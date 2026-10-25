import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { Plan, PlanSchema } from './schemas/plan.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Plan.name, schema: PlanSchema },
    ]),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService, MongooseModule],
})
export class EntitlementsModule {}
