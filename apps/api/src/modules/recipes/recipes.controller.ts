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
import { RecipesService } from './recipes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CreateRecipeInput, UpdateRecipeInput } from '@koki/validation';

@ApiTags('recipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @ApiOperation({ summary: 'Listar receitas e fichas técnicas com filtros' })
  @Get()
  async findAll(
    @CurrentCompany() company: any,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recipesService.findAll(company._id, {
      category,
      search,
      sortBy,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @ApiOperation({ summary: 'Resumo geral de receitas e custos' })
  @Get('summary')
  async getSummary(@CurrentCompany() company: any) {
    return this.recipesService.getSummary(company._id);
  }

  @ApiOperation({ summary: 'Categorias distintas de receitas' })
  @Get('categories')
  async getCategories(@CurrentCompany() company: any) {
    return this.recipesService.getCategories(company._id);
  }

  @ApiOperation({ summary: 'Obter ficha técnica por ID' })
  @Get(':id')
  async findById(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.recipesService.findById(company._id, id);
  }

  @ApiOperation({ summary: 'Escalonar proporções da receita dinamicamente' })
  @Get(':id/scale')
  async scale(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Query('multiplier') multiplier?: string,
    @Query('targetYield') targetYield?: string,
  ) {
    return this.recipesService.scale(
      company._id,
      id,
      multiplier ? parseFloat(multiplier) : undefined,
      targetYield ? parseFloat(targetYield) : undefined,
    );
  }

  @ApiOperation({ summary: 'Cadastrar nova ficha técnica de receita' })
  @Post()
  async create(
    @CurrentCompany() company: any,
    @Body() input: CreateRecipeInput,
  ) {
    return this.recipesService.create(company._id, input);
  }

  @ApiOperation({ summary: 'Atualizar ficha técnica' })
  @Put(':id')
  async update(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateRecipeInput,
  ) {
    return this.recipesService.update(company._id, id, input);
  }

  @ApiOperation({ summary: 'Atualização parcial de ficha técnica' })
  @Patch(':id')
  async patch(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateRecipeInput,
  ) {
    return this.recipesService.update(company._id, id, input);
  }

  @ApiOperation({ summary: 'Excluir ficha técnica' })
  @Delete(':id')
  async remove(@CurrentCompany() company: any, @Param('id') id: string) {
    return this.recipesService.remove(company._id, id);
  }
}
