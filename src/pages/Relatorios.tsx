import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  TrendingDown,
  Calendar as CalendarIcon,
  Download,
  Printer
} from 'lucide-react';
import { useReports, DateRangeType } from '@/hooks/useReports';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Relatorios() {
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('vendas');

  const {
    salesReport,
    lossesReport,
    purchasedReport,
    usedReport,
    purchaseListReport,
    totalSales,
    totalLosses,
    totalPurchased,
    totalPurchaseList,
    isLoading,
  } = useReports(dateRange, customStart, customEnd);

  const handleExport = (reportType: string) => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    switch (reportType) {
      case 'vendas':
        data = salesReport;
        filename = 'relatorio_vendas';
        headers = ['Data', 'Produto', 'Quantidade', 'Preço Unitário', 'Total'];
        break;
      case 'perdas':
        data = lossesReport;
        filename = 'relatorio_perdas';
        headers = ['Data', 'Produto', 'Quantidade', 'Valor Estimado'];
        break;
      case 'comprados':
        data = purchasedReport;
        filename = 'relatorio_insumos_comprados';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Fornecedor', 'Custo Total'];
        break;
      case 'utilizados':
        data = usedReport;
        filename = 'relatorio_insumos_utilizados';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Produção', 'Origem'];
        break;
      case 'compras':
        data = purchaseListReport;
        filename = 'relatorio_compras';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Fornecedor', 'Status', 'Custo Estimado'];
        break;
    }

    // Convert to CSV
    const csvContent = [
      headers.join(';'),
      ...data.map(row => Object.values(row).join(';'))
    ].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Relatórios" description="Relatórios e análises do sistema" />
        <div className="grid grid-cols-4 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          description="Relatórios e análises do sistema"
        />
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {dateRange === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(!customStart && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStart ? format(customStart, 'dd/MM/yyyy') : 'Data inicial'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={setCustomStart}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(!customEnd && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Data final'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={setCustomEnd}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-600">R$ {totalSales.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Vendas</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-lg font-bold text-destructive">R$ {totalLosses.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Perdas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">R$ {totalPurchased.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Insumos Comprados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ShoppingCart className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-bold">R$ {totalPurchaseList.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Lista Compras</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="vendas" className="text-xs">Vendas</TabsTrigger>
            <TabsTrigger value="perdas" className="text-xs">Perdas</TabsTrigger>
            <TabsTrigger value="comprados" className="text-xs">Insumos Comprados</TabsTrigger>
            <TabsTrigger value="utilizados" className="text-xs">Insumos Utilizados</TabsTrigger>
            <TabsTrigger value="compras" className="text-xs">Compras</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport(activeTab)}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Sales Report */}
        <TabsContent value="vendas">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Relatório de Vendas
                <Badge variant="secondary">{salesReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.map((sale, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{sale.date}</TableCell>
                          <TableCell className="font-medium">{sale.productName}</TableCell>
                          <TableCell className="text-right">{sale.quantity}</TableCell>
                          <TableCell className="text-right">R$ {sale.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">R$ {sale.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={2}>TOTAL</TableCell>
                        <TableCell className="text-right">{salesReport.reduce((sum, s) => sum + s.quantity, 0)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-emerald-600">R$ {totalSales.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Losses Report */}
        <TabsContent value="perdas">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Relatório de Perdas
                <Badge variant="destructive">{lossesReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossesReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma perda registrada no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead className="text-right">Valor Est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lossesReport.map((loss, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{loss.date}</TableCell>
                          <TableCell className="font-medium">{loss.productName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {loss.sourceType === 'sale_product' ? 'Venda' : 
                               loss.sourceType === 'finished_production' ? 'Produção' : 'Estoque'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{loss.quantity}</TableCell>
                          <TableCell>{loss.unit}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            R$ {loss.estimatedValue.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-destructive/10 font-bold border-t-2">
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        <TableCell className="text-right">{lossesReport.reduce((sum, l) => sum + l.quantity, 0)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-destructive">R$ {totalLosses.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchased Ingredients Report */}
        <TabsContent value="comprados">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Insumos Comprados
                <Badge variant="secondary">{purchasedReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchasedReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum insumo comprado no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasedReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.supplierName || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {item.totalCost.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={5}>TOTAL</TableCell>
                        <TableCell className="text-right text-primary">R$ {totalPurchased.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Used Ingredients Report */}
        <TabsContent value="utilizados">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Insumos Utilizados
                <Badge variant="secondary">{usedReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usedReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum insumo utilizado no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Produção</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usedReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-xs">{item.productionName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.source}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={2}>TOTAL DE ITENS</TableCell>
                        <TableCell className="text-right">{usedReport.reduce((sum, i) => sum + i.quantity, 0).toFixed(2)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchases Report */}
        <TabsContent value="compras">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Relatório de Compras
                <Badge variant="secondary">{purchaseListReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseListReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma compra no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Custo Est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseListReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.supplierName || '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.status === 'Entregue' ? 'default' : item.status === 'Comprado' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {item.estimatedCost.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={6}>TOTAL</TableCell>
                        <TableCell className="text-right text-orange-600">R$ {totalPurchaseList.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
