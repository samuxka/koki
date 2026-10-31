import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductionPlannerController } from './production-planner.controller';
import { ProductionPlannerService } from './production-planner.service';
import { ProductionBatch, ProductionBatchSchema } from './schemas/production-batch.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Recipe, RecipeSchema } from '../recipes/schemas/recipe.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductionBatch.name, schema: ProductionBatchSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Recipe.name, schema: RecipeSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
    EntitlementsModule,
    CompaniesModule,
  ],
  controllers: [ProductionPlannerController],
  providers: [ProductionPlannerService],
  exports: [ProductionPlannerService, MongooseModule],
})
export class ProductionPlannerModule {}
