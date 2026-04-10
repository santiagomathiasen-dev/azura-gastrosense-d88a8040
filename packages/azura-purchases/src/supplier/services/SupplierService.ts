import { Supplier, SupplierSchema, SupplierInsertSchema } from '../types';

export class SupplierService {
    static validateSupplier(supplier: any): Supplier {
        return SupplierSchema.parse(supplier);
    }

    static validateInsert(supplier: any) {
        return SupplierInsertSchema.parse(supplier);
    }

    /** Remove todos os não-dígitos do número de telefone. */
    static formatPhone(phone: string): string {
        return phone.replace(/\D/g, '');
    }

    /** Monta URL do WhatsApp Web com mensagem pré-preenchida. */
    static buildWhatsAppUrl(whatsappNumber: string, message: string): string {
        const clean = this.formatPhone(whatsappNumber);
        return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    }
}
