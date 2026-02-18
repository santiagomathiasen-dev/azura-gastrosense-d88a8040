import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface ForecastProductionOrder {
    id: string;
    user_id: string;
    forecast_id: string | null;
    technical_sheet_id: string;
    production_date: string;
    target_consumption_date: string;
    required_quantity: number;
    existing_stock: number;
    net_quantity: number;
    praca: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    linked_production_id: string | null;
    created_at: string;
    updated_at: string;
    technical_sheet?: {
        id: string;
        name: string;
        yield_unit: string;
        yield_quantity: number;
        image_url: string | null;
        ingredients?: {
            stock_item_id: string;
            quantity: number;
            unit: string;
            stock_item: { name: string } | null;
        }[];
    };
}

export const PRACA_LABELS: Record<string, string> = {
    gelateria: 'Gelateria',
    confeitaria: 'Confeitaria',
    padaria: 'Padaria',
    praca_quente: 'Praça Quente',
    bar: 'Bar',
};

export const FORECAST_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
};

export function useForecastProductionOrders(productionDate?: string) {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['forecast_production_orders', ownerId, productionDate],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            let query = supabase
                .from('forecast_production_orders')
                .select(`
          *,
          technical_sheet:technical_sheets(
            id, 
            name, 
            yield_unit, 
            yield_quantity, 
            image_url,
            ingredients:technical_sheet_ingredients(
              stock_item_id,
              quantity,
              unit,
              stock_item:stock_items(name)
            )
          )
        `)
                .order('production_date', { ascending: true });

            if (productionDate) {
                query = query.eq('production_date', productionDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as ForecastProductionOrder[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 15_000,
    });

    // Function to subtract stock when production starts
    const subtractStockForProduction = async (order: ForecastProductionOrder) => {
        if (!ownerId || !order.technical_sheet || !order.technical_sheet.ingredients) return;

        const yieldQty = Number(order.technical_sheet.yield_quantity);
        const plannedQty = Number(order.net_quantity);
        const multiplier = plannedQty / yieldQty;

        const insufficientItems: { name: string; needed: number; available: number; unit: string }[] = [];

        for (const ingredient of order.technical_sheet.ingredients) {
            const stockItemId = ingredient.stock_item_id;
            // Apply waste factor from stock item
            const wasteFactorResult = await supabase
                .from('stock_items')
                .select('waste_factor, current_quantity, name, unit')
                .eq('id', stockItemId)
                .single();

            const wasteFactor = Number(wasteFactorResult.data?.waste_factor || 0) / 100;
            const baseQty = Number(ingredient.quantity) * multiplier;
            const neededQty = baseQty * (1 + wasteFactor); // Apply waste factor

            let remainingQty = neededQty;

            // 1. First, try to use from production stock
            const { data: prodStock } = await supabase
                .from('production_stock')
                .select('id, quantity')
                .eq('stock_item_id', stockItemId)
                .single();

            if (prodStock && Number(prodStock.quantity) > 0) {
                const useFromProd = Math.min(Number(prodStock.quantity), remainingQty);
                const newProdQty = Number(prodStock.quantity) - useFromProd;

                if (newProdQty <= 0) {
                    await supabase.from('production_stock').delete().eq('id', prodStock.id);
                } else {
                    await supabase.from('production_stock').update({ quantity: newProdQty }).eq('id', prodStock.id);
                }

                remainingQty -= useFromProd;
            }

            // 2. If still need more, use from central stock
            if (remainingQty > 0) {
                const centralQty = Number(wasteFactorResult.data?.current_quantity || 0);

                if (centralQty > 0) {
                    const useFromCentral = Math.min(centralQty, remainingQty);

                    // Create exit movement from central stock
                    await supabase.from('stock_movements').insert({
                        stock_item_id: stockItemId,
                        user_id: ownerId,
                        type: 'exit',
                        quantity: useFromCentral,
                        source: 'production',
                        // related_production_id: order.id, // Forecast orders might not link directly to productions table yet
                        notes: `Baixa automática - Ordem Previsão: ${order.technical_sheet.name}`,
                    });

                    remainingQty -= useFromCentral;
                }
            }

            // 3. If still insufficient, track for purchase order
            if (remainingQty > 0) {
                insufficientItems.push({
                    name: wasteFactorResult.data?.name || ingredient.stock_item?.name || 'Item',
                    needed: neededQty,
                    available: (Number(prodStock?.quantity || 0) + Number(wasteFactorResult.data?.current_quantity || 0)),
                    unit: wasteFactorResult.data?.unit || ingredient.unit,
                });

                // Auto-generate purchase order for missing quantity
                const { data: existingPurchase } = await supabase
                    .from('purchase_list_items')
                    .select('id, suggested_quantity')
                    .eq('stock_item_id', stockItemId)
                    .eq('status', 'pending')
                    .single();

                if (existingPurchase) {
                    await supabase
                        .from('purchase_list_items')
                        .update({
                            suggested_quantity: Number(existingPurchase.suggested_quantity) + remainingQty
                        })
                        .eq('id', existingPurchase.id);
                } else {
                    await supabase.from('purchase_list_items').insert({
                        user_id: ownerId,
                        stock_item_id: stockItemId,
                        suggested_quantity: remainingQty,
                        status: 'pending',
                        notes: `Gerado automaticamente - Ordem Previsão: ${order.technical_sheet.name}`,
                    });
                }
            }
        }

        if (insufficientItems.length > 0) {
            const itemsList = insufficientItems.map(i => `${i.name} (falta ${(i.needed - i.available).toFixed(2)} ${i.unit})`).join(', ');
            toast.warning(`Estoque insuficiente para: ${itemsList}. Pedidos de compra gerados.`);
        }
    };

    const addToFinishedStock = async (order: any) => {
        if (!ownerId || !order.technical_sheet) return;

        const technicalSheetId = order.technical_sheet.id;
        const unit = order.technical_sheet.yield_unit;
        const praca = order.praca || null;
        const quantity = order.net_quantity;

        // Check if entry already exists for this known sheet + praca
        let query = supabase
            .from('finished_productions_stock')
            .select('id, quantity')
            .eq('technical_sheet_id', technicalSheetId);

        if (praca) {
            query = query.eq('praca', praca);
        } else {
            query = query.is('praca', null);
        }

        const { data: existing } = await query.single();

        if (existing) {
            await supabase
                .from('finished_productions_stock')
                .update({
                    quantity: Number(existing.quantity) + Number(quantity),
                })
                .eq('id', existing.id);
        } else {
            const insertData: any = {
                user_id: ownerId,
                technical_sheet_id: technicalSheetId,
                quantity: Number(quantity),
                unit: unit,
                notes: `Produção (Previsão): ${new Date().toLocaleDateString()}`,
            };
            if (praca) insertData.praca = praca;

            await supabase
                .from('finished_productions_stock')
                .insert(insertData);
        }
    };

    const updateOrderStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }) => {
            const { data: order, error } = await supabase
                .from('forecast_production_orders')
                .update({ status })
                .eq('id', id)
                .select(`
                    *,
                    technical_sheet:technical_sheets(id, name, yield_unit, production_type)
                `)
                .single();

            if (error) throw error;

            if (status === 'completed' && order) {
                await addToFinishedStock(order);
            }

            // If starting production, deduct ingredients
            if (status === 'in_progress' && order) {
                // Fetch full order with ingredients since update return might be partial depending on RLS/Query
                // Re-fetch to be safe or type check 'order'
                // The update returns technical_sheet but we need ingredients.
                // It's safer to use the 'order' from the query cache or fetch it again with ingredients.
                // However, 'order' variable from update response has minimal technical_sheet fields.

                // Let's refetch the full order with ingredients
                const { data: fullOrder } = await supabase
                    .from('forecast_production_orders')
                    .select(`
                        *,
                        technical_sheet:technical_sheets(
                            id, name, yield_unit, yield_quantity, image_url,
                            ingredients:technical_sheet_ingredients(
                                stock_item_id, quantity, unit, stock_item:stock_items(name)
                            )
                        )
                    `)
                    .eq('id', id)
                    .single();

                if (fullOrder) {
                    await subtractStockForProduction(fullOrder as any);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
            toast.success('Status atualizado!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao atualizar status: ${err.message}`);
        },
    });

    const deleteOrder = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('forecast_production_orders')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            toast.success('Ordem removida!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao remover: ${err.message}`);
        },
    });

    // Group orders by praca for the kitchen screen
    const ordersByPraca = orders.reduce((acc, order) => {
        const praca = order.praca || 'praca_quente';
        if (!acc[praca]) acc[praca] = [];
        acc[praca].push(order);
        return acc;
    }, {} as Record<string, ForecastProductionOrder[]>);

    // Summary counts
    const summary = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        inProgress: orders.filter(o => o.status === 'in_progress').length,
        completed: orders.filter(o => o.status === 'completed').length,
    };

    return {
        orders,
        ordersByPraca,
        summary,
        isLoading,
        updateOrderStatus,
        deleteOrder,
    };
}
