import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubscriptionStatus } from '@koki/types';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, unique: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, default: 'free', index: true })
  planCode: string;

  @Prop({
    required: true,
    enum: ['trialing', 'active', 'past_due', 'canceled', 'expired'],
    default: 'active',
    index: true,
  })
  status: SubscriptionStatus;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop({ default: false })
  isAdministrativeGrant: boolean;

  @Prop()
  grantedBy?: string;

  @Prop()
  grantedUntil?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
