import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CouponDocument = Coupon & Document;

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  discountType: 'percentage' | 'fixed';

  @Prop({ required: true, min: 0 })
  discountValue: number; // if percentage: 1..100; if fixed: cents

  @Prop({ default: 0, min: 0 })
  minOrderAmountCents: number;

  @Prop({ min: 0 })
  maxDiscountAmountCents?: number;

  @Prop({ default: 0, min: 0 })
  usageLimit?: number; // 0 = unlimited

  @Prop({ default: 0, min: 0 })
  usageCount: number;

  @Prop({ min: 0 })
  usageLimitPerCustomer?: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Customer' }], default: [] })
  usedByCustomerIds: Types.ObjectId[];

  @Prop()
  startDate?: string; // YYYY-MM-DD

  @Prop()
  expiresAt?: string; // YYYY-MM-DD

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  applicableProductIds?: Types.ObjectId[];
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Compound index to ensure uniqueness of coupon code per company
CouponSchema.index({ companyId: 1, code: 1 }, { unique: true });
CouponSchema.index({ companyId: 1, isActive: 1, expiresAt: 1 });
