import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company, CompanySchema } from './schemas/company.schema';
import { UsersModule } from '../users/users.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { Subscription, SubscriptionSchema } from '../entitlements/schemas/subscription.schema';
import { CashAccount, CashAccountSchema } from '../cashflow/schemas/cash-account.schema';
import { CashTransaction, CashTransactionSchema } from '../cashflow/schemas/cash-transaction.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: CashAccount.name, schema: CashAccountSchema },
      { name: CashTransaction.name, schema: CashTransactionSchema },
    ]),
    UsersModule,
    MembershipsModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService, MongooseModule],
})
export class CompaniesModule {}
