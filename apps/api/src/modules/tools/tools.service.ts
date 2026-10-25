import { Injectable } from '@nestjs/common';

export interface CostCalculationInput {
  ingredientsCostCents: number;
  packagingCostCents?: number;
  laborCostCents?: number;
  overheadCostCents?: number;
  method: 'margin' | 'markup'; // margem sobre venda vs markup sobre custo
  targetPercentage: number; // ex: 35 (%)
}

export interface UnitConversionInput {
  ingredient?: string; // 'farinha', 'acucar', 'manteiga', 'leite', 'chocolate', 'geral'
  value: number;
  fromUnit: 'g' | 'kg' | 'ml' | 'l' | 'xicara' | 'colher_sopa' | 'colher_cha';
  toUnit: 'g' | 'kg' | 'ml' | 'l' | 'xicara' | 'colher_sopa' | 'colher_cha';
}

@Injectable()
export class ToolsService {
  // Density table (grams per ml) for common culinary ingredients
  private densities: Record<string, number> = {
    farinha: 0.55,
    acucar: 0.85,
    manteiga: 0.95,
    leite: 1.03,
    chocolate: 0.55,
    geral: 1.0,
  };

  calculateCost(input: CostCalculationInput) {
    const ingredients = input.ingredientsCostCents || 0;
    const packaging = input.packagingCostCents || 0;
    const labor = input.laborCostCents || 0;
    const overhead = input.overheadCostCents || 0;

    const totalCostCents = ingredients + packaging + labor + overhead;
    const rate = (input.targetPercentage || 0) / 100;

    let suggestedPriceCents = 0;
    let profitCents = 0;

    if (input.method === 'margin') {
      // Margem sobre preço de venda: Preço = Custo / (1 - Margem)
      if (rate >= 1) {
        suggestedPriceCents = totalCostCents * 2;
      } else {
        suggestedPriceCents = Math.round(totalCostCents / (1 - rate));
      }
    } else {
      // Markup sobre o custo: Preço = Custo * (1 + Markup)
      suggestedPriceCents = Math.round(totalCostCents * (1 + rate));
    }

    profitCents = Math.max(0, suggestedPriceCents - totalCostCents);
    const effectiveMarginPercent =
      suggestedPriceCents > 0
        ? Math.round((profitCents / suggestedPriceCents) * 100)
        : 0;
    const effectiveMarkupPercent =
      totalCostCents > 0
        ? Math.round((profitCents / totalCostCents) * 100)
        : 0;

    return {
      totalCostCents,
      suggestedPriceCents,
      profitCents,
      effectiveMarginPercent,
      effectiveMarkupPercent,
      costBreakdown: {
        ingredients,
        packaging,
        labor,
        overhead,
      },
    };
  }

  convertUnit(input: UnitConversionInput) {
    const ingredient = (input.ingredient || 'geral').toLowerCase();
    const density = this.densities[ingredient] || 1.0;

    // Convert everything to a standard base (grams)
    let grams = 0;

    switch (input.fromUnit) {
      case 'g':
        grams = input.value;
        break;
      case 'kg':
        grams = input.value * 1000;
        break;
      case 'ml':
        grams = input.value * density;
        break;
      case 'l':
        grams = input.value * 1000 * density;
        break;
      case 'xicara':
        grams = input.value * 240 * density;
        break;
      case 'colher_sopa':
        grams = input.value * 15 * density;
        break;
      case 'colher_cha':
        grams = input.value * 5 * density;
        break;
    }

    // Convert from grams to target unit
    let result = 0;
    switch (input.toUnit) {
      case 'g':
        result = grams;
        break;
      case 'kg':
        result = grams / 1000;
        break;
      case 'ml':
        result = grams / density;
        break;
      case 'l':
        result = grams / (1000 * density);
        break;
      case 'xicara':
        result = grams / (240 * density);
        break;
      case 'colher_sopa':
        result = grams / (15 * density);
        break;
      case 'colher_cha':
        result = grams / (5 * density);
        break;
    }

    return {
      inputValue: input.value,
      fromUnit: input.fromUnit,
      toUnit: input.toUnit,
      ingredient,
      convertedValue: Number(result.toFixed(2)),
    };
  }

