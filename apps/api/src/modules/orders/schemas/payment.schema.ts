import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentMethod } from '@koki/types';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CashAccount', required: true, index: true })
  cashAccountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CashTransaction' })
  cashTransactionId?: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountCents: number;

  @Prop({
    required: true,
    enum: ['cash', 'card', 'mbway', 'pix', 'bank_transfer', 'other'],
    default: 'cash',
  })
  paymentMethod: PaymentMethod;

  @Prop({ default: Date.now })
  paidAt: Date;

  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop()
  receiptUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
