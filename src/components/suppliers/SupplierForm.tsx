import { useState } from 'react';
import { Plus, Phone, Mail, Star, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Supplier } from '@/hooks/useSuppliers';

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Supplier>) => void;
  initialData?: Supplier | null;
  isLoading?: boolean;
}

const CATEGORIES = [
  'Laticínios',
  'Secos e Grãos',
  'Hortifruti',
  'Carnes e Peixes',
  'Embalagens',
  'Limpeza',
  'Bebidas',
  'Outros',
];

export function SupplierForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
}: SupplierFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [deliveryDays, setDeliveryDays] = useState(String(initialData?.average_delivery_days || 3));
  const [rating, setRating] = useState(String(initialData?.quality_rating || 3));
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      category: category || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      average_delivery_days: parseInt(deliveryDays) || 3,
      quality_rating: parseInt(rating) || 3,
      notes: notes || null,
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName(initialData?.name || '');
      setCategory(initialData?.category || '');
      setPhone(initialData?.phone || '');
      setWhatsapp(initialData?.whatsapp || '');
      setEmail(initialData?.email || '');
      setDeliveryDays(String(initialData?.average_delivery_days || 3));
      setRating(String(initialData?.quality_rating || 3));
      setNotes(initialData?.notes || '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do fornecedor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 0000-0000"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@fornecedor.com"
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryDays">Prazo de Entrega (dias)</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deliveryDays"
                  type="number"
                  min="1"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Qualidade (1-5)</Label>
              <div className="relative">
                <Star className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger className="pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {'★'.repeat(r)}{'☆'.repeat(5 - r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {initialData ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
