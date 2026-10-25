import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { Recipe, RecipeSchema } from './schemas/recipe.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recipe.name, schema: RecipeSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
    EntitlementsModule,
    CompaniesModule,
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService, MongooseModule],
})
export class RecipesModule {}
