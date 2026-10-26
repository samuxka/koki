import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Headers, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderInput, CreatePaymentInput, UpdateOrderStatusInput } from '@koki/validation';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly stripeService: StripeService,
  ) {}

  @ApiOperation({ summary: 'Listar pedidos com filtros combináveis e paginação' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('operationalStatus') operationalStatus?: string,
    @Query('financialStatus') financialStatus?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.ordersService.findAll(
      company._id,
      operationalStatus,
      financialStatus,
      search,
      startDate,
      endDate,
      customerId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @ApiOperation({ summary: 'Obter detalhes do pedido e histórico de pagamentos' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.ordersService.findById(company._id, id);
  }

  @ApiOperation({ summary: 'Criar novo pedido com múltiplos produtos e pagamento opcional' })
  @Post()
  async create(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Body() input: CreateOrderInput,
  ) {
    const order = await this.ordersService.create(company._id, input, user?.id);
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalAmountCents: order.totalAmountCents,
      paidAmountCents: order.paidAmountCents,
      remainingAmountCents: order.remainingAmountCents,
      operationalStatus: order.operationalStatus,
      financialStatus: order.financialStatus,
      deliveryDate: order.deliveryDate,
    };
  }

  @ApiOperation({ summary: 'Atualizar status operacional ou financeiro do pedido' })
  @Patch(':id/status')
  async updateStatus(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateOrderStatusInput,
  ) {
    const updated = await this.ordersService.updateStatus(company._id, id, input);
    return {
      id: updated._id.toString(),
      orderNumber: updated.orderNumber,
      operationalStatus: updated.operationalStatus,
      financialStatus: updated.financialStatus,
    };
  }

  @ApiOperation({ summary: 'Registrar pagamento (parcial ou total) para o pedido' })
  @Post(':id/payments')
  async addPayment(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() input: CreatePaymentInput,
  ) {
    const result = await this.ordersService.addPayment(company._id, id, input, user?.id);
    return {
      payment: {
        id: result.payment._id.toString(),
        amountCents: result.payment.amountCents,
        paymentMethod: result.payment.paymentMethod,
        receiptUrl: result.payment.receiptUrl,
        paidAt: result.payment.paidAt,
      },
      order: {
        id: result.order._id.toString(),
        paidAmountCents: result.order.paidAmountCents,
        remainingAmountCents: result.order.remainingAmountCents,
        financialStatus: result.order.financialStatus,
      },
    };
  }

  @ApiOperation({ summary: 'Cancelar pedido' })
  @Delete(':id')
  async cancel(@CurrentCompany() company: any, @Param('id') id: string) {
    await this.ordersService.cancel(company._id, id);
    return { success: true, message: 'Pedido cancelado com sucesso' };
  }

  @ApiOperation({ summary: 'Gerar link de pagamento seguro da Stripe para o pedido' })
  @Post(':id/payment-link')
  async generatePaymentLink(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.stripeService.generatePaymentLink(company._id, id);
  }

  @Public()
  @ApiOperation({ summary: 'Webhook de pagamentos da Stripe' })
  @Post('stripe/webhook')
  async stripeWebhook(@Body() payload: any, @Headers('stripe-signature') signature?: string) {
    return this.stripeService.handleWebhook(payload, signature);
  }

  @Public()
  @ApiOperation({ summary: 'Página de confirmação de pagamento Stripe' })
  @Get('payment/success')
  async paymentSuccess(
    @Query('session_id') sessionId: string,
    @Query('order_id') orderId: string,
    @Res() res: any,
  ) {
    let orderNumber: number | string = '';
    let customerName = '';
    let amountFormatted = '';

    if (sessionId) {
      try {
        const result = await this.stripeService.verifyAndConfirmSession(sessionId);
        if (result) {
          orderNumber = result.orderNumber;
          customerName = result.customerName;
          amountFormatted = (result.amountPaidCents / 100).toFixed(2) + ' €';
        }
      } catch (err: any) {
        // proceed to display confirmation
      }
    }

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Confirmado - Bris Pastelaria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #fff6e9;
      color: #33220A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      padding: 36px 24px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(102, 60, 0, 0.08);
      border: 1px solid #e8d7c3;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      background-color: #eafaf1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: #009933;
      font-size: 38px;
      line-height: 1;
    }
    .brand-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #cc9a52;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #33220A;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      color: #6b543e;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .order-box {
      background: #fdfaf6;
      border: 1px dashed #cc9a52;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .order-row:last-child {
      margin-bottom: 0;
      padding-top: 8px;
      border-top: 1px solid #f0e0cc;
      font-weight: 700;
      color: #009933;
      font-size: 15px;
    }
    .btn {
      display: block;
      background: #663c00;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 12px;
      transition: background 0.2s;
    }
    .btn:hover { background: #4d2d00; }
    .footer-note {
      font-size: 11px;
      color: #9e8570;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">✓</div>
    <div class="brand-name">BRIS • PASTELARIA</div>
    <h1>Pagamento Confirmado!</h1>
    <p class="subtitle">
      Recebemos o seu pagamento com sucesso via Stripe. A nossa equipa já foi notificada e está a preparar a sua encomenda com todo o carinho!
    </p>

    <div class="order-box">
      ${orderNumber ? `<div class="order-row"><span>Número do Pedido:</span><b>#${orderNumber}</b></div>` : ''}
      ${customerName ? `<div class="order-row"><span>Cliente:</span><b>${customerName}</b></div>` : ''}
      <div class="order-row"><span>Status:</span><b style="color: #009933;">100% Pago</b></div>
      ${amountFormatted ? `<div class="order-row"><span>Valor Pago:</span><b>${amountFormatted}</b></div>` : ''}
    </div>

    <a href="https://bris-website.vercel.app/" class="btn">
      Voltar para a Loja Online
    </a>

    <div class="footer-note">
      🔒 Processamento seguro via Stripe Payments & Tax
    </div>
  </div>
</body>
</html>`;

    res.type('html').send(html);
  }

  @Public()
  @ApiOperation({ summary: 'Página de cancelamento de pagamento Stripe' })
  @Get('payment/cancel')
  paymentCancel(@Query('order_id') orderId: string, @Res() res: any) {
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Não Concluído - Bris Pastelaria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #fff6e9;
      color: #33220A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      padding: 36px 24px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      border: 1px solid #e8d7c3;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      background-color: #fbeae9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: #c2312a;
      font-size: 32px;
    }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
    p { font-size: 14px; color: #6b543e; line-height: 1.5; margin-bottom: 24px; }
    .btn {
      display: block;
      background: #663c00;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      padding: 14px 20px;
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">✕</div>
    <h1>Pagamento Cancelado</h1>
    <p>O processo de pagamento foi cancelado. Se desejar, você pode solicitar um novo link de pagamento ou tentar novamente.</p>
    <a href="https://bris-website.vercel.app/" class="btn">Voltar para a Loja</a>
  </div>
</body>
</html>`;
    res.type('html').send(html);
  }
}
