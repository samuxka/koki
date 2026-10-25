import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CashflowService } from './cashflow.service';
import { CashflowController } from './cashflow.controller';
import { CashAccount, CashAccountSchema } from './schemas/cash-account.schema';
import { CashTransaction, CashTransactionSchema } from './schemas/cash-transaction.schema';
import { CompaniesModule } from '../companies/companies.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashAccount.name, schema: CashAccountSchema },
      { name: CashTransaction.name, schema: CashTransactionSchema },
    ]),
    CompaniesModule,
  ],
  controllers: [CashflowController],
  providers: [CashflowService],
  exports: [CashflowService, MongooseModule],
})
export class CashflowModule {}
