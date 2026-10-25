import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashflowService } from './cashflow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateCashAccountInput,
  CreateCashTransactionInput,
  CreateTransferInput,
} from '@koki/validation';

@ApiTags('cash')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('cash')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @ApiOperation({ summary: 'Obter resumo consolidado do caixa e caixinhas' })
  @Get('summary')
  async getSummary(
    @CurrentCompany() company: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashflowService.getSummary(
      company._id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @ApiOperation({ summary: 'Listar todas as caixinhas (contas financeiras)' })
  @Get('accounts')
  async getAccounts(@CurrentCompany() company: any) {
    const accounts = await this.cashflowService.getAccounts(company._id);
    return accounts.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      type: a.type,
      icon: a.icon,
      color: a.color,
      currentBalanceCents: a.currentBalanceCents,
      description: a.description,
      isDefault: a.isDefault,
    }));
  }

  @ApiOperation({ summary: 'Criar nova caixinha' })
  @Post('accounts')
  async createAccount(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Body() input: CreateCashAccountInput,
  ) {
    const account = await this.cashflowService.createAccount(
      company._id,
      input,
      user?.id,
    );
    return {
      id: account._id.toString(),
      name: account.name,
      type: account.type,
      icon: account.icon,
      color: account.color,
      currentBalanceCents: account.currentBalanceCents,
    };
  }

  @ApiOperation({ summary: 'Listar histórico de transações com filtros e paginação' })
  @Get('transactions')
  async getTransactions(
    @CurrentCompany() company: any,
    @Query('type') type?: string,
    @Query('cashAccountId') cashAccountId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.cashflowService.getTransactions(
      company._id,
      type,
      cashAccountId,
      category,
      search,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @ApiOperation({ summary: 'Lançar nova entrada financeira' })
  @Post('transactions/income')
  async createIncome(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Body() input: Omit<CreateCashTransactionInput, 'type'>,
  ) {
    return this.cashflowService.createTransaction(
      company._id,
      { ...input, type: 'income' },
      user?.id,
    );
  }

  @ApiOperation({ summary: 'Lançar nova saída (despesa)' })
  @Post('transactions/expense')
  async createExpense(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Body() input: Omit<CreateCashTransactionInput, 'type'>,
  ) {
    return this.cashflowService.createTransaction(
      company._id,
      { ...input, type: 'expense' },
      user?.id,
    );
  }

  @ApiOperation({ summary: 'Realizar transferência interna entre caixinhas' })
  @Post('transactions/transfer')
  async transfer(
    @CurrentCompany() company: any,
    @CurrentUser() user: any,
    @Body() input: CreateTransferInput,
  ) {
    return this.cashflowService.transfer(company._id, input, user?.id);
  }

  @ApiOperation({ summary: 'Obter dados para o gráfico de fluxo de caixa' })
  @Get('flow-chart')
  async getFlowChart(
    @CurrentCompany() company: any,
    @Query('period') period = 'month',
  ) {
    return this.cashflowService.getFlowChart(company._id, period);
  }
}
