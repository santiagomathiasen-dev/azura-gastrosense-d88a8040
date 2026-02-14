import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductions } from '@/hooks/useProductions';
import { useStockItems } from '@/hooks/useStockItems';

export default function Dashboard() {
  const navigate = useNavigate();
  const { productions, isLoading: productionsLoading } = useProductions();
  const { items: stockItems, isLoading: stockLoading } = useStockItems();

  // Filter productions by status
  const plannedProductions = productions.filter((p) => p.status === 'planned');
  const inProgressProductions = productions.filter((p) => p.status === 'in_progress');

  // Filter low stock items (current <= minimum)
  const lowStockItems = stockItems.filter(
    (item) => item.current_quantity <= item.minimum_quantity
  );

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Painel" 
        description="Visão geral da sua gestão gastronômica"
      />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/estoque')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas de Estoque
              <Badge variant="secondary" className="ml-auto">
                {lowStockItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stockLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item com estoque baixo</p>
            ) : (
              lowStockItems.slice(0, 4).map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20"
                >
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Mínimo: {item.minimum_quantity} {item.unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning">
                    {item.current_quantity} {item.unit}
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
