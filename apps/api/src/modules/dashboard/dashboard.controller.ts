import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Obter resumo do dashboard principal da empresa' })
  @Get('overview')
  async getOverview(@CurrentCompany() company: any) {
    return this.dashboardService.getOverview(company._id);
  }

  @ApiOperation({ summary: 'Obter dados do gráfico de pedidos por período' })
  @Get('orders-chart')
  async getOrdersChart(
    @CurrentCompany() company: any,
    @Query('period') period = '7d',
  ) {
    return this.dashboardService.getOrdersChart(company._id, period);
  }
}
