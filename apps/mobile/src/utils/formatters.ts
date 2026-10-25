export function formatCurrency(
  cents: number,
  currency = 'EUR',
  hideValue = false,
): string {
  if (hideValue) {
    return '••••••';
  }
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `€ ${amount.toFixed(2)}`;
  }
}

export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
  })} às ${d.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
