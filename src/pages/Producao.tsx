import { useState, useMemo } from 'react';
import { Factory, Search, Calendar as CalendarIcon, Play, CheckCircle2, Clock, Eye, ChevronLeft, ChevronRight, XCircle, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { useProductions, ProductionWithSheet, STATUS_LABELS, ProductionStatus } from '@/hooks/useProductions';
import { useTechnicalSheets } from '@/hooks/useTechnicalSheets';
import { ProductionExecutionDialog } from '@/components/production/ProductionExecutionDialog';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type PeriodType = 'day' | 'week' | 'month' | 'year';

const statusConfig: Record<ProductionStatus, { label: string; icon: typeof CalendarIcon; variant: 'default' | 'warning' | 'success' | 'destructive' }> = {
  planned: { label: 'Planejada', icon: CalendarIcon, variant: 'default' },
  in_progress: { label: 'Em andamento', icon: Play, variant: 'warning' },
  completed: { label: 'Concluída', icon: CheckCircle2, variant: 'success' },
  cancelled: { label: 'Cancelada', icon: XCircle, variant: 'destructive' },
};

export default function Producao() {
  const { productions, isLoading, createProduction, updateProduction } = useProductions();
  const { sheets } = useTechnicalSheets();
  
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedProducao, setSelectedProducao] = useState<ProductionWithSheet | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Period filter state
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [formData, setFormData] = useState({
    technicalSheetId: '',
    name: '',
    plannedQuantity: '',
    scheduledDate: '',
  });

  // Calculate period boundaries
  const periodBoundaries = useMemo(() => {
    switch (periodType) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate, { locale: ptBR }), end: endOfWeek(currentDate, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'year':
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
  }, [periodType, currentDate]);

  // Format period label
  const periodLabel = useMemo(() => {
    switch (periodType) {
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
      case 'week':
        return `${format(periodBoundaries.start, "d MMM", { locale: ptBR })} - ${format(periodBoundaries.end, "d MMM yyyy", { locale: ptBR })}`;
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'year':
        return format(currentDate, "yyyy", { locale: ptBR });
    }
  }, [periodType, currentDate, periodBoundaries]);

  // Navigate period
  const navigatePeriod = (direction: 'prev' | 'next') => {
    switch (periodType) {
      case 'day':
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1));
        break;
    }
  };

  // Handle calendar date selection
  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setCalendarOpen(false);
    }
  };

  // Filter productions by period and search
  const filteredProducoes = useMemo(() => {
    return productions.filter(prod => {
      // Parse date as local date to avoid timezone issues
      const [year, month, day] = prod.scheduled_date.split('-').map(Number);
      const prodDate = new Date(year, month - 1, day);
      const inPeriod = isWithinInterval(prodDate, { start: periodBoundaries.start, end: periodBoundaries.end });
      const matchesSearch = prod.name.toLowerCase().includes(search.toLowerCase());
      return inPeriod && matchesSearch;
    });
  }, [productions, periodBoundaries, search]);

  const producoesPorStatus = {
    planned: filteredProducoes.filter(p => p.status === 'planned'),
    in_progress: filteredProducoes.filter(p => p.status === 'in_progress'),
    completed: filteredProducoes.filter(p => p.status === 'completed'),
    cancelled: filteredProducoes.filter(p => p.status === 'cancelled'),
  };

  const openNewDialog = () => {
    setFormData({ technicalSheetId: '', name: '', plannedQuantity: '', scheduledDate: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.technicalSheetId || !formData.plannedQuantity || !formData.scheduledDate) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const selectedSheet = sheets.find(s => s.id === formData.technicalSheetId);
    const name = formData.name || selectedSheet?.name || 'Produção';

    await createProduction.mutateAsync({
      technical_sheet_id: formData.technicalSheetId,
      name,
      planned_quantity: parseFloat(formData.plannedQuantity),
      scheduled_date: formData.scheduledDate,
    });
    
    setDialogOpen(false);
  };

  const updateStatus = async (id: string, newStatus: ProductionStatus, actualQty?: number) => {
    await updateProduction.mutateAsync({ 
      id, 
      status: newStatus,
      ...(actualQty !== undefined && { actual_quantity: actualQty })
    });
  };

  const openPreview = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setPreviewOpen(true);
  };

  const handleStartFromPreview = async () => {
    if (selectedProducao) {
      await updateStatus(selectedProducao.id, 'in_progress');
      setPreviewOpen(false);
      // Open execution dialog for step-by-step
      setExecutionDialogOpen(true);
    }
  };

  const openExecutionDialog = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setExecutionDialogOpen(true);
  };

  const openCompleteDialog = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setActualQuantity(String(producao.planned_quantity));
    setCompleteDialogOpen(true);
  };

  const handleCompleteProduction = async () => {
    if (!selectedProducao) return;
    
    const qty = parseFloat(actualQuantity);
    if (isNaN(qty) || qty < 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    
    await updateStatus(selectedProducao.id, 'completed', qty);
    setCompleteDialogOpen(false);
    setPreviewOpen(false);
    toast.success('Produção finalizada com sucesso!');
  };

  const handleSheetSelect = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    setFormData(prev => ({
      ...prev,
      technicalSheetId: sheetId,
      name: sheet?.name || '',
    }));
  };

  const renderProducaoItem = (producao: ProductionWithSheet) => {
    const config = statusConfig[producao.status];
    const StatusIcon = config.icon;

    return (
      <MobileListItem
        key={producao.id}
        onClick={() => openPreview(producao)}
        actions={
          <div className="flex flex-col gap-1">
            {producao.status === 'planned' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openPreview(producao);
                }}
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            {producao.status === 'in_progress' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExecutionDialog(producao);
                  }}
                  title="Passo a passo"
                >
                  <ListChecks className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCompleteDialog(producao);
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openPreview(producao);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <MobileListTitle>{producao.name}</MobileListTitle>
          <MobileListBadge variant={config.variant}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </MobileListBadge>
        </div>

        <MobileListDetails>
          <span className="flex items-center gap-1">
            <Factory className="h-3 w-3" />
            {producao.status === 'completed' && producao.actual_quantity !== null ? (
              <span>
                <span className="text-muted-foreground line-through mr-1">{producao.planned_quantity}</span>
                <span className="font-semibold text-success">{producao.actual_quantity}</span> {producao.technical_sheet?.yield_unit || 'un'}
              </span>
            ) : (
              <span>{producao.planned_quantity} {producao.technical_sheet?.yield_unit || 'un'}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(() => {
              const [year, month, day] = producao.scheduled_date.split('-').map(Number);
              return format(new Date(year, month - 1, day), "dd/MM/yyyy", { locale: ptBR });
            })()}
          </span>
        </MobileListDetails>
      </MobileListItem>
    );
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Produção"
        description="Gerencie produções"
        action={{ label: 'Nova', onClick: openNewDialog }}
      />

      {/* Period Filter - Compact */}
      <div className="flex flex-wrap gap-2 mb-2">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[90px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day" className="text-xs">Dia</SelectItem>
            <SelectItem value="week" className="text-xs">Semana</SelectItem>
            <SelectItem value="month" className="text-xs">Mês</SelectItem>
            <SelectItem value="year" className="text-xs">Ano</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('prev')}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 min-w-[140px] justify-center text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={handleCalendarSelect}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('next')}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto">{filteredProducoes.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Nenhuma produção"
          description="Agende uma nova produção"
          action={{ label: 'Agendar', onClick: openNewDialog }}
        />
      ) : (
        <div className="space-y-3">
          {/* Planejadas */}
          {producoesPorStatus.planned.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-xs flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 text-primary" />
                Planejadas ({producoesPorStatus.planned.length})
              </h3>
              <MobileList>
                {producoesPorStatus.planned.map(renderProducaoItem)}
              </MobileList>
            </div>
          )}

          {/* Em Andamento */}
          {producoesPorStatus.in_progress.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-xs flex items-center gap-1">
                <Play className="h-3 w-3 text-warning" />
                Em Andamento ({producoesPorStatus.in_progress.length})
              </h3>
              <MobileList>
                {producoesPorStatus.in_progress.map(renderProducaoItem)}
              </MobileList>
            </div>
          )}

          {/* Concluídas */}
          {producoesPorStatus.completed.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-xs flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Concluídas ({producoesPorStatus.completed.length})
              </h3>
              <MobileList>
                {producoesPorStatus.completed.map(renderProducaoItem)}
              </MobileList>
            </div>
          )}

          {/* Canceladas */}
          {producoesPorStatus.cancelled.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-xs flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3 text-destructive" />
                Canceladas ({producoesPorStatus.cancelled.length})
              </h3>
              <MobileList>
                {producoesPorStatus.cancelled.map(renderProducaoItem)}
              </MobileList>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Dialog Nova Produção */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Produção</DialogTitle>
            <DialogDescription>
              Agende uma nova produção
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ficha Técnica *</Label>
              <Select
                value={formData.technicalSheetId}
                onValueChange={handleSheetSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ficha técnica" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma ficha técnica cadastrada.
                      <br />
                      Vá até a aba "Fichas Técnicas" para criar uma.
                    </div>
                  ) : (
                    sheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name} {sheet.yield_quantity && `(${sheet.yield_quantity} ${sheet.yield_unit})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Produção</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Produção Semanal de Pães"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.plannedQuantity}
                  onChange={(e) => setFormData({ ...formData, plannedQuantity: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createProduction.isPending}>
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Preview Dialog */}
      <ProductionPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        producao={selectedProducao}
        onStartProduction={handleStartFromPreview}
        onComplete={() => {
          if (selectedProducao) {
            openCompleteDialog(selectedProducao);
          }
        }}
        onUpdateDate={async (newDate: string) => {
          if (selectedProducao) {
            await updateProduction.mutateAsync({ id: selectedProducao.id, scheduled_date: newDate });
          }
        }}
        isUpdating={updateProduction.isPending}
      />

      {/* Complete Production Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Produção</DialogTitle>
            <DialogDescription>
              Informe a quantidade real produzida
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProducao && (
              <>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Produção</p>
                  <p className="font-semibold text-lg">{selectedProducao.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Quantidade Planejada</p>
                    <p className="font-bold text-xl text-primary">
                      {selectedProducao.planned_quantity} {selectedProducao.technical_sheet?.yield_unit || 'un'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actualQty">Quantidade Produzida *</Label>
                    <Input
                      id="actualQty"
                      type="number"
                      value={actualQuantity}
                      onChange={(e) => setActualQuantity(e.target.value)}
                      placeholder="Ex: 48"
                      className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      {selectedProducao.technical_sheet?.yield_unit || 'unidades'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCompleteProduction} 
              disabled={updateProduction.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Execution Dialog (Step by Step) */}
      <ProductionExecutionDialog
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
        production={selectedProducao}
        onComplete={() => {
          setExecutionDialogOpen(false);
          if (selectedProducao) {
            openCompleteDialog(selectedProducao);
          }
        }}
      />
    </div>
  );
}

// Inline preview component using real data
function ProductionPreviewSheet({
  open,
  onOpenChange,
  producao,
  onStartProduction,
  onComplete,
  onUpdateDate,
  isUpdating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producao: ProductionWithSheet | null;
  onStartProduction: () => void;
  onComplete: () => void;
  onUpdateDate: (newDate: string) => Promise<void>;
  isUpdating: boolean;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  if (!producao || !producao.technical_sheet) return null;

  const sheet = producao.technical_sheet;
  const multiplier = Number(producao.planned_quantity) / Number(sheet.yield_quantity);
  const canEditDate = producao.status === 'planned' || producao.status === 'in_progress';

  // Parse scheduled date as local date
  const [year, month, day] = producao.scheduled_date.split('-').map(Number);
  const scheduledDate = new Date(year, month - 1, day);
  const today = startOfDay(new Date());
  
  // Check if production is overdue (planned but past scheduled date)
  const isOverdue = producao.status === 'planned' && scheduledDate < today;

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      if (formattedDate !== producao.scheduled_date) {
        await onUpdateDate(formattedDate);
      }
      setCalendarOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producao.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-muted-foreground text-xs">Planejado</p>
              <p className="font-bold text-lg text-primary">{producao.planned_quantity}</p>
            </div>
            {producao.status === 'completed' && producao.actual_quantity !== null && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-muted-foreground text-xs">Produzido</p>
                <p className="font-bold text-lg text-success">{producao.actual_quantity}</p>
              </div>
            )}
            <div className={cn(
              "p-3 rounded-lg",
              isOverdue ? "bg-destructive/10 border border-destructive/30" : "bg-muted"
            )}>
              <p className={cn(
                "text-xs",
                isOverdue ? "text-destructive" : "text-muted-foreground"
              )}>Data {isOverdue && "(Atrasada)"}</p>
              {canEditDate ? (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "font-medium flex items-center gap-1 hover:opacity-80 transition-opacity",
                        isOverdue ? "text-destructive" : ""
                      )}
                      disabled={isUpdating}
                    >
                      {format(scheduledDate, "dd/MM/yy", { locale: ptBR })}
                      <CalendarIcon className={cn(
                        "h-3 w-3",
                        isOverdue ? "text-destructive/70" : "text-muted-foreground"
                      )} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={handleDateSelect}
                      initialFocus
                      className="pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="font-medium">
                  {format(scheduledDate, "dd/MM/yy", { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground text-xs">Multiplicador</p>
              <p className="font-medium">{multiplier.toFixed(2)}x</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2 text-sm">Ingredientes Necessários</h4>
            <div className="rounded-lg border divide-y text-sm">
              {sheet.ingredients.map((ing, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5">
                  <span>{ing.stock_item?.name || 'Item'}</span>
                  <span className="font-medium text-primary">
                    {(Number(ing.quantity) * multiplier).toFixed(2)} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {producao.notes && (
            <div>
              <h4 className="font-medium mb-1 text-sm">Observações</h4>
              <p className="text-sm text-muted-foreground">{producao.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {producao.status === 'planned' && (
            <Button onClick={onStartProduction} className="gap-2">
              <Play className="h-4 w-4" />
              Iniciar
            </Button>
          )}
          {producao.status === 'in_progress' && (
            <Button onClick={onComplete} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
