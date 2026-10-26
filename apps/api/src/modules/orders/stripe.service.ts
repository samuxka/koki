import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Order, OrderDocument } from './schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { CashAccount, CashAccountDocument } from '../cashflow/schemas/cash-account.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CashflowService } from '../cashflow/cashflow.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripeClient: Stripe | null = null;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(CashAccount.name) private cashAccountModel: Model<CashAccountDocument>,
    private cashflowService: CashflowService,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey && !secretKey.startsWith('mock_')) {
      try {
        this.stripeClient = new Stripe(secretKey, {
          apiVersion: '2025-01-27.acacia' as any,
        });
        this.logger.log('Stripe client inicializado com sucesso.');
      } catch (err: any) {
        this.logger.error(`Falha ao inicializar Stripe: ${err.message}`);
      }
    } else {
      this.logger.warn('STRIPE_SECRET_KEY não configurada no ambiente. Modo de simulação de links ativo.');
    }
  }

  async generatePaymentLink(companyId: string | Types.ObjectId, orderId: string) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const orderObjectId = new Types.ObjectId(orderId);

    const [order, company] = await Promise.all([
      this.orderModel.findOne({
        _id: orderObjectId,
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      }),
      this.companyModel.findById(companyObjectId),
    ]);

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    if (order.financialStatus === 'paid' || order.remainingAmountCents <= 0) {
      throw new BadRequestException('Este pedido já está totalmente quitado.');
    }

    const customer = await this.customerModel.findById(order.customerId);
    const currency = (company.currency || 'EUR').toLowerCase();
    const amountCents = order.remainingAmountCents;

    // Check if there is an active Stripe client
    if (this.stripeClient) {
      try {
        const lineItemDescription =
          order.items && order.items.length > 0
            ? `Itens: ${order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ').slice(0, 200)}`
            : `Pagamento do pedido #${order.orderNumber}. Cliente: ${order.customerName}`;

        const baseSessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: `Pedido #${order.orderNumber} - ${company.tradeName}`,
                  description: lineItemDescription,
                },
                unit_amount: amountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber.toString(),
            companyId: company._id.toString(),
          },
          client_reference_id: order._id.toString(),
          customer_email: customer?.email || undefined,
          tax_id_collection: { enabled: true },
          phone_number_collection: { enabled: true },
          success_url: `https://checkout.stripe.com/success?order=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `https://checkout.stripe.com/cancel?order=${order.orderNumber}`,
        };

        let session: Stripe.Checkout.Session;
        try {
          // Stripe Tax automatically calculates IVA / sales tax
          session = await this.stripeClient.checkout.sessions.create({
            ...baseSessionParams,
            automatic_tax: { enabled: true },
          });
        } catch (taxErr: any) {
          this.logger.warn(`Stripe Tax fallback: ${taxErr.message}`);
          session = await this.stripeClient.checkout.sessions.create(baseSessionParams);
        }

        const paymentUrl = session.url || `https://checkout.stripe.com/c/pay/${session.id}`;

        order.stripePaymentLinkUrl = paymentUrl;
        order.stripeSessionId = session.id;
        await order.save();

        return {
          paymentUrl,
          sessionId: session.id,
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          remainingAmountCents: amountCents,
          currency: company.currency || 'EUR',
          customerName: order.customerName,
          customerPhone: order.customerPhone || customer?.phone,
        };
      } catch (err: any) {
        this.logger.error(`Erro ao criar sessão na Stripe: ${err.message}`, err.stack);
        throw new BadRequestException(`Erro ao conectar com a Stripe: ${err.message}`);
      }
    } else {
      // Sandbox / dev simulation fallback if STRIPE_SECRET_KEY is not yet defined
      const simulatedSessionId = `cs_test_${order._id.toString().slice(-8)}_${Date.now()}`;
      const simulatedUrl = `https://checkout.stripe.com/pay/${simulatedSessionId}#order-${order.orderNumber}`;

      order.stripePaymentLinkUrl = simulatedUrl;
      order.stripeSessionId = simulatedSessionId;
      await order.save();

      return {
        paymentUrl: simulatedUrl,
        sessionId: simulatedSessionId,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        remainingAmountCents: amountCents,
        currency: company.currency || 'EUR',
        customerName: order.customerName,
        customerPhone: order.customerPhone,
      };
    }
  }

  async handleWebhook(rawBody: any, signature?: string) {
    let event: any = rawBody;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (this.stripeClient && webhookSecret && signature) {
      try {
        event = this.stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err: any) {
        this.logger.error(`Webhook signature verification failed: ${err.message}`);
        throw new BadRequestException(`Webhook Error: ${err.message}`);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object as Stripe.Checkout.Session;
      if (!session) return { received: true };

      const orderId = session.metadata?.orderId;
      const companyId = session.metadata?.companyId;

      if (orderId && companyId) {
        await this.confirmStripePayment(companyId, orderId, session);
      }
    }

    return { received: true };
  }

  private async confirmStripePayment(
    companyId: string,
    orderId: string,
    session: Stripe.Checkout.Session,
  ) {
    const companyObjectId = new Types.ObjectId(companyId);
    const orderObjectId = new Types.ObjectId(orderId);

    const order = await this.orderModel.findOne({
      _id: orderObjectId,
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!order || order.financialStatus === 'paid') {
      return;
    }

    // Find destination cash account (e.g. Bank or first available)
    let cashAccount = await this.cashAccountModel.findOne({
      companyId: companyObjectId,
      deletedAt: { $exists: false },
      type: { $in: ['bank', 'cash'] },
    });

    if (!cashAccount) {
      cashAccount = await this.cashAccountModel.findOne({
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });
    }

    if (!cashAccount) {
      this.logger.warn(`Empresa ${companyId} sem caixinha de destino para pagamento Stripe`);
      return;
    }

    const amountPaidCents = session.amount_total || order.remainingAmountCents;
    const idempotencyKey = `stripe-${session.id}`;

    // Check if already registered
    const existingPayment = await this.paymentModel.findOne({ idempotencyKey });
    if (existingPayment) {
      return;
    }

    const payment = await this.paymentModel.create({
      companyId: companyObjectId,
      orderId: orderObjectId,
      cashAccountId: cashAccount._id,
      amountCents: amountPaidCents,
      paymentMethod: 'card',
      receiptUrl: (session as any).url || `https://dashboard.stripe.com/payments/${session.payment_intent}`,
      paidAt: new Date(),
      idempotencyKey,
    });

    const cashTx = await this.cashflowService.registerOrderIncome(
      companyObjectId,
      cashAccount._id,
      orderObjectId,
      payment._id,
      order.orderNumber,
      amountPaidCents,
      idempotencyKey,
    );

    payment.cashTransactionId = cashTx._id;
    await payment.save();

    const newPaidAmountCents = order.paidAmountCents + amountPaidCents;
    const newRemainingAmountCents = Math.max(0, order.totalAmountCents - newPaidAmountCents);
    const newFinancialStatus = newRemainingAmountCents === 0 ? 'paid' : 'partial';

    order.paidAmountCents = newPaidAmountCents;
    order.remainingAmountCents = newRemainingAmountCents;
    order.financialStatus = newFinancialStatus;
    await order.save();

    this.logger.log(
      `Pagamento Stripe de ${(amountPaidCents / 100).toFixed(2)} processado com sucesso para pedido #${order.orderNumber}`,
    );
  }
}
