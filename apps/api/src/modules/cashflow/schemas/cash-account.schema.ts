import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CashAccountType } from '@koki/types';

export type CashAccountDocument = CashAccount & Document;

@Schema({ timestamps: true })
export class CashAccount {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    enum: ['cash', 'bank', 'savings', 'tax', 'investment', 'equipment'],
    default: 'cash',
  })
  type: CashAccountType;

  @Prop({ default: 'wallet' })
  icon: string;

  @Prop({ default: '#cc9a52' })
  color: string;

  @Prop({ required: true, default: 0 })
  currentBalanceCents: number;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop()
  deletedAt?: Date;
}

export const CashAccountSchema = SchemaFactory.createForClass(CashAccount);
CashAccountSchema.index({ companyId: 1, name: 1 });
