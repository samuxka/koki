import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryPlannerController } from './delivery-planner.controller';
import { DeliveryPlannerService } from './delivery-planner.service';
import { DeliveryItem, DeliveryItemSchema } from './schemas/delivery-item.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryItem.name, schema: DeliveryItemSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    EntitlementsModule,
    CompaniesModule,
  ],
  controllers: [DeliveryPlannerController],
  providers: [DeliveryPlannerService],
  exports: [DeliveryPlannerService, MongooseModule],
})
export class DeliveryPlannerModule {}
