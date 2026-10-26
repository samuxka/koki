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
import { CombosService } from './combos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CreateComboInput, UpdateComboInput } from '@koki/validation';

@ApiTags('combos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('combos')
export class CombosController {
  constructor(private readonly combosService: CombosService) {}

  @ApiOperation({ summary: 'Obter cota de combos e kits do plano atual' })
  @Get('quota')
  async getQuota(@CurrentCompany() company: any) {
    return this.combosService.getQuota(company._id);
  }

  @ApiOperation({ summary: 'Listar combos e kits da confeitaria' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isAvailable') isAvailable?: string,
  ) {
    return this.combosService.findAll(company._id, search, category, isAvailable);
  }

  @ApiOperation({ summary: 'Obter detalhes de um combo' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.combosService.findById(company._id, id);
  }

  @ApiOperation({ summary: 'Criar novo combo ou kit promocional' })
  @Post()
  async create(@CurrentCompany() company: any, @Body() input: CreateComboInput) {
    return this.combosService.create(company._id, input as any);
  }

  @ApiOperation({ summary: 'Atualizar dados, itens ou preço de um combo' })
  @Patch(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateComboInput,
  ) {
    return this.combosService.update(company._id, id, input as any);
  }

  @ApiOperation({ summary: 'Alternar disponibilidade do combo' })
  @Patch(':id/toggle')
  async toggleAvailability(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.combosService.toggleAvailability(company._id, id);
  }

  @ApiOperation({ summary: 'Excluir um combo permanentemente' })
  @Delete(':id')
  async remove(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.combosService.remove(company._id, id);
  }
}
