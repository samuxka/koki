import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CreateLabelBatchDto, LabelBatchStatus } from '@koki/types';

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @ApiOperation({ summary: 'Consultar franquia mensal de etiquetas e uso atual' })
  @Get('quota')
  async getQuota(@CurrentCompany() company: any) {
    return this.labelsService.getQuota(company._id);
  }

  @ApiOperation({ summary: 'Listar lotes e etiquetas da confeitaria' })
  @Get('batches')
  async getBatches(
    @CurrentCompany() company: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.labelsService.getBatches(company._id, search, status);
  }

  @ApiOperation({ summary: 'Criar novo lote e gerar etiqueta de validade' })
  @Post('batches')
  async createBatch(
    @CurrentCompany() company: any,
    @Body() dto: CreateLabelBatchDto,
  ) {
    return this.labelsService.createBatch(company._id, dto);
  }

  @ApiOperation({ summary: 'Consultar detalhes de um lote específico' })
  @Get('batches/:id')
  async getBatchById(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.labelsService.getBatchById(company._id, id);
  }

  @ApiOperation({ summary: 'Obter HTML formatado para impressão térmica ou A4' })
  @Get('batches/:id/html')
  @Header('Content-Type', 'text/html')
  async getPrintableHtml(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.labelsService.getPrintableHtml(company._id, id);
  }

  @ApiOperation({ summary: 'Atualizar status do lote (ativo, vencido, esgotado)' })
  @Patch('batches/:id/status')
  async updateStatus(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body('status') status: LabelBatchStatus,
  ) {
    return this.labelsService.updateStatus(company._id, id, status);
  }

  @ApiOperation({ summary: 'Excluir registro de lote' })
  @Delete('batches/:id')
  async deleteBatch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.labelsService.deleteBatch(company._id, id);
  }
}
