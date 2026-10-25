import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CreateCustomerInput, LoyaltyCardInput } from '@koki/validation';
import { CustomerSortBy, CustomerFilterType } from '@koki/types';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Listar clientes com busca avançada, ordenação e filtros' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: CustomerSortBy,
    @Query('filter') filter?: CustomerFilterType,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.customersService.findAll(
      company._id,
      search,
      sortBy || 'ranking',
      filter || 'all',
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @ApiOperation({ summary: 'Obter detalhes do cliente (perfil, métricas, top produto, fidelidade e histórico)' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.customersService.getDetail(company._id, id);
  }

  @ApiOperation({ summary: 'Criar novo cliente' })
  @Post()
  async create(@CurrentCompany() company: any, @Body() input: CreateCustomerInput) {
    const c = await this.customersService.create(company._id, input);
    return {
      id: c._id.toString(),
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      photoUrl: c.photoUrl,
      loyaltyCard: c.loyaltyCard,
      totalOrdersCount: c.totalOrdersCount,
      totalSpentCents: c.totalSpentCents,
    };
  }

  @ApiOperation({ summary: 'Atualizar dados cadastrais do cliente' })
  @Put(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: Partial<CreateCustomerInput>,
  ) {
    const c = await this.customersService.update(company._id, id, input);
    return {
      id: c._id.toString(),
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      photoUrl: c.photoUrl,
      loyaltyCard: c.loyaltyCard,
    };
  }

  @ApiOperation({ summary: 'Atualizar cartão fidelidade do cliente' })
  @Patch(':id/loyalty')
  async updateLoyalty(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: LoyaltyCardInput,
  ) {
    const c = await this.customersService.updateLoyalty(company._id, id, input);
    return {
      id: c._id.toString(),
      loyaltyCard: c.loyaltyCard,
    };
  }

  @ApiOperation({ summary: 'Excluir cliente (soft delete)' })
  @Delete(':id')
  async delete(@CurrentCompany() company: any, @Param('id') id: string) {
    await this.customersService.delete(company._id, id);
    return { success: true };
  }
}
