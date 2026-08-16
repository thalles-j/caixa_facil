import { formatCurrency } from './format';

export function whatsappChargeUrl(phone: string | undefined, name: string, amount: number): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return null;
  const message = `Olá, ${name}! Consta um valor pendente de ${formatCurrency(amount)}. Podemos combinar o pagamento?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
