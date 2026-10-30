import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';
import { MembershipsService } from '../memberships/memberships.service';
import { UsersService } from '../users/users.service';
import { Subscription, SubscriptionDocument } from '../entitlements/schemas/subscription.schema';
import { CashAccount, CashAccountDocument } from '../cashflow/schemas/cash-account.schema';
import { CashTransaction, CashTransactionDocument } from '../cashflow/schemas/cash-transaction.schema';
import { OnboardingInput } from '@koki/validation';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(CashAccount.name) private cashAccountModel: Model<CashAccountDocument>,
    @InjectModel(CashTransaction.name) private cashTransactionModel: Model<CashTransactionDocument>,
    private membershipsService: MembershipsService,
    private usersService: UsersService,
  ) {}

  async createWithOnboarding(userId: string | Types.ObjectId, input: OnboardingInput): Promise<{
    company: CompanyDocument;
    cashAccount: CashAccountDocument;
  }> {
    const userObjectId = new Types.ObjectId(userId.toString());

    // 1. Create Company
    const company = await this.companyModel.create({
      tradeName: input.tradeName.trim(),
      businessType: input.businessType,
      currency: input.currency || 'EUR',
      timezone: input.timezone || 'Europe/Lisbon',
      monthlySalesGoalCents: input.monthlySalesGoalCents || 0,
      status: 'active',
      createdBy: userObjectId,
    });

    // 2. Create Owner Membership
    await this.membershipsService.create({
      userId: userObjectId,
      companyId: company._id,
      role: 'owner',
      permissions: ['*'],
    });

    // 3. Set as user's current company
    await this.usersService.setCurrentCompany(userObjectId, company._id);

    // 4. Create default Free subscription
    const subscription = await this.subscriptionModel.create({
      companyId: company._id,
      planCode: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
    });

    company.subscriptionId = subscription._id;
    await company.save();

    // 5. Create First Caixinha (Cash Account)
    const initialBalanceCents = input.initialBalanceCents || 0;
    const cashAccount = await this.cashAccountModel.create({
      companyId: company._id,
      name: input.initialCashAccountName?.trim() || 'Caixa Físico',
      type: 'cash',
      icon: 'wallet',
      color: '#cc9a52',
      currentBalanceCents: initialBalanceCents,
      isDefault: true,
      description: 'Caixa principal da empresa',
    });

    // If initial balance > 0, create traceable opening balance transaction
    if (initialBalanceCents > 0) {
      await this.cashTransactionModel.create({
        companyId: company._id,
        cashAccountId: cashAccount._id,
        type: 'opening_balance',
        category: 'Abertura de Caixa',
        description: 'Lançamento de saldo de abertura inicial',
        amountCents: initialBalanceCents,
        date: new Date(),
        createdBy: userObjectId,
      });
    }

    return { company, cashAccount };
  }

  async findById(companyId: string | Types.ObjectId): Promise<CompanyDocument> {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return company;
  }

  async updateSalesGoal(companyId: string | Types.ObjectId, monthlySalesGoalCents: number): Promise<CompanyDocument> {
    if (monthlySalesGoalCents < 0) {
      throw new BadRequestException('A meta de vendas deve ser um valor positivo');
    }
    const company = await this.companyModel.findByIdAndUpdate(
      companyId,
      { monthlySalesGoalCents },
      { new: true },
    );
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return company;
  }

  async updateProfile(
    companyId: string | Types.ObjectId,
    data: Partial<Company>,
  ): Promise<CompanyDocument> {
    const updatePayload: Record<string, any> = {};
    if (data.tradeName !== undefined && data.tradeName.trim()) {
      updatePayload.tradeName = data.tradeName.trim();
    }
    if (data.legalName !== undefined) {
      updatePayload.legalName = data.legalName.trim();
    }
    if (data.taxId !== undefined) {
      updatePayload.taxId = data.taxId.trim();
    }
    if (data.phone !== undefined) {
      updatePayload.phone = data.phone.trim();
    }
    if (data.email !== undefined) {
      updatePayload.email = data.email.trim();
    }
    if (data.address !== undefined) {
      updatePayload.address = {
        street: data.address.street?.trim() || undefined,
        number: data.address.number?.trim() || undefined,
        complement: data.address.complement?.trim() || undefined,
        neighborhood: data.address.neighborhood?.trim() || undefined,
        city: data.address.city?.trim() || undefined,
        postalCode: data.address.postalCode?.trim() || undefined,
      };
    }

    const company = await this.companyModel.findByIdAndUpdate(
      companyId,
      { $set: updatePayload },
      { new: true },
    );
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return company;
  }
}
