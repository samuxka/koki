import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreateProductInput } from '@koki/validation';
import { ProductSortBy, ProductFilterType, ProductPeriodFilter } from '@koki/types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
  ) {}

  async findAll(
    companyId: string | Types.ObjectId,
    category?: string,
    search?: string,
    sortBy: ProductSortBy = 'popular',
    filterType: ProductFilterType = 'all',
  ) {
    const filter: Record<string, any> = {
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (filterType === 'available') {
      filter.isAvailable = true;
    } else if (filterType === 'unavailable') {
      filter.isAvailable = false;
    } else if (filterType === 'with_goal') {
      filter.monthlySalesGoalUnits = { $gt: 0 };
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { notes: { $regex: term, $options: 'i' } },
        { flavors: { $regex: term, $options: 'i' } },
      ];
    }

    let sortQuery: Record<string, 1 | -1> = { name: 1 };
    if (sortBy === 'popular') {
      sortQuery = { totalUnitsSold: -1, totalRevenueCents: -1 };
    } else if (sortBy === 'revenue') {
      sortQuery = { totalRevenueCents: -1, totalUnitsSold: -1 };
    } else if (sortBy === 'price_high') {
      sortQuery = { priceCents: -1 };
    } else if (sortBy === 'price_low') {
      sortQuery = { priceCents: 1 };
    } else if (sortBy === 'newest') {
      sortQuery = { createdAt: -1 };
    } else if (sortBy === 'oldest') {
      sortQuery = { createdAt: 1 };
    }

    const products = await this.productModel.find(filter).sort(sortQuery).exec();

    const items = products.map((p) => {
      const priceCents = p.priceCents || 0;
      const costCents = p.costCents || 0;
      const profitMarginPercent = priceCents > 0
        ? Math.round(((priceCents - costCents) / priceCents) * 100)
        : 0;

      return {
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        description: p.description,
        imageUrl: p.imageUrl,
        unit: p.unit,
        priceCents,
        costCents,
        profitMarginPercent,
        monthlySalesGoalUnits: p.monthlySalesGoalUnits || 0,
        ingredients: p.ingredients || [],
        flavors: p.flavors || [],
        complements: p.complements || [],
        notes: p.notes,
        isAvailable: p.isAvailable,
        isCombo: p.isCombo,
        totalOrdersCount: p.totalOrdersCount || 0,
        totalUnitsSold: p.totalUnitsSold || 0,
        totalRevenueCents: p.totalRevenueCents || 0,
        createdAt: (p as any).createdAt,
      };
    });

    return {
      items,
      total: items.length,
    };
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  async getDetail(
    companyId: string | Types.ObjectId,
    id: string,
    period: ProductPeriodFilter = 'week',
    startDate?: string,
    endDate?: string,
  ) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const productObjectId = new Types.ObjectId(id);

    const product = await this.findById(companyObjectId, id);

    // 1. Determine Date Range for Chart
    const now = new Date();
    let periodStart = new Date();
    let periodEnd = new Date();

    if (period === 'day') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === 'week') {
      periodStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      periodStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      periodStart = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'custom' && startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    }

    // 2. Fetch all non-canceled orders containing this product
    const orders = await this.orderModel
      .find({
        companyId: companyObjectId,
        'items.productId': productObjectId,
        deletedAt: { $exists: false },
        operationalStatus: { $ne: 'canceled' },
      })
      .sort({ createdAt: -1 })
      .exec();

    // 3. Compute Totals across all orders
    let totalUnitsSold = 0;
    let totalOrdersCount = orders.length;
    let totalRevenueCents = 0;
    let soldThisMonth = 0;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const order of orders) {
      const orderDate = new Date((order as any).createdAt || order.deliveryDate);
      const isThisMonth = orderDate >= startOfMonth;

      for (const item of order.items) {
        if (item.productId.toString() === id) {
          totalUnitsSold += item.quantity;
          totalRevenueCents += item.subtotalCents;
          if (isThisMonth) {
            soldThisMonth += item.quantity;
          }
        }
      }
    }

    const totalCostCents = (product.costCents || 0) * totalUnitsSold;
    const totalProfitCents = Math.max(0, totalRevenueCents - totalCostCents);
    const profitMarginPercentage = totalRevenueCents > 0
      ? Math.round((totalProfitCents / totalRevenueCents) * 100)
      : (product.priceCents > 0
          ? Math.round((((product.priceCents || 0) - (product.costCents || 0)) / product.priceCents) * 100)
          : 0);

    // 4. Monthly Goal calculation
    const targetUnits = product.monthlySalesGoalUnits || 0;
    const monthlyGoal = targetUnits > 0 ? {
      targetUnits,
      soldThisMonth,
      progressPercentage: Math.min(100, Math.round((soldThisMonth / targetUnits) * 100)),
      remainingUnits: Math.max(0, targetUnits - soldThisMonth),
    } : null;

    // 5. Generate Chart Data based on period
    const chartData = this.buildChartData(orders, id, period, periodStart, periodEnd);

    // 6. Recent Orders
    const recentOrders = orders.slice(0, 10).map((o) => {
      const item = o.items.find((it) => it.productId.toString() === id);
      return {
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : '',
        quantity: item?.quantity || 1,
        subtotalCents: item?.subtotalCents || 0,
        operationalStatus: o.operationalStatus,
      };
    });

    const priceCents = product.priceCents || 0;
    const costCents = product.costCents || 0;
    const profitMarginPercent = priceCents > 0
      ? Math.round(((priceCents - costCents) / priceCents) * 100)
      : 0;

    return {
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        description: product.description,
        imageUrl: product.imageUrl,
        unit: product.unit,
        priceCents,
        costCents,
        profitMarginPercent,
        monthlySalesGoalUnits: targetUnits,
        ingredients: product.ingredients || [],
        flavors: product.flavors || [],
        complements: product.complements || [],
        notes: product.notes,
        isAvailable: product.isAvailable,
        isCombo: product.isCombo,
        totalOrdersCount,
        totalUnitsSold,
        totalRevenueCents,
        createdAt: (product as any).createdAt,
        updatedAt: (product as any).updatedAt,
      },
      metrics: {
        totalUnitsSold,
        totalOrdersCount,
        totalRevenueCents,
        totalCostCents,
        totalProfitCents,
        profitMarginPercentage,
        monthlyGoal,
      },
      chartData,
      recentOrders,
    };
  }

  private buildChartData(
    orders: OrderDocument[],
    productId: string,
    period: ProductPeriodFilter,
    periodStart: Date,
    periodEnd: Date,
  ) {
    if (period === 'day') {
      const slots = ['08h', '11h', '14h', '17h', '20h', '23h'];
      const slotHours = [8, 11, 14, 17, 20, 23];
      return slots.map((label, idx) => {
        const targetHour = slotHours[idx];
        let units = 0;
        let rev = 0;
        let ordCount = 0;

        for (const order of orders) {
          const d = new Date((order as any).createdAt || order.deliveryDate);
          if (d.toDateString() === periodStart.toDateString() && Math.abs(d.getHours() - targetHour) <= 1) {
            ordCount++;
            for (const item of order.items) {
              if (item.productId.toString() === productId) {
                units += item.quantity;
                rev += item.subtotalCents;
              }
            }
          }
        }
        return { label, ordersCount: ordCount, unitsSold: units, revenueCents: rev };
      });
    }

    if (period === 'week') {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const points: { label: string; ordersCount: number; unitsSold: number; revenueCents: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayName = days[d.getDay()];
        const dateStr = d.toDateString();

        let units = 0;
        let rev = 0;
        let ordCount = 0;

        for (const order of orders) {
          const od = new Date((order as any).createdAt || order.deliveryDate);
          if (od.toDateString() === dateStr) {
            ordCount++;
            for (const item of order.items) {
              if (item.productId.toString() === productId) {
                units += item.quantity;
                rev += item.subtotalCents;
              }
            }
          }
        }
        points.push({ label: dayName, ordersCount: ordCount, unitsSold: units, revenueCents: rev });
      }
      return points;
    }

    if (period === 'month') {
      const points: { label: string; ordersCount: number; unitsSold: number; revenueCents: number }[] = [];
      const intervals = 5;
      const intervalDays = 6;

      for (let i = intervals - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * intervalDays * 24 * 60 * 60 * 1000);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;

        let units = 0;
        let rev = 0;
        let ordCount = 0;

        const rangeStart = new Date(d.getTime() - intervalDays * 24 * 60 * 60 * 1000);
        for (const order of orders) {
          const od = new Date((order as any).createdAt || order.deliveryDate);
          if (od >= rangeStart && od <= d) {
            ordCount++;
            for (const item of order.items) {
              if (item.productId.toString() === productId) {
                units += item.quantity;
                rev += item.subtotalCents;
              }
            }
          }
        }
        points.push({ label, ordersCount: ordCount, unitsSold: units, revenueCents: rev });
      }
      return points;
    }

    if (period === 'year') {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentYear = new Date().getFullYear();

      return monthNames.map((label, monthIdx) => {
        let units = 0;
        let rev = 0;
        let ordCount = 0;

        for (const order of orders) {
          const d = new Date((order as any).createdAt || order.deliveryDate);
          if (d.getFullYear() === currentYear && d.getMonth() === monthIdx) {
            ordCount++;
            for (const item of order.items) {
              if (item.productId.toString() === productId) {
                units += item.quantity;
                rev += item.subtotalCents;
              }
            }
          }
        }
        return { label, ordersCount: ordCount, unitsSold: units, revenueCents: rev };
      });
    }

    // Default / Custom period
    return [
      { label: 'Início', ordersCount: Math.round(orders.length / 2), unitsSold: Math.round(orders.length), revenueCents: 0 },
      { label: 'Fim', ordersCount: orders.length, unitsSold: orders.length * 2, revenueCents: 0 },
    ];
  }

  async getCategories(companyId: string | Types.ObjectId): Promise<string[]> {
    const categories = await this.productModel.distinct('category', {
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });
    return categories;
  }

  async create(companyId: string | Types.ObjectId, input: CreateProductInput): Promise<ProductDocument> {
    // If ingredients provided and cost is 0, sum ingredients costs
    let costCents = input.costCents || 0;
    if (costCents === 0 && input.ingredients && input.ingredients.length > 0) {
      costCents = input.ingredients.reduce((acc, curr) => acc + (curr.costCents || 0), 0);
    }

    return this.productModel.create({
      companyId: new Types.ObjectId(companyId.toString()),
      name: input.name.trim(),
      category: input.category.trim(),
      description: input.description?.trim(),
      imageUrl: input.imageUrl?.trim(),
      unit: input.unit || 'unit',
      priceCents: input.priceCents,
      costCents,
      monthlySalesGoalUnits: input.monthlySalesGoalUnits || 0,
      ingredients: input.ingredients || [],
      flavors: input.flavors || [],
      complements: input.complements || [],
      notes: input.notes?.trim(),
      isAvailable: input.isAvailable ?? true,
      isCombo: input.isCombo ?? false,
    });
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    input: Partial<CreateProductInput>,
  ): Promise<ProductDocument> {
    let costCents = input.costCents;
    if (costCents === undefined && input.ingredients && input.ingredients.length > 0) {
      costCents = input.ingredients.reduce((acc, curr) => acc + (curr.costCents || 0), 0);
    }

    const product = await this.productModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      {
        $set: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.category && { category: input.category.trim() }),
          ...(input.description !== undefined && { description: input.description?.trim() }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() }),
          ...(input.unit && { unit: input.unit }),
          ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
          ...(costCents !== undefined && { costCents }),
          ...(input.monthlySalesGoalUnits !== undefined && { monthlySalesGoalUnits: input.monthlySalesGoalUnits }),
          ...(input.ingredients !== undefined && { ingredients: input.ingredients }),
          ...(input.flavors !== undefined && { flavors: input.flavors }),
          ...(input.complements !== undefined && { complements: input.complements }),
          ...(input.notes !== undefined && { notes: input.notes?.trim() }),
          ...(input.isAvailable !== undefined && { isAvailable: input.isAvailable }),
          ...(input.isCombo !== undefined && { isCombo: input.isCombo }),
        },
      },
      { new: true },
    );

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  async toggleAvailability(companyId: string | Types.ObjectId, id: string): Promise<ProductDocument> {
    const product = await this.findById(companyId, id);
    product.isAvailable = !product.isAvailable;
    await product.save();
    return product;
  }

  async delete(companyId: string | Types.ObjectId, id: string): Promise<void> {
    const result = await this.productModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
      },
      { deletedAt: new Date() },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Produto não encontrado');
    }
  }
}
