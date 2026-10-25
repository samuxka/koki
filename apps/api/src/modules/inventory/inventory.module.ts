import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryItem, InventoryItemSchema } from './schemas/inventory-item.schema';
import { InventoryMovement, InventoryMovementSchema } from './schemas/inventory-movement.schema';
import { ShoppingListItem, ShoppingListItemSchema } from './schemas/shopping-list-item.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryMovement.name, schema: InventoryMovementSchema },
      { name: ShoppingListItem.name, schema: ShoppingListItemSchema },
    ]),
    EntitlementsModule,
    CompaniesModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
