import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PlanLimits } from '@koki/types';

export type PlanDocument = Plan & Document;

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, unique: true, index: true })
  code: string; // 'free' | 'pro_monthly' | 'pro_yearly'

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 0 })
  priceCents: number;

  @Prop({ default: 'EUR' })
  currency: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({
    type: Object,
    default: {
      monthlyOrders: 30,
      productsLimit: 20,
      customersLimit: 50,
      cashAccountsLimit: 2,
      recipesEnabled: false,
      productionPlannerEnabled: false,
      deliveryPlannerEnabled: false,
      costCalculatorAdvanced: false,
      whatsappBotEnabled: false,
    },
  })
  limits: PlanLimits;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