  scaleRecipe(input: {
    multiplier?: number;
    originalYield?: number;
    targetYield?: number;
    yieldUnit?: string;
    panScaling?: {
      originalShape: 'round' | 'rectangular';
      originalDiameter?: number;
      originalLength?: number;
      originalWidth?: number;
      targetShape: 'round' | 'rectangular';
      targetDiameter?: number;
      targetLength?: number;
      targetWidth?: number;
    };
    baseFlourGrams?: number;
    ingredients?: Array<{
      name: string;
      quantity: number;
      unit: string;
      unitCostCents?: number;
      costCents?: number;
      isFlour?: boolean;
    }>;
  }) {
    let factor = 1;

    // 1. Escalonamento por dimensões de forma
    if (input.panScaling) {
      const origArea =
        input.panScaling.originalShape === 'round'
          ? Math.PI * Math.pow((input.panScaling.originalDiameter || 20) / 2, 2)
          : (input.panScaling.originalLength || 20) * (input.panScaling.originalWidth || 20);

      const targetArea =
        input.panScaling.targetShape === 'round'
          ? Math.PI * Math.pow((input.panScaling.targetDiameter || 25) / 2, 2)
          : (input.panScaling.targetLength || 30) * (input.panScaling.targetWidth || 20);

      factor = origArea > 0 ? targetArea / origArea : 1;
    }
    // 2. Escalonamento por rendimento (porções / fatias)
    else if (input.targetYield && input.originalYield && input.originalYield > 0) {
      factor = input.targetYield / input.originalYield;
    }
    // 3. Escalonamento por peso de farinha base (Baker's %)
    else if (input.baseFlourGrams && input.baseFlourGrams > 0 && input.ingredients) {
      const origFlour = input.ingredients
        .filter((i) => i.isFlour || i.name.toLowerCase().includes('farinha'))
        .reduce((sum, i) => sum + i.quantity, 0);

      factor = origFlour > 0 ? input.baseFlourGrams / origFlour : 1;
    }
    // 4. Multiplicador direto (ex: 2x, 0.5x, 3x)
    else if (input.multiplier && input.multiplier > 0) {
      factor = input.multiplier;
    }

    factor = Number(factor.toFixed(4));

    const originalYield = input.originalYield || 1;
    const scaledYield = Number((originalYield * factor).toFixed(2));
    const ingredients = input.ingredients || [];

    // Calcular farinha total escalonada para o Baker's %
    const totalScaledFlour = ingredients
      .filter((i) => i.isFlour || i.name.toLowerCase().includes('farinha'))
      .reduce((sum, i) => sum + i.quantity * factor, 0);

    let originalTotalCostCents = 0;
    let scaledTotalCostCents = 0;

    const scaledIngredients = ingredients.map((ing) => {
      const scaledQuantity = Number((ing.quantity * factor).toFixed(2));
      const origCost = ing.costCents || Math.round((ing.unitCostCents || 0) * ing.quantity);
      const scaledCost = Math.round(origCost * factor);

      originalTotalCostCents += origCost;
      scaledTotalCostCents += scaledCost;

      const bakersPercentage =
        totalScaledFlour > 0
          ? Number(((scaledQuantity / totalScaledFlour) * 100).toFixed(1))
          : undefined;

      return {
        name: ing.name,
        originalQuantity: ing.quantity,
        scaledQuantity,
        unit: ing.unit,
        unitCostCents: ing.unitCostCents || 0,
        originalCostCents: origCost,
        scaledCostCents: scaledCost,
        isFlour: ing.isFlour || ing.name.toLowerCase().includes('farinha'),
        bakersPercentage,
      };
    });

    const costPerYieldUnitCents =
      scaledYield > 0 ? Math.round(scaledTotalCostCents / scaledYield) : 0;

    return {
      factor,
      originalYield,
      scaledYield,
      yieldUnit: input.yieldUnit || 'porções',
      scaledIngredients,
      originalTotalCostCents,
      scaledTotalCostCents,
      costPerYieldUnitCents,
    };
  }
}
