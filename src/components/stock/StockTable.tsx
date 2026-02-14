import { useState, useCallback } from 'react';
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Check, X, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatQuantity } from '@/lib/utils';
import {
  type StockItem,
  CATEGORY_LABELS,
  UNIT_LABELS,
  getStockStatus,
  type StockCategory,
} from '@/hooks/useStockItems';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';

interface StockItemWithProjection extends StockItem {
  projectedQuantity?: number;
  projectedConsumption?: number;
}

interface StockTableProps {
  items: StockItemWithProjection[];
  onMovement: (item: StockItem) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  onCountedQuantityChange?: (itemId: string, quantity: number) => void;
  onTransfer?: (item: StockItem) => void;
  isVoiceActive?: boolean;
  activeVoiceItemId?: string | null;
  onVoiceToggle?: (itemId: string) => void;
}

export function StockTable({ 
  items, 
  onMovement, 
  onEdit, 
  onDelete,
  onCountedQuantityChange,
  onTransfer,
}: StockTableProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (item: StockItemWithProjection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditValue(Number(item.current_quantity).toFixed(3));
  };

  const handleConfirmEdit = (itemId: string) => {
    const quantity = parseFloat(editValue);
    if (!isNaN(quantity) && quantity >= 0 && onCountedQuantityChange) {
      onCountedQuantityChange(itemId, quantity);
    }
    setEditingItemId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter') {
      handleConfirmEdit(itemId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card">
        Nenhum item de estoque cadastrado
      </div>
    );
  }

  return (
    <MobileList>
      {items.map((item) => {
        const currentQty = Number(item.current_quantity);
        const minQty = Number(item.minimum_quantity);
        const status = getStockStatus(currentQty, minQty);
        const unitLabel = UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS];
        const categoryLabel = CATEGORY_LABELS[item.category as StockCategory];
        const isEditing = editingItemId === item.id;

        return (
          <MobileListItem
            key={item.id}
            className={cn(
              "py-2",
              status === 'red' && 'border-destructive/50 bg-destructive/5',
              status === 'yellow' && 'border-warning/50 bg-warning/5'
            )}
            actions={
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovement(item);
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
                {onTransfer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransfer(item);
                    }}
                    title="Transferir para outro estoque"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          >
            {/* Linha 1: Nome e Status */}
            <div className="flex items-center gap-2">
              <MobileListTitle>{item.name}</MobileListTitle>
              <MobileListBadge
                variant={status === 'green' ? 'success' : status === 'yellow' ? 'warning' : 'destructive'}
              >
                {status === 'green' ? 'OK' : status === 'yellow' ? 'Baixo' : 'Crítico'}
              </MobileListBadge>
            </div>

            {/* Linha 2: Categoria, Quantidades - Compact */}
            <MobileListDetails className="text-xs gap-1.5 flex-wrap">
              <span className="bg-secondary px-1 py-0.5 rounded text-[10px]">{categoryLabel}</span>
              <span>Atual: <strong>{formatQuantity(currentQty)}{unitLabel}</strong></span>
              {isEditing ? (
                <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, item.id)}
                    className="w-16 h-5 text-xs px-1"
                    step="0.001"
                    min="0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); handleConfirmEdit(item.id); }}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </span>
              ) : (
                <button className="hover:underline" onClick={(e) => handleStartEdit(item, e)}>
                  Contada: <strong>{formatQuantity(currentQty)}</strong>
                </button>
              )}
              <span>Mín: {formatQuantity(minQty)}{unitLabel}</span>
            </MobileListDetails>
          </MobileListItem>
        );
      })}
    </MobileList>
  );
}
