import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductions } from '@/hooks/useProductions';
import { useStockItems } from '@/hooks/useStockItems';
import { useFinishedProductionsStock } from '@/hooks/useFinishedProductionsStock';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { usePendingDeliveries } from '@/hooks/usePendingDeliveries';
import { AIAssistant } from '@/components/dashboard/AIAssistant';
import { usePreparationAlerts } from '@/hooks/usePreparationAlerts';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { productions, isLoading: productionsLoading } = useProductions();
  const { items: stockItems, isLoading: stockLoading } = useStockItems();
  const { finishedStock, isLoading: finishedLoading } = useFinishedProductionsStock();
  const { saleProducts, isLoading: saleProductsLoading } = useSaleProducts();
  const { alerts: preparationAlerts, isLoading: alertsLoading, resolveAlert } = usePreparationAlerts();
  const { pendingItems } = usePendingDeliveries();

  // Filter productions by status
  const plannedProductions = productions.filter((p) => p.status === 'planned');
  const inProgressProductions = productions.filter((p) => p.status === 'in_progress');

  // Filter low stock items (current <= minimum)
  const lowStockItems = stockItems.filter(
    (item) => item.current_quantity <= item.minimum_quantity &&
      !pendingItems.some(p => p.stock_item_id === item.id)
  );

  const lowFinishedStock = finishedStock.filter(
    (item) => {
      // Calculate expected output from in-progress productions for this item
      // We match production.technical_sheet_id with item.technical_sheet_id
      const incomingFromProduction = inProgressProductions
        .filter(p => p.technical_sheet_id === item.technical_sheet_id)
        .reduce((sum, p) => sum + (Number(p.planned_quantity) || 0), 0);

      const totalAvailable = item.quantity + incomingFromProduction;

      return totalAvailable <= (item.technical_sheet?.minimum_stock || 0);
    }
  );

  const lowSaleProducts = saleProducts.filter(
    (item) => item.ready_quantity <= (item.minimum_stock || 0)
  );

  // Debug logging
  console.log('=== DASHBOARD DEBUG ===');
  console.log('Stock Items:', stockItems.length);
  console.log('Finished Stock:', finishedStock.length, finishedStock);
  console.log('Sale Products:', saleProducts.length, saleProducts);
  console.log('Low Stock Items:', lowStockItems.length);
  console.log('Low Finished Stock:', lowFinishedStock.length, lowFinishedStock);
  console.log('Low Sale Products:', lowSaleProducts.length, lowSaleProducts);

  const combinedAlerts = [
    ...lowStockItems.map(item => ({
      id: item.id,
      name: item.name,
      current: item.current_quantity,
      min: item.minimum_quantity,
      unit: item.unit,
      type: 'insumo' as const
    })),
    ...lowFinishedStock.map(item => ({
      id: item.id,
      name: item.technical_sheet?.name || 'Desconhecido',
      current: item.quantity,
      min: item.technical_sheet?.minimum_stock || 0,
      unit: item.unit,
      type: 'producao' as const
    })),
    ...lowSaleProducts.map(item => ({
      id: item.id,
      name: item.name,
      current: item.ready_quantity,
      min: item.minimum_stock || 0,
      unit: 'un', // Sale products are usually in units
      type: 'venda' as const
    }))
  ];

  const totalAlerts = combinedAlerts.length;
  const isLoadingAlerts = stockLoading || finishedLoading || saleProductsLoading;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Painel"
        description="Visão geral da sua gestão gastronômica"
      />

      {/* Smart Analysis Block */}
      <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <AIAssistant />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preparation Alerts */}
        {(preparationAlerts.length > 0) && (
          <Card className="col-span-full border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Falhas na Preparação (Estoque Insuficiente)
                <Badge variant="destructive" className="ml-auto">
                  {preparationAlerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preparationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-destructive/20"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Não foi possível preparar: <span className="font-bold">{alert.sale_product?.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Faltou: <span className="text-destructive font-semibold">{alert.missing_quantity} {alert.missing_component_name}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => resolveAlert.mutate(alert.id)}
                    className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-green-600 transition-colors"
                    title="Marcar como resolvido"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Planned Productions */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/producao')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Produções Programadas
              <Badge variant="secondary" className="ml-auto">
                {plannedProductions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productionsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : plannedProductions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma produção programada</p>
            ) : (
              plannedProductions.slice(0, 4).map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{prod.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(prod.scheduled_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {prod.planned_quantity} un
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* In Progress Productions */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/producao')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-success" />
              Produções em Processo
              <Badge variant="secondary" className="ml-auto">
                {inProgressProductions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productionsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : inProgressProductions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma produção em andamento</p>
            ) : (
              inProgressProductions.slice(0, 4).map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20"
                >
                  <div>
                    <p className="font-medium text-sm">{prod.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(prod.scheduled_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-success border-success">
                    {prod.planned_quantity} un
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas de Estoque
              <Badge variant="secondary" className="ml-auto">
                {totalAlerts}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingAlerts ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : totalAlerts === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item com estoque baixo</p>
            ) : (
              combinedAlerts.slice(0, 5).map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
                  onClick={() => {
                    if (item.type === 'insumo') navigate('/estoque');
                    else if (item.type === 'producao') navigate('/estoque-finalizados');
                    else if (item.type === 'venda') navigate('/produtos-venda');
                  }}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase shrink-0">
                        {item.type === 'insumo' ? 'Insumo' : item.type === 'producao' ? 'Produção' : 'Venda'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mínimo: {item.min} {item.unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning shrink-0">
                    {item.current} {item.unit}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
