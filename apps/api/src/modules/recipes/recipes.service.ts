import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';
import { InventoryItem, InventoryItemDocument } from '../inventory/schemas/inventory-item.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreateRecipeInput, UpdateRecipeInput } from '@koki/validation';
import { Recipe as IRecipe, RecipeSummary, RecipeIngredient as IRecipeIngredient } from '@koki/types';

@Injectable()
export class RecipesService {
  constructor(
    @InjectModel(Recipe.name)
    private recipeModel: Model<RecipeDocument>,
    @InjectModel(InventoryItem.name)
    private inventoryModel: Model<InventoryItemDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapRecipe(doc: RecipeDocument): IRecipe {
    const raw = doc.toObject ? doc.toObject() : doc;
    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      name: raw.name,
      category: raw.category,
      description: raw.description,
      imageUrl: raw.imageUrl,
      yield: raw.yield,
      yieldUnit: raw.yieldUnit,
      prepTimeMinutes: raw.prepTimeMinutes,
      bakeTimeMinutes: raw.bakeTimeMinutes,
      ovenTemperature: raw.ovenTemperature,
      ingredients: (raw.ingredients || []).map((ing: any) => ({
        id: ing._id ? ing._id.toString() : undefined,
        inventoryItemId: ing.inventoryItemId ? ing.inventoryItemId.toString() : undefined,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        unitCostCents: ing.unitCostCents || 0,
        costCents: ing.costCents || 0,
        isFlour: ing.isFlour || false,
        bakersPercentage: ing.bakersPercentage || 0,
      })),
      instructions: raw.instructions || [],
      notes: raw.notes,
      ingredientsCostCents: raw.ingredientsCostCents || 0,
      packagingCostCents: raw.packagingCostCents,
      laborCostCents: raw.laborCostCents,
      overheadCostCents: raw.overheadCostCents,
      totalCostCents: raw.totalCostCents || 0,
      costPerYieldUnitCents: raw.costPerYieldUnitCents || 0,
      suggestedSalePriceCents: raw.suggestedSalePriceCents,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  private calculateCostPerGram(invItem: InventoryItemDocument, targetUnit: string = 'g'): number {
    let cost = invItem.unitCostCents || 0;
    if (cost === 0 && invItem.packageCostCents && invItem.packageSize && invItem.packageSize > 0) {
      cost = invItem.packageCostCents / invItem.packageSize;
    }
    const itemUnit = (invItem.unit || 'g').toLowerCase().trim();
    const target = (targetUnit || 'g').toLowerCase().trim();

    if (itemUnit === 'kg' && (target === 'g' || target === 'ml')) {
      return cost / 1000;
    }
    if (itemUnit === 'l' && (target === 'ml' || target === 'g')) {
      return cost / 1000;
    }
    if (itemUnit === 'g' && target === 'kg') {
      return cost * 1000;
    }
    if (itemUnit === 'ml' && target === 'l') {
      return cost * 1000;
    }
    return cost;
  }

  private async enrichIngredientsFromInventory(
    companyObjectId: Types.ObjectId,
    ingredients: Array<any>,
  ) {
    if (!ingredients || ingredients.length === 0) return [];

    return Promise.all(
      ingredients.map(async (ing) => {
        let unitCostCents = ing.unitCostCents;
        let inventoryItemId = ing.inventoryItemId ? ing.inventoryItemId.toString() : undefined;

        if (inventoryItemId) {
          const invItem = await this.inventoryModel.findOne({
            _id: new Types.ObjectId(inventoryItemId),
            companyId: companyObjectId,
            deletedAt: { $exists: false },
          });
          if (invItem && (!unitCostCents || unitCostCents === 0)) {
            unitCostCents = this.calculateCostPerGram(invItem, ing.unit);
          }
        } else if (ing.name) {
          const trimmedName = ing.name.trim();
          const invItem = await this.inventoryModel.findOne({
            companyId: companyObjectId,
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            deletedAt: { $exists: false },
          });
          if (invItem) {
            inventoryItemId = invItem._id.toString();
            if (!unitCostCents || unitCostCents === 0) {
              unitCostCents = this.calculateCostPerGram(invItem, ing.unit);
            }
          }
        }

        const costCents =
          ing.costCents && ing.costCents > 0
            ? ing.costCents
            : Math.round((ing.quantity || 0) * (unitCostCents || 0));

        return {
          ...ing,
          inventoryItemId,
          unitCostCents: unitCostCents || 0,
          costCents,
        };
      }),
    );
  }

  private calculateIngredientsAndCosts(input: {
    ingredients: Array<{
      inventoryItemId?: string;
      name: string;
      quantity: number;
      unit: string;
      unitCostCents?: number;
      costCents?: number;
      isFlour?: boolean;
    }>;
    yield: number;
    packagingCostCents?: number;
    laborCostCents?: number;
    overheadCostCents?: number;
    suggestedSalePriceCents?: number;
  }) {
    // 1. Calculate flour base for Baker's Percentage
    let totalFlourWeightGrams = 0;
    const processedIngredients = input.ingredients.map((ing) => {
      const isFlour =
        ing.isFlour !== undefined
          ? ing.isFlour
          : ing.name.toLowerCase().includes('farinha') || ing.name.toLowerCase().includes('flour');

      // convert quantity to grams if possible
      let qtyGrams = ing.quantity;
      if (ing.unit.toLowerCase() === 'kg') qtyGrams = ing.quantity * 1000;

      if (isFlour) {
        totalFlourWeightGrams += qtyGrams;
      }

      const unitCost = ing.unitCostCents ?? 0;
      const cost = ing.costCents ?? Math.round(ing.quantity * unitCost);

      return {
        ...ing,
        isFlour,
        costCents: cost,
        unitCostCents: unitCost,
        qtyGrams,
      };
    });

    // 2. Compute Baker's % and sum costs
    let ingredientsCostCents = 0;
    const finalIngredients = processedIngredients.map((ing) => {
      let bakersPercentage = 0;
      if (totalFlourWeightGrams > 0) {
        bakersPercentage = Math.round((ing.qtyGrams / totalFlourWeightGrams) * 1000) / 10;
      }
      ingredientsCostCents += ing.costCents;

      return {
        inventoryItemId: ing.inventoryItemId ? new Types.ObjectId(ing.inventoryItemId) : undefined,
        name: ing.name.trim(),
        quantity: ing.quantity,
        unit: ing.unit,
        unitCostCents: ing.unitCostCents,
        costCents: ing.costCents,
        isFlour: ing.isFlour,
        bakersPercentage,
      };
    });

    const packagingCostCents = input.packagingCostCents || 0;
    const laborCostCents = input.laborCostCents || 0;
    const overheadCostCents = input.overheadCostCents || 0;

    const totalCostCents = ingredientsCostCents + packagingCostCents + laborCostCents + overheadCostCents;
    const yieldAmount = Math.max(1, input.yield);
    const costPerYieldUnitCents = Math.round(totalCostCents / yieldAmount);

    let suggestedSalePriceCents = input.suggestedSalePriceCents;
    if (!suggestedSalePriceCents && totalCostCents > 0) {
      // Default 60% gross margin: price = cost / (1 - 0.6) = cost * 2.5
      suggestedSalePriceCents = Math.round(totalCostCents * 2.5);
    }

    return {
      finalIngredients,
      ingredientsCostCents,
      totalCostCents,
      costPerYieldUnitCents,
      suggestedSalePriceCents,
    };
  }

  async create(companyId: string | Types.ObjectId, input: CreateRecipeInput): Promise<IRecipe> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Check entitlements
    const entitlements = await this.entitlementsService.getEntitlements(companyObjectId);
    const limit = entitlements.limits.recipesLimit;

    if (limit !== -1) {
      const count = await this.recipeModel.countDocuments({
        companyId: companyObjectId,
        deletedAt: { $exists: false },
      });

      if (count >= limit) {
        throw new ForbiddenException({
          message: `Limite de ${limit} receitas atingido para o plano ${entitlements.tier.toUpperCase()}. Faça upgrade para o Pro para cadastrar até 100 receitas.`,
          code: 'RECIPES_LIMIT_REACHED',
        });
      }
    }

    const enrichedIngredients = await this.enrichIngredientsFromInventory(
      companyObjectId,
      input.ingredients,
    );

    const {
      finalIngredients,
      ingredientsCostCents,
      totalCostCents,
      costPerYieldUnitCents,
      suggestedSalePriceCents,
    } = this.calculateIngredientsAndCosts({
      ingredients: enrichedIngredients,
      yield: input.yield,
      packagingCostCents: input.packagingCostCents,
      laborCostCents: input.laborCostCents,
      overheadCostCents: input.overheadCostCents,
      suggestedSalePriceCents: input.suggestedSalePriceCents,
    });

    const created = await this.recipeModel.create({
      companyId: companyObjectId,
      name: input.name.trim(),
      category: input.category.trim(),
      description: input.description?.trim(),
      imageUrl: input.imageUrl?.trim(),
      yield: input.yield || 1,
      yieldUnit: input.yieldUnit || 'unidades',
      prepTimeMinutes: input.prepTimeMinutes || 0,
      bakeTimeMinutes: input.bakeTimeMinutes || 0,
      ovenTemperature: input.ovenTemperature || 0,
      ingredients: finalIngredients,
      instructions: (input.instructions || []).map((s) => s.trim()).filter(Boolean),
      notes: input.notes?.trim(),
      ingredientsCostCents,
      packagingCostCents: input.packagingCostCents || 0,
      laborCostCents: input.laborCostCents || 0,
      overheadCostCents: input.overheadCostCents || 0,
      totalCostCents,
      costPerYieldUnitCents,
      suggestedSalePriceCents,
    });

    return this.mapRecipe(created);
  }

  async findAll(
    companyId: string | Types.ObjectId,
    query: {
      search?: string;
      category?: string;
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

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { 'ingredients.name': { $regex: term, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    let sortQuery: Record<string, 1 | -1> = { name: 1 };
    if (query.sortBy === 'name') {
      sortQuery = { name: 1 };
    } else if (query.sortBy === 'cost_high') {
      sortQuery = { totalCostCents: -1 };
    } else if (query.sortBy === 'cost_low') {
      sortQuery = { totalCostCents: 1 };
    } else if (query.sortBy === 'newest') {
      sortQuery = { createdAt: -1 };
    }

    const [docs, total] = await Promise.all([
      this.recipeModel.find(filter).sort(sortQuery).skip(skip).limit(limit).exec(),
      this.recipeModel.countDocuments(filter).exec(),
    ]);

    const items = docs.map((d) => this.mapRecipe(d));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(companyId: string | Types.ObjectId, id: string): Promise<IRecipe> {
    const doc = await this.recipeModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId.toString()),
      deletedAt: { $exists: false },
    });

    if (!doc) {
      throw new NotFoundException('Ficha técnica / receita não encontrada');
    }

    return this.mapRecipe(doc);
  }

  async update(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateRecipeInput,
  ): Promise<IRecipe> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const doc = await this.recipeModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!doc) {
      throw new NotFoundException('Receita não encontrada');
    }

    const yieldAmount = input.yield !== undefined ? input.yield : doc.yield;
    const rawIngredients = input.ingredients !== undefined ? input.ingredients : (doc.ingredients as any);
    const enrichedIngredients = await this.enrichIngredientsFromInventory(companyObjectId, rawIngredients);

    const {
      finalIngredients,
      ingredientsCostCents,
      totalCostCents,
      costPerYieldUnitCents,
      suggestedSalePriceCents,
    } = this.calculateIngredientsAndCosts({
      ingredients: enrichedIngredients,
      yield: yieldAmount,
      packagingCostCents: input.packagingCostCents !== undefined ? input.packagingCostCents : doc.packagingCostCents,
      laborCostCents: input.laborCostCents !== undefined ? input.laborCostCents : doc.laborCostCents,
      overheadCostCents: input.overheadCostCents !== undefined ? input.overheadCostCents : doc.overheadCostCents,
      suggestedSalePriceCents: input.suggestedSalePriceCents !== undefined ? input.suggestedSalePriceCents : doc.suggestedSalePriceCents,
    });

    if (input.name !== undefined) doc.name = input.name.trim();
    if (input.category !== undefined) doc.category = input.category.trim();
    if (input.description !== undefined) doc.description = input.description?.trim();
    if (input.imageUrl !== undefined) doc.imageUrl = input.imageUrl?.trim();
    if (input.yield !== undefined) doc.yield = input.yield;
    if (input.yieldUnit !== undefined) doc.yieldUnit = input.yieldUnit;
    if (input.prepTimeMinutes !== undefined) doc.prepTimeMinutes = input.prepTimeMinutes;
    if (input.bakeTimeMinutes !== undefined) doc.bakeTimeMinutes = input.bakeTimeMinutes;
    if (input.ovenTemperature !== undefined) doc.ovenTemperature = input.ovenTemperature;
    if (input.instructions !== undefined) doc.instructions = input.instructions.map((s) => s.trim()).filter(Boolean);
    if (input.notes !== undefined) doc.notes = input.notes?.trim();

    doc.ingredients = finalIngredients as any;
    doc.ingredientsCostCents = ingredientsCostCents;
    if (input.packagingCostCents !== undefined) doc.packagingCostCents = input.packagingCostCents;
    if (input.laborCostCents !== undefined) doc.laborCostCents = input.laborCostCents;
    if (input.overheadCostCents !== undefined) doc.overheadCostCents = input.overheadCostCents;
    doc.totalCostCents = totalCostCents;
    doc.costPerYieldUnitCents = costPerYieldUnitCents;
    doc.suggestedSalePriceCents = suggestedSalePriceCents;

    await doc.save();
    return this.mapRecipe(doc);
  }

