import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { CashflowModule } from '../cashflow/cashflow.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    CashflowModule,
    CompaniesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
