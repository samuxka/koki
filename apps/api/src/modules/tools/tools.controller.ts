import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ToolsService, CostCalculationInput, UnitConversionInput } from './tools.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @ApiOperation({ summary: 'Calculadora de custos e formação de preço (margem vs markup)' })
  @Post('cost-calculator')
  async calculateCost(@Body() input: CostCalculationInput) {
    return this.toolsService.calculateCost(input);
  }

  @ApiOperation({ summary: 'Conversor de medidas culinárias com densidades de ingredientes' })
  @Post('unit-converter')
  async convertUnit(@Body() input: UnitConversionInput) {
    return this.toolsService.convertUnit(input);
  }

  @ApiOperation({ summary: 'Escalonador de receitas por rendimento, forma de bolo ou Baker% ' })
  @Post('recipe-scaler')
  async scaleRecipe(@Body() input: any) {
    return this.toolsService.scaleRecipe(input);
  }
}
