import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
    Calculator,
    Info,
    DollarSign,
    TrendingUp,
    ArrowUpRight,
    Save,
    Check
} from 'lucide-react';
import { useProductCosts } from '@/hooks/useProductCosts';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Factory,
    Zap,
    PackagePlus,
    Edit,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

export default function Financeiro() {
    const { productCosts, isLoading: isCostsLoading } = useProductCosts();
    const { updateSaleProduct } = useSaleProducts();
    const [targetCMV, setTargetCMV] = useState(30); // Default 30%

    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [editValues, setEditValues] = useState({
        labor: '0',
        energy: '0',
        other: '0'
    });

    const handleApplyPrice = (productId: string, price: number) => {
        updateSaleProduct.mutate({
            id: productId,
            sale_price: Number(price.toFixed(2))
        }, {
            onSuccess: () => {
                toast.success('Preço atualizado com sucesso!');
            }
        });
    };

    const handleOpenEdit = (product: any) => {
        setEditingProduct(product);
        setEditValues({
            labor: (product.laborCost || 0).toString(),
            energy: (product.energyCost || 0).toString(),
            other: (product.otherCosts || 0).toString()
        });
    };

    const handleSaveCosts = () => {
        if (!editingProduct) return;

        updateSaleProduct.mutate({
            id: editingProduct.id,
            labor_cost: Number(editValues.labor),
            energy_cost: Number(editValues.energy),
            other_costs: Number(editValues.other)
        } as any, {
            onSuccess: () => {
                toast.success('Custos individuais atualizados!');
                setEditingProduct(null);
            }
        });
    };

    if (isCostsLoading) {
        return (
            <div className="space-y-4">
                <PageHeader title="Financeiro" description="Gestão de custos e precificação" />
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-8">
            <PageHeader
                title="Financeiro"
                description="Analise seus custos e gere preços de venda competitivos"
            />

            {/* Pricing Simulator Control */}
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-primary" />
                                Simulador de Precificação (Markup)
                            </CardTitle>
                            <CardDescription>Ajuste o CMV alvo para recalcular os preços sugeridos</CardDescription>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-primary">{targetCMV}%</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">CMV ALVO</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="px-2">
                        <Slider
                            value={[targetCMV]}
                            onValueChange={(vals) => setTargetCMV(vals[0])}
                            min={15}
                            max={60}
                            step={1}
                            className="py-4"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                            <span>MARGEM ALTA (15%)</span>
                            <span>EQUILIBRADO (30-35%)</span>
                            <span>VOLUME (60%)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-3 bg-background rounded-xl border shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-black">Meta Gastos</p>
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            </div>
                            <p className="text-xl font-bold text-emerald-600">{100 - targetCMV}%</p>
                            <p className="text-[10px] text-muted-foreground italic">Margem Bruta Disponível</p>
                        </div>

                        <div className="p-3 bg-background rounded-xl border shadow-sm">
                            <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Markup (K)</p>
                            <p className="text-xl font-bold text-blue-600">{(100 / targetCMV).toFixed(2)}x</p>
                            <p className="text-[10px] text-muted-foreground italic">Multiplicador do custo</p>
                        </div>

                        <div className="p-3 bg-background rounded-xl border shadow-sm lg:col-span-2">
                            <div className="flex items-center gap-2 mb-1">
                                <Info className="h-3 w-3 text-primary" />
                                <p className="text-[10px] text-muted-foreground uppercase font-black">Composição Estimada (Base 100%)</p>
                            </div>
                            <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted mt-2">
                                <div style={{ width: `${targetCMV}%` }} className="bg-primary" title="CMV" />
                                <div style={{ width: '15%' }} className="bg-emerald-500" title="Impostos" />
                                <div style={{ width: '25%' }} className="bg-blue-500" title="Custos Fixos" />
                                <div style={{ width: `${Math.max(0, 100 - targetCMV - 40)}%` }} className="bg-orange-500" title="Lucro Líquido" />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> CMV {targetCMV}%</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Imp. 15%</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Fixo 25%</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Lucro {Math.max(0, 60 - targetCMV)}%</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Analysis Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Análise de Produtos e Precificação Sugerida
                        <Badge variant="secondary" className="ml-auto">{productCosts.length} produtos</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {productCosts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                <Calculator className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground">Vá em "Produtos p/ Venda" e adicione componentes aos seus produtos para ver a análise de custos aqui.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Breakdown do Custo</TableHead>
                                        <TableHead className="text-right">Custo Total</TableHead>
                                        <TableHead className="text-right">Preço Sugerido</TableHead>
                                        <TableHead className="text-right">Preço Atual</TableHead>
                                        <TableHead className="text-right">Margem Atual</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productCosts.map((p) => {
                                        const dynamicSuggested = p.totalCost / (targetCMV / 100);
                                        const isPriceDifferent = Math.abs(dynamicSuggested - (p.currentSalePrice || 0)) > 0.01;
                                        const currentMargin = p.currentSalePrice && p.currentSalePrice > 0
                                            ? ((p.currentSalePrice - p.totalCost) / p.currentSalePrice) * 100
                                            : 0;

                                        return (
                                            <TableRow key={p.id} className="group">
                                                <TableCell className="font-bold">
                                                    <div className="flex flex-col">
                                                        <span>{p.name}</span>
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="h-auto p-0 text-[10px] text-primary w-fit flex items-center gap-1"
                                                            onClick={() => handleOpenEdit(p)}
                                                        >
                                                            <Edit className="h-2 w-2" /> Editar Custos Indiv.
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex gap-1.5 overflow-hidden rounded-sm h-1.5 w-24 bg-muted">
                                                            <div style={{ width: `${(p.ingredientCost / p.totalCost) * 100}%` }} className="bg-primary" title="Insumos" />
                                                            <div style={{ width: `${(p.laborCost / p.totalCost) * 100}%` }} className="bg-emerald-500" title="Mão de Obra" />
                                                            <div style={{ width: `${(p.energyCost / p.totalCost) * 100}%` }} className="bg-blue-500" title="Energia" />
                                                            <div style={{ width: `${(p.otherCosts / p.totalCost) * 100}%` }} className="bg-orange-500" title="Outros" />
                                                        </div>
                                                        <div className="flex gap-2 text-[9px] text-muted-foreground font-medium">
                                                            <span title="Insumos">INS: R${p.ingredientCost.toFixed(2)}</span>
                                                            <span title="Mão de Obra">MOD: R${p.laborCost.toFixed(2)}</span>
                                                            <span title="Energia/OPEX">OPX: R${(p.energyCost + p.otherCosts).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-foreground">
                                                    R$ {p.totalCost.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-primary">R$ {dynamicSuggested.toFixed(2)}</span>
                                                        <span className="text-[9px] text-muted-foreground">Target {targetCMV}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    R$ {p.currentSalePrice?.toFixed(2) || '0.00'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge
                                                        variant={currentMargin >= (100 - targetCMV) ? 'default' : currentMargin >= 50 ? 'secondary' : 'destructive'}
                                                        className={cn(currentMargin >= (100 - targetCMV) && "bg-emerald-100 text-emerald-700 border-emerald-200")}
                                                    >
                                                        {currentMargin.toFixed(1)}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={isPriceDifferent ? "default" : "outline"}
                                                        className={cn("h-8 gap-2", !isPriceDifferent && "text-emerald-600 border-emerald-200 bg-emerald-50")}
                                                        disabled={!isPriceDifferent || updateSaleProduct.isPending}
                                                        onClick={() => handleApplyPrice(p.id, dynamicSuggested)}
                                                    >
                                                        {isPriceDifferent ? (
                                                            <>
                                                                <ArrowUpRight className="h-3 w-3" />
                                                                Aplicar
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Check className="h-3 w-3" />
                                                                Atualizado
                                                            </>
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Costs Dialog */}
            <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Custos Individuais (Simulação) - {editingProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Ajuste os custos operacionais para simular a margem.
                            <span className="block mt-1 font-bold text-orange-600">Nota: O salvamento destes campos está temporariamente desabilitado (apenas para exibição local).</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right flex items-center justify-end gap-2">
                                <Factory className="h-4 w-4 text-emerald-500" />
                                M.O.
                            </Label>
                            <div className="col-span-3 relative">
                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={editValues.labor}
                                    onChange={(e) => setEditValues({ ...editValues, labor: e.target.value })}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right flex items-center justify-end gap-2">
                                <Zap className="h-4 w-4 text-blue-500" />
                                Energia
                            </Label>
                            <div className="col-span-3 relative">
                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={editValues.energy}
                                    onChange={(e) => setEditValues({ ...editValues, energy: e.target.value })}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right flex items-center justify-end gap-2">
                                <PackagePlus className="h-4 w-4 text-orange-500" />
                                Outros
                            </Label>
                            <div className="col-span-3 relative">
                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={editValues.other}
                                    onChange={(e) => setEditValues({ ...editValues, other: e.target.value })}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-xs text-muted-foreground">
                        <p><strong>Nota:</strong> O custo dos insumos (R$ {editingProduct?.ingredientCost.toFixed(2)}) é calculado automaticamente com base na ficha técnica.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProduct(null)}>Fechar</Button>
                        <Button onClick={() => {
                            toast.info("Valores aplicados para simulação nesta sessão.");
                            setEditingProduct(null);
                        }}>
                            Aplicar Simulação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
