import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from './schemas/inventory-item.schema';
import { InventoryMovement, InventoryMovementDocument } from './schemas/inventory-movement.schema';
import { ShoppingListItem as ShoppingListDoc, ShoppingListItemDocument } from './schemas/shopping-list-item.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateInventoryMovementInput,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '@koki/validation';
import {
  InventoryItem as IInventoryItem,
  InventorySummary,
  ShoppingListResponse,
  ShoppingListItem,
} from '@koki/types';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private itemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
    @InjectModel(ShoppingListDoc.name)
    private shoppingListModel: Model<ShoppingListItemDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapItem(doc: InventoryItemDocument): IInventoryItem {
    const raw = doc.toObject ? doc.toObject() : doc;
    let unitCost = raw.unitCostCents ?? 0;
    if (unitCost === 0 && raw.packageCostCents && raw.packageSize && raw.packageSize > 0) {
      unitCost = raw.packageCostCents / raw.packageSize;
    }
    const isLowStock = (raw.currentStock ?? 0) <= (raw.minStock ?? 0);
    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      name: raw.name,
      category: raw.category,
      brand: raw.brand,
      unit: raw.unit,
      currentStock: raw.currentStock ?? 0,
      minStock: raw.minStock ?? 0,
      idealStock: raw.idealStock,
      unitCostCents: unitCost,
      packageSize: raw.packageSize,
      packageCostCents: raw.packageCostCents,
      location: raw.location,
      supplier: raw.supplier,
      expiryDate: raw.expiryDate,
      notes: raw.notes,
      isLowStock,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  async create(companyId: string | Types.ObjectId, input: CreateInventoryItemInput): Promise<IInventoryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Check entitlements
    const entitlements = await this.entitlementsService.getEntitlements(companyObjectId);
    const limit = entitlements.limits.inventoryItemsLimit;

    if (limit !== -1) {
      const count = await this.itemModel.countDocuments({
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });

      if (count >= limit) {
        throw new ForbiddenException({
          message: `Limite de ${limit} itens no estoque atingido para o plano ${entitlements.tier.toUpperCase()}. Faça upgrade para o Pro para cadastrar mais insumos.`,
          code: 'INVENTORY_LIMIT_REACHED',
        });
      }
    }

    let unitCostCents = input.unitCostCents ?? 0;
    if (unitCostCents === 0 && input.packageCostCents && input.packageSize && input.packageSize > 0) {
      unitCostCents = input.packageCostCents / input.packageSize;
    }

    const created = await this.itemModel.create({
      companyId: companyObjectId,
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand?.trim(),
      unit: input.unit || 'g',
      currentStock: input.currentStock ?? 0,
      minStock: input.minStock ?? 0,
      idealStock: input.idealStock ?? 0,
      unitCostCents,
      packageSize: input.packageSize,
      packageCostCents: input.packageCostCents,
      location: input.location?.trim(),
      supplier: input.supplier?.trim(),
      expiryDate: input.expiryDate?.trim(),
      notes: input.notes?.trim(),
    });

    // If initial stock is greater than 0, create movement log
    if (created.currentStock > 0) {
      await this.movementModel.create({
        companyId: companyObjectId,
        itemId: created._id,
        itemName: created.name,
        unit: created.unit,
        type: 'in',
        quantity: created.currentStock,
        previousStock: 0,
        newStock: created.currentStock,
        costCents: input.packageCostCents || Math.round(created.currentStock * unitCostCents),
        reason: 'saldo_inicial',
        notes: 'Cadastro inicial do insumo',
        date: new Date(),
      });
    }

    return this.mapItem(created);
  }

  async findAll(
    companyId: string | Types.ObjectId,
    query: {
      search?: string;
      category?: string;
      lowStock?: boolean;
      sortBy?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const filter: Record<string, any> = {
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    };

    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }

    if (query.lowStock === true) {
      filter.$expr = { $lte: ['$currentStock', '$minStock'] };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { brand: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { supplier: { $regex: term, $options: 'i' } },
        { location: { $regex: term, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    let sortQuery: Record<string, 1 | -1> = { name: 1 };
    if (query.sortBy === 'name') {
      sortQuery = { name: 1 };
    } else if (query.sortBy === 'cost_high') {
      sortQuery = { unitCostCents: -1 };
    } else if (query.sortBy === 'cost_low') {
      sortQuery = { unitCostCents: 1 };
    } else if (query.sortBy === 'stock_high') {
      sortQuery = { currentStock: -1 };
    } else if (query.sortBy === 'stock_low') {
      sortQuery = { currentStock: 1 };
    } else if (query.sortBy === 'newest') {
      sortQuery = { createdAt: -1 };
    }

    const [docs, total] = await Promise.all([
      this.itemModel.find(filter).sort(sortQuery).skip(skip).limit(limit).exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);

    const items = docs.map((d) => this.mapItem(d));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<IInventoryItem> {
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });

    if (!item) {
      throw new NotFoundException('Insumo não encontrado');
    }

    return this.mapItem(item);
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateInventoryItemInput,
  ): Promise<IInventoryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!item) {
      throw new NotFoundException('Insumo não encontrado');
    }

    // Check if stock is being manually overridden
    if (input.currentStock !== undefined && input.currentStock !== item.currentStock) {
      const prevStock = item.currentStock;
      const newStock = input.currentStock;

      await this.movementModel.create({
        companyId: companyObjectId,
        itemId: item._id,
        itemName: item.name,
        unit: item.unit,
        type: 'adjustment',
        quantity: Math.abs(newStock - prevStock),
        previousStock: prevStock,
        newStock,
        reason: 'ajuste_inventario',
        notes: 'Ajuste manual de estoque na edição',
        date: new Date(),
      });
    }

    if (input.name !== undefined) item.name = input.name.trim();
    if (input.category !== undefined) item.category = input.category.trim();
    if (input.brand !== undefined) item.brand = input.brand?.trim();
    if (input.unit !== undefined) item.unit = input.unit;
    if (input.currentStock !== undefined) item.currentStock = input.currentStock;
    if (input.minStock !== undefined) item.minStock = input.minStock;
    if (input.idealStock !== undefined) item.idealStock = input.idealStock;
    if (input.packageSize !== undefined) item.packageSize = input.packageSize;
    if (input.packageCostCents !== undefined) item.packageCostCents = input.packageCostCents;
    if (input.location !== undefined) item.location = input.location?.trim();
    if (input.supplier !== undefined) item.supplier = input.supplier?.trim();
    if (input.expiryDate !== undefined) item.expiryDate = input.expiryDate?.trim();
    if (input.notes !== undefined) item.notes = input.notes?.trim();

    if (input.unitCostCents !== undefined) {
      item.unitCostCents = input.unitCostCents;
    } else if (input.packageCostCents && input.packageSize && input.packageSize > 0) {
      item.unitCostCents = input.packageCostCents / input.packageSize;
    }

    await item.save();
    return this.mapItem(item);
  }

  async remove(companyId: string | Types.ObjectId, id: string): Promise<void> {
    const result = await this.itemModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId.toString()),
        deletedAt: { $exists: false },
      },
      {
        $set: { deletedAt: new Date() },
      },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Insumo não encontrado');
    }
  }

  async addMovement(
    companyId: string | Types.ObjectId,
    id: string,
    input: CreateInventoryMovementInput,
  ) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!item) {
      throw new NotFoundException('Insumo não encontrado');
    }

    const previousStock = item.currentStock;
    let newStock = previousStock;

    if (input.type === 'in') {
      newStock = previousStock + input.quantity;
      // Optionally update unit cost if costCents provided for input
      if (input.costCents && input.quantity > 0) {
        item.unitCostCents = input.costCents / input.quantity;
      }
    } else if (input.type === 'out') {
      newStock = Math.max(0, previousStock - input.quantity);
    } else if (input.type === 'adjustment') {
      newStock = input.quantity;
    }

    item.currentStock = newStock;
    await item.save();

    const movement = await this.movementModel.create({
      companyId: companyObjectId,
      itemId: item._id,
      itemName: item.name,
      unit: item.unit,
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      costCents: input.costCents || 0,
      reason: input.reason || (input.type === 'in' ? 'compra' : input.type === 'out' ? 'producao' : 'ajuste'),
      notes: input.notes,
      date: input.date ? new Date(input.date) : new Date(),
    });

    return {
      item: this.mapItem(item),
      movement: {
        id: movement._id.toString(),
        companyId: movement.companyId.toString(),
        itemId: movement.itemId.toString(),
        itemName: movement.itemName,
        unit: movement.unit,
        type: movement.type as any,
        quantity: movement.quantity,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        costCents: movement.costCents,
        reason: movement.reason,
        notes: movement.notes,
        date: movement.date ? movement.date.toISOString() : new Date().toISOString(),
        createdAt: (movement as any).createdAt ? new Date((movement as any).createdAt).toISOString() : new Date().toISOString(),
      },
    };
  }

  async getMovements(
    companyId: string | Types.ObjectId,
    id: string,
    limit = 20,
  ) {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const movements = await this.movementModel
      .find({
        companyId: companyObjectId,
        itemId: new Types.ObjectId(id),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return movements.map((m) => ({
      id: m._id.toString(),
      companyId: m.companyId.toString(),
      itemId: m.itemId.toString(),
      itemName: m.itemName,
      unit: m.unit,
      type: m.type as any,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      costCents: m.costCents,
      reason: m.reason,
      notes: m.notes,
      date: m.date ? m.date.toISOString() : new Date().toISOString(),
      createdAt: (m as any).createdAt ? new Date((m as any).createdAt).toISOString() : new Date().toISOString(),
    }));
  }

  async getSummary(companyId: string | Types.ObjectId): Promise<InventorySummary> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const items = await this.itemModel.find({
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    }).exec();

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValueCents = 0;

    for (const item of items) {
      const stock = item.currentStock ?? 0;
      const min = item.minStock ?? 0;
      const unitCost = item.unitCostCents ?? 0;

      if (stock <= 0) {
        outOfStockCount++;
        lowStockCount++;
      } else if (stock <= min) {
        lowStockCount++;
      }

      if (stock > 0 && unitCost > 0) {
        totalStockValueCents += Math.round(stock * unitCost);
      }
    }

    return {
      totalItems: items.length,
      lowStockCount,
      outOfStockCount,
      totalStockValueCents,
    };
  }

  async getShoppingList(companyId: string | Types.ObjectId): Promise<ShoppingListResponse> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // 1. Insumos com estoque baixo (menor ou igual ao mínimo)
    const lowStockDocs = await this.itemModel.find({
      companyId: companyObjectId,
      deletedAt: { $exists: false },
      $expr: { $lte: ['$currentStock', '$minStock'] },
    }).sort({ currentStock: 1 }).exec();

    // 2. Itens persistidos na lista de compras (manuais ou com status personalizado)
    const customDocs = await this.shoppingListModel.find({
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    }).sort({ createdAt: -1 }).exec();

    const customByInventoryId = new Map<string, ShoppingListItemDocument>();
    const standaloneCustomItems: ShoppingListItemDocument[] = [];

    for (const doc of customDocs) {
      if (doc.inventoryItemId) {
        customByInventoryId.set(doc.inventoryItemId.toString(), doc);
      } else {
        standaloneCustomItems.push(doc);
      }
    }

    const items: ShoppingListItem[] = [];
    const processedInventoryIds = new Set<string>();

    // Processar insumos com estoque baixo
    for (const doc of lowStockDocs) {
      const item = this.mapItem(doc);
      processedInventoryIds.add(item.id);
      const customDoc = customByInventoryId.get(item.id);

      const target = item.idealStock && item.idealStock > item.minStock
        ? item.idealStock
        : Math.max(item.minStock * 2, item.minStock + 1);

      const defaultSuggested = Math.max(1, target - item.currentStock);
      const suggestedBuyQuantity = customDoc ? customDoc.quantity : defaultSuggested;
      const estimatedCostCents = customDoc && customDoc.estimatedCostCents > 0
        ? customDoc.estimatedCostCents
        : Math.round(suggestedBuyQuantity * item.unitCostCents);

      items.push({
        id: customDoc ? customDoc._id.toString() : `inv_${item.id}`,
        item,
        inventoryItemId: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        suggestedBuyQuantity,
        estimatedCostCents,
        isPurchased: customDoc ? customDoc.isPurchased : false,
        purchasedAt: customDoc?.purchasedAt ? new Date(customDoc.purchasedAt).toISOString() : undefined,
        source: 'low_stock',
        notes: customDoc?.notes,
      });
    }

    // Processar itens de estoque adicionados manualmente que NÃO estão com estoque baixo
    for (const [invId, customDoc] of customByInventoryId.entries()) {
      if (!processedInventoryIds.has(invId)) {
        processedInventoryIds.add(invId);
        const invDoc = await this.itemModel.findOne({
          _id: new Types.ObjectId(invId),
          deletedAt: { $exists: false },
        });

        if (invDoc) {
          const item = this.mapItem(invDoc);
          items.push({
            id: customDoc._id.toString(),
            item,
            inventoryItemId: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            suggestedBuyQuantity: customDoc.quantity,
            estimatedCostCents: customDoc.estimatedCostCents > 0
              ? customDoc.estimatedCostCents
              : Math.round(customDoc.quantity * item.unitCostCents),
            isPurchased: customDoc.isPurchased,
            purchasedAt: customDoc.purchasedAt ? new Date(customDoc.purchasedAt).toISOString() : undefined,
            source: 'manual',
            notes: customDoc.notes,
          });
        }
      }
    }

    // Processar itens manuais avulsos (sem vínculo no estoque)
    for (const customDoc of standaloneCustomItems) {
      const syntheticItem: IInventoryItem = {
        id: customDoc._id.toString(),
        companyId: companyId.toString(),
        name: customDoc.name,
        category: customDoc.category || 'Geral',
        unit: customDoc.unit || 'un',
        currentStock: 0,
        minStock: 0,
        unitCostCents: customDoc.quantity > 0 ? Math.round(customDoc.estimatedCostCents / customDoc.quantity) : 0,
        isLowStock: false,
        createdAt: customDoc.createdAt ? new Date(customDoc.createdAt).toISOString() : new Date().toISOString(),
      };

      items.push({
        id: customDoc._id.toString(),
        item: syntheticItem,
        name: customDoc.name,
        category: customDoc.category || 'Geral',
        unit: customDoc.unit || 'un',
        suggestedBuyQuantity: customDoc.quantity,
        estimatedCostCents: customDoc.estimatedCostCents,
        isPurchased: customDoc.isPurchased,
        purchasedAt: customDoc.purchasedAt ? new Date(customDoc.purchasedAt).toISOString() : undefined,
        source: 'manual',
        notes: customDoc.notes,
      });
    }

    let totalEstimatedCostCents = 0;
    let purchasedCount = 0;

    for (const entry of items) {
      totalEstimatedCostCents += entry.estimatedCostCents;
      if (entry.isPurchased) {
        purchasedCount++;
      }
    }

    return {
      items,
      totalEstimatedCostCents,
      lowStockItemsCount: lowStockDocs.length,
      purchasedCount,
      totalItemsCount: items.length,
    };
  }

  async addShoppingListItem(
    companyId: string | Types.ObjectId,
    input: CreateShoppingListItemInput,
  ): Promise<ShoppingListItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    let name = input.name.trim();
    let category = input.category?.trim() || 'Geral';
    let unit = input.unit?.trim() || 'un';
    let estimatedCostCents = input.estimatedCostCents || 0;
    let inventoryItemDoc: InventoryItemDocument | null = null;

    if (input.inventoryItemId) {
      inventoryItemDoc = await this.itemModel.findOne({
        _id: new Types.ObjectId(input.inventoryItemId),
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });

      if (inventoryItemDoc) {
        name = inventoryItemDoc.name;
        category = inventoryItemDoc.category;
        unit = inventoryItemDoc.unit;
        if (!estimatedCostCents) {
          estimatedCostCents = Math.round(input.quantity * inventoryItemDoc.unitCostCents);
        }
      }
    }

    const doc = new this.shoppingListModel({
      companyId: companyObjectId,
      inventoryItemId: input.inventoryItemId ? new Types.ObjectId(input.inventoryItemId) : undefined,
      name,
      category,
      unit,
      quantity: input.quantity,
      estimatedCostCents,
      isPurchased: false,
      source: input.inventoryItemId ? 'low_stock' : 'manual',
      notes: input.notes?.trim(),
    });

    await doc.save();

    const itemObj: IInventoryItem = inventoryItemDoc
      ? this.mapItem(inventoryItemDoc)
      : {
          id: doc._id.toString(),
          companyId: companyId.toString(),
          name: doc.name,
          category: doc.category,
          unit: doc.unit,
          currentStock: 0,
          minStock: 0,
          unitCostCents: doc.quantity > 0 ? Math.round(doc.estimatedCostCents / doc.quantity) : 0,
          isLowStock: false,
          createdAt: new Date().toISOString(),
        };

    return {
      id: doc._id.toString(),
      item: itemObj,
      inventoryItemId: input.inventoryItemId,
      name: doc.name,
      category: doc.category,
      unit: doc.unit,
      suggestedBuyQuantity: doc.quantity,
      estimatedCostCents: doc.estimatedCostCents,
      isPurchased: doc.isPurchased,
      source: doc.source as any,
      notes: doc.notes,
    };
  }

  async toggleShoppingListItem(
    companyId: string | Types.ObjectId,
    id: string,
  ): Promise<{ id: string; isPurchased: boolean }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    if (id.startsWith('inv_')) {
      const invId = id.replace('inv_', '');
      const invDoc = await this.itemModel.findOne({
        _id: new Types.ObjectId(invId),
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });

      if (!invDoc) {
        throw new NotFoundException('Insumo não encontrado');
      }

      const target = invDoc.idealStock && invDoc.idealStock > invDoc.minStock
        ? invDoc.idealStock
        : Math.max(invDoc.minStock * 2, invDoc.minStock + 1);
      const qty = Math.max(1, target - invDoc.currentStock);
      const costCents = Math.round(qty * invDoc.unitCostCents);

      const doc = new this.shoppingListModel({
        companyId: companyObjectId,
        inventoryItemId: invDoc._id,
        name: invDoc.name,
        category: invDoc.category,
        unit: invDoc.unit,
        quantity: qty,
        estimatedCostCents: costCents,
        isPurchased: true,
        purchasedAt: new Date(),
        source: 'low_stock',
      });

      await doc.save();
      return { id: doc._id.toString(), isPurchased: true };
    }

    const doc = await this.shoppingListModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!doc) {
      throw new NotFoundException('Item da lista de compras não encontrado');
    }

    doc.isPurchased = !doc.isPurchased;
    doc.purchasedAt = doc.isPurchased ? new Date() : undefined;
    await doc.save();

    return { id: doc._id.toString(), isPurchased: doc.isPurchased };
  }

  async updateShoppingListItem(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateShoppingListItemInput,
  ): Promise<void> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    if (id.startsWith('inv_')) {
      const invId = id.replace('inv_', '');
      const invDoc = await this.itemModel.findOne({
        _id: new Types.ObjectId(invId),
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });

      if (!invDoc) {
        throw new NotFoundException('Insumo não encontrado');
      }

      const qty = input.quantity || 1;
      const costCents = input.estimatedCostCents !== undefined
        ? input.estimatedCostCents
        : Math.round(qty * invDoc.unitCostCents);

      const doc = new this.shoppingListModel({
        companyId: companyObjectId,
        inventoryItemId: invDoc._id,
        name: invDoc.name,
        category: invDoc.category,
        unit: invDoc.unit,
        quantity: qty,
        estimatedCostCents: costCents,
        isPurchased: input.isPurchased ?? false,
        purchasedAt: input.isPurchased ? new Date() : undefined,
        notes: input.notes?.trim(),
        source: 'low_stock',
      });

      await doc.save();
      return;
    }

    const doc = await this.shoppingListModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!doc) {
      throw new NotFoundException('Item da lista de compras não encontrado');
    }

    if (input.quantity !== undefined) doc.quantity = input.quantity;
    if (input.estimatedCostCents !== undefined) doc.estimatedCostCents = input.estimatedCostCents;
    if (input.isPurchased !== undefined) {
      doc.isPurchased = input.isPurchased;
      doc.purchasedAt = input.isPurchased ? new Date() : undefined;
    }
    if (input.notes !== undefined) doc.notes = input.notes?.trim();

    await doc.save();
  }

  async removeShoppingListItem(companyId: string | Types.ObjectId, id: string): Promise<void> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    if (id.startsWith('inv_')) {
      // Insumo virtual de estoque baixo: cria um registro marcado como deletado para ignorar temporariamente
      const invId = id.replace('inv_', '');
      const doc = new this.shoppingListModel({
        companyId: companyObjectId,
        inventoryItemId: new Types.ObjectId(invId),
        name: 'Ignorado',
        category: 'Geral',
        unit: 'un',
        quantity: 1,
        estimatedCostCents: 0,
        isPurchased: false,
        deletedAt: new Date(),
        source: 'low_stock',
      });
      await doc.save();
      return;
    }

    await this.shoppingListModel.updateOne(
      { _id: new Types.ObjectId(id), companyId: companyObjectId },
      { $set: { deletedAt: new Date() } },
    );
  }

  async restockPurchasedItems(
    companyId: string | Types.ObjectId,
  ): Promise<{ restockedCount: number; totalCostCents: number }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const purchasedDocs = await this.shoppingListModel.find({
      companyId: companyObjectId,
      isPurchased: true,
      deletedAt: { $exists: false },
    });

    let restockedCount = 0;
    let totalCostCents = 0;

    for (const doc of purchasedDocs) {
      if (doc.inventoryItemId) {
        // Registra entrada no estoque
        await this.addMovement(companyObjectId, doc.inventoryItemId.toString(), {
          type: 'in',
          quantity: doc.quantity,
          costCents: doc.estimatedCostCents,
          reason: 'Compra / Reposição de Estoque',
          notes: doc.notes || 'Entrada automática pela Lista de Compras Koki',
        });
        restockedCount++;
      }
      totalCostCents += doc.estimatedCostCents || 0;
      doc.deletedAt = new Date();
      await doc.save();
    }

    return { restockedCount, totalCostCents };
  }

  async clearPurchased(companyId: string | Types.ObjectId): Promise<{ clearedCount: number }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const res = await this.shoppingListModel.updateMany(
      { companyId: companyObjectId, isPurchased: true, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    );
    return { clearedCount: res.modifiedCount };
  }

  async getCategories(companyId: string | Types.ObjectId): Promise<string[]> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const categories = await this.itemModel.distinct('category', {
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });
    return categories.filter(Boolean);
  }
}
