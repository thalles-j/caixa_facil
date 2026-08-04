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
  // usa os componentes locais em vez de toISOString() (que é sempre UTC) —
  // senão, a partir de ~21h no horário de Brasília (UTC-3), a data já teria
  // virado para o dia seguinte e lançamentos seriam gravados na data errada
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Aceita o formato de valor monetário em texto livre no padrão BR:
 * "." como separador de milhar e "," como separador decimal (ex: "1.500,00").
 * Os pontos de milhar precisam ser removidos antes de trocar a vírgula por ponto —
 * senão "1.500,00" vira "1.500.00", que Number() não consegue converter (NaN).
 */
export function parseMoney(raw: string): number {
  return Number(raw.trim().replace(/\./g, '').replace(',', '.'));
}
