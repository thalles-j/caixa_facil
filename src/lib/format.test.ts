import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMoney, todayISO } from './format';

describe('parseMoney', () => {
  it('remove o separador de milhar e converte a vírgula decimal', () => {
    expect(parseMoney('1.500,00')).toBe(1500);
  });

  it('aceita valores sem separador de milhar', () => {
    expect(parseMoney('150,50')).toBe(150.5);
  });

  it('aceita valores inteiros sem vírgula', () => {
    expect(parseMoney('150')).toBe(150);
  });

  it('retorna NaN para entradas inválidas', () => {
    expect(parseMoney('abc')).toBeNaN();
  });

  it('remove múltiplos separadores de milhar', () => {
    expect(parseMoney('1.234.567,89')).toBe(1234567.89);
  });
});

describe('todayISO', () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    // força o horário de Brasília independente do fuso da máquina que roda o teste
    process.env.TZ = 'America/Sao_Paulo';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTZ;
  });

  it('retorna a data local correta durante o dia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T10:00:00-03:00'));
    expect(todayISO()).toBe('2026-08-03');
  });

  it('não vira o dia à noite mesmo já tendo virado em UTC (21h-23h59 BRT)', () => {
    // 2026-08-03T21:30 em Brasília (UTC-3) equivale a 2026-08-04T00:30 UTC —
    // toISOString().slice(0, 10) reportaria erroneamente "2026-08-04"
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T21:30:00-03:00'));
    expect(todayISO()).toBe('2026-08-03');
  });

  it('não vira o dia poucos minutos antes da meia-noite local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T23:59:00-03:00'));
    expect(todayISO()).toBe('2026-08-03');
  });

  it('vira o dia corretamente exatamente na meia-noite local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00-03:00'));
    expect(todayISO()).toBe('2026-08-04');
  });
});
