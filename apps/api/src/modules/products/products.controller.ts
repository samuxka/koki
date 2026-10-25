import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CreateProductInput } from '@koki/validation';
import { ProductSortBy, ProductFilterType, ProductPeriodFilter } from '@koki/types';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Listar produtos por categoria, busca, ordenação e filtros' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: ProductSortBy,
    @Query('filter') filter?: ProductFilterType,
    @Query('availableOnly') availableOnly?: string,
  ) {
    const effectiveFilter: ProductFilterType =
      filter || (availableOnly === 'true' ? 'available' : 'all');

    return this.productsService.findAll(
      company._id,
      category,
      search,
      sortBy || 'popular',
      effectiveFilter,
    );
  }

  @ApiOperation({ summary: 'Obter categorias distintas de produtos' })
  @Get('categories')
  async getCategories(@CurrentCompany() company: any) {
    return this.productsService.getCategories(company._id);
  }

  @ApiOperation({ summary: 'Obter produto por ID com métricas e gráfico de vendas por período' })
  @Get(':id')
  async findById(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Query('period') period?: ProductPeriodFilter,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.productsService.getDetail(
      company._id,
      id,
      period || 'week',
      startDate,
      endDate,
    );
  }

  @ApiOperation({ summary: 'Cadastrar novo produto' })
  @Post()
  async create(@CurrentCompany() company: any, @Body() input: CreateProductInput) {
    const p = await this.productsService.create(company._id, input);
    return {
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      priceCents: p.priceCents,
      costCents: p.costCents,
      unit: p.unit,
      isAvailable: p.isAvailable,
      imageUrl: p.imageUrl,
    };
  }

  @ApiOperation({ summary: 'Atualizar dados do produto' })
  @Put(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: Partial<CreateProductInput>,
  ) {
    const p = await this.productsService.update(company._id, id, input);
    return {
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      priceCents: p.priceCents,
      costCents: p.costCents,
      unit: p.unit,
      isAvailable: p.isAvailable,
      imageUrl: p.imageUrl,
    };
  }

  @ApiOperation({ summary: 'Alternar disponibilidade do produto (disponível / esgotado)' })
  @Patch(':id/toggle-availability')
  async toggleAvailability(@CurrentCompany() company: any, @Param('id') id: string) {
    const p = await this.productsService.toggleAvailability(company._id, id);
    return {
      id: p._id.toString(),
      isAvailable: p.isAvailable,
    };
  }

  @ApiOperation({ summary: 'Excluir produto (soft delete)' })
  @Delete(':id')
  async delete(@CurrentCompany() company: any, @Param('id') id: string) {
    await this.productsService.delete(company._id, id);
    return { success: true, message: 'Produto removido com sucesso' };
  }
}
