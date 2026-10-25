import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AccountStatus, BusinessType } from '@koki/types';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, trim: true })
  tradeName: string;

  @Prop({ trim: true })
  legalName?: string;

  @Prop({
    required: true,
    enum: ['confeitaria', 'padaria', 'pastelaria', 'outro'],
    default: 'confeitaria',
  })
  businessType: BusinessType;

  @Prop({ trim: true })
  taxId?: string;

  @Prop({ default: 'EUR' })
  currency: string;

  @Prop({ default: 'Europe/Lisbon' })
  timezone: string;

  @Prop({ default: 0 })
  monthlySalesGoalCents: number;

  @Prop({
    enum: ['active', 'suspended', 'pending_verification', 'deactivated'],
    default: 'active',
    index: true,
  })
  status: AccountStatus;

  @Prop()
  logoUrl?: string;

  @Prop()
  phone?: string;

  @Prop()
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

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
