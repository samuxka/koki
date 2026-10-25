import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductionPlannerService } from './production-planner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import {
  CreateProductionBatchInput,
  UpdateProductionBatchInput,
} from '@koki/validation';
import { OperationalStatus } from '@koki/types';

@ApiTags('production-planner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('production-planner')
export class ProductionPlannerController {
  constructor(private readonly productionPlannerService: ProductionPlannerService) {}

  @ApiOperation({ summary: 'Obter plano diário consolidado de produção (demandas, fornadas e insumos)' })
  @Get('daily')
  async getDailyPlan(
    @CurrentCompany() company: any,
    @Query('date') date?: string,
  ) {
    return this.productionPlannerService.getDailyPlan(company._id, date);
  }

  @ApiOperation({ summary: 'Criar fornada ou lote de produção manual' })
  @Post('batches')
  async createBatch(
    @CurrentCompany() company: any,
    @Body() input: CreateProductionBatchInput,
  ) {
    return this.productionPlannerService.createBatch(company._id, input);
  }

  @ApiOperation({ summary: 'Atualizar fornada ou lote de produção' })
  @Put('batches/:id')
  async updateBatch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateProductionBatchInput,
  ) {
    return this.productionPlannerService.updateBatch(company._id, id, input);
  }

  @ApiOperation({ summary: 'Alternar status da fornada (Pendente -> Em Produção -> Concluído)' })
  @Patch('batches/:id/toggle')
  async toggleBatch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.productionPlannerService.toggleBatchStatus(company._id, id);
  }

  @ApiOperation({ summary: 'Excluir fornada ou lote' })
  @Delete('batches/:id')
  async deleteBatch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.productionPlannerService.deleteBatch(company._id, id);
  }

  @ApiOperation({ summary: 'Gerar fornadas e cronograma automaticamente a partir dos pedidos do dia' })
  @Post('auto-generate')
  async autoGenerate(
    @CurrentCompany() company: any,
    @Body('date') date: string,
  ) {
    return this.productionPlannerService.autoGenerateBatches(company._id, date);
  }

  @ApiOperation({ summary: 'Avançar status operacional do pedido diretamente da cozinha' })
  @Patch('orders/:orderId/status')
  async updateOrderStatus(
    @CurrentCompany() company: any,
    @Param('orderId') orderId: string,
    @Body('status') status: OperationalStatus,
  ) {
    return this.productionPlannerService.updateOrderOperationalStatus(company._id, orderId, status);
  }
}
