import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryMovementDocument = InventoryMovement & Document;

@Schema({ timestamps: true })
export class InventoryMovement {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true, index: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ required: true, trim: true })
  unit: string;

  @Prop({ required: true, enum: ['in', 'out', 'adjustment'] })
  type: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  previousStock: number;

  @Prop({ required: true })
  newStock: number;

  @Prop({ default: 0 })
  costCents?: number;

  @Prop({ trim: true })
  reason?: string;

  @Prop()
  notes?: string;

  @Prop({ default: Date.now })
  date: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InventoryMovementSchema = SchemaFactory.createForClass(InventoryMovement);
InventoryMovementSchema.index({ companyId: 1, itemId: 1, createdAt: -1 });
InventoryMovementSchema.index({ companyId: 1, createdAt: -1 });
