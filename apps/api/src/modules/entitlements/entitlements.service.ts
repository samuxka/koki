import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { Plan, PlanDocument } from './schemas/plan.schema';
import {
  EntitlementsResponse,
  SubscriptionTier,
  KOKI_PLANS,
  Plan as IPlan,
} from '@koki/types';

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name)
    private planModel: Model<PlanDocument>,
  ) {}

  async getCompanySubscription(companyId: string | Types.ObjectId): Promise<SubscriptionDocument> {
    let sub = await this.subscriptionModel.findOne({
      companyId: new Types.ObjectId(companyId.toString()),
    });

    if (!sub) {
      sub = await this.subscriptionModel.create({
        companyId: new Types.ObjectId(companyId.toString()),
        planCode: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
      });
    }

    return sub;
  }

  getAvailablePlans(): IPlan[] {
    return Object.values(KOKI_PLANS);
  }

  async getEntitlements(companyId: string | Types.ObjectId): Promise<EntitlementsResponse> {
    const sub = await this.getCompanySubscription(companyId);
    
    // Determine active tier
    let tier: SubscriptionTier = 'free';
    if (sub.status === 'active' || sub.status === 'trialing') {
      if (sub.planCode.startsWith('business')) {
        tier = 'business';
      } else if (sub.planCode.startsWith('pro')) {
        tier = 'pro';
      }
    }

    const planConfig = KOKI_PLANS[tier] || KOKI_PLANS.free;
    const isPro = tier === 'pro' || tier === 'business';
    const isBusiness = tier === 'business';

    const accessibleFeatures = [
      'orders.create',
      'customers.create',
      'products.create',
      'cashflow.access',
      'cash_accounts.manage',
      'tools.cost_calculator',
      'tools.unit_converter',
      'tools.recipe_scaler',
      'recipes.access',
      'inventory.access',
      'production_planner.access',
      'delivery_planner.access',
      'labels_generator.access',
      'combos.create',
      ...(isPro
        ? [
            'coupons.create',
            'shopping_list.automatic',
            'production_planner.manual',
            'delivery_planner.access',
            'reports.advanced',
          ]
        : []),
      ...(isBusiness
        ? [
            'production_planner.automatic',
            'delivery_planner.unlimited',
            'whatsapp_bot.access',
            'multi_store.access',
          ]
        : []),
    ];

    return {
      planCode: sub.planCode,
      tier,
      status: sub.status,
      isPro,
      isBusiness,
      limits: planConfig.limits,
      canCreateOrder: true,
      canCreateProduct: true,
      canCreateCustomer: true,
      canCreateCashAccount: true,
      canCreateInventoryItem: true,
      canCreateRecipe: true,
      accessibleFeatures,
    };
  }

  async verifyFeatureAccess(companyId: string | Types.ObjectId, featureKey: string): Promise<void> {
    const entitlements = await this.getEntitlements(companyId);
    if (!entitlements.accessibleFeatures.includes(featureKey)) {
      const requiredPlan = featureKey.includes('whatsapp') || featureKey.includes('automatic')
        ? 'Business'
        : 'Pro';
      throw new ForbiddenException(
        `O recurso "${featureKey}" requer assinatura do plano Koki ${requiredPlan}. Atualize seu plano para desbloquear.`,
      );
    }
  }

  async upgradePlan(
    companyId: string | Types.ObjectId,
    tier: SubscriptionTier,
    interval: 'monthly' | 'yearly' = 'monthly',
  ): Promise<EntitlementsResponse> {
    if (tier === 'free') {
      const sub = await this.subscriptionModel.findOneAndUpdate(
        { companyId: new Types.ObjectId(companyId.toString()) },
        { planCode: 'free', status: 'active' },
        { new: true, upsert: true },
      );
      return this.getEntitlements(companyId);
    }

    const planCode = interval === 'yearly' ? `${tier}_yearly` : tier;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

    await this.subscriptionModel.findOneAndUpdate(
      { companyId: new Types.ObjectId(companyId.toString()) },
      {
        planCode,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      { new: true, upsert: true },
    );

    return this.getEntitlements(companyId);
  }
}
