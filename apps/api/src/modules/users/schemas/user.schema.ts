import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserPreferences } from '@koki/types';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Company' })
  currentCompanyId?: Types.ObjectId;

  @Prop({
    type: Object,
    default: {
      hideValues: false,
      language: 'pt',
      theme: 'light',
    },
  })
  preferences: UserPreferences;
}

export const UserSchema = SchemaFactory.createForClass(User);
