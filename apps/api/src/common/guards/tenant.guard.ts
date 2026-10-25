import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Membership, MembershipDocument } from '../../modules/memberships/schemas/membership.schema';
import { Company, CompanyDocument } from '../../modules/companies/schemas/company.schema';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    // Determine target companyId
    const companyIdFromHeader = request.headers['x-company-id'];
    const companyIdFromParams = request.params?.companyId;
    const companyIdFromQuery = request.query?.companyId;
    const companyIdFromBody = request.body?.companyId;

    const rawCompanyId =
      companyIdFromHeader ||
      companyIdFromParams ||
      companyIdFromQuery ||
      companyIdFromBody ||
      user.currentCompanyId;

    if (!rawCompanyId) {
      // If user has no currentCompanyId yet (e.g. before completing onboarding), allow onboarding endpoints
      if (request.url.includes('/companies/onboarding') || request.url.includes('/users/me')) {
        return true;
      }
      throw new ForbiddenException('Nenhuma empresa ativa selecionada');
    }

    let targetCompanyObjectId: Types.ObjectId;
    try {
      targetCompanyObjectId = new Types.ObjectId(rawCompanyId.toString());
    } catch {
      throw new ForbiddenException('Identificador de empresa inválido');
    }

    const membership = await this.membershipModel.findOne({
      userId: new Types.ObjectId(user.id || user._id),
      companyId: targetCompanyObjectId,
    });

    if (!membership) {
      throw new ForbiddenException('Você não possui permissão de acesso para esta empresa');
    }

    const company = await this.companyModel.findById(targetCompanyObjectId);
    if (!company) {
      throw new ForbiddenException('Empresa não encontrada');
    }

    if (company.status === 'suspended') {
      throw new ForbiddenException('Acesso suspenso para esta empresa. Contate o suporte.');
    }

    request.companyId = targetCompanyObjectId.toString();
    request.company = company;
    request.membership = membership;

    return true;
  }
}
