import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Headers, UseGuards } from '@nestjs/common';
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
}