  async remove(companyId: string | Types.ObjectId, id: string): Promise<void> {
    const result = await this.recipeModel.updateOne(
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
      throw new NotFoundException('Receita não encontrada');
    }
  }

  async scale(
    companyId: string | Types.ObjectId,
    id: string,
    multiplier?: number,
    targetYield?: number,
  ) {
    const recipe = await this.findById(companyId, id);

    let scale = multiplier || 1;
    if (targetYield && recipe.yield > 0) {
      scale = targetYield / recipe.yield;
    }

    const scaledIngredients: IRecipeIngredient[] = recipe.ingredients.map((ing) => {
      const scaledQty = Math.round(ing.quantity * scale * 100) / 100;
      const scaledCost = Math.round(ing.costCents * scale);
      return {
        ...ing,
        quantity: scaledQty,
        costCents: scaledCost,
      };
    });

    const scaledIngredientsCost = Math.round(recipe.ingredientsCostCents * scale);
    const scaledTotalCost = Math.round(recipe.totalCostCents * scale);
    const scaledYield = Math.round(recipe.yield * scale * 100) / 100;

    return {
      recipe,
      scaleMultiplier: scale,
      scaledYield,
      scaledIngredients,
      scaledIngredientsCostCents: scaledIngredientsCost,
      scaledTotalCostCents: scaledTotalCost,
      costPerYieldUnitCents: recipe.costPerYieldUnitCents,
    };
  }

  async getSummary(companyId: string | Types.ObjectId): Promise<RecipeSummary> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const docs = await this.recipeModel.find({
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    }).exec();

    const categories = new Set<string>();
    let totalCostSum = 0;

    for (const r of docs) {
      if (r.category) categories.add(r.category);
      totalCostSum += r.totalCostCents || 0;
    }

    const averageCostCents = docs.length > 0 ? Math.round(totalCostSum / docs.length) : 0;

    return {
      totalRecipes: docs.length,
      categoriesCount: categories.size,
      averageCostCents,
    };
  }

  async getCategories(companyId: string | Types.ObjectId): Promise<string[]> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const categories = await this.recipeModel.distinct('category', {
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });
    return categories.filter(Boolean);
  }
}
