import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { CashflowService } from '../cashflow/cashflow.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private cashflowService: CashflowService,
  ) {}

  async getOverview(companyId: string | Types.ObjectId) {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Execute all dashboard queries in parallel to minimize latency
    const [
      company,
      currentMonthOrders,
      lastMonthOrdersCount,
      cashSummary,
      urgentOrders,
      pendingOrdersCount,
      recentOrders,
    ] = await Promise.all([
      this.companyModel.findById(companyObjectId).lean().exec(),
      this.orderModel
        .find({
          companyId: companyObjectId,
          operationalStatus: { $ne: 'canceled' },
          createdAt: { $gte: startOfCurrentMonth },
        })
        .select('totalAmountCents')
        .lean()
        .exec(),
      this.orderModel.countDocuments({
        companyId: companyObjectId,
        operationalStatus: { $ne: 'canceled' },
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
      this.cashflowService.getSummary(companyObjectId),
      this.orderModel
        .find({
          companyId: companyObjectId,
          operationalStatus: { $in: ['pending', 'in_production'] },
        })
        .sort({ deliveryDate: 1 })
        .limit(5)
        .lean()
        .exec(),
      this.orderModel.countDocuments({
        companyId: companyObjectId,
        operationalStatus: { $in: ['pending', 'in_production'] },
      }),
      this.orderModel
        .find({ companyId: companyObjectId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
    ]);

    const monthlySalesGoalCents = company?.monthlySalesGoalCents || 0;
    const currentMonthSoldCents = currentMonthOrders.reduce(
      (acc, o) => acc + (o.totalAmountCents || 0),
      0,
    );
    const currentMonthOrdersCount = currentMonthOrders.length;

    const progressPercentage =
      monthlySalesGoalCents > 0
        ? Math.min(100, Math.round((currentMonthSoldCents / monthlySalesGoalCents) * 100))
        : 0;
    const remainingCents = Math.max(0, monthlySalesGoalCents - currentMonthSoldCents);

    const ordersComparisonPercent =
      lastMonthOrdersCount > 0
        ? Math.round(((currentMonthOrdersCount - lastMonthOrdersCount) / lastMonthOrdersCount) * 100)
        : currentMonthOrdersCount > 0
        ? 100
        : 0;

    const totalBalanceCents = cashSummary.consolidatedBalanceCents;

    return {
      company: {
        id: company?._id.toString(),
        tradeName: company?.tradeName || 'Minha Empresa',
        currency: company?.currency || 'EUR',
      },
      salesGoal: {
        monthlySalesGoalCents,
        currentMonthSoldCents,
        progressPercentage,
        remainingCents,
      },
      totalBalanceCents,
      pendingOrdersCount,
      monthlyOrdersCount: currentMonthOrdersCount,
      ordersComparisonPercent,
      urgentOrders: urgentOrders.map((o) => ({
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        deliveryDate: o.deliveryDate.toISOString(),
        totalAmountCents: o.totalAmountCents,
        operationalStatus: o.operationalStatus,
        financialStatus: o.financialStatus,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        totalAmountCents: o.totalAmountCents,
        operationalStatus: o.operationalStatus,
        financialStatus: o.financialStatus,
        itemsCount: o.items.length,
        createdAt: (o as any).createdAt,
      })),
    };
  }

  async getOrdersChart(companyId: string | Types.ObjectId, period = '7d') {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const now = new Date();
    let startDate = new Date();

    if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(now.getDate() - 7);
    }

    const orders = await this.orderModel.find({
      companyId: companyObjectId,
      createdAt: { $gte: startDate, $lte: now },
    }).sort({ createdAt: 1 }).exec();

    const map = new Map<string, number>();

    // Initialize all dates in range
    const cur = new Date(startDate);
    while (cur <= now) {
      map.set(cur.toISOString().slice(0, 10), 0);
      cur.setDate(cur.getDate() + 1);
    }

    for (const o of orders) {
      const key = (o as any).createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }

    return Array.from(map.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }
}
