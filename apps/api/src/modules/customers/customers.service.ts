import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreateCustomerInput, LoyaltyCardInput } from '@koki/validation';
import { CustomerSortBy, CustomerFilterType } from '@koki/types';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
  ) {}

  async findAll(
    companyId: string | Types.ObjectId,
    search?: string,
    sortBy: CustomerSortBy = 'ranking',
    filterType: CustomerFilterType = 'all',
    page = 1,
    limit = 50,
  ) {
    const filter: Record<string, any> = {
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    };

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { notes: { $regex: term, $options: 'i' } },
        { 'address.street': { $regex: term, $options: 'i' } },
        { 'address.city': { $regex: term, $options: 'i' } },
        { 'address.neighborhood': { $regex: term, $options: 'i' } },
      ];
    }

    if (filterType === 'with_orders') {
      filter.totalOrdersCount = { $gt: 0 };
    } else if (filterType === 'without_orders') {
      filter.totalOrdersCount = 0;
    } else if (filterType === 'loyalty_active') {
      filter['loyaltyCard.enabled'] = true;
    }

    let sortQuery: Record<string, 1 | -1> = { totalSpentCents: -1, name: 1 };
    if (sortBy === 'orders') {
      sortQuery = { totalOrdersCount: -1, totalSpentCents: -1 };
    } else if (sortBy === 'newest') {
      sortQuery = { createdAt: -1 };
    } else if (sortBy === 'oldest') {
      sortQuery = { createdAt: 1 };
    } else if (sortBy === 'name') {
      sortQuery = { name: 1 };
    } else if (sortBy === 'ranking') {
      sortQuery = { totalSpentCents: -1, totalOrdersCount: -1 };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.customerModel.find(filter).sort(sortQuery).skip(skip).limit(limit).exec(),
      this.customerModel.countDocuments(filter),
    ]);

    return {
      items: items.map((c) => {
        const targetOrders = c.loyaltyCard?.targetOrders || 10;
        const currentOrders = (c.totalOrdersCount || 0) % targetOrders;
        const progressPercent = Math.min(100, Math.round((currentOrders / targetOrders) * 100));

        return {
          id: c._id.toString(),
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          notes: c.notes,
          photoUrl: c.photoUrl,
          loyaltyCard: {
            enabled: !!c.loyaltyCard?.enabled,
            targetOrders,
            reward: c.loyaltyCard?.reward || '',
            currentOrders,
            progressPercent,
            completedCycles: Math.floor((c.totalOrdersCount || 0) / targetOrders),
          },
          totalOrdersCount: c.totalOrdersCount || 0,
          totalSpentCents: c.totalSpentCents || 0,
          createdAt: (c as any).createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<CustomerDocument> {
    const customer = await this.customerModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async getDetail(companyId: string | Types.ObjectId, id: string) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const customerObjectId = new Types.ObjectId(id);

    const customer = await this.findById(companyObjectId, id);

    // 1. Get recent orders for this customer
    const recentOrders = await this.orderModel
      .find({
        companyId: companyObjectId,
        customerId: customerObjectId,
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    // 2. Aggregate top product for this customer
    const topProductAgg = await this.orderModel.aggregate([
      {
        $match: {
          companyId: companyObjectId,
          customerId: customerObjectId,
          deletedAt: { $exists: false },
          operationalStatus: { $ne: 'canceled' },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          productId: { $first: '$items.productId' },
          productName: { $first: '$items.productName' },
          quantity: { $sum: '$items.quantity' },
          totalSpentCents: { $sum: '$items.subtotalCents' },
        },
      },
      { $sort: { quantity: -1, totalSpentCents: -1 } },
      { $limit: 1 },
    ]);

    const topProduct = topProductAgg.length > 0 ? {
      productId: topProductAgg[0].productId ? topProductAgg[0].productId.toString() : undefined,
      productName: topProductAgg[0].productName,
      quantity: topProductAgg[0].quantity,
      totalSpentCents: topProductAgg[0].totalSpentCents,
    } : null;

    // 3. Loyalty card calculation
    const targetOrders = customer.loyaltyCard?.targetOrders || 10;
    const totalOrders = customer.totalOrdersCount || 0;
    const currentOrders = totalOrders % targetOrders;
    const completedCycles = Math.floor(totalOrders / targetOrders);
    const progressPercent = Math.min(100, Math.round((currentOrders / targetOrders) * 100));

    const averageTicketCents = totalOrders > 0
      ? Math.round((customer.totalSpentCents || 0) / totalOrders)
      : 0;

    return {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
        photoUrl: customer.photoUrl,
        totalOrdersCount: totalOrders,
        totalSpentCents: customer.totalSpentCents || 0,
        createdAt: (customer as any).createdAt,
        updatedAt: (customer as any).updatedAt,
      },
      stats: {
        totalOrdersCount: totalOrders,
        totalSpentCents: customer.totalSpentCents || 0,
        averageTicketCents,
        topProduct,
      },
      loyaltyCard: {
        enabled: !!customer.loyaltyCard?.enabled,
        targetOrders,
        reward: customer.loyaltyCard?.reward || '',
        currentOrders,
        progressPercent,
        completedCycles,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o._id.toString(),
        companyId: o.companyId.toString(),
        orderNumber: o.orderNumber,
        customerId: o.customerId.toString(),
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        items: o.items.map((it) => ({
          productId: it.productId.toString(),
          productName: it.productName,
          unitPriceCents: it.unitPriceCents,
          quantity: it.quantity,
          subtotalCents: it.subtotalCents,
          notes: it.notes,
        })),
        discountCents: o.discountCents,
        deliveryFeeCents: o.deliveryFeeCents,
        totalAmountCents: o.totalAmountCents,
        paidAmountCents: o.paidAmountCents,
        remainingAmountCents: o.remainingAmountCents,
        operationalStatus: o.operationalStatus,
        financialStatus: o.financialStatus,
        deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : '',
        deliveryMethod: o.deliveryMethod,
        notes: o.notes,
        createdAt: (o as any).createdAt ? (o as any).createdAt.toISOString() : '',
      })),
    };
  }

  async create(companyId: string | Types.ObjectId, input: CreateCustomerInput): Promise<CustomerDocument> {
    return this.customerModel.create({
      companyId: new Types.ObjectId(companyId.toString()),
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      email: input.email ? input.email.trim().toLowerCase() : undefined,
      address: input.address,
      notes: input.notes?.trim() || undefined,
      photoUrl: input.photoUrl || undefined,
      loyaltyCard: input.loyaltyCard || { enabled: false, targetOrders: 10, reward: '' },
    });
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    input: Partial<CreateCustomerInput>,
  ): Promise<CustomerDocument> {
    const customer = await this.customerModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      {
        $set: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.phone !== undefined && { phone: input.phone?.trim() }),
          ...(input.email !== undefined && { email: input.email?.trim().toLowerCase() }),
          ...(input.address && { address: input.address }),
          ...(input.notes !== undefined && { notes: input.notes?.trim() }),
          ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
          ...(input.loyaltyCard && { loyaltyCard: input.loyaltyCard }),
        },
      },
      { new: true },
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async updateLoyalty(
    companyId: string | Types.ObjectId,
    id: string,
    input: LoyaltyCardInput,
  ): Promise<CustomerDocument> {
    const customer = await this.customerModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      {
        $set: {
          loyaltyCard: {
            enabled: input.enabled,
            targetOrders: input.targetOrders,
            reward: input.reward?.trim() || '',
          },
        },
      },
      { new: true },
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async delete(companyId: string | Types.ObjectId, id: string): Promise<boolean> {
    const customer = await this.customerModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      {
        $set: { deletedAt: new Date() },
      },
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return true;
  }
}
