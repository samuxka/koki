import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LabelBatch as ILabelBatch,
  CreateLabelBatchDto,
  LabelQuotaResponse,
  LabelBatchStatus,
} from '@koki/types';
import { LabelBatch, LabelBatchDocument } from './schemas/label-batch.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';

@Injectable()
export class LabelsService {
  constructor(
    @InjectModel(LabelBatch.name)
    private labelBatchModel: Model<LabelBatchDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapBatch(doc: LabelBatchDocument): ILabelBatch {
    const raw = doc.toObject ? doc.toObject() : doc;
    const today = new Date().toISOString().split('T')[0];

    // Compute dynamic status
    let currentStatus: LabelBatchStatus = (raw.status as LabelBatchStatus) || 'active';
    if (currentStatus !== 'depleted') {
      if (raw.expiryDate < today) {
        currentStatus = 'expired';
      } else {
        const expiryDateObj = new Date(raw.expiryDate);
        const todayObj = new Date(today);
        const diffDays = Math.ceil(
          (expiryDateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays <= 2 && diffDays >= 0) {
          currentStatus = 'expiring_soon';
        }
      }
    }

    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      batchCode: raw.batchCode,
      productName: raw.productName,
      productId: raw.productId ? raw.productId.toString() : undefined,
      recipeId: raw.recipeId ? raw.recipeId.toString() : undefined,
      productionDate: raw.productionDate,
      expiryDate: raw.expiryDate,
      shelfLifeDays: raw.shelfLifeDays,
      storageCondition: raw.storageCondition,
      netWeight: raw.netWeight,
      ingredientsText: raw.ingredientsText,
      allergensText: raw.allergensText,
      nutritionalHighlights: raw.nutritionalHighlights,
      labelSize: raw.labelSize || 'standard',
      quantity: raw.quantity || 1,
      barcodeOrQrContent: raw.barcodeOrQrContent || raw.batchCode,
      notes: raw.notes,
      status: currentStatus,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  async getQuota(companyId: Types.ObjectId): Promise<LabelQuotaResponse> {
    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const monthlyLimit = entitlements.limits.monthlyLabelsLimit; // 10, 300, -1

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const batchesThisMonth = await this.labelBatchModel.find({
      companyId,
      productionDate: { $gte: firstDay, $lte: lastDay },
    });

    const usedThisMonth = batchesThisMonth.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

    const isLimitReached = monthlyLimit !== -1 && usedThisMonth >= monthlyLimit;
    const remainingThisMonth = monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - usedThisMonth);

    return {
      usedThisMonth,
      monthlyLimit,
      remainingThisMonth,
      isLimitReached,
      tier: entitlements.tier,
    };
  }

  async createBatch(
    companyId: Types.ObjectId,
    dto: CreateLabelBatchDto,
  ): Promise<ILabelBatch> {
    const quota = await this.getQuota(companyId);
    const requestedQty = dto.quantity || 1;

    if (quota.monthlyLimit !== -1 && quota.usedThisMonth + requestedQty > quota.monthlyLimit) {
      throw new ForbiddenException(
        `Limite mensal de etiquetas atingido (${quota.usedThisMonth}/${quota.monthlyLimit} etiquetas usadas no plano ${quota.tier.toUpperCase()}). Faça upgrade para continuar emitindo etiquetas.`,
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const productionDate = dto.productionDate || todayStr;

    // Generate batchCode if not provided: LOT-YYYYMMDD-001
    let batchCode = (dto.batchCode || '').trim();
    if (!batchCode) {
      const cleanDate = productionDate.replace(/-/g, '');
      const existingCount = await this.labelBatchModel.countDocuments({
        companyId,
        productionDate,
      });
      const seq = String(existingCount + 1).padStart(3, '0');
      batchCode = `LOT-${cleanDate}-${seq}`;
    }

    // Expiry date calculation
    let expiryDate = dto.expiryDate;
    if (!expiryDate && dto.shelfLifeDays) {
      const pDate = new Date(productionDate);
      pDate.setDate(pDate.getDate() + Number(dto.shelfLifeDays));
      expiryDate = pDate.toISOString().split('T')[0];
    } else if (!expiryDate) {
      // Default: 3 days for fresh pastries
      const pDate = new Date(productionDate);
      pDate.setDate(pDate.getDate() + 3);
      expiryDate = pDate.toISOString().split('T')[0];
    }

    const created = await this.labelBatchModel.create({
      companyId,
      batchCode,
      productName: dto.productName,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      recipeId: dto.recipeId ? new Types.ObjectId(dto.recipeId) : undefined,
      productionDate,
      expiryDate,
      shelfLifeDays: dto.shelfLifeDays,
      storageCondition: dto.storageCondition || 'Conservar em local seco e fresco',
      netWeight: dto.netWeight,
      ingredientsText: dto.ingredientsText,
      allergensText: dto.allergensText,
      nutritionalHighlights: dto.nutritionalHighlights,
      labelSize: dto.labelSize || 'standard',
      quantity: requestedQty,
      barcodeOrQrContent: batchCode,
      notes: dto.notes,
      status: 'active',
    });

    return this.mapBatch(created);
  }

  async getBatches(
    companyId: Types.ObjectId,
    search?: string,
    statusFilter?: string,
  ): Promise<ILabelBatch[]> {
    const filter: Record<string, any> = { companyId };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ productName: regex }, { batchCode: regex }];
    }

    const docs = await this.labelBatchModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    let mapped = docs.map((d) => this.mapBatch(d));

    if (statusFilter && statusFilter !== 'all') {
      mapped = mapped.filter((b) => b.status === statusFilter);
    }

    return mapped;
  }

  async getBatchById(
    companyId: Types.ObjectId,
    id: string,
  ): Promise<ILabelBatch> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lote não encontrado');
    }

