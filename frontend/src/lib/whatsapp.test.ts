import { describe, expect, it } from 'vitest';
import { whatsappChargeUrl } from './whatsapp';

describe('whatsappChargeUrl', () => {
  it('normaliza um celular brasileiro e inclui nome e valor na cobrança', () => {
    const url = whatsappChargeUrl('(11) 99999-1234', 'Ana', 12.5);
    expect(url).toContain('https://wa.me/5511999991234?text=');
    expect(decodeURIComponent(url ?? '')).toContain('Ana');
    expect(decodeURIComponent(url ?? '')).toContain('R$ 12,50');
  });

  it('não cria link para telefone inválido', () => {
    expect(whatsappChargeUrl('123', 'Ana', 10)).toBeNull();
  });
});
