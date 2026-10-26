import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CashflowService } from '../cashflow/cashflow.service';
import { CouponsService } from '../coupons/coupons.service';
import { StripeService } from './stripe.service';
import { CreateOrderInput, CreatePaymentInput, UpdateOrderStatusInput } from '@koki/validation';
import { calculateOrderTotals } from '../../common/utils/currency.utils';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cashflowService: CashflowService,
    @Optional() private couponsService?: CouponsService,
    @Optional() private stripeService?: StripeService,
  ) {}

  async create(companyId: string | Types.ObjectId, input: CreateOrderInput, userId?: string): Promise<OrderDocument> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const customerObjectId = new Types.ObjectId(input.customerId);

    // 1. Validate Customer
    const customer = await this.customerModel.findOne({
      _id: customerObjectId,
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });
    if (!customer) {
      throw new NotFoundException('Cliente selecionado não foi encontrado');
    }

    // 2. Next sequential order number for this company
    const lastOrder = await this.orderModel
      .findOne({ companyId: companyObjectId })
      .sort({ orderNumber: -1 })
      .select('orderNumber')
      .exec();
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // 3. Process items and freeze price snapshots
    const processedItems = input.items.map((item) => {
      const subtotalCents = Math.round(item.unitPriceCents * item.quantity);
      return {
        productId: new Types.ObjectId(item.productId),
        productName: item.productName.trim(),
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        subtotalCents,
        flavor: item.flavor?.trim(),
        complements: item.complements || [],
        notes: item.notes?.trim(),
      };
    });

    // 4. Calculate Totals
    const { totalAmountCents } = calculateOrderTotals(
      processedItems,
      input.discountCents || 0,
      input.deliveryFeeCents || 0,
    );

    const initialPaidCents = input.initialPayment ? input.initialPayment.amountCents : 0;
    if (initialPaidCents > totalAmountCents) {
      throw new BadRequestException('O pagamento inicial não pode exceder o total do pedido');
    }

    const remainingAmountCents = Math.max(0, totalAmountCents - initialPaidCents);
    const financialStatus =
      initialPaidCents >= totalAmountCents
        ? 'paid'
        : initialPaidCents > 0
        ? 'partial'
        : 'unpaid';

    // 5. Create Order
    const order = await this.orderModel.create({
      companyId: companyObjectId,
      orderNumber,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: processedItems,
      discountCents: input.discountCents || 0,
      couponCode: input.couponCode?.trim()?.toUpperCase() || undefined,
      couponId: input.couponId ? new Types.ObjectId(input.couponId) : undefined,
      deliveryFeeCents: input.deliveryFeeCents || 0,
      totalAmountCents,
      paidAmountCents: initialPaidCents,
      remainingAmountCents,
      operationalStatus: 'pending',
      financialStatus,
      deliveryDate: new Date(input.deliveryDate),
      deliveryMethod: input.deliveryMethod || 'pickup',
      notes: input.notes?.trim(),
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // 5.1 Increment coupon usage if a coupon was redeemed
    if (order.couponId && this.couponsService) {
      await this.couponsService
        .incrementUsage(companyObjectId, order.couponId, customer._id)
        .catch(() => {});
    }

    // 6. Handle Initial Payment if present
    if (input.initialPayment && initialPaidCents > 0) {
      const cashAccountObjectId = new Types.ObjectId(input.initialPayment.cashAccountId);
      const payment = await this.paymentModel.create({
        companyId: companyObjectId,
        orderId: order._id,
        cashAccountId: cashAccountObjectId,
        amountCents: initialPaidCents,
        paymentMethod: input.initialPayment.paymentMethod,
        paidAt: new Date(),
        createdBy: userId ? new Types.ObjectId(userId) : undefined,
      });

      const cashTx = await this.cashflowService.registerOrderIncome(
        companyObjectId,
        cashAccountObjectId,
        order._id,
        payment._id,
        orderNumber,
        initialPaidCents,
        undefined,
        userId ? new Types.ObjectId(userId) : undefined,
      );

      payment.cashTransactionId = cashTx._id;
      await payment.save();
    }

    // 7. Update Customer Statistics
    await this.customerModel.findByIdAndUpdate(customer._id, {
      $inc: {
        totalOrdersCount: 1,
        totalSpentCents: totalAmountCents,
      },
    });

    // 8. Update Product Statistics
    for (const item of processedItems) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: {
          totalOrdersCount: 1,
          totalUnitsSold: item.quantity,
          totalRevenueCents: item.subtotalCents,
        },
      });
    }

    return order;
  }

  async findAll(
    companyId: string | Types.ObjectId,
    operationalStatus?: string,
    financialStatus?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
    customerId?: string,
    page = 1,
    limit = 20,
  ) {
    const filter: Record<string, any> = {
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    };

    if (operationalStatus && operationalStatus !== 'all') {
      filter.operationalStatus = operationalStatus;
    }

    if (financialStatus && financialStatus !== 'all') {
      filter.financialStatus = financialStatus;
    }

    if (customerId) {
      filter.customerId = new Types.ObjectId(customerId);
    }

    if (startDate || endDate) {
      filter.deliveryDate = {};
      if (startDate) filter.deliveryDate.$gte = new Date(startDate);
      if (endDate) filter.deliveryDate.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const searchNum = parseInt(search.trim(), 10);
      filter.$or = [
        { customerName: { $regex: search.trim(), $options: 'i' } },
        { customerPhone: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
        ...(!isNaN(searchNum) ? [{ orderNumber: searchNum }] : []),
      ];
    }

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ deliveryDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      items: orders.map((o) => ({
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        customerId: o.customerId.toString(),
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        items: o.items.map((i) => ({
          productId: i.productId.toString(),
          productName: i.productName,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          subtotalCents: i.subtotalCents,
          notes: i.notes,
        })),
        discountCents: o.discountCents,
        couponCode: (o as any).couponCode,
        couponId: (o as any).couponId?.toString(),
        deliveryFeeCents: o.deliveryFeeCents,
        totalAmountCents: o.totalAmountCents,
        paidAmountCents: o.paidAmountCents,
        remainingAmountCents: o.remainingAmountCents,
        operationalStatus: o.operationalStatus,
        financialStatus: o.financialStatus,
        deliveryDate: o.deliveryDate.toISOString(),
        deliveryMethod: o.deliveryMethod,
        notes: o.notes,
        createdAt: (o as any).createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(companyId: string | Types.ObjectId, id: string) {
    if (this.stripeService) {
      await this.stripeService.syncOrderPaymentStatus(companyId, id);
    }

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const payments = await this.paymentModel
      .find({ orderId: order._id })
      .populate('cashAccountId', 'name icon color')
      .sort({ paidAt: -1 })
      .exec();

    return {
      order: {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        customerId: order.customerId.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items: order.items.map((i) => ({
          productId: i.productId.toString(),
          productName: i.productName,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          subtotalCents: i.subtotalCents,
          flavor: i.flavor,
          complements: i.complements || [],
          notes: i.notes,
        })),
        discountCents: order.discountCents,
        couponCode: (order as any).couponCode,
        couponId: (order as any).couponId?.toString(),
        deliveryFeeCents: order.deliveryFeeCents,
        totalAmountCents: order.totalAmountCents,
        paidAmountCents: order.paidAmountCents,
        remainingAmountCents: order.remainingAmountCents,
        operationalStatus: order.operationalStatus,
        financialStatus: order.financialStatus,
        deliveryDate: order.deliveryDate.toISOString(),
        deliveryMethod: order.deliveryMethod,
        notes: order.notes,
        stripePaymentLinkUrl: order.stripePaymentLinkUrl,
        stripeSessionId: order.stripeSessionId,
        createdAt: (order as any).createdAt,
      },
      payments: payments.map((p) => ({
        id: p._id.toString(),
        amountCents: p.amountCents,
        paymentMethod: p.paymentMethod,
        cashAccountId: p.cashAccountId?._id?.toString() || (p.cashAccountId as any)?.toString(),
        cashAccountName: (p.cashAccountId as any)?.name,
        receiptUrl: p.receiptUrl,
        paidAt: p.paidAt.toISOString(),
      })),
    };
  }

  async updateStatus(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateOrderStatusInput,
  ): Promise<OrderDocument> {
    const updateData: Record<string, any> = {};
    if (input.operationalStatus) updateData.operationalStatus = input.operationalStatus;
    if (input.financialStatus) updateData.financialStatus = input.financialStatus;

    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      { $set: updateData },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return order;
  }

  async addPayment(
    companyId: string | Types.ObjectId,
    orderId: string,
    input: CreatePaymentInput,
    userId?: string,
  ) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const orderObjectId = new Types.ObjectId(orderId);

    const order = await this.orderModel.findOne({
      _id: orderObjectId,
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (order.financialStatus === 'paid') {
      throw new BadRequestException('Este pedido já está totalmente quitado');
    }

    if (input.amountCents > order.remainingAmountCents) {
      throw new BadRequestException(
        `O valor informado ultrapassa o saldo restante de ${order.remainingAmountCents / 100}€`,
      );
    }

    // Idempotency check
    if (input.idempotencyKey) {
      const existing = await this.paymentModel.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return { payment: existing, order };
      }
    }

    const cashAccountObjectId = new Types.ObjectId(input.cashAccountId);
    const payment = await this.paymentModel.create({
      companyId: companyObjectId,
      orderId: orderObjectId,
      cashAccountId: cashAccountObjectId,
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      receiptUrl: input.receiptUrl,
      paidAt: new Date(),
      idempotencyKey: input.idempotencyKey,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Credit cash account and record transaction
    const cashTx = await this.cashflowService.registerOrderIncome(
      companyObjectId,
      cashAccountObjectId,
      orderObjectId,
      payment._id,
      order.orderNumber,
      input.amountCents,
      input.idempotencyKey,
      userId ? new Types.ObjectId(userId) : undefined,
    );

    payment.cashTransactionId = cashTx._id;
    await payment.save();

    // Update Order amounts
    const newPaidAmountCents = order.paidAmountCents + input.amountCents;
    const newRemainingAmountCents = Math.max(0, order.totalAmountCents - newPaidAmountCents);
    const newFinancialStatus =
      newRemainingAmountCents === 0 ? 'paid' : newPaidAmountCents > 0 ? 'partial' : 'unpaid';

    order.paidAmountCents = newPaidAmountCents;
    order.remainingAmountCents = newRemainingAmountCents;
    order.financialStatus = newFinancialStatus;
    await order.save();

    return { payment, order };
  }

  async cancel(companyId: string | Types.ObjectId, id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      { $set: { operationalStatus: 'canceled' } },
      { new: true },
    );
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return order;
  }
}
