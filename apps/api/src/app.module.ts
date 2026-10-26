import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AuthModule } from './modules/auth/auth.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CashflowModule } from './modules/cashflow/cashflow.module';
import { ToolsModule } from './modules/tools/tools.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { ProductionPlannerModule } from './modules/production-planner/production-planner.module';
import { DeliveryPlannerModule } from './modules/delivery-planner/delivery-planner.module';
import { LabelsModule } from './modules/labels/labels.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    UsersModule,
    MembershipsModule,
    CompaniesModule,
    AuthModule,
    EntitlementsModule,
    DashboardModule,
    CustomersModule,
    ProductsModule,
    OrdersModule,
    CashflowModule,
    ToolsModule,
    InventoryModule,
    RecipesModule,
    ProductionPlannerModule,
    DeliveryPlannerModule,
    LabelsModule,
  ],
})
export class AppModule {}
