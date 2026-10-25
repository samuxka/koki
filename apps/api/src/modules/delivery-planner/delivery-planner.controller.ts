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
import { DeliveryPlannerService } from './delivery-planner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import {
  CreateDeliveryItemInput,
  UpdateDeliveryItemInput,
  UpdateDeliveryStatusInput,
} from '@koki/validation';

@ApiTags('delivery-planner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('delivery-planner')
export class DeliveryPlannerController {
  constructor(private readonly deliveryPlannerService: DeliveryPlannerService) {}

  @ApiOperation({ summary: 'Obter rotas e entregas do dia por turno' })
  @Get('daily')
  async getDailyDeliveries(
    @CurrentCompany() company: any,
    @Query('date') date?: string,
  ) {
    return this.deliveryPlannerService.getDailyDeliveries(company._id, date);
  }

  @ApiOperation({ summary: 'Criar entrega ou parada de rota' })
  @Post()
  async createDelivery(
    @CurrentCompany() company: any,
    @Body() input: CreateDeliveryItemInput,
  ) {
    return this.deliveryPlannerService.createDelivery(company._id, input);
  }

  @ApiOperation({ summary: 'Atualizar informações da entrega' })
  @Put(':id')
  async updateDelivery(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateDeliveryItemInput,
  ) {
    return this.deliveryPlannerService.updateDelivery(company._id, id, input);
  }

  @ApiOperation({ summary: 'Atualizar status da rota (Pendente -> Em Rota -> Entregue -> Não Entregue)' })
  @Patch(':id/status')
  async updateDeliveryStatus(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body() input: UpdateDeliveryStatusInput,
  ) {
    return this.deliveryPlannerService.updateDeliveryStatus(company._id, id, input);
  }

  @ApiOperation({ summary: 'Atribuir entregador/motoboy à entrega' })
  @Patch(':id/driver')
  async assignDriver(
    @CurrentCompany() company: any,
    @Param('id') id: string,
    @Body('driverName') driverName: string,
  ) {
    return this.deliveryPlannerService.assignDriver(company._id, id, driverName);
  }

  @ApiOperation({ summary: 'Excluir entrega da rota' })
  @Delete(':id')
  async deleteDelivery(
    @CurrentCompany() company: any,
    @Param('id') id: string,
  ) {
    return this.deliveryPlannerService.deleteDelivery(company._id, id);
  }
}
