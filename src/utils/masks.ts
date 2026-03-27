// Input mask utilities for Brazilian formats

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function maskCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) return maskCPF(value);
  return maskCNPJ(value);
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function maskPlaca(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
  // Formato Mercosul: ABC1D23 ou antigo: ABC1234
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + '-' + clean.slice(3);
}

export function unmask(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatBankNumberInput(value: string, decimals = 2, maxDigits = 12): string {
  const digits = value.replace(/\D/g, '').slice(0, maxDigits);
  if (!digits) return '';

  const numeric = Number.parseInt(digits, 10);
  if (Number.isNaN(numeric)) return '';

  const divisor = 10 ** decimals;
  return (numeric / divisor).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatToneladaInput(value: string): string {
  return formatBankNumberInput(value, 2, 9);
}

/**
 * Parses a numeric string formatted for Brazil (e.g. "1.234,56") back to a float (e.g. 1234.56)
 */
export function parseNumeric(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).trim().replace(/\./g, '').replace(',', '.');
  const result = Number.parseFloat(clean);
  return Number.isNaN(result) ? 0 : result;
}

