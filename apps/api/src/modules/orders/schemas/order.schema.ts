import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OperationalStatus, FinancialStatus, DeliveryMethod } from '@koki/types';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  unitPriceCents: number;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  subtotalCents: number;

  @Prop()
  flavor?: string;

  @Prop({ type: [{ name: String, additionalPriceCents: Number }], default: [] })
  complements?: { name: string; additionalPriceCents: number }[];

  @Prop()
  notes?: string;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, index: true })
  orderNumber: number;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ trim: true })
  customerPhone?: string;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ default: 0 })
  discountCents: number;

  @Prop({ default: 0 })
  deliveryFeeCents: number;

  @Prop({ required: true, default: 0 })
  totalAmountCents: number;

  @Prop({ default: 0 })
  paidAmountCents: number;

  @Prop({ default: 0 })
  remainingAmountCents: number;

  @Prop({
    required: true,
    enum: ['pending', 'in_production', 'ready', 'delivered', 'canceled'],
    default: 'pending',
    index: true,
  })
  operationalStatus: OperationalStatus;

  @Prop({
    required: true,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
    index: true,
  })
  financialStatus: FinancialStatus;

  @Prop({ required: true, index: true })
  deliveryDate: Date;

  @Prop({
    required: true,
    enum: ['pickup', 'delivery'],
    default: 'pickup',
  })
  deliveryMethod: DeliveryMethod;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ companyId: 1, orderNumber: 1 });
OrderSchema.index({ companyId: 1, deliveryDate: 1 });
OrderSchema.index({ companyId: 1, operationalStatus: 1 });
OrderSchema.index({ companyId: 1, financialStatus: 1 });
OrderSchema.index({ companyId: 1, createdAt: -1 });
