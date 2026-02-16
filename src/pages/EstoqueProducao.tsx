import { useState, useCallback } from 'react';
import { Search, ArrowLeft, Package, Boxes, ClipboardList, Send, Mic, MicOff } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStockItems, CATEGORY_LABELS, UNIT_LABELS } from '@/hooks/useStockItems';
import { useProductionStock } from '@/hooks/useProductionStock';
import { useStockRequests } from '@/hooks/useStockRequests';
import { useStockVoiceControl } from '@/hooks/useStockVoiceControl';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';

export default function EstoqueProducao() {
  const { items: centralItems, isLoading: centralLoading } = useStockItems();
  const {
    productionStock,
    isLoading: productionLoading,
    transferToCentral,
    updateQuantity,
  } = useProductionStock();
  const {
    requests,
    pendingRequests,
    isLoading: requestsLoading,
    createRequest,
    cancelRequest,
  } = useStockRequests();

  const [search, setSearch] = useState('');
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const isLoading = centralLoading || productionLoading || requestsLoading;

  // Map production stock to format expected by voice control
  const stockItemsForVoice = productionStock.map(ps => ({
    id: ps.stock_item_id,
    name: ps.stock_item?.name || '',
    unit: ps.stock_item?.unit || 'unidade',
    category: ps.stock_item?.category || 'outros',
  }));

  // Handle voice quantity update
  const handleVoiceQuantityUpdate = useCallback((itemId: string, newQuantity: number) => {
    const item = productionStock.find(ps => ps.stock_item_id === itemId);
    if (item) {
      updateQuantity.mutate({ stockItemId: itemId, quantity: newQuantity });
      toast.success(`${item.stock_item?.name}: ${newQuantity} ${item.stock_item?.unit ? UNIT_LABELS[item.stock_item.unit as keyof typeof UNIT_LABELS] : ''}`);
    }
  }, [productionStock, updateQuantity]);

  const voiceControl = useStockVoiceControl({
    stockItems: stockItemsForVoice as any,
    onQuantityUpdate: handleVoiceQuantityUpdate,
  });

  // Filter production stock by search
  const filteredProductionStock = productionStock.filter(ps =>
    ps.stock_item?.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get all items for request (from central stock)
  const availableItems = centralItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Filter requests by search
  const filteredRequests = requests.filter(r =>
    r.stock_item?.name.toLowerCase().includes(search.toLowerCase())
  );

  const openRequestDialog = (itemId?: string) => {
    setSelectedItemId(itemId || '');
    setQuantity('');
    setNotes('');
    setRequestDialogOpen(true);
  };

  const openReturnDialog = (itemId: string) => {
    setSelectedItemId(itemId);
    setQuantity('');
    setNotes('');
    setReturnDialogOpen(true);
  };

  const handleCreateRequest = async () => {
    if (!selectedItemId || !quantity) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    await createRequest.mutateAsync({
      stockItemId: selectedItemId,
      quantity: qty,
      notes: notes || undefined,
    });

    setRequestDialogOpen(false);
  };

  const handleReturn = async () => {
    if (!selectedItemId || !quantity) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    await transferToCentral.mutateAsync({
      stockItemId: selectedItemId,
      quantity: qty,
      notes: notes || undefined,
    });

    setReturnDialogOpen(false);
  };

  const getMaxReturnQuantity = () => {
    const item = productionStock.find(ps => ps.stock_item_id === selectedItemId);
    return item ? Number(item.quantity) : 0;
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Estoque de Produção"
          description="Gerencie o estoque separado para realizar produções"
        />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Estoque de Produção"
        description="Estoque separado para produções"
        action={{
          label: 'Solicitar',
          onClick: () => openRequestDialog(),
          icon: Send,
        }}
      />

      {/* Summary Cards - Compact */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold">{productionStock.length}</div>
              <p className="text-xs text-muted-foreground">Em Produção</p>
            </div>
          </div>
        </Card>
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold">{pendingRequests.length}</div>
              <p className="text-xs text-muted-foreground">Solicitações</p>
            </div>
          </div>
        </Card>
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold">{centralItems.length}</div>
              <p className="text-xs text-muted-foreground">Central</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Voice Control - Prominent */}
      {voiceControl.isSupported && (
        <div className="mb-3 flex flex-col items-center gap-2">
          <Button
            variant={voiceControl.isListening ? 'destructive' : 'default'}
            size="lg"
            className="h-16 w-16 rounded-full shadow-lg"
            onClick={() => voiceControl.toggleListening()}
            title={voiceControl.isListening ? 'Parar de ouvir' : 'Contagem por voz'}
          >
            {voiceControl.isListening ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
          {voiceControl.isListening && (
            <div className="w-full max-w-md p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground animate-pulse">
                🎤 Ouvindo... Diga o nome do ingrediente e a quantidade
              </p>
              {voiceControl.transcript && (
                <p className="text-sm mt-1 font-medium">"{voiceControl.transcript}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <Tabs defaultValue="production" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="h-8">
          <TabsTrigger value="production" className="text-xs h-7">
            <Boxes className="h-3 w-3 mr-1" />
            Produção
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs h-7">
            <ClipboardList className="h-3 w-3 mr-1" />
            Solicitações
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="items" className="text-xs h-7">
            <Package className="h-3 w-3 mr-1" />
            Itens
          </TabsTrigger>
        </TabsList>

        {/* Production Stock Tab */}
        <TabsContent value="production" className="flex-1 overflow-auto">
          {filteredProductionStock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Estoque de produção vazio"
              description="Faça solicitações para receber itens do estoque central"
              action={{
                label: 'Solicitar Itens',
                onClick: () => openRequestDialog(),
              }}
            />
          ) : (
            <div className="space-y-1">
              {filteredProductionStock.map((ps) => (
                <Card key={ps.id} className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Linha 1: Nome e Quantidade */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs truncate">{ps.stock_item?.name || 'Item não encontrado'}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {Number(ps.quantity).toFixed(1)} {ps.stock_item?.unit ? UNIT_LABELS[ps.stock_item.unit as keyof typeof UNIT_LABELS] : ''}
                        </Badge>
                      </div>
                      {/* Linha 2: Categoria */}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {ps.stock_item?.category ? CATEGORY_LABELS[ps.stock_item.category as keyof typeof CATEGORY_LABELS] : '-'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => openRequestDialog(ps.stock_item_id)}
                      >
                        Solicitar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => openReturnDialog(ps.stock_item_id)}
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="flex-1 overflow-auto">
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma solicitação"
              description="Crie solicitações para solicitar itens do estoque central"
              action={{
                label: 'Nova Solicitação',
                onClick: () => openRequestDialog(),
              }}
            />
          ) : (
            <div className="space-y-1">
              {filteredRequests.map((request) => {
                const remaining = Number(request.requested_quantity) - Number(request.delivered_quantity);
                return (
                  <Card key={request.id} className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      {/* Linha 1: Nome, Status e Quantidades */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs truncate">{request.stock_item?.name || 'Item removido'}</span>
                          <Badge
                            variant={request.status === 'completed' ? 'default' : request.status === 'cancelled' ? 'secondary' : 'outline'}
                            className="text-[10px] px-1 py-0 h-4"
                          >
                            {request.status === 'pending' && 'Pendente'}
                            {request.status === 'partial' && 'Parcial'}
                            {request.status === 'completed' && 'Entregue'}
                            {request.status === 'cancelled' && 'Cancelado'}
                          </Badge>
                        </div>
                        {/* Linha 2: Detalhes */}
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Solicitado: {Number(request.requested_quantity).toFixed(1)}</span>
                          <span>Entregue: {Number(request.delivered_quantity).toFixed(1)}</span>
                          {remaining > 0 && request.status !== 'cancelled' && (
                            <span className="text-warning">Falta: {remaining.toFixed(1)}</span>
                          )}
                          <span>{format(new Date(request.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                      {(request.status === 'pending' || request.status === 'partial') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 text-destructive"
                          onClick={() => cancelRequest.mutate(request.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Items Tab (for creating requests) */}
        <TabsContent value="items" className="flex-1 overflow-auto">
          {availableItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum item cadastrado"
              description="Adicione itens ao estoque central primeiro"
            />
          ) : (
            <div className="space-y-1">
              {availableItems.map((item) => {
                const inProduction = productionStock.find(ps => ps.stock_item_id === item.id);
                const hasPendingRequest = pendingRequests.some(r => r.stock_item_id === item.id);
                return (
                  <Card key={item.id} className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      {/* Linha 1: Nome e Quantidades */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs truncate">{item.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            Central: {Number(item.current_quantity).toFixed(1)}
                          </Badge>
                          {inProduction && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary">
                              Prod: {Number(inProduction.quantity).toFixed(1)}
                            </Badge>
                          )}
                          {hasPendingRequest && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                              Solicitado
                            </Badge>
                          )}
                        </div>
                        {/* Linha 2: Categoria */}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {CATEGORY_LABELS[item.category]} • {UNIT_LABELS[item.unit]}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => openRequestDialog(item.id)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Solicitar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Item</DialogTitle>
            <DialogDescription>
              Crie uma solicitação para receber itens do estoque central.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item" />
                </SelectTrigger>
                <SelectContent>
                  {centralItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({Number(item.current_quantity).toFixed(2)} {UNIT_LABELS[item.unit]} no central)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observação (opcional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Para produção de pães"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRequest}
              disabled={!selectedItemId || !quantity || createRequest.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver para Central</DialogTitle>
            <DialogDescription>
              Devolva itens do estoque de produção para o estoque central.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item" />
                </SelectTrigger>
                <SelectContent>
                  {productionStock.map((ps) => (
                    <SelectItem key={ps.stock_item_id} value={ps.stock_item_id}>
                      {ps.stock_item?.name} ({Number(ps.quantity).toFixed(2)} disponível)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnQuantity">Quantidade</Label>
              <Input
                id="returnQuantity"
                type="number"
                step="0.001"
                min="0"
                max={getMaxReturnQuantity()}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
              />
              {selectedItemId && (
                <p className="text-xs text-muted-foreground">
                  Máximo disponível: {getMaxReturnQuantity().toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnNotes">Observação (opcional)</Label>
              <Input
                id="returnNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Sobra de produção"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReturn}
              disabled={!selectedItemId || !quantity || transferToCentral.isPending}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
