import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComboDocument = Combo & Document;

@Schema({ _id: false })
export class ComboItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  productName: string;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ required: true, default: 0 })
  unitPriceCents: number;

  @Prop({ required: true, default: 0 })
  unitCostCents: number;

  @Prop({ trim: true })
  flavor?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const ComboItemSchema = SchemaFactory.createForClass(ComboItem);

@Schema({ timestamps: true, collection: 'combos' })
export class Combo {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: 'Combos & Kits', trim: true })
  category: string;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [ComboItemSchema], default: [] })
  items: ComboItem[];

  @Prop({ required: true, default: 0 })
  originalTotalCents: number;

  @Prop({ required: true, default: 0 })
  totalCostCents: number;

  @Prop({ required: true, default: 0 })
  priceCents: number;

  @Prop({ default: 0 })
  discountCents: number;

  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ default: 0 })
  profitCents: number;

  @Prop({ default: 0 })
  profitMarginPercent: number;

  @Prop({ default: true, index: true })
  isAvailable: boolean;

  @Prop({ default: 0 })
  minLeadTimeHours?: number;

  @Prop({ default: true })
  syncAsProduct: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;
}

export const ComboSchema = SchemaFactory.createForClass(Combo);
ComboSchema.index({ companyId: 1, name: 1 });
ComboSchema.index({ companyId: 1, isAvailable: 1 });
