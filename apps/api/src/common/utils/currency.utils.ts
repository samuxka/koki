/**
 * Utility functions for reliable integer cents financial handling.
 * Avoids any floating point inaccuracies.
 */

export function formatCentsToCurrency(cents: number, currency = 'EUR', locale = 'pt-PT'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function parseCurrencyToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function calculateSubtotal(unitPriceCents: number, quantity: number): number {
  return Math.round(unitPriceCents * quantity);
}

export function calculateOrderTotals(items: { subtotalCents: number }[], discountCents = 0, deliveryFeeCents = 0) {
  const itemsTotalCents = items.reduce((acc, item) => acc + item.subtotalCents, 0);
  const totalAmountCents = Math.max(0, itemsTotalCents - discountCents + deliveryFeeCents);
  return {
    itemsTotalCents,
    totalAmountCents,
  };
}
