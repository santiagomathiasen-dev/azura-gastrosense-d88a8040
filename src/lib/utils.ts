import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number in Brazilian format: 1.000,00
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatBrazilianNumber(
  value: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    hideDecimalsIfZero?: boolean;
  }
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    hideDecimalsIfZero = true,
  } = options || {};

  // Check if value has decimals
  const hasDecimals = value % 1 !== 0;

  // If hideDecimalsIfZero is true and value is integer, don't show decimals
  const minDecimals = hideDecimalsIfZero && !hasDecimals ? 0 : minimumFractionDigits;

  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maximumFractionDigits,
  }).format(value);

  return formatted;
}

/**
 * Parse Brazilian formatted number string to number
 * Handles: "1.000,50" -> 1000.50, "1000,5" -> 1000.5, "1.000" -> 1000
 */
export function parseBrazilianNumber(value: string): number {
  if (!value) return 0;

  // Remove thousand separators (dots) and replace comma with dot
  const normalized = value
    .replace(/\./g, '') // Remove dots (thousand separators)
    .replace(',', '.'); // Replace comma with dot (decimal separator)

  return parseFloat(normalized) || 0;
}

/**
 * Format quantity removing unnecessary trailing zeros
 * Examples: 1.000 -> "1", 1.100 -> "1,1", 0.123 -> "0,123"
 * Uses Brazilian formatting with thousands separator for large numbers
 */
export function formatQuantity(value: number): string {
  // Round to 3 decimal places to avoid floating point issues
  const rounded = Math.round(value * 1000) / 1000;

  // For values >= 1000, use full Brazilian formatting with thousand separators
  if (Math.abs(rounded) >= 1000) {
    return formatBrazilianNumber(rounded, {
      maximumFractionDigits: 3,
      hideDecimalsIfZero: true
    });
  }

  // For smaller values, format without thousand separators but with comma
  let formatted = rounded.toString();

  // If it has decimals, remove trailing zeros
  if (formatted.includes('.')) {
    formatted = formatted.replace(/\.?0+$/, '');
  }

  // Replace dot with comma for Brazilian format
  return formatted.replace('.', ',');
}

/**
 * Format currency in Brazilian Real (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Get the current date/time in Brasília timezone (America/Sao_Paulo).
 * This ensures consistent date handling regardless of the user's browser timezone.
 */
export function getNow(): Date {
  const now = new Date();
  const brasiliaTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
  return brasiliaTime;
}

/**
 * Get today's date as YYYY-MM-DD string in Brasília timezone.
 */
export function getTodayStr(): string {
  const now = getNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
