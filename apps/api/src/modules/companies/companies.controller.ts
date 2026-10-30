import { Controller, Post, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OnboardingInput, SalesGoalInput } from '@koki/validation';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiOperation({ summary: 'Onboarding inicial da empresa' })
  @Post('onboarding')
  async completeOnboarding(
    @CurrentUser() user: any,
    @Body() input: OnboardingInput,
  ) {
    const result = await this.companiesService.createWithOnboarding(
      user._id || user.id,
      input,
    );
    return {
      company: {
        id: result.company._id.toString(),
        tradeName: result.company.tradeName,
        businessType: result.company.businessType,
        currency: result.company.currency,
        timezone: result.company.timezone,
        monthlySalesGoalCents: result.company.monthlySalesGoalCents,
        status: result.company.status,
      },
      cashAccount: {
        id: result.cashAccount._id.toString(),
        name: result.cashAccount.name,
        currentBalanceCents: result.cashAccount.currentBalanceCents,
      },
    };
  }

  @ApiOperation({ summary: 'Obter detalhes da empresa ativa' })
  @UseGuards(TenantGuard)
  @Get('current')
  async getCurrentCompany(@CurrentCompany() company: any) {
    return {
      id: company._id.toString(),
      tradeName: company.tradeName,
      legalName: company.legalName,
      businessType: company.businessType,
      taxId: company.taxId,
      currency: company.currency,
      timezone: company.timezone,
      monthlySalesGoalCents: company.monthlySalesGoalCents,
      status: company.status,
      logoUrl: company.logoUrl,
      phone: company.phone,
      email: company.email,
      address: company.address,
      createdAt: company.createdAt,
    };
  }

  @ApiOperation({ summary: 'Atualizar meta mensal de vendas' })
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  @Put('current/sales-goal')
  async updateSalesGoal(
    @CurrentCompany() company: any,
    @Body() input: SalesGoalInput,
  ) {
    const updated = await this.companiesService.updateSalesGoal(
      company._id,
      input.monthlySalesGoalCents,
    );
    TenantGuard.invalidateCompanyCache(company._id.toString());
    return {
      monthlySalesGoalCents: updated.monthlySalesGoalCents,
    };
  }

  @ApiOperation({ summary: 'Atualizar dados e endereço da empresa' })
  @UseGuards(TenantGuard)
  @Put('current/profile')
  async updateCompanyProfile(
    @CurrentCompany() company: any,
    @Body() body: { tradeName?: string; phone?: string; address?: any },
  ) {
    const updated = await this.companiesService.updateProfile(company._id, body);
    TenantGuard.invalidateCompanyCache(company._id.toString());
    return {
      id: updated._id.toString(),
      tradeName: updated.tradeName,
      phone: updated.phone,
      address: updated.address,
    };
  }
}
