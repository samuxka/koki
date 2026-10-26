import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Coupon as ICoupon,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponInput,
  ValidateCouponResult,
  CouponQuotaResponse,
  CouponStatus,
} from '@koki/types';
import { Coupon, CouponDocument } from './schemas/coupon.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name)
    private couponModel: Model<CouponDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapCoupon(doc: CouponDocument): ICoupon {
    const raw = doc.toObject ? doc.toObject() : doc;
    const today = new Date().toISOString().split('T')[0];

    let computedStatus: CouponStatus = 'active';
    if (!raw.isActive) {
      computedStatus = 'inactive';
    } else if (raw.expiresAt && raw.expiresAt < today) {
      computedStatus = 'expired';
    } else if (raw.usageLimit && raw.usageLimit > 0 && raw.usageCount >= raw.usageLimit) {
      computedStatus = 'depleted';
    }

    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      code: raw.code,
      description: raw.description,
      discountType: raw.discountType,
      discountValue: raw.discountValue,
      minOrderAmountCents: raw.minOrderAmountCents || 0,
      maxDiscountAmountCents: raw.maxDiscountAmountCents,
      usageLimit: raw.usageLimit || 0,
      usageCount: raw.usageCount || 0,
      usageLimitPerCustomer: raw.usageLimitPerCustomer,
      startDate: raw.startDate,
      expiresAt: raw.expiresAt,
      isActive: raw.isActive ?? true,
      computedStatus,
      applicableProductIds: raw.applicableProductIds?.map((id: any) => id.toString()),
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async getQuota(companyId: string | Types.ObjectId): Promise<CouponQuotaResponse> {
    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const limit = entitlements.limits.activeCouponsLimit; // 0, 10, -1

    const activeCount = await this.couponModel.countDocuments({
      companyId: new Types.ObjectId(companyId.toString()),
      isActive: true,
    });

    const canCreate = limit === -1 || activeCount < limit;

    return {
      activeCouponsCount: activeCount,
      activeCouponsLimit: limit,
      canCreate,
      tier: entitlements.tier,
    };
  }

  async findAll(
    companyId: string | Types.ObjectId,
    status?: string,
    search?: string,
  ): Promise<ICoupon[]> {
    const query: any = {
      companyId: new Types.ObjectId(companyId.toString()),
    };

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { code: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const docs = await this.couponModel.find(query).sort({ createdAt: -1 });
    const mapped = docs.map((d) => this.mapCoupon(d));

    if (status && status !== 'all') {
      return mapped.filter((c) => c.computedStatus === status);
    }

    return mapped;
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<ICoupon> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de cupom inválido');
    }

    const doc = await this.couponModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
    });

    if (!doc) {
      throw new NotFoundException('Cupom não encontrado');
    }

    return this.mapCoupon(doc);
  }

  async create(companyId: string | Types.ObjectId, dto: CreateCouponDto): Promise<ICoupon> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // 1. Quota & Entitlement check
    const quota = await this.getQuota(companyObjectId);
    if (!quota.canCreate) {
      throw new ForbiddenException(
        quota.activeCouponsLimit === 0
          ? 'O plano Free não inclui cupons promocionais. Faça upgrade para o plano Pro para criar até 10 cupons ativos!'
          : `Você atingiu o limite de ${quota.activeCouponsLimit} cupons ativos do plano Pro. Faça upgrade para o plano Business para cupons ilimitados!`,
      );
    }

    const normalizedCode = dto.code.trim().toUpperCase();

    // 2. Uniqueness check for this company
    const existing = await this.couponModel.findOne({
      companyId: companyObjectId,
      code: normalizedCode,
    });

    if (existing) {
      throw new BadRequestException(`Já existe um cupom com o código "${normalizedCode}"`);
    }

    // 3. Create document
    const doc = await this.couponModel.create({
      companyId: companyObjectId,
      code: normalizedCode,
      description: dto.description?.trim(),
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderAmountCents: dto.minOrderAmountCents || 0,
      maxDiscountAmountCents: dto.maxDiscountAmountCents,
      usageLimit: dto.usageLimit || 0,
      usageCount: 0,
      usageLimitPerCustomer: dto.usageLimitPerCustomer,
      usedByCustomerIds: [],
      startDate: dto.startDate,
      expiresAt: dto.expiresAt,
      isActive: dto.isActive ?? true,
      applicableProductIds: dto.applicableProductIds?.map((id) => new Types.ObjectId(id)),
    });

    return this.mapCoupon(doc);
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<ICoupon> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de cupom inválido');
    }

    const companyObjectId = new Types.ObjectId(companyId.toString());
    const doc = await this.couponModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
    });

    if (!doc) {
      throw new NotFoundException('Cupom não encontrado');
    }

    if (dto.code) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (normalizedCode !== doc.code) {
        const existing = await this.couponModel.findOne({
          companyId: companyObjectId,
          code: normalizedCode,
          _id: { $ne: doc._id },
        });
        if (existing) {
          throw new BadRequestException(`Já existe outro cupom com o código "${normalizedCode}"`);
        }
        doc.code = normalizedCode;
      }
    }

    if (dto.description !== undefined) doc.description = dto.description?.trim();
    if (dto.discountType) doc.discountType = dto.discountType;
    if (dto.discountValue !== undefined) doc.discountValue = dto.discountValue;
    if (dto.minOrderAmountCents !== undefined) doc.minOrderAmountCents = dto.minOrderAmountCents;
    if (dto.maxDiscountAmountCents !== undefined) doc.maxDiscountAmountCents = dto.maxDiscountAmountCents;
    if (dto.usageLimit !== undefined) doc.usageLimit = dto.usageLimit;
    if (dto.usageLimitPerCustomer !== undefined) doc.usageLimitPerCustomer = dto.usageLimitPerCustomer;
    if (dto.startDate !== undefined) doc.startDate = dto.startDate;
    if (dto.expiresAt !== undefined) doc.expiresAt = dto.expiresAt;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    if (dto.applicableProductIds) {
      doc.applicableProductIds = dto.applicableProductIds.map((pid) => new Types.ObjectId(pid));
    }

    await doc.save();
    return this.mapCoupon(doc);
  }

  async remove(companyId: string | Types.ObjectId, id: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de cupom inválido');
    }

    const res = await this.couponModel.deleteOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
    });

    if (res.deletedCount === 0) {
      throw new NotFoundException('Cupom não encontrado');
    }

    return { success: true };
  }

  async validateCoupon(
    companyId: string | Types.ObjectId,
    input: ValidateCouponInput,
  ): Promise<ValidateCouponResult> {
    const normalizedCode = (input.code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return { valid: false, discountCents: 0, message: 'Código de cupom obrigatório.' };
    }

    const doc = await this.couponModel.findOne({
      companyId: new Types.ObjectId(companyId.toString()),
      code: normalizedCode,
    });

    if (!doc || !doc.isActive) {
      return { valid: false, discountCents: 0, message: 'Cupom inválido ou inativo.' };
    }

    const today = new Date().toISOString().split('T')[0];

    // Check Start Date
    if (doc.startDate && doc.startDate > today) {
      return {
        valid: false,
        discountCents: 0,
        message: `Este cupom só será válido a partir de ${doc.startDate}.`,
      };
    }

    // Check Expiration Date
    if (doc.expiresAt && doc.expiresAt < today) {
      return {
        valid: false,
        discountCents: 0,
        message: `Este cupom expirou em ${doc.expiresAt}.`,
      };
    }

    // Check Total Usage Limit
    if (doc.usageLimit && doc.usageLimit > 0 && doc.usageCount >= doc.usageLimit) {
      return {
        valid: false,
        discountCents: 0,
        message: 'Este cupom atingiu o limite máximo de utilizações.',
      };
    }

    // Check Minimum Order Amount
    const orderTotal = Math.max(0, input.orderTotalCents || 0);
    if (doc.minOrderAmountCents && doc.minOrderAmountCents > 0 && orderTotal < doc.minOrderAmountCents) {
      const minEuro = (doc.minOrderAmountCents / 100).toFixed(2);
      return {
        valid: false,
        discountCents: 0,
        message: `O pedido mínimo para este cupom é de ${minEuro} €.`,
      };
    }

    // Check Per Customer Usage
    if (input.customerId && doc.usageLimitPerCustomer && doc.usageLimitPerCustomer > 0) {
      const customerObjectId = new Types.ObjectId(input.customerId);
      const usedTimes = (doc.usedByCustomerIds || []).filter(
        (cid) => cid.toString() === customerObjectId.toString(),
      ).length;
      if (usedTimes >= doc.usageLimitPerCustomer) {
        return {
          valid: false,
          discountCents: 0,
          message: `Você já atingiu o limite de ${doc.usageLimitPerCustomer} uso(s) deste cupom.`,
        };
      }
    }

    // Calculate Discount
    let discountCents = 0;
    if (doc.discountType === 'fixed') {
      discountCents = Math.min(doc.discountValue, orderTotal);
    } else {
      // Percentage
      const percent = Math.min(100, Math.max(0, doc.discountValue));
      discountCents = Math.round(orderTotal * (percent / 100));

      // Check max discount ceiling
      if (doc.maxDiscountAmountCents && doc.maxDiscountAmountCents > 0) {
        discountCents = Math.min(discountCents, doc.maxDiscountAmountCents);
      }
    }

    const mapped = this.mapCoupon(doc);

    return {
      valid: true,
      coupon: mapped,
      discountCents,
      message: 'Cupom aplicado com sucesso!',
    };
  }

  async incrementUsage(
    companyId: string | Types.ObjectId,
    couponId: string | Types.ObjectId,
    customerId?: string | Types.ObjectId,
  ): Promise<void> {
    const update: any = {
      $inc: { usageCount: 1 },
    };

    if (customerId) {
      update.$push = { usedByCustomerIds: new Types.ObjectId(customerId.toString()) };
    }

    await this.couponModel.updateOne(
      {
        _id: new Types.ObjectId(couponId.toString()),
        companyId: new Types.ObjectId(companyId.toString()),
      },
      update,
    );
  }
}
