import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProductionBatchCategory, ProductionBatchStatus } from '@koki/types';

export type ProductionBatchDocument = ProductionBatch & Document;

@Schema({ _id: false })
export class ProductionBatchItem {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop()
  orderNumber?: number;

  @Prop({ required: true, trim: true })
  productName: string;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ trim: true })
  unit?: string;

  @Prop({ trim: true })
  flavor?: string;

  @Prop({ trim: true })
  notes?: string;
}

const ProductionBatchItemSchema = SchemaFactory.createForClass(ProductionBatchItem);

@Schema({ timestamps: true })
export class ProductionBatch {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true, default: 1 })
  batchNumber: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    enum: ['oven', 'stove', 'assembly', 'decoration', 'packaging', 'other'],
    default: 'oven',
    index: true,
  })
  category: ProductionBatchCategory;

  @Prop({ trim: true })
  time?: string; // e.g. "08:30" or "08:00 - 09:15"

  @Prop({ min: 0 })
  temperature?: number; // °C

  @Prop({ min: 0 })
  durationMinutes?: number;

  @Prop({
    required: true,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
    index: true,
  })
  status: ProductionBatchStatus;

  @Prop({ type: Types.ObjectId, ref: 'Recipe' })
  recipeId?: Types.ObjectId;

  @Prop({ trim: true })
  recipeName?: string;

  @Prop({ type: [ProductionBatchItemSchema], default: [] })
  items: ProductionBatchItem[];

  @Prop({ trim: true })
  notes?: string;

  @Prop()
  deletedAt?: Date;
}

export const ProductionBatchSchema = SchemaFactory.createForClass(ProductionBatch);
ProductionBatchSchema.index({ companyId: 1, date: 1, batchNumber: 1 });
ProductionBatchSchema.index({ companyId: 1, date: 1, status: 1 });
