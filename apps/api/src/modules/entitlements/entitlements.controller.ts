import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntitlementsService } from './entitlements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { SubscriptionTier } from '@koki/types';

@ApiTags('entitlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @ApiOperation({ summary: 'Obter permissões e limites do plano da empresa ativa' })
  @Get('features')
  async getFeatures(@CurrentCompany() company: any) {
    return this.entitlementsService.getEntitlements(company._id);
  }

  @ApiOperation({ summary: 'Listar todos os planos disponíveis (Free, Pro, Business)' })
  @Get('plans')
  async getPlans() {
    return this.entitlementsService.getAvailablePlans();
  }

  @ApiOperation({ summary: 'Simular ou realizar upgrade de plano' })
  @Post('upgrade')
  async upgradePlan(
    @CurrentCompany() company: any,
    @Body() body: { tier: SubscriptionTier; interval?: 'monthly' | 'yearly' },
  ) {
    return this.entitlementsService.upgradePlan(
      company._id,
      body.tier,
      body.interval || 'monthly',
    );
  }
}
