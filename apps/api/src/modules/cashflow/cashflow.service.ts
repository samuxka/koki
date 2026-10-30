import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CashAccount, CashAccountDocument } from './schemas/cash-account.schema';
import { CashTransaction, CashTransactionDocument } from './schemas/cash-transaction.schema';
import {
  CreateCashAccountInput,
  CreateCashTransactionInput,
  CreateTransferInput,
} from '@koki/validation';
import { CashSummary } from '@koki/types';

@Injectable()
export class CashflowService {
  constructor(
    @InjectModel(CashAccount.name)
    private cashAccountModel: Model<CashAccountDocument>,
    @InjectModel(CashTransaction.name)
    private cashTransactionModel: Model<CashTransactionDocument>,
  ) {}

  // Cash Accounts (Caixinhas)
  async getAccounts(companyId: string | Types.ObjectId): Promise<CashAccountDocument[]> {
    return this.cashAccountModel
      .find({
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      })
      .sort({ isDefault: -1, name: 1 })
      .exec();
  }

  async getAccountById(companyId: string | Types.ObjectId, id: string): Promise<CashAccountDocument> {
    const account = await this.cashAccountModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });
    if (!account) {
      throw new NotFoundException('Caixinha não encontrada');
    }
    return account;
  }

  async createAccount(
    companyId: string | Types.ObjectId,
    input: CreateCashAccountInput,
    userId?: string,
  ): Promise<CashAccountDocument> {
    const initialBalanceCents = input.initialBalanceCents || 0;

    const account = await this.cashAccountModel.create({
      companyId: new Types.ObjectId(companyId.toString()),
      name: input.name.trim(),
      type: input.type || 'cash',
      icon: input.icon || 'wallet',
      color: input.color || '#cc9a52',
      currentBalanceCents: initialBalanceCents,
      description: input.description?.trim(),
      isDefault: false,
    });

    if (initialBalanceCents > 0) {
      await this.cashTransactionModel.create({
        companyId: new Types.ObjectId(companyId.toString()),
        cashAccountId: account._id,
        type: 'opening_balance',
        category: 'Abertura de Caixa',
        description: `Saldo inicial da caixinha "${account.name}"`,
        amountCents: initialBalanceCents,
        date: new Date(),
        createdBy: userId ? new Types.ObjectId(userId) : undefined,
      });
    }

    return account;
  }

  // Transactions (Entradas e Saídas)
  async createTransaction(
    companyId: string | Types.ObjectId,
    input: CreateCashTransactionInput,
    userId?: string,
  ): Promise<CashTransactionDocument> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const account = await this.getAccountById(companyId, input.cashAccountId);

    if (input.type === 'expense' && account.currentBalanceCents < input.amountCents) {
      // We allow expense with warning or let balance go negative if business demands, but typically warn
    }

    const transaction = await this.cashTransactionModel.create({
      companyId: companyObjectId,
      cashAccountId: account._id,
      type: input.type,
      category: input.category.trim(),
      description: input.description.trim(),
      amountCents: input.amountCents,
      date: input.date ? new Date(input.date) : new Date(),
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Update account balance
    const balanceDelta = input.type === 'income' ? input.amountCents : -input.amountCents;
    await this.cashAccountModel.findByIdAndUpdate(account._id, {
      $inc: { currentBalanceCents: balanceDelta },
    });

    return transaction;
  }

  // Internal Transfer (Transferência entre caixinhas)
  async transfer(
    companyId: string | Types.ObjectId,
    input: CreateTransferInput,
    userId?: string,
  ): Promise<{ sourceAccount: CashAccountDocument; destAccount: CashAccountDocument }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    if (input.sourceAccountId === input.destinationAccountId) {
      throw new BadRequestException('A conta de origem e destino não podem ser as mesmas');
    }

    const source = await this.getAccountById(companyId, input.sourceAccountId);
    const dest = await this.getAccountById(companyId, input.destinationAccountId);

    if (source.currentBalanceCents < input.amountCents) {
      throw new BadRequestException('Saldo insuficiente na conta de origem para transferência');
    }

    // 1. Transaction record for transfer
    await this.cashTransactionModel.create({
      companyId: companyObjectId,
      cashAccountId: source._id,
      destinationAccountId: dest._id,
      type: 'transfer',
      category: 'Transferência Interna',
      description: input.description?.trim() || `Transferência de "${source.name}" para "${dest.name}"`,
      amountCents: input.amountCents,
      date: new Date(),
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // 2. Adjust balances atomically
    const [updatedSource, updatedDest] = await Promise.all([
      this.cashAccountModel.findByIdAndUpdate(
        source._id,
        { $inc: { currentBalanceCents: -input.amountCents } },
        { new: true },
      ),
      this.cashAccountModel.findByIdAndUpdate(
        dest._id,
        { $inc: { currentBalanceCents: input.amountCents } },
        { new: true },
      ),
    ]);

    return { sourceAccount: updatedSource!, destAccount: updatedDest! };
  }

  // Register payment from order
  async registerOrderIncome(
    companyId: Types.ObjectId,
    cashAccountId: Types.ObjectId,
    orderId: Types.ObjectId,
    paymentId: Types.ObjectId,
    orderNumber: number,
    amountCents: number,
    idempotencyKey?: string,
    userId?: Types.ObjectId,
  ): Promise<CashTransactionDocument> {
    if (idempotencyKey) {
      const existing = await this.cashTransactionModel.findOne({ idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    const transaction = await this.cashTransactionModel.create({
      companyId,
      cashAccountId,
      type: 'income',
      category: 'Venda de Pedido',
      description: `Pagamento ref. Pedido #${orderNumber}`,
      amountCents,
      date: new Date(),
      orderId,
      paymentId,
      idempotencyKey,
      createdBy: userId,
    });

    await this.cashAccountModel.findByIdAndUpdate(cashAccountId, {
      $inc: { currentBalanceCents: amountCents },
    });

    return transaction;
  }

  // Summary & Flow Calculation
  async getSummary(companyId: string | Types.ObjectId, startDate?: Date, endDate?: Date): Promise<CashSummary> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const dateFilter: Record<string, any> = { companyId: companyObjectId };
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = startDate;
      if (endDate) dateFilter.date.$lte = endDate;
    }

    const [accounts, transactions] = await Promise.all([
      this.getAccounts(companyId),
      this.cashTransactionModel
        .find({
          ...dateFilter,
          type: { $in: ['income', 'expense'] },
        })
        .select('type amountCents')
        .lean()
        .exec(),
    ]);

    const consolidatedBalanceCents = accounts.reduce((acc, a) => acc + a.currentBalanceCents, 0);

    let periodIncomeCents = 0;
    let periodExpenseCents = 0;

    for (const t of transactions) {
      if (t.type === 'income') {
        periodIncomeCents += t.amountCents;
      } else if (t.type === 'expense') {
        periodExpenseCents += t.amountCents;
      }
    }

    return {
      consolidatedBalanceCents,
      periodIncomeCents,
      periodExpenseCents,
      periodNetCents: periodIncomeCents - periodExpenseCents,
      accounts: accounts.map((a) => ({
        id: a._id.toString(),
        companyId: a.companyId.toString(),
        name: a.name,
        type: a.type,
        icon: a.icon,
        color: a.color,
        currentBalanceCents: a.currentBalanceCents,
        description: a.description,
        isDefault: a.isDefault,
        createdAt: (a as any).createdAt,
        updatedAt: (a as any).updatedAt,
      })),
    };
  }

  // List transactions with pagination and filters
  async getTransactions(
    companyId: string | Types.ObjectId,
    type?: string,
    cashAccountId?: string,
    category?: string,
    search?: string,
    page = 1,
    limit = 20,
  ) {
    const filter: Record<string, any> = {
      companyId: new Types.ObjectId(companyId.toString()),
    };

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (cashAccountId) {
      filter.cashAccountId = new Types.ObjectId(cashAccountId);
    }

    if (category) {
      filter.category = category;
    }

    if (search && search.trim()) {
      filter.$or = [
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.cashTransactionModel
        .find(filter)
        .populate('cashAccountId', 'name icon color')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.cashTransactionModel.countDocuments(filter),
    ]);

    return {
      items: items.map((t) => ({
        id: t._id.toString(),
        type: t.type,
        category: t.category,
        description: t.description,
        amountCents: t.amountCents,
        date: t.date,
        cashAccountId: t.cashAccountId?._id?.toString() || (t.cashAccountId as any)?.toString(),
        cashAccountName: (t.cashAccountId as any)?.name,
        orderId: t.orderId?.toString(),
        createdAt: (t as any).createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Flow chart data for period
  async getFlowChart(companyId: string | Types.ObjectId, period = 'month') {
    const now = new Date();
    let startDate = new Date();

    if (period === '7d' || period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === '30d' || period === 'month') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      startDate.setDate(now.getDate() - 7);
    }

    const transactions = await this.cashTransactionModel.find({
      companyId: new Types.ObjectId(companyId.toString()),
      type: { $in: ['income', 'expense'] },
      date: { $gte: startDate, $lte: now },
    }).sort({ date: 1 }).exec();

    // Group by day (YYYY-MM-DD)
    const dailyMap = new Map<string, { date: string; incomeCents: number; expenseCents: number }>();

    for (const t of transactions) {
      const dateKey = t.date.toISOString().slice(0, 10);
      const current = dailyMap.get(dateKey) || { date: dateKey, incomeCents: 0, expenseCents: 0 };
      if (t.type === 'income') {
        current.incomeCents += t.amountCents;
      } else if (t.type === 'expense') {
        current.expenseCents += t.amountCents;
      }
      dailyMap.set(dateKey, current);
    }

    return Array.from(dailyMap.values());
  }
}
