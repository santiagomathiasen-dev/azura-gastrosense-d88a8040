import { useState, useMemo } from 'react';
import {
    CalendarClock,
    Plus,
    Trash2,
    Zap,
    ChefHat,
    Clock,
    CheckCircle2,
    Play,
    AlertTriangle,
    Calendar as CalendarIcon,
    ArrowRight,
    History,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

import { useSalesForecasts } from '@/hooks/useSalesForecasts';
import { useForecastExplosion } from '@/hooks/useForecastExplosion';
import {
    useForecastProductionOrders,
    PRACA_LABELS,
    FORECAST_STATUS_LABELS,
} from '@/hooks/useForecastProductionOrders';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { ProductionSheetDialog } from '@/components/production/ProductionSheetDialog';

// ---- Forecast Input Tab ----

function ForecastInputTab() {
    const [targetDate, setTargetDate] = useState<Date>(addDays(new Date(), 1));
    const [showDialog, setShowDialog] = useState(false);
    const [showSuggestDialog, setShowSuggestDialog] = useState(false);
    const [baseDate, setBaseDate] = useState<Date>(subDays(new Date(), 7));
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState('');

    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const { forecasts, isLoading, createForecast, deleteForecast, generateForecast } = useSalesForecasts(dateStr);
    const { saleProducts = [] } = useSaleProducts();
    const { explode } = useForecastExplosion();

    const handleAddForecast = () => {
        if (!selectedProductId || !quantity) {
            toast.error('Selecione um produto e informe a quantidade.');
            return;
        }
        createForecast.mutate({
            sale_product_id: selectedProductId,
            target_date: dateStr,
            forecasted_quantity: parseInt(quantity, 10),
        });
        setShowDialog(false);
        setSelectedProductId('');
        setQuantity('');
    };

    const handleExplode = () => {
        if (forecasts.length === 0) {
            toast.error('Adicione pelo menos uma previsão antes de gerar ordens.');
            return;
        }
        explode.mutate(dateStr);
    };

    const handleGenerateSuggestion = () => {
        generateForecast.mutate({
            targetDate: dateStr,
            baseDate: format(baseDate, 'yyyy-MM-dd'),
            bufferPercent: 10
        });
        setShowSuggestDialog(false);
    };

    return (
        <div className="space-y-4">
            {/* Date selector */}
            <div className="flex items-center gap-3 flex-wrap">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(targetDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={targetDate}
                            onSelect={(d) => d && setTargetDate(d)}
                            locale={ptBR}
                        />
                    </PopoverContent>
                </Popover>

                <Button size="sm" variant="outline" onClick={() => setTargetDate(addDays(new Date(), 1))}>
                    Amanhã
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTargetDate(addDays(new Date(), 2))}>
                    Depois de amanhã
                </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar Manualmente
                </Button>
                <Button onClick={() => setShowSuggestDialog(true)} variant="secondary" className="gap-2">
                    <History className="h-4 w-4" /> Sugerir do Histórico
                </Button>
                <Button
                    onClick={handleExplode}
                    variant="default"
                    className="gap-2 bg-orange-600 hover:bg-orange-700"
                    disabled={explode.isPending || forecasts.length === 0}
                >
                    <Zap className="h-4 w-4" />
                    {explode.isPending ? 'Gerando...' : 'Gerar Ordens de Produção'}
                </Button>
            </div>

            {/* Forecast List */}
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : forecasts.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="Nenhuma previsão para esta data"
                    description="Adicione previsões de venda para gerar as ordens de produção automaticamente."
                />
            ) : (
                <div className="grid gap-2">
                    {forecasts.map((f) => (
                        <Card key={f.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <ChefHat className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">
                                            {(f.sale_product as any)?.name || 'Produto'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Previsão: <strong>{f.forecasted_quantity}</strong> unid.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteForecast.mutate(f.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Forecast Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Previsão de Venda</DialogTitle>
                        <DialogDescription>
                            Para {format(targetDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Produto de Venda</Label>
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o produto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {saleProducts.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quantidade prevista</Label>
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="Ex: 50"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAddForecast} disabled={createForecast.isPending}>
                            {createForecast.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suggestion Dialog */}
            <Dialog open={showSuggestDialog} onOpenChange={setShowSuggestDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gerar Sugestão Baseada em Histórico</DialogTitle>
                        <DialogDescription>
                            O sistema analisará as vendas e perdas do dia selecionado e aplicará uma margem de segurança de 10%.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Usar dados de:</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {baseDate ? format(baseDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : <span>Selecione uma data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={baseDate}
                                        onSelect={(d) => d && setBaseDate(d)}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">
                                Recomendação: Selecione o mesmo dia da semana anterior
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSuggestDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleGenerateSuggestion} disabled={generateForecast.isPending}>
                            {generateForecast.isPending ? 'Gerando...' : 'Gerar Sugestão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---- Production Orders Tab (Kitchen Screen) ----

function ProductionOrdersTab() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [sheetDialogOpen, setSheetDialogOpen] = useState(false);

    const { orders, ordersByPraca, summary, isLoading, updateOrderStatus } =
        useForecastProductionOrders(dateStr);

    const statusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'in_progress': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
            case 'completed': return 'bg-green-500/10 text-green-600 border-green-200';
            case 'cancelled': return 'bg-gray-500/10 text-gray-500 border-gray-200';
            default: return '';
        }
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'in_progress': return <Play className="h-4 w-4" />;
            case 'completed': return <CheckCircle2 className="h-4 w-4" />;
            default: return null;
        }
    };

    const nextStatus = (current: string) => {
        switch (current) {
            case 'pending': return 'in_progress';
            case 'in_progress': return 'completed';
            default: return current;
        }
    };

    return (
        <div className="space-y-4">
            {/* Date navigation */}
            <div className="flex items-center gap-3 flex-wrap">
                <Button
                    size="sm"
                    variant={dateStr === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(new Date())}
                >
                    Hoje
                </Button>
                <Button
                    size="sm"
                    variant={dateStr === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(addDays(new Date(), 1))}
                >
                    Amanhã
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            locale={ptBR}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Summary badges */}
            {orders.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Total: {summary.total}</Badge>
                    <Badge className="bg-red-500/10 text-red-600 border-red-200">
                        Pendente: {summary.pending}
                    </Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                        Em andamento: {summary.inProgress}
                    </Badge>
                    <Badge className="bg-green-500/10 text-green-600 border-green-200">
                        Concluído: {summary.completed}
                    </Badge>
                </div>
            )}

            {/* Orders grouped by praça */}
            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : orders.length === 0 ? (
                <EmptyState
                    icon={ChefHat}
                    title="Nenhuma ordem de produção"
                    description={`Não há ordens para ${format(selectedDate, "dd/MM/yyyy")}. Use a aba "Previsão" para criar previsões e gerar ordens.`}
                />
            ) : (
                <div className="space-y-4">
                    {Object.entries(ordersByPraca).map(([praca, pracaOrders]) => (
                        <Card key={praca}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ChefHat className="h-4 w-4 text-primary" />
                                    {PRACA_LABELS[praca] || praca}
                                    <Badge variant="secondary" className="ml-auto">
                                        {pracaOrders.length} {pracaOrders.length === 1 ? 'item' : 'itens'}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {pracaOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={cn(
                                            'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md',
                                            statusColor(order.status)
                                        )}
                                        onClick={() => {
                                            setSelectedOrder(order);
                                            setSheetDialogOpen(true);
                                        }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="flex-shrink-0">
                                                {statusIcon(order.status)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                    {order.technical_sheet?.name || 'Sub-receita'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>
                                                        Produzir: <strong>{typeof order.net_quantity === 'number' ? order.net_quantity.toLocaleString('pt-BR') : order.net_quantity}</strong>{' '}
                                                        {order.technical_sheet?.yield_unit || 'un'}
                                                    </span>
                                                    {order.existing_stock > 0 && (
                                                        <span className="text-green-600">
                                                            (estoque: {typeof order.existing_stock === 'number' ? order.existing_stock.toLocaleString('pt-BR') : order.existing_stock})
                                                        </span>
                                                    )}
                                                    <ArrowRight className="h-3 w-3" />
                                                    <span>
                                                        Consumo:{' '}
                                                        {format(new Date(order.target_consumption_date + 'T12:00:00'), 'dd/MM')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status action button */}
                                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="ml-2 flex-shrink-0 gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateOrderStatus.mutate({
                                                        id: order.id,
                                                        status: nextStatus(order.status),
                                                    });
                                                }}
                                            >
                                                {order.status === 'pending' ? (
                                                    <>
                                                        <Play className="h-3 w-3" /> Iniciar
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-3 w-3" /> Concluir
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ProductionSheetDialog
                open={sheetDialogOpen}
                onOpenChange={setSheetDialogOpen}
                order={selectedOrder}
            />
        </div>
    );
}

// ---- Main Page ----

export default function PrevisaoVendas() {
    return (
        <div className="space-y-4">
            <PageHeader
                title="Previsão de Vendas & Produção"
                description="Defina previsões de vendas e gere automaticamente as ordens de produção por praça."
            />
            <Tabs defaultValue="previsao" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="previsao" className="gap-2">
                        <CalendarClock className="h-4 w-4" /> Previsão
                    </TabsTrigger>
                    <TabsTrigger value="ordens" className="gap-2">
                        <ChefHat className="h-4 w-4" /> Ordens de Produção
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="previsao">
                    <ForecastInputTab />
                </TabsContent>
                <TabsContent value="ordens">
                    <ProductionOrdersTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
