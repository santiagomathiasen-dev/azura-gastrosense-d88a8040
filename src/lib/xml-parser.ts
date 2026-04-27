import { parseNFeXML } from './nfe-parser';

/**
 * Parses an NF-e XML string and returns normalized invoice data
 * compatible with InvoiceImportDialog.
 */
export function parseNfeXml(xmlString: string) {
  const raw = parseNFeXML(xmlString);
  return {
    supplierName: raw.supplierName || 'Fornecedor não identificado',
    supplierCnpj: raw.supplierCnpj || null,
    invoiceNumber: raw.invoiceNumber || '-',
    totalValue: raw.totalValue ?? 0,
    items: raw.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      category: undefined as string | undefined,
    })),
  };
}
