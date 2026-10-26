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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import {
  CreateCouponInput,
  UpdateCouponInput,
  ValidateCouponSchemaInput,
} from '@koki/validation';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @ApiOperation({ summary: 'Obter cota de cupons ativos do plano atual' })
  @Get('quota')
  async getQuota(@CurrentCompany() company: any) {
    return this.couponsService.getQuota(company._id);
  }

  @ApiOperation({ summary: 'Validar cupom e calcular desconto para um pedido' })
  @Post('validate')
  async validateCoupon(
    @CurrentCompany() company: any,
    @Body() input: ValidateCouponSchemaInput,
  ) {
    return this.couponsService.validateCoupon(company._id, input as any);
  }

  @ApiOperation({ summary: 'Listar cupons promocionais da confeitaria' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.couponsService.findAll(company._id, status, search);
  }

  @ApiOperation({ summary: 'Obter detalhes de um cupom específico' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.couponsService.findById(company._id, id);
  }

  @ApiOperation({ summary: 'Criar novo cupom de desconto' })
  @Post()
  async create(@CurrentCompany() company: any, @Body() input: CreateCouponInput) {
    return this.couponsService.create(company._id, input as any);
  }

  @ApiOperation({ summary: 'Atualizar dados ou status de um cupom' })
  @Patch(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateCouponInput,
  ) {
    return this.couponsService.update(company._id, id, input as any);
  }

  @ApiOperation({ summary: 'Excluir um cupom permanentemente' })
  @Delete(':id')
  async remove(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.couponsService.remove(company._id, id);
  }
}
