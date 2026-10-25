import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { MembershipsService } from '../memberships/memberships.service';
import { RegisterInput, LoginInput } from '@koki/validation';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private membershipsService: MembershipsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(input: RegisterInput) {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new BadRequestException('Já existe uma conta com este e-mail');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await this.usersService.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
    });

    return this.generateTokens(user._id, user.email);
  }

  async login(input: LoginInput) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    return this.generateTokens(user._id, user.email, user.currentCompanyId?.toString());
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Token de atualização não fornecido');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.usersService.findValidRefreshToken(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedException('Token de atualização inválido ou expirado');
    }

    const user = await this.usersService.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Rotating tokens: revoke old token and generate new pair
    const newTokens = await this.generateTokens(user._id, user.email, user.currentCompanyId?.toString());
    const newTokenHash = this.hashToken(newTokens.refreshToken);
    await this.usersService.revokeRefreshToken(tokenHash, newTokenHash);

    return newTokens;
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.usersService.revokeRefreshToken(tokenHash);
    } else if (userId) {
      await this.usersService.revokeAllUserTokens(new Types.ObjectId(userId));
    }
    return { success: true, message: 'Sessão encerrada com sucesso' };
  }

  private async generateTokens(userId: Types.ObjectId, email: string, companyId?: string) {
    const payload = {
      sub: userId.toString(),
      email,
      companyId: companyId || null,
    };

    const accessToken = this.jwtService.sign(payload);

    // Refresh token is a secure random string
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshExpiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresInDays);

    await this.usersService.saveRefreshToken(userId, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: userId.toString(),
        email,
        currentCompanyId: companyId || null,
      },
    };
  }
}
