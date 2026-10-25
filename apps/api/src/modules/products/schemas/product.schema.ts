import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProductUnit } from '@koki/types';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductIngredientCost {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, default: 0 })
  costCents: number;
}

const ProductIngredientCostSchema = SchemaFactory.createForClass(ProductIngredientCost);

@Schema({ _id: false })
export class ProductComplement {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: 0 })
  additionalPriceCents: number;
}

const ProductComplementSchema = SchemaFactory.createForClass(ProductComplement);

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  category: string;

  @Prop()
  description?: string;

  @Prop()
  imageUrl?: string;

  @Prop({
    required: true,
    default: 'unidade',
    trim: true,
  })
  unit: string;

  @Prop({ required: true, default: 0 })
  priceCents: number;

  @Prop({ default: 0 })
  costCents: number;

  @Prop({ default: 0 })
  monthlySalesGoalUnits?: number;

  @Prop({ type: [ProductIngredientCostSchema], default: [] })
  ingredients?: ProductIngredientCost[];

  @Prop({ type: [String], default: [] })
  flavors?: string[];

  @Prop({ type: [ProductComplementSchema], default: [] })
  complements?: ProductComplement[];

  @Prop()
  notes?: string;

  @Prop({ default: true, index: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isCombo: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Recipe' })
  recipeId?: Types.ObjectId;

  @Prop({ default: 0 })
  totalOrdersCount: number;

  @Prop({ default: 0 })
  totalUnitsSold: number;

  @Prop({ default: 0 })
  totalRevenueCents: number;

  @Prop()
  deletedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ companyId: 1, name: 1 });
ProductSchema.index({ companyId: 1, category: 1 });
ProductSchema.index({ companyId: 1, totalUnitsSold: -1 });
ProductSchema.index({ companyId: 1, priceCents: 1 });
ProductSchema.index({ companyId: 1, createdAt: -1 });
