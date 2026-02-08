import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CATEGORY_LABELS, UNIT_LABELS, type StockItem, type StockCategory, type StockUnit } from '@/hooks/useStockItems';
import { useSuppliers } from '@/hooks/useSuppliers';
import { AlertTriangle } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  category: z.enum(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros'] as const),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'dz'] as const),
  current_quantity: z.coerce.number().min(0).optional(),
  minimum_quantity: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  waste_factor: z.coerce.number().min(0).max(100).optional(),
  expiration_date: z.string().optional(),
  supplier_id: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StockItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  initialData?: StockItem | null;
  isLoading?: boolean;
}

export function StockItemForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
}: StockItemFormProps) {
  const { suppliers } = useSuppliers();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'outros',
      unit: 'unidade',
      current_quantity: 0,
      minimum_quantity: 0,
      unit_price: 0,
      waste_factor: 0,
      expiration_date: '',
      supplier_id: '',
      notes: '',
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        category: (initialData?.category as StockCategory) || 'outros',
        unit: (initialData?.unit as StockUnit) || 'unidade',
        current_quantity: Number(initialData?.current_quantity) || 0,
        minimum_quantity: Number(initialData?.minimum_quantity) || 0,
        unit_price: Number((initialData as any)?.unit_price) || 0,
        waste_factor: Number((initialData as any)?.waste_factor) || 0,
        expiration_date: initialData?.expiration_date || '',
        supplier_id: initialData?.supplier_id || '',
        notes: initialData?.notes || '',
      });
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = (data: FormData) => {
    // Apply defaults and clean up empty strings
    const cleanedData = {
      name: data.name,
      category: data.category,
      unit: data.unit,
      current_quantity: data.current_quantity ?? 0,
      minimum_quantity: data.minimum_quantity ?? 0,
      unit_price: data.unit_price ?? 0,
      waste_factor: data.waste_factor ?? 0,
      supplier_id: data.supplier_id || null,
      expiration_date: data.expiration_date || null,
      notes: data.notes || null,
    };
    onSubmit(cleanedData);
  };

  const expirationDate = watch('expiration_date');
  const isExpiringSoon = expirationDate && new Date(expirationDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isExpired = expirationDate && new Date(expirationDate) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Item' : 'Novo Item de Estoque'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Farinha de Trigo"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value as StockCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={watch('unit')}
                onValueChange={(value) => setValue('unit', value as StockUnit)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_quantity">Qtd. Atual</Label>
              <Input
                id="current_quantity"
                type="number"
                step="0.001"
                {...register('current_quantity')}
              />
              {errors.current_quantity && (
                <p className="text-sm text-destructive">{errors.current_quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_quantity">Qtd. Mínima</Label>
              <Input
                id="minimum_quantity"
                type="number"
                step="0.001"
                {...register('minimum_quantity')}
              />
              {errors.minimum_quantity && (
                <p className="text-sm text-destructive">{errors.minimum_quantity.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_price">Preço (R$)</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                {...register('unit_price')}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waste_factor">Desperdício (%)</Label>
              <Input
                id="waste_factor"
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('waste_factor')}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Ex: 10% = precisa comprar 10% a mais
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration_date">Data de Validade (opcional)</Label>
            <Input
              id="expiration_date"
              type="date"
              {...register('expiration_date')}
              className={isExpired ? 'border-destructive' : isExpiringSoon ? 'border-yellow-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco se não quiser controlar validade
            </p>
            {isExpired && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Produto vencido!
              </p>
            )}
            {!isExpired && isExpiringSoon && (
              <p className="text-sm text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Vence em menos de 7 dias
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select
              value={watch('supplier_id') || 'none'}
              onValueChange={(value) => setValue('supplier_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Observações opcionais..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {initialData ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
