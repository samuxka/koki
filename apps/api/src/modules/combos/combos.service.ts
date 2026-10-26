import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Combo as ICombo,
  CreateComboDto,
  UpdateComboDto,
  ComboQuotaResponse,
} from '@koki/types';
import { Combo, ComboDocument } from './schemas/combo.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class CombosService {
  constructor(
    @InjectModel(Combo.name)
    private comboModel: Model<ComboDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapCombo(doc: ComboDocument): ICombo {
    const raw = doc.toObject ? doc.toObject() : doc;

    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      name: raw.name,
      description: raw.description,
      category: raw.category || 'Combos & Kits',
      imageUrl: raw.imageUrl,
      items: (raw.items || []).map((i: any) => ({
        productId: i.productId.toString(),
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        unitCostCents: i.unitCostCents,
        flavor: i.flavor,
        notes: i.notes,
      })),
      originalTotalCents: raw.originalTotalCents || 0,
      totalCostCents: raw.totalCostCents || 0,
      priceCents: raw.priceCents || 0,
      discountCents: raw.discountCents || 0,
      discountPercent: raw.discountPercent || 0,
      profitCents: raw.profitCents || 0,
      profitMarginPercent: raw.profitMarginPercent || 0,
      isAvailable: raw.isAvailable ?? true,
      minLeadTimeHours: raw.minLeadTimeHours || 0,
      syncAsProduct: raw.syncAsProduct ?? true,
      productId: raw.productId ? raw.productId.toString() : undefined,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async getQuota(companyId: string | Types.ObjectId): Promise<ComboQuotaResponse> {
    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const limit = entitlements.limits.combosLimit; // 2, 30, -1

    const count = await this.comboModel.countDocuments({
      companyId: new Types.ObjectId(companyId.toString()),
    });

    const canCreate = limit === -1 || count < limit;

    return {
      combosCount: count,
      combosLimit: limit,
      canCreate,
      tier: entitlements.tier,
    };
  }

  async findAll(
    companyId: string | Types.ObjectId,
    search?: string,
    category?: string,
    isAvailable?: string,
  ): Promise<ICombo[]> {
    const query: any = {
      companyId: new Types.ObjectId(companyId.toString()),
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (isAvailable !== undefined && isAvailable !== 'all') {
      query.isAvailable = isAvailable === 'true';
    }

    if (search && search.trim()) {
      const clean = search.trim();
      query.$or = [
        { name: { $regex: clean, $options: 'i' } },
        { description: { $regex: clean, $options: 'i' } },
        { 'items.productName': { $regex: clean, $options: 'i' } },
      ];
    }

    const docs = await this.comboModel.find(query).sort({ createdAt: -1 });
    return docs.map((d) => this.mapCombo(d));
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<ICombo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de combo inválido');
    }

    const doc = await this.comboModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
    });

    if (!doc) {
      throw new NotFoundException('Combo não encontrado');
    }

    return this.mapCombo(doc);
  }

  async create(companyId: string | Types.ObjectId, dto: CreateComboDto): Promise<ICombo> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // 1. Check Quota
    const quota = await this.getQuota(companyObjectId);
    if (!quota.canCreate) {
      throw new ForbiddenException(
        quota.combosLimit === 2
          ? 'Você atingiu o limite de 2 combos do plano Free. Faça upgrade para o plano Pro para criar até 30 combos!'
          : `Você atingiu o limite de ${quota.combosLimit} combos do seu plano. Faça upgrade para o plano Business para combos ilimitados!`,
      );
    }

    // 2. Compute Financials
    const items = dto.items.map((i) => ({
      productId: new Types.ObjectId(i.productId),
      productName: i.productName.trim(),
      quantity: Math.max(1, i.quantity),
      unitPriceCents: Math.max(0, i.unitPriceCents),
      unitCostCents: Math.max(0, i.unitCostCents),
      flavor: i.flavor?.trim(),
      notes: i.notes?.trim(),
    }));

    const originalTotalCents = items.reduce(
      (acc, item) => acc + item.quantity * item.unitPriceCents,
      0,
    );
    const totalCostCents = items.reduce(
      (acc, item) => acc + item.quantity * item.unitCostCents,
      0,
    );
    const priceCents = Math.max(0, dto.priceCents);
    const discountCents = Math.max(0, originalTotalCents - priceCents);
    const discountPercent =
      originalTotalCents > 0
        ? Math.round((discountCents / originalTotalCents) * 100)
        : 0;
    const profitCents = Math.max(0, priceCents - totalCostCents);
    const profitMarginPercent =
      priceCents > 0 ? Math.round((profitCents / priceCents) * 100) : 0;

    let createdProductObjectId: Types.ObjectId | undefined;

    // 3. Sync as Product in catalog if enabled
    if (dto.syncAsProduct !== false) {
      const product = await this.productModel.create({
        companyId: companyObjectId,
        name: dto.name.trim(),
        category: dto.category?.trim() || 'Combos & Kits',
        description: dto.description?.trim(),
        unit: 'kit',
        priceCents,
        costCents: totalCostCents,
        isAvailable: dto.isAvailable ?? true,
        isCombo: true,
      });
      createdProductObjectId = product._id as Types.ObjectId;
    }

    // 4. Create Combo Document
    const doc = await this.comboModel.create({
      companyId: companyObjectId,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      category: dto.category?.trim() || 'Combos & Kits',
      imageUrl: dto.imageUrl,
      items,
      originalTotalCents,
      totalCostCents,
      priceCents,
      discountCents,
      discountPercent,
      profitCents,
      profitMarginPercent,
      isAvailable: dto.isAvailable ?? true,
      minLeadTimeHours: dto.minLeadTimeHours || 0,
      syncAsProduct: dto.syncAsProduct !== false,
      productId: createdProductObjectId,
    });

    return this.mapCombo(doc);
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    dto: UpdateComboDto,
  ): Promise<ICombo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de combo inválido');
    }

    const companyObjectId = new Types.ObjectId(companyId.toString());
    const doc = await this.comboModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
    });

    if (!doc) {
      throw new NotFoundException('Combo não encontrado');
    }

    if (dto.name) doc.name = dto.name.trim();
    if (dto.description !== undefined) doc.description = dto.description?.trim();
    if (dto.category) doc.category = dto.category.trim();
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl;
    if (dto.minLeadTimeHours !== undefined) doc.minLeadTimeHours = dto.minLeadTimeHours;
    if (dto.isAvailable !== undefined) doc.isAvailable = dto.isAvailable;

    if (dto.items) {
      doc.items = dto.items.map((i) => ({
        productId: new Types.ObjectId(i.productId),
        productName: i.productName.trim(),
        quantity: Math.max(1, i.quantity),
        unitPriceCents: Math.max(0, i.unitPriceCents),
        unitCostCents: Math.max(0, i.unitCostCents),
        flavor: i.flavor?.trim(),
        notes: i.notes?.trim(),
      })) as any;
    }

    // Recalculate
    const priceCents = dto.priceCents !== undefined ? Math.max(0, dto.priceCents) : doc.priceCents;
    doc.priceCents = priceCents;

    const originalTotalCents = doc.items.reduce(
      (acc, item) => acc + item.quantity * item.unitPriceCents,
      0,
    );
    const totalCostCents = doc.items.reduce(
      (acc, item) => acc + item.quantity * item.unitCostCents,
      0,
    );
    const discountCents = Math.max(0, originalTotalCents - priceCents);
    const discountPercent =
      originalTotalCents > 0
        ? Math.round((discountCents / originalTotalCents) * 100)
        : 0;
    const profitCents = Math.max(0, priceCents - totalCostCents);
    const profitMarginPercent =
      priceCents > 0 ? Math.round((profitCents / priceCents) * 100) : 0;

    doc.originalTotalCents = originalTotalCents;
    doc.totalCostCents = totalCostCents;
    doc.discountCents = discountCents;
    doc.discountPercent = discountPercent;
    doc.profitCents = profitCents;
    doc.profitMarginPercent = profitMarginPercent;

    // Sync product if linked
    if (doc.productId) {
      await this.productModel.updateOne(
        { _id: doc.productId, companyId: companyObjectId },
        {
          name: doc.name,
          category: doc.category,
          description: doc.description,
          priceCents: doc.priceCents,
          costCents: doc.totalCostCents,
          isAvailable: doc.isAvailable,
        },
      );
    }

    await doc.save();
    return this.mapCombo(doc);
  }

  async remove(companyId: string | Types.ObjectId, id: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de combo inválido');
    }

    const companyObjectId = new Types.ObjectId(companyId.toString());
    const doc = await this.comboModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
    });

    if (!doc) {
      throw new NotFoundException('Combo não encontrado');
    }

    // Soft delete corresponding catalog product if linked
    if (doc.productId) {
      await this.productModel.updateOne(
        { _id: doc.productId, companyId: companyObjectId },
        { deletedAt: new Date(), isAvailable: false },
      );
    }

    await this.comboModel.deleteOne({ _id: doc._id });
    return { success: true };
  }

  async toggleAvailability(companyId: string | Types.ObjectId, id: string): Promise<ICombo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de combo inválido');
    }

    const companyObjectId = new Types.ObjectId(companyId.toString());
    const doc = await this.comboModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
    });

    if (!doc) {
      throw new NotFoundException('Combo não encontrado');
    }

    doc.isAvailable = !doc.isAvailable;
    await doc.save();

    if (doc.productId) {
      await this.productModel.updateOne(
        { _id: doc.productId, companyId: companyObjectId },
        { isAvailable: doc.isAvailable },
      );
    }

    return this.mapCombo(doc);
  }
}
