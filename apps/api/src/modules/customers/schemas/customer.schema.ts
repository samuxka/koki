import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ trim: true, index: true })
  phone?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ type: Object })
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    postalCode?: string;
  };

  @Prop()
  notes?: string;

  @Prop()
  photoUrl?: string;

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      targetOrders: { type: Number, default: 10 },
      reward: { type: String, default: '' },
    },
    default: { enabled: false, targetOrders: 10, reward: '' },
  })
  loyaltyCard?: {
    enabled: boolean;
    targetOrders: number;
    reward?: string;
  };

  @Prop({ default: 0 })
  totalOrdersCount: number;

  @Prop({ default: 0 })
  totalSpentCents: number;

  @Prop()
  deletedAt?: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ companyId: 1, name: 1 });
CustomerSchema.index({ companyId: 1, totalSpentCents: -1 });
CustomerSchema.index({ companyId: 1, totalOrdersCount: -1 });
CustomerSchema.index({ companyId: 1, createdAt: -1 });
