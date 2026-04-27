import { InvoiceExpenseRequest } from '../types';
import { supabaseFetch } from '../../../lib/supabase-fetch';

export class FinancialService {
    // ─────────────────────────────────────────────────────────────────────────
    // FASE 2 — CONTRATO COM FINANCEIRO
    // Este método é o único ponto de contato entre Estoque e a tabela
    // financial_expenses. O hook useStockItems NÃO escreve mais nessa tabela.
    //
    // Regra de negócio encapsulada aqui:
    //   • Cria uma despesa do tipo 'invoice' com status 'paid'
    //   • Categoria 'variable' — padrão para compras de insumos
    // ─────────────────────────────────────────────────────────────────────────
    static async recordInvoiceExpense(request: InvoiceExpenseRequest): Promise<void> {
        const { ownerId, supplierName, invoiceNumber, totalValue, emissionDate } = request;

        await supabaseFetch('financial_expenses', {
            method: 'POST',
            body: JSON.stringify({
                user_id: ownerId,
                description: `Compra: ${supplierName} (NF ${invoiceNumber})`,
                amount: totalValue,
                category: 'variable',
                type: 'invoice',
                date: emissionDate.split('T')[0],
                status: 'paid',
                invoice_number: invoiceNumber,
                notes: `Importacao automatica via XML. Fornecedor: ${supplierName}`,
            })
        });
    }
}
