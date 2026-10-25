import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransactionType } from '@koki/types';

export type CashTransactionDocument = CashTransaction & Document;

@Schema({ timestamps: true })
export class CashTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CashAccount', required: true, index: true })
  cashAccountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CashAccount' })
  destinationAccountId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['income', 'expense', 'transfer', 'opening_balance'],
    index: true,
  })
  type: TransactionType;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true })
  amountCents: number;

  @Prop({ required: true, default: Date.now, index: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const CashTransactionSchema = SchemaFactory.createForClass(CashTransaction);
CashTransactionSchema.index({ companyId: 1, date: -1 });
CashTransactionSchema.index({ companyId: 1, type: 1 });
