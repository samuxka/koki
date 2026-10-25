import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserPreferences } from '@koki/types';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    const profile = await this.usersService.findById(user._id || user.id);
    return {
      id: profile._id.toString(),
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified,
      currentCompanyId: profile.currentCompanyId?.toString(),
      preferences: profile.preferences,
      createdAt: (profile as any).createdAt,
      updatedAt: (profile as any).updatedAt,
    };
  }

  @ApiOperation({ summary: 'Atualizar preferências do usuário' })
  @Put('me/preferences')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() preferences: Partial<UserPreferences>,
  ) {
    const updated = await this.usersService.updatePreferences(
      user._id || user.id,
      preferences,
    );
    return updated.preferences;
  }
}
