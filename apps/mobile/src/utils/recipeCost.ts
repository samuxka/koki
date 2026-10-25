import { InventoryItem } from '@koki/types';

/**
 * Calculates the exact cost in cents for a given target unit (default 'g')
 * taking into account packaging, packageSize, and unit conversions (kg -> g, l -> ml).
 */
export function getCostPerGramCents(item: InventoryItem, targetUnit: string = 'g'): number {
  let cost = item.unitCostCents || 0;

  if (cost === 0 && item.packageCostCents && item.packageSize && item.packageSize > 0) {
    cost = item.packageCostCents / item.packageSize;
  }

  const itemUnit = (item.unit || 'g').toLowerCase().trim();
  const target = (targetUnit || 'g').toLowerCase().trim();

  // kg -> g or ml
  if (itemUnit === 'kg' && (target === 'g' || target === 'ml')) {
    return cost / 1000;
  }
  // l -> ml or g
  if (itemUnit === 'l' && (target === 'ml' || target === 'g')) {
    return cost / 1000;
  }
  // g -> kg
  if (itemUnit === 'g' && target === 'kg') {
    return cost * 1000;
  }
  // ml -> l
  if (itemUnit === 'ml' && target === 'l') {
    return cost * 1000;
  }

  return cost;
}

/**
 * Formats unit cost nicely.
 * For sub-cent values (e.g. 0.15 cents = 0.0015 €), uses 4 decimal places.
 */
export function formatCostPerUnit(unitCostCents: number, unit: string): string {
  if (!unitCostCents || unitCostCents <= 0) return `0,00 €/${unit}`;
  const euro = unitCostCents / 100;
  if (euro < 0.01) {
    return `${euro.toFixed(4).replace('.', ',')} €/${unit}`;
  }
  return `${euro.toFixed(2).replace('.', ',')} €/${unit}`;
}

/**
 * Formats human-friendly description showing both per-gram and per-kg rates.
 * E.g. "0,0015 €/g (1,50 €/kg)"
 */
export function formatRateDescription(unitCostCents: number, unit: string): string {
  if (!unitCostCents || unitCostCents <= 0) return `0,00 €/${unit}`;
  const base = formatCostPerUnit(unitCostCents, unit);
  if (unit === 'g') {
    const perKg = (unitCostCents * 10).toFixed(2).replace('.', ',');
    return `${base} (${perKg} €/kg)`;
  }
  if (unit === 'ml') {
    const perL = (unitCostCents * 10).toFixed(2).replace('.', ',');
    return `${base} (${perL} €/l)`;
  }
  return base;
}

/**
 * Helper to find an inventory item that matches a typed name.
 */
export function findMatchingInventoryItem(
  name: string,
  items: InventoryItem[],
): InventoryItem | undefined {
  if (!name || !name.trim()) return undefined;
  const trimmed = name.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === trimmed);
}
