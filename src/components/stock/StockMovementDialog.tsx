import { useState } from 'react';
import { Plus, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type StockItem, UNIT_LABELS } from '@/hooks/useStockItems';
import { type MovementType } from '@/hooks/useStockMovements';

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
  onSubmit: (data: { type: MovementType; quantity: number; notes?: string }) => void;
  isLoading?: boolean;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
}: StockMovementDialogProps) {
  const [type, setType] = useState<MovementType>('entry');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    onSubmit({ type, quantity: qty, notes: notes || undefined });
    setType('entry');
    setQuantity('');
    setNotes('');
  };

  if (!item) return null;

  const unitLabel = UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação de Estoque</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Estoque atual</p>
            <p className="text-2xl font-bold">
              {Number(item.current_quantity).toFixed(3)} {unitLabel}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de movimentação</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-500" />
                    Entrada
                  </span>
                </SelectItem>
                <SelectItem value="exit">
                  <span className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-destructive" />
                    Saída
                  </span>
                </SelectItem>
                <SelectItem value="adjustment">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Ajuste (define valor exato)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              {type === 'adjustment' ? 'Nova quantidade' : 'Quantidade'} ({unitLabel})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da movimentação..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !quantity}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
