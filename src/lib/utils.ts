import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format quantity removing unnecessary trailing zeros
 * Examples: 1.000 -> "1", 1.100 -> "1,1", 0.123 -> "0,123"
 */
export function formatQuantity(value: number): string {
  // Round to 3 decimal places to avoid floating point issues
  const rounded = Math.round(value * 1000) / 1000;
  
  // Convert to string and remove trailing zeros after decimal point
  let formatted = rounded.toString();
  
  // If it has decimals, remove trailing zeros
  if (formatted.includes('.')) {
    formatted = formatted.replace(/\.?0+$/, '');
  }
  
  // Replace dot with comma for Brazilian format
  return formatted.replace('.', ',');
}