    const doc = await this.labelBatchModel.findOne({
      _id: new Types.ObjectId(id),
      companyId,
    });

    if (!doc) {
      throw new NotFoundException('Lote não encontrado');
    }

    return this.mapBatch(doc);
  }

  async updateStatus(
    companyId: Types.ObjectId,
    id: string,
    status: LabelBatchStatus,
  ): Promise<ILabelBatch> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lote não encontrado');
    }

    const doc = await this.labelBatchModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), companyId },
      { $set: { status } },
      { new: true },
    );

    if (!doc) {
      throw new NotFoundException('Lote não encontrado');
    }

    return this.mapBatch(doc);
  }

  async deleteBatch(companyId: Types.ObjectId, id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lote não encontrado');
    }

    const result = await this.labelBatchModel.deleteOne({
      _id: new Types.ObjectId(id),
      companyId,
    });

    return (result.deletedCount || 0) > 0;
  }

  async getPrintableHtml(companyId: Types.ObjectId, id: string): Promise<string> {
    const batch = await this.getBatchById(companyId, id);
    const company = await this.companyModel.findById(companyId);
    const tradeName = company?.tradeName || 'Confeitaria Artesanal';
    const phone = company?.phone || '';
    const address = company?.address?.city || '';

    const labelDimensions =
      batch.labelSize === 'small'
        ? { width: '50mm', height: '30mm', font: '8px' }
        : batch.labelSize === 'large'
        ? { width: '80mm', height: '50mm', font: '11px' }
        : { width: '60mm', height: '40mm', font: '9.5px' };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${batch.batchCode} - ${batch.productName}</title>
  <style>
    @page {
      size: ${labelDimensions.width} ${labelDimensions.height};
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: ${labelDimensions.font};
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
    }
    .label-container {
      width: ${labelDimensions.width};
      height: ${labelDimensions.height};
      box-sizing: border-box;
      padding: 2.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px dashed #ccc;
      page-break-after: always;
    }
    .header {
      border-bottom: 1.5px solid #000;
      padding-bottom: 1.5mm;
      margin-bottom: 1.5mm;
    }
    .company-title {
      font-size: 1.1em;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .product-title {
      font-size: 1.35em;
      font-weight: 900;
      margin-top: 1mm;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-top: 1mm;
    }
    .dates-box {
      background: #f4f4f4;
      border: 1px solid #000;
      padding: 1.5mm;
      margin: 1.5mm 0;
      display: flex;
      justify-content: space-between;
      font-weight: 800;
    }
    .allergens {
      font-size: 0.85em;
      font-weight: 900;
      margin-top: 1mm;
      text-transform: uppercase;
    }
    .ingredients {
      font-size: 0.8em;
      line-height: 1.15;
      color: #222;
    }
    .storage {
      font-size: 0.8em;
      font-weight: 600;
      margin-top: 1mm;
    }
    .footer {
      border-top: 1px solid #000;
      padding-top: 1mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75em;
    }
    .barcode-mock {
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      font-weight: 900;
      font-size: 1.1em;
    }
  </style>
</head>
<body>
  ${Array.from({ length: batch.quantity || 1 })
    .map(
      (_, i) => `
  <div class="label-container">
    <div class="header">
      <div class="company-title">${tradeName}</div>
      <div class="product-title">${batch.productName}</div>
      <div class="meta-row">
        <span>LOTE: ${batch.batchCode}</span>
        ${batch.netWeight ? `<span>PESO LÍQ: ${batch.netWeight}</span>` : ''}
      </div>
    </div>

    <div class="dates-box">
      <div>FAB: ${batch.productionDate}</div>
      <div>VAL: ${batch.expiryDate}</div>
    </div>

    ${
      batch.ingredientsText
        ? `<div class="ingredients"><b>Ingredientes:</b> ${batch.ingredientsText}</div>`
        : ''
    }

    ${
      batch.allergensText
        ? `<div class="allergens">ALÉRGICOS: ${batch.allergensText}</div>`
        : ''
    }

    <div class="storage">Conservação: ${batch.storageCondition}</div>

    <div class="footer">
      <div class="barcode-mock">||| | |||| | ||| ${batch.batchCode}</div>
      <div>${phone || address || 'KOKI'} (${i + 1}/${batch.quantity})</div>
    </div>
  </div>
  `,
    )
    .join('')}
</body>
</html>
    `;
  }
}
