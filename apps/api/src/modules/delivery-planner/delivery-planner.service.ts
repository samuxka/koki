import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeliveryItem, DeliveryItemDocument } from './schemas/delivery-item.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  CreateDeliveryItemInput,
  UpdateDeliveryItemInput,
  UpdateDeliveryStatusInput,
} from '@koki/validation';
import {
  DailyDeliveryPlan,
  DeliveryItem as IDeliveryItem,
  DeliveryStatus,
  DeliveryShift,
} from '@koki/types';

@Injectable()
export class DeliveryPlannerService {
  constructor(
    @InjectModel(DeliveryItem.name)
    private deliveryModel: Model<DeliveryItemDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapDelivery(doc: DeliveryItemDocument): IDeliveryItem {
    const raw = doc.toObject ? doc.toObject() : doc;
    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      date: raw.date,
      orderId: raw.orderId ? raw.orderId.toString() : undefined,
      orderNumber: raw.orderNumber,
      customerName: raw.customerName,
      customerPhone: raw.customerPhone,
      address: {
        street: raw.address?.street,
        number: raw.address?.number,
        complement: raw.address?.complement,
        neighborhood: raw.address?.neighborhood,
        city: raw.address?.city,
        postalCode: raw.address?.postalCode,
        formattedAddress: raw.address?.formattedAddress,
      },
      shift: raw.shift || 'morning',
      scheduledTime: raw.scheduledTime,
      deliveryFeeCents: raw.deliveryFeeCents || 0,
      remainingAmountCents: raw.remainingAmountCents || 0,
      financialStatus: raw.financialStatus || 'unpaid',
      status: raw.status || 'pending',
      deliveredAt: raw.deliveredAt ? new Date(raw.deliveredAt).toISOString() : undefined,
      driverName: raw.driverName,
      notes: raw.notes,
      orderItemsCount: raw.orderItemsCount || 1,
      itemsSummary: raw.itemsSummary,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  private buildFormattedAddress(addr?: any): string {
    if (!addr) return '';
    const parts: string[] = [];
    if (addr.street) {
      parts.push(addr.street + (addr.number ? `, ${addr.number}` : ''));
    }
    if (addr.complement) parts.push(addr.complement);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(addr.city);
    if (addr.postalCode) parts.push(addr.postalCode);
    return parts.join(' - ');
  }

  /**
   * Obtém o plano diário de entregas (com sincronização automática de pedidos agendados)
   */
  async getDailyDeliveries(companyId: string | Types.ObjectId, dateStr?: string): Promise<DailyDeliveryPlan> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : new Date().toISOString().split('T')[0];

    // Janela ampla de 24h para cobrir qualquer fuso horário
    const [year, month, day] = targetDate.split('-').map(Number);
    const windowStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    windowStart.setHours(windowStart.getHours() - 14);

    const windowEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    windowEnd.setHours(windowEnd.getHours() + 14);

    // 1. Buscar pedidos com método "delivery" agendados para este dia
    const rawOrders = await this.orderModel
      .find({
        companyId: companyObjectId,
        deletedAt: { $exists: false },
        operationalStatus: { $ne: 'canceled' },
        deliveryMethod: 'delivery',
        deliveryDate: { $gte: windowStart, $lte: windowEnd },
      })
      .sort({ deliveryDate: 1, orderNumber: 1 })
      .exec();

    const matchingOrders = rawOrders.filter((o) => {
      if (!o.deliveryDate) return false;
      const isoDate = o.deliveryDate.toISOString().split('T')[0];
      const ly = o.deliveryDate.getFullYear();
      const lm = String(o.deliveryDate.getMonth() + 1).padStart(2, '0');
      const ld = String(o.deliveryDate.getDate()).padStart(2, '0');
      const localDate = `${ly}-${lm}-${ld}`;
      return isoDate === targetDate || localDate === targetDate;
    });

    // 2. Para cada pedido de entrega, verificar se já existe DeliveryItem; se não existir, auto-sincronizar
    if (matchingOrders.length > 0) {
      const existingDeliveries = await this.deliveryModel
        .find({
          companyId: companyObjectId,
          date: targetDate,
          deletedAt: { $exists: false },
        })
        .select('orderId')
        .exec();

      const existingOrderIds = new Set(
        existingDeliveries.map((d) => (d.orderId ? d.orderId.toString() : '')),
      );

      const customerIds = matchingOrders.map((o) => o.customerId);
      const customers = await this.customerModel
        .find({ _id: { $in: customerIds } })
        .exec();

      const customerMap = new Map<string, CustomerDocument>();
      customers.forEach((c) => customerMap.set(c._id.toString(), c));

      for (const order of matchingOrders) {
        if (!existingOrderIds.has(order._id.toString())) {
          const customer = customerMap.get(order.customerId.toString());
          const addr = customer?.address || {};
          const formattedAddress = this.buildFormattedAddress(addr);

          // Resumo dos itens
          const itemsSummary = (order.items || [])
            .map((it) => `${it.quantity}x ${it.productName}${it.flavor ? ` (${it.flavor})` : ''}`)
            .join(', ');

          // Inferir turno a partir da hora da entrega
          let shift: DeliveryShift = 'morning';
          if (order.deliveryDate) {
            const hour = order.deliveryDate.getHours();
            if (hour >= 12 && hour < 18) {
              shift = 'afternoon';
            } else if (hour >= 18) {
              shift = 'evening';
            }
          }

          let scheduledTime: string | undefined;
          if (order.deliveryDate) {
            const h = String(order.deliveryDate.getHours()).padStart(2, '0');
            const m = String(order.deliveryDate.getMinutes()).padStart(2, '0');
            if (h !== '00' || m !== '00') {
              scheduledTime = `${h}:${m}`;
            }
          }

          await this.deliveryModel.create({
            companyId: companyObjectId,
            date: targetDate,
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone || customer?.phone,
            address: {
              street: addr.street,
              number: addr.number,
              complement: addr.complement,
              neighborhood: addr.neighborhood,
              city: addr.city,
              postalCode: addr.postalCode,
              formattedAddress,
            },
            shift,
            scheduledTime,
            deliveryFeeCents: order.deliveryFeeCents || 0,
            remainingAmountCents: order.remainingAmountCents || 0,
            financialStatus: order.financialStatus,
            status: order.operationalStatus === 'delivered' ? 'delivered' : 'pending',
            orderItemsCount: (order.items || []).reduce((s, it) => s + it.quantity, 0),
            itemsSummary,
            notes: order.notes,
          });
        }
      }
    }

    // 3. Buscar todas as entregas do dia
    const deliveryDocs = await this.deliveryModel
      .find({
        companyId: companyObjectId,
        date: targetDate,
        deletedAt: { $exists: false },
      })
      .sort({ scheduledTime: 1, createdAt: 1 })
      .exec();

    const mappedDeliveries = deliveryDocs.map((d) => this.mapDelivery(d));

    // 4. Agrupamento por turnos
    const deliveriesByShift = {
      morning: mappedDeliveries.filter((d) => d.shift === 'morning'),
      afternoon: mappedDeliveries.filter((d) => d.shift === 'afternoon'),
      evening: mappedDeliveries.filter((d) => d.shift === 'evening'),
      anytime: mappedDeliveries.filter((d) => d.shift === 'anytime'),
    };

    // 5. Cálculos de totais e valores a receber
    const totalDeliveriesCount = mappedDeliveries.length;
    const completedDeliveriesCount = mappedDeliveries.filter((d) => d.status === 'delivered').length;
    const totalDeliveryFeesCents = mappedDeliveries.reduce((sum, d) => sum + d.deliveryFeeCents, 0);

    // Valor pendente de cobrança na entrega (apenas pedidos unpaid ou partial)
    const totalAmountToCollectCents = mappedDeliveries.reduce((sum, d) => {
      if (d.financialStatus !== 'paid' && d.status !== 'delivered') {
        return sum + d.remainingAmountCents;
      }
      return sum;
    }, 0);

    // 6. Contagem de entregas no mês para validação de limites de plano
    const [y, m] = targetDate.split('-');
    const monthPrefix = `${y}-${m}`;
    const monthlyDeliveriesCount = await this.deliveryModel.countDocuments({
      companyId: companyObjectId,
      date: { $regex: `^${monthPrefix}` },
      deletedAt: { $exists: false },
    });

    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const monthlyLimit = entitlements.limits.monthlyDeliveryOrdersLimit;

    return {
      date: targetDate,
      totalDeliveriesCount,
      completedDeliveriesCount,
      totalDeliveryFeesCents,
      totalAmountToCollectCents,
      deliveriesByShift,
      deliveries: mappedDeliveries,
      monthlyDeliveriesCount,
      monthlyLimit,
    };
  }

  /**
   * Criação manual de entrega / parada de rota
   */
  async createDelivery(companyId: string | Types.ObjectId, input: CreateDeliveryItemInput): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Checagem de limites SaaS
    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const limit = entitlements.limits.monthlyDeliveryOrdersLimit;

    if (limit !== -1) {
      const [y, m] = input.date.split('-');
      const monthPrefix = `${y}-${m}`;
      const currentMonthCount = await this.deliveryModel.countDocuments({
        companyId: companyObjectId,
        date: { $regex: `^${monthPrefix}` },
        deletedAt: { $exists: false },
      });

      if (limit === 0) {
        throw new BadRequestException(
          'O Planejador de Entregas é exclusivo dos planos Pro e Business. Faça o upgrade para gerenciar suas rotas.',
        );
      }

      if (currentMonthCount >= limit) {
        throw new BadRequestException(
          `Você atingiu o limite de ${limit} entregas planejadas neste mês no plano ${entitlements.planCode.toUpperCase()}. Faça upgrade para o plano Business para entregas ilimitadas.`,
        );
      }
    }

    const formattedAddress =
      input.address?.formattedAddress || this.buildFormattedAddress(input.address);

    const created = await this.deliveryModel.create({
      companyId: companyObjectId,
      date: input.date,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined,
      orderNumber: input.orderNumber,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim(),
      address: {
        ...input.address,
        formattedAddress,
      },
      shift: input.shift || 'morning',
      scheduledTime: input.scheduledTime?.trim(),
      deliveryFeeCents: input.deliveryFeeCents || 0,
      remainingAmountCents: input.remainingAmountCents || 0,
      financialStatus: input.financialStatus || 'unpaid',
      status: input.status || 'pending',
      driverName: input.driverName?.trim(),
      notes: input.notes?.trim(),
      orderItemsCount: input.orderItemsCount || 1,
      itemsSummary: input.itemsSummary?.trim(),
    });

    return this.mapDelivery(created);
  }

