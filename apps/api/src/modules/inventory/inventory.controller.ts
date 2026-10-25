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
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateInventoryMovementInput,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '@koki/validation';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Listar insumos do estoque com filtros e busca' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.findAll(company._id, {
      category,
      search,
      lowStock: lowStock === 'true',
      sortBy,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @ApiOperation({ summary: 'Resumo estatístico do estoque de insumos' })
  @Get('summary')
  async getSummary(@CurrentCompany() company: any) {
    return this.inventoryService.getSummary(company._id);
  }

  @ApiOperation({ summary: 'Lista de compras inteligente de insumos em falta' })
  @Get('shopping-list')
  async getShoppingList(@CurrentCompany() company: any) {
    return this.inventoryService.getShoppingList(company._id);
  }

  @ApiOperation({ summary: 'Adicionar item manual ou de estoque à lista de compras' })
  @Post('shopping-list')
  async addShoppingListItem(
    @CurrentCompany() company: any,
    @Body() input: CreateShoppingListItemInput,
  ) {
    return this.inventoryService.addShoppingListItem(company._id, input);
  }

  @ApiOperation({ summary: 'Dar entrada no estoque para todos os itens comprados' })
  @Post('shopping-list/restock-purchased')
  async restockPurchased(@CurrentCompany() company: any) {
    return this.inventoryService.restockPurchasedItems(company._id);
  }

  @ApiOperation({ summary: 'Limpar todos os itens marcados como comprados da lista' })
  @Post('shopping-list/clear-purchased')
  async clearPurchased(@CurrentCompany() company: any) {
    return this.inventoryService.clearPurchased(company._id);
  }

  @ApiOperation({ summary: 'Alternar status de comprado de um item da lista' })
  @Patch('shopping-list/:id/toggle')
  async toggleShoppingListItem(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.inventoryService.toggleShoppingListItem(company._id, id);
  }

  @ApiOperation({ summary: 'Atualizar quantidade ou notas de um item da lista' })
  @Patch('shopping-list/:id')
  async updateShoppingListItem(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateShoppingListItemInput,
  ) {
    return this.inventoryService.updateShoppingListItem(company._id, id, input);
  }

  @ApiOperation({ summary: 'Remover item da lista de compras' })
  @Delete('shopping-list/:id')
  async removeShoppingListItem(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.inventoryService.removeShoppingListItem(company._id, id);
  }

  @ApiOperation({ summary: 'Categorias distintas de insumos' })
  @Get('categories')
  async getCategories(@CurrentCompany() company: any) {
    return this.inventoryService.getCategories(company._id);
  }

  @ApiOperation({ summary: 'Detalhes de um insumo específico' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.inventoryService.findById(company._id, id);
  }

  @ApiOperation({ summary: 'Histórico de movimentações de um insumo' })
  @Get(':id/movements')
  async getMovements(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getMovements(
      company._id,
      id,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Cadastrar novo insumo' })
  @Post()
  async create(
    @CurrentCompany() company: any,
    @Body() input: CreateInventoryItemInput,
  ) {
    return this.inventoryService.create(company._id, input);
  }

  @ApiOperation({ summary: 'Atualizar dados de um insumo' })
  @Put(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateInventoryItemInput,
  ) {
    return this.inventoryService.update(company._id, id, input);
  }

  @ApiOperation({ summary: 'Atualização parcial de um insumo' })
  @Patch(':id')
  async patch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateInventoryItemInput,
  ) {
    return this.inventoryService.update(company._id, id, input);
  }

  @ApiOperation({ summary: 'Excluir insumo do estoque' })
  @Delete(':id')
  async remove(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.inventoryService.remove(company._id, id);
  }

  @ApiOperation({ summary: 'Registrar entrada, saída ou ajuste de estoque' })
  @Post(':id/movements')
  async addMovement(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: CreateInventoryMovementInput,
  ) {
    return this.inventoryService.addMovement(company._id, id, input);
  }
}
