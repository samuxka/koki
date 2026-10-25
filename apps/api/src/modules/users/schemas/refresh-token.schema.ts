import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  tokenHash: string;

  @Prop()
  deviceId?: string;

  @Prop()
  userAgent?: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  replacedByTokenHash?: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
