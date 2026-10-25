import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryItemDocument = InventoryItem & Document;

@Schema({ timestamps: true })
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  category: string;

  @Prop({ trim: true })
  brand?: string;

  @Prop({ required: true, default: 'g', trim: true })
  unit: string;

  @Prop({ required: true, default: 0 })
  currentStock: number;

  @Prop({ required: true, default: 0 })
  minStock: number;

  @Prop({ default: 0 })
  idealStock?: number;

  @Prop({ required: true, default: 0 })
  unitCostCents: number;

  @Prop()
  packageSize?: number;

  @Prop()
  packageCostCents?: number;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  supplier?: string;

  @Prop()
  expiryDate?: string;

  @Prop()
  notes?: string;

  @Prop()
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ companyId: 1, name: 1 });
InventoryItemSchema.index({ companyId: 1, category: 1 });
InventoryItemSchema.index({ companyId: 1, currentStock: 1 });
InventoryItemSchema.index({ companyId: 1, createdAt: -1 });
