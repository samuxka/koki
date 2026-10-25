import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '@koki/types';

export type MembershipDocument = Membership & Document;

@Schema({ timestamps: true })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['owner', 'admin', 'staff'],
    default: 'staff',
    index: true,
  })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ userId: 1, companyId: 1 }, { unique: true });
