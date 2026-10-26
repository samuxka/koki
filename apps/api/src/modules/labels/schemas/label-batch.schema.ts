import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LabelBatchDocument = LabelBatch & Document;

@Schema({ timestamps: true, collection: 'label_batches' })
export class LabelBatch {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, index: true })
  batchCode: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Recipe' })
  recipeId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  productionDate: string; // YYYY-MM-DD

  @Prop({ required: true, index: true })
  expiryDate: string; // YYYY-MM-DD

  @Prop({ type: Number })
  shelfLifeDays?: number;

  @Prop({ required: true, default: 'Conservar em local seco e fresco' })
  storageCondition: string;

  @Prop()
  netWeight?: string; // ex: "350g", "1 kg"

  @Prop()
  ingredientsText?: string;

  @Prop()
  allergensText?: string;

  @Prop()
  nutritionalHighlights?: string;

  @Prop({ required: true, default: 'standard' })
  labelSize: string; // 'small' | 'standard' | 'large'

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop()
  barcodeOrQrContent?: string;

  @Prop()
  notes?: string;

  @Prop({ required: true, default: 'active', index: true })
  status: string; // 'active' | 'expiring_soon' | 'expired' | 'depleted'
}

export const LabelBatchSchema = SchemaFactory.createForClass(LabelBatch);
LabelBatchSchema.index({ companyId: 1, productionDate: -1 });
LabelBatchSchema.index({ companyId: 1, batchCode: 1 });
