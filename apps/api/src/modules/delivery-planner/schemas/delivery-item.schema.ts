import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DeliveryShift, DeliveryStatus, FinancialStatus } from '@koki/types';

export type DeliveryItemDocument = DeliveryItem & Document;

@Schema({ _id: false })
export class DeliveryAddressSchema {
  @Prop({ trim: true })
  street?: string;

  @Prop({ trim: true })
  number?: string;

  @Prop({ trim: true })
  complement?: string;

  @Prop({ trim: true })
  neighborhood?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  postalCode?: string;

  @Prop({ trim: true })
  formattedAddress?: string;
}

const DeliveryAddressSubSchema = SchemaFactory.createForClass(DeliveryAddressSchema);

@Schema({ timestamps: true })
export class DeliveryItem {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  date: string; // YYYY-MM-DD

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop()
  orderNumber?: number;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ trim: true })
  customerPhone?: string;

  @Prop({ type: DeliveryAddressSubSchema, default: {} })
  address: DeliveryAddressSchema;

  @Prop({
    required: true,
    enum: ['morning', 'afternoon', 'evening', 'anytime'],
    default: 'morning',
    index: true,
  })
  shift: DeliveryShift;

  @Prop({ trim: true })
  scheduledTime?: string; // ex: "10:30" ou "09:00 - 11:00"

  @Prop({ required: true, default: 0 })
  deliveryFeeCents: number;

  @Prop({ required: true, default: 0 })
  remainingAmountCents: number;

  @Prop({
    required: true,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  })
  financialStatus: FinancialStatus;

  @Prop({
    required: true,
    enum: ['pending', 'out_for_delivery', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  })
  status: DeliveryStatus;

  @Prop()
  deliveredAt?: Date;

  @Prop({ trim: true })
  driverName?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ default: 1 })
  orderItemsCount: number;

  @Prop({ trim: true })
  itemsSummary?: string;

  @Prop()
  deletedAt?: Date;
}

export const DeliveryItemSchema = SchemaFactory.createForClass(DeliveryItem);
DeliveryItemSchema.index({ companyId: 1, date: 1, shift: 1 });
DeliveryItemSchema.index({ companyId: 1, date: 1, status: 1 });
DeliveryItemSchema.index({ companyId: 1, orderId: 1 });