  /**
   * Atualização de dados da entrega
   */
  async updateDelivery(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateDeliveryItemInput,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    if (input.customerName !== undefined) delivery.customerName = input.customerName.trim();
    if (input.customerPhone !== undefined) delivery.customerPhone = input.customerPhone.trim();
    if (input.shift !== undefined) delivery.shift = input.shift;
    if (input.scheduledTime !== undefined) delivery.scheduledTime = input.scheduledTime.trim();
    if (input.driverName !== undefined) delivery.driverName = input.driverName.trim();
    if (input.notes !== undefined) delivery.notes = input.notes.trim();
    if (input.deliveryFeeCents !== undefined) delivery.deliveryFeeCents = input.deliveryFeeCents;
    if (input.remainingAmountCents !== undefined) delivery.remainingAmountCents = input.remainingAmountCents;

    if (input.address) {
      delivery.address = {
        ...input.address,
        formattedAddress:
          input.address.formattedAddress || this.buildFormattedAddress(input.address),
      };
    }

    await delivery.save();
    return this.mapDelivery(delivery);
  }

  /**
   * Atualização de status da entrega (Pendente -> Em Rota -> Entregue -> Não Entregue)
   */
  async updateDeliveryStatus(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateDeliveryStatusInput,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    delivery.status = input.status;
    if (input.status === 'delivered') {
      delivery.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : new Date();

      // Sincronizar com o pedido: se entregue, avança o status operacional do pedido também!
      if (delivery.orderId) {
        await this.orderModel.updateOne(
          { _id: delivery.orderId, companyId: companyObjectId },
          { operationalStatus: 'delivered' },
        );
      }
    } else if (input.status === 'out_for_delivery') {
      if (delivery.orderId) {
        await this.orderModel.updateOne(
          { _id: delivery.orderId, companyId: companyObjectId },
          { operationalStatus: 'ready' },
        );
      }
    }

    if (input.notes !== undefined) {
      delivery.notes = input.notes.trim();
    }

    await delivery.save();
    return this.mapDelivery(delivery);
  }

  /**
   * Atribuição de entregador
   */
  async assignDriver(
    companyId: string | Types.ObjectId,
    id: string,
    driverName: string,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    delivery.driverName = driverName.trim();
    await delivery.save();

    return this.mapDelivery(delivery);
  }

  /**
   * Exclusão da entrega
   */
  async deleteDelivery(companyId: string | Types.ObjectId, id: string): Promise<{ success: boolean }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const result = await this.deliveryModel.updateOne(
      { _id: new Types.ObjectId(id), companyId: companyObjectId },
      { deletedAt: new Date() },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Entrega não encontrada');
    }

    return { success: true };
  }
}
