import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'koki-super-secret-jwt-key-2026-production-ready',
    });
  }

  async validate(payload: { sub: string; email: string; companyId?: string }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      currentCompanyId: payload.companyId || user.currentCompanyId?.toString(),
      preferences: user.preferences,
    };
  }
}
