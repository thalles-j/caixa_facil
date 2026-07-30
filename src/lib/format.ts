export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso: string): string {
  // parse as local time — new Date(iso) treats a date-only string as UTC
  // midnight, which shifts a day back once formatted in timezones behind UTC
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Aceita vírgula decimal (padrão BR) em campos de valor monetário digitados como texto livre. */
export function parseMoney(raw: string): number {
  return Number(raw.trim().replace(',', '.'));
}
