import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Combo, ComboSchema } from './schemas/combo.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { CombosService } from './combos.service';
import { CombosController } from './combos.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Combo.name, schema: ComboSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    EntitlementsModule,
  ],
  controllers: [CombosController],
  providers: [CombosService],
  exports: [CombosService],
})
export class CombosModule {}
