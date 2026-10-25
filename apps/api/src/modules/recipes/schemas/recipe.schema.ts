import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RecipeDocument = Recipe & Document;

@Schema({ _id: false })
export class RecipeIngredient {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem' })
  inventoryItemId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true, default: 'g', trim: true })
  unit: string;

  @Prop({ required: true, default: 0 })
  unitCostCents: number;

  @Prop({ required: true, default: 0 })
  costCents: number;

  @Prop({ default: false })
  isFlour?: boolean;

  @Prop({ default: 0 })
  bakersPercentage?: number;
}

export const RecipeIngredientSchema = SchemaFactory.createForClass(RecipeIngredient);

@Schema({ timestamps: true })
export class Recipe {
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

  @Prop({ required: true, default: 1 })
  yield: number;

  @Prop({ required: true, default: 'unidades', trim: true })
  yieldUnit: string;

  @Prop({ default: 0 })
  prepTimeMinutes?: number;

  @Prop({ default: 0 })
  bakeTimeMinutes?: number;

  @Prop({ default: 0 })
  ovenTemperature?: number;

  @Prop({ type: [RecipeIngredientSchema], default: [] })
  ingredients: RecipeIngredient[];

  @Prop({ type: [String], default: [] })
  instructions: string[];

  @Prop()
  notes?: string;

  @Prop({ required: true, default: 0 })
  ingredientsCostCents: number;

  @Prop({ default: 0 })
  packagingCostCents?: number;

  @Prop({ default: 0 })
  laborCostCents?: number;

  @Prop({ default: 0 })
  overheadCostCents?: number;

  @Prop({ required: true, default: 0 })
  totalCostCents: number;

  @Prop({ required: true, default: 0 })
  costPerYieldUnitCents: number;

  @Prop({ default: 0 })
  suggestedSalePriceCents?: number;

  @Prop()
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const RecipeSchema = SchemaFactory.createForClass(Recipe);
RecipeSchema.index({ companyId: 1, name: 1 });
RecipeSchema.index({ companyId: 1, category: 1 });
RecipeSchema.index({ companyId: 1, totalCostCents: 1 });
RecipeSchema.index({ companyId: 1, createdAt: -1 });
