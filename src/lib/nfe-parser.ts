/**
 * Utility for parsing Brazilian NF-e (Nota Fiscal Eletrônica) XML files.
 */

export interface NFeItem {
  id: string; // Internal mapping ID or supplier code
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  supplierCode: string;
}

export interface NFeData {
  invoiceNumber: string;
  emissionDate: string;
  supplierName: string;
  supplierCnpj: string;
  totalValue: number;
  items: NFeItem[];
}

export function parseNFeXML(xmlString: string): NFeData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // Check for parsing errors
  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Erro ao processar o arquivo XML da NF-e.");
  }

  // Basic Info (identificação)
  const ide = xmlDoc.getElementsByTagName("ide")[0];
  const invoiceNumber = ide?.getElementsByTagName("nNF")[0]?.textContent || "";
  const emissionDate = ide?.getElementsByTagName("dhEmi")[0]?.textContent || "";

  // Supplier info (emitente)
  const emit = xmlDoc.getElementsByTagName("emit")[0];
  const supplierName = emit?.getElementsByTagName("xNome")[0]?.textContent || "";
  const supplierCnpj = emit?.getElementsByTagName("CNPJ")[0]?.textContent || "";

  // Total value (total/ICMSTot)
  const total = xmlDoc.getElementsByTagName("ICMSTot")[0];
  const totalValue = parseFloat(total?.getElementsByTagName("vNF")[0]?.textContent || "0");

  // Items (detalhamento)
  const detElements = xmlDoc.getElementsByTagName("det");
  const items: NFeItem[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName("prod")[0];

    if (prod) {
      const name = prod.getElementsByTagName("xProd")[0]?.textContent || "";
      const quantity = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0");
      const unit = prod.getElementsByTagName("uCom")[0]?.textContent?.toLowerCase() || "";
      const unitPrice = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0");
      const totalPrice = parseFloat(prod.getElementsByTagName("vProd")[0]?.textContent || "0");
      const supplierCode = prod.getElementsByTagName("cProd")[0]?.textContent || "";

      items.push({
        id: `nfe-item-${i}`,
        name,
        quantity,
        unit: normalizeUnit(unit),
        unitPrice,
        totalPrice,
        supplierCode
      });
    }
  }

  return {
    invoiceNumber,
    emissionDate,
    supplierName,
    supplierCnpj,
    totalValue,
    items
  };
}

/**
 * Normalizes NF-e units to system units
 */
function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === 'kg' || u === 'kilog' || u === 'kilo') return 'kg';
  if (u === 'g' || u === 'grama') return 'g';
  if (u === 'l' || u === 'litro') return 'L';
  if (u === 'ml' || u === 'milit') return 'ml';
  if (u === 'un' || u === 'und' || u === 'unid' || u === 'unidade') return 'unidade';
  if (u === 'cx' || u === 'caixa') return 'caixa';
  if (u === 'dz' || u === 'duzia') return 'dz';
  return 'unidade'; // Default
}
