import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShoppingListItemDocument = ShoppingListItem & Document;

@Schema({ timestamps: true })
export class ShoppingListItem {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: false, index: true })
  inventoryItemId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, default: 'Geral' })
  category: string;

  @Prop({ required: true, trim: true, default: 'un' })
  unit: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop({ required: true, default: 0 })
  estimatedCostCents: number;

  @Prop({ required: true, default: false, index: true })
  isPurchased: boolean;

  @Prop()
  purchasedAt?: Date;

  @Prop({ required: true, default: 'manual', enum: ['low_stock', 'manual', 'order_demand'] })
  source: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop()
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ShoppingListItemSchema = SchemaFactory.createForClass(ShoppingListItem);

ShoppingListItemSchema.index({ companyId: 1, isPurchased: 1 });
