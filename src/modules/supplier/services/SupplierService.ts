import { Supplier, SupplierSchema, SupplierInsertSchema } from '../types';

export class SupplierService {
    /**
     * Validates a supplier.
     */
    static validateSupplier(supplier: any): Supplier {
        return SupplierSchema.parse(supplier);
    }

    /**
     * Validates a partial supplier for creation.
     */
    static validateInsert(supplier: any) {
        return SupplierInsertSchema.parse(supplier);
    }

    /**
     * Formats a phone/whatsapp number to consistent format.
     */
    static formatPhone(phone: string): string {
        return phone.replace(/\D/g, '');
    }
}
