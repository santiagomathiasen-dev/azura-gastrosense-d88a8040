import { useState } from 'react';
import { Search, DollarSign, Calculator, Clock, Users, ChefHat, Edit, Trash2, Mic, Plus, FileText, Loader2, X, Camera } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { useTechnicalSheets, TechnicalSheetWithIngredients } from '@/hooks/useTechnicalSheets';
import { useStockItems, type StockUnit, type StockCategory } from '@/hooks/useStockItems';
import { VoiceImportDialog, type ExtractedItem } from '@/components/VoiceImportDialog';
import { RecipeFileImportDialog } from '@/components/RecipeFileImportDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { ExtractedIngredient, RecipeData } from '@/hooks/useIngredientImport';

interface IngredienteForm {
  id: string;
  stockItemId: string;
  nome: string;
  quantidade: string;
  unidade: string;
}

const calcularCustoTotal = (sheet: TechnicalSheetWithIngredients) => {
  if (sheet.total_cost) return sheet.total_cost;
  return sheet.ingredients?.reduce((total, ing) => total + (ing.total_cost || 0), 0) || 0;
};

const calcularCustoPorcao = (sheet: TechnicalSheetWithIngredients) => {
  if (sheet.cost_per_unit) return sheet.cost_per_unit;
  const custoTotal = calcularCustoTotal(sheet);
  return sheet.yield_quantity > 0 ? custoTotal / sheet.yield_quantity : 0;
};

export default function Fichas() {
  const { sheets, isLoading, isOwnerLoading, createSheet, updateSheet, deleteSheet, addIngredient, removeIngredient } = useTechnicalSheets();
  const { items: stockItems, isOwnerLoading: stockOwnerLoading, createItem: createStockItem } = useStockItems();
  
  const [search, setSearch] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<TechnicalSheetWithIngredients | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [fileImportDialogOpen, setFileImportDialogOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<TechnicalSheetWithIngredients | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tempoPreparo: '',
    rendimento: '',
    unidadeRendimento: 'un',
    modoPreparo: '',
    image_url: '',
    productionType: 'final' as 'insumo' | 'final',
  });

  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>([]);
  const [novoIngrediente, setNovoIngrediente] = useState({
    stockItemId: '',
    quantidade: '',
    unidade: 'kg',
  });

  const filteredSheets = sheets.filter(sheet =>
    sheet.name.toLowerCase().includes(search.toLowerCase()) ||
    (sheet.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      tempoPreparo: '',
      rendimento: '',
      unidadeRendimento: 'un',
      modoPreparo: '',
      image_url: '',
      productionType: 'final',
    });
    setIngredientes([]);
    setNovoIngrediente({ stockItemId: '', quantidade: '', unidade: 'kg' });
    setEditingSheet(null);
  };

  const handleAddIngrediente = () => {
    if (!novoIngrediente.stockItemId || !novoIngrediente.quantidade) {
      toast.error('Selecione o ingrediente e informe a quantidade');
      return;
    }

    const stockItem = stockItems.find(item => item.id === novoIngrediente.stockItemId);
    if (!stockItem) return;

    if (ingredientes.some(i => i.stockItemId === novoIngrediente.stockItemId)) {
      toast.error('Este ingrediente já foi adicionado');
      return;
    }

    setIngredientes([
      ...ingredientes,
      {
        id: crypto.randomUUID(),
        stockItemId: novoIngrediente.stockItemId,
        nome: stockItem.name,
        quantidade: novoIngrediente.quantidade,
        unidade: novoIngrediente.unidade,
      }
    ]);
    setNovoIngrediente({ stockItemId: '', quantidade: '', unidade: 'kg' });
  };

  const handleRemoveIngrediente = (id: string) => {
    setIngredientes(ingredientes.filter(i => i.id !== id));
  };

  // Voice Import
  const handleVoiceImport = async (items: ExtractedItem[]) => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    setIsSaving(true);
    
    try {
      const ingredientStockIds: Map<string, string> = new Map();
      
      for (const ing of items) {
        const existing = stockItems.find(
          item => item.name.toLowerCase() === ing.name.toLowerCase()
        );
        
        if (existing) {
          ingredientStockIds.set(ing.name, existing.id);
        } else {
          const newItem = await new Promise<any>((resolve, reject) => {
            createStockItem.mutate(
              {
                name: ing.name,
                current_quantity: 0,
                unit: ing.unit as StockUnit,
                category: ing.category as StockCategory,
                minimum_quantity: 0,
              },
              {
                onSuccess: (data) => resolve(data),
                onError: (err) => reject(err),
              }
            );
          });
          ingredientStockIds.set(ing.name, newItem.id);
        }
      }

      const newSheet = await new Promise<any>((resolve, reject) => {
        createSheet.mutate(
          {
            name: 'Receita por Voz',
            description: '',
            yield_quantity: 1,
            yield_unit: 'un',
          },
          {
            onSuccess: (data) => resolve(data),
            onError: (err) => reject(err),
          }
        );
      });

      for (const ing of items) {
        const stockItemId = ingredientStockIds.get(ing.name);
        if (stockItemId) {
          await addIngredient.mutateAsync({
            technical_sheet_id: newSheet.id,
            stock_item_id: stockItemId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      toast.success(`Ficha técnica criada com ${items.length} ingredientes!`);
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('Erro ao criar ficha técnica');
    } finally {
      setIsSaving(false);
    }
  };

  // File Import
  const handleFileImport = async (recipeInfo: RecipeData, items: ExtractedIngredient[]) => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    setIsSaving(true);
    
    try {
      const ingredientStockIds: Map<string, string> = new Map();
      
      for (const ing of items) {
        const existing = stockItems.find(
          item => item.name.toLowerCase() === ing.name.toLowerCase()
        );
        
        if (existing) {
          ingredientStockIds.set(ing.name, existing.id);
        } else {
          const newItem = await new Promise<any>((resolve, reject) => {
            createStockItem.mutate(
              {
                name: ing.name,
                current_quantity: 0,
                unit: ing.unit as StockUnit,
                category: ing.category as StockCategory,
                minimum_quantity: 0,
              },
              {
                onSuccess: (data) => resolve(data),
                onError: (err) => reject(err),
              }
            );
          });
          ingredientStockIds.set(ing.name, newItem.id);
        }
      }

      const newSheet = await new Promise<any>((resolve, reject) => {
        createSheet.mutate(
          {
            name: recipeInfo.recipeName || 'Receita Importada',
            description: '',
            preparation_method: recipeInfo.preparationMethod || null,
            preparation_time: recipeInfo.preparationTime || null,
            yield_quantity: recipeInfo.yieldQuantity || 1,
            yield_unit: 'un',
          },
          {
            onSuccess: (data) => resolve(data),
            onError: (err) => reject(err),
          }
        );
      });

      for (const ing of items) {
        const stockItemId = ingredientStockIds.get(ing.name);
        if (stockItemId) {
          await addIngredient.mutateAsync({
            technical_sheet_id: newSheet.id,
            stock_item_id: stockItemId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      toast.success(`Receita "${recipeInfo.recipeName}" criada com ${items.length} ingredientes!`);
    } catch (error) {
      console.error('Error creating recipe from file:', error);
      toast.error('Erro ao criar receita');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFicha = (sheet: TechnicalSheetWithIngredients) => {
    setSelectedSheet(sheet);
    setDetailDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setFormDialogOpen(true);
  };

  const openEditDialog = (sheet: TechnicalSheetWithIngredients) => {
    setEditingSheet(sheet);
    setFormData({
      nome: sheet.name,
      descricao: sheet.description || '',
      tempoPreparo: sheet.preparation_time?.toString() || '',
      rendimento: sheet.yield_quantity?.toString() || '',
      unidadeRendimento: sheet.yield_unit || 'un',
      modoPreparo: sheet.preparation_method || '',
      image_url: sheet.image_url || '',
      productionType: sheet.production_type || 'final',
    });
    const existingIngredients: IngredienteForm[] = (sheet.ingredients || []).map(ing => ({
      id: ing.id,
      stockItemId: ing.stock_item_id,
      nome: ing.stock_item?.name || 'Ingrediente',
      quantidade: ing.quantity.toString(),
      unidade: ing.unit,
    }));
    setIngredientes(existingIngredients);
    setDetailDialogOpen(false);
    setFormDialogOpen(true);
  };

  const handleDeleteSheet = (sheet: TechnicalSheetWithIngredients) => {
    if (confirm(`Deseja excluir a ficha técnica "${sheet.name}"?`)) {
      deleteSheet.mutate(sheet.id);
      setDetailDialogOpen(false);
    }
  };

  const handleSave = async () => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    if (!formData.nome) {
      toast.error('Preencha o nome da receita');
      return;
    }

    setIsSaving(true);
    try {
      let sheetId: string;
      
      if (editingSheet) {
        await updateSheet.mutateAsync({
          id: editingSheet.id,
          name: formData.nome,
          description: formData.descricao || null,
          preparation_method: formData.modoPreparo || null,
          preparation_time: formData.tempoPreparo ? parseInt(formData.tempoPreparo) : null,
          yield_quantity: formData.rendimento ? parseFloat(formData.rendimento) : 1,
          yield_unit: formData.unidadeRendimento,
          image_url: formData.image_url || null,
        });
        sheetId = editingSheet.id;

        const existingIds = new Set(ingredientes.map(i => i.id));
        const toRemove = (editingSheet.ingredients || []).filter(ing => !existingIds.has(ing.id));
        for (const ing of toRemove) {
          await removeIngredient.mutateAsync(ing.id);
        }

        const newIngredients = ingredientes.filter(i => 
          !editingSheet.ingredients?.some(existing => existing.id === i.id)
        );
        for (const ing of newIngredients) {
          await addIngredient.mutateAsync({
            technical_sheet_id: sheetId,
            stock_item_id: ing.stockItemId,
            quantity: parseFloat(ing.quantidade),
            unit: ing.unidade,
          });
        }
      } else {
        const newSheet = await createSheet.mutateAsync({
          name: formData.nome,
          description: formData.descricao || null,
          preparation_method: formData.modoPreparo || null,
          preparation_time: formData.tempoPreparo ? parseInt(formData.tempoPreparo) : null,
          yield_quantity: formData.rendimento ? parseFloat(formData.rendimento) : 1,
          yield_unit: formData.unidadeRendimento,
          image_url: formData.image_url || null,
        });
        sheetId = newSheet.id;

        for (const ing of ingredientes) {
          await addIngredient.mutateAsync({
            technical_sheet_id: sheetId,
            stock_item_id: ing.stockItemId,
            quantity: parseFloat(ing.quantidade),
            unit: ing.unidade,
          });
        }
      }
      
      setFormDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving recipe:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <PageHeader
          title="Fichas Técnicas"
          description="Cadastre e visualize o custo detalhado de cada receita"
        />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Fichas Técnicas"
        description="Cadastre e visualize o custo detalhado de cada receita"
      />

      <Tabs defaultValue="fichas" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="fichas">Fichas</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        {/* Fichas Tab - List */}
        <TabsContent value="fichas">
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fichas técnicas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Empty State */}
          {filteredSheets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma ficha técnica cadastrada ainda.</p>
              <p className="text-sm mt-1">Use a aba "Cadastro" para adicionar suas receitas.</p>
            </div>
          )}

          {/* List */}
          {filteredSheets.length > 0 && (
            <MobileList>
              {filteredSheets.map((sheet) => {
                const custoTotal = calcularCustoTotal(sheet);
                const custoPorcao = calcularCustoPorcao(sheet);
                
                return (
                  <MobileListItem
                    key={sheet.id}
                    onClick={() => handleSelectFicha(sheet)}
                  >
                    <div className="flex items-center gap-2">
                      <MobileListTitle>{sheet.name}</MobileListTitle>
                      <span className="ml-auto text-sm font-bold text-primary">
                        R$ {custoTotal.toFixed(2)}
                      </span>
                    </div>
                    
                    <MobileListDetails>
                      <span className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        R$ {custoPorcao.toFixed(2)}/{sheet.yield_unit}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {sheet.yield_quantity} {sheet.yield_unit}
                      </span>
                      {sheet.preparation_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {sheet.preparation_time} min
                        </span>
                      )}
                      <span>{sheet.ingredients?.length || 0} ingredientes</span>
                    </MobileListDetails>
                  </MobileListItem>
                );
              })}
            </MobileList>
          )}
        </TabsContent>

        {/* Cadastro Tab */}
        <TabsContent value="cadastro">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => setVoiceDialogOpen(true)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-base">Falar Ingredientes</CardTitle>
                <CardDescription className="text-xs">
                  Dite a receita e a IA cadastra
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => setFileImportDialogOpen(true)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-2 group-hover:bg-accent/80 transition-colors">
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-base">Importar Arquivo</CardTitle>
                <CardDescription className="text-xs">
                  Foto, PDF ou texto
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={openNewDialog}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-2 group-hover:bg-secondary transition-colors">
                  <Plus className="h-6 w-6 text-foreground" />
                </div>
                <CardTitle className="text-base">Cadastro Manual</CardTitle>
                <CardDescription className="text-xs">
                  Adicionar ficha técnica
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Voice Import Dialog */}
      <VoiceImportDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onImport={handleVoiceImport}
        title="Falar Ingredientes da Receita"
        description="Fale os ingredientes da receita. Ex: 'Farinha de trigo 500 gramas, açúcar 200 gramas, ovos 3 unidades'"
        mode="recipe"
      />

      {/* File Import Dialog */}
      <RecipeFileImportDialog
        open={fileImportDialogOpen}
        onOpenChange={setFileImportDialogOpen}
        onImport={handleFileImport}
      />

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedSheet?.name}</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => selectedSheet && handleDeleteSheet(selectedSheet)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1"
                  onClick={() => selectedSheet && openEditDialog(selectedSheet)}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedSheet && (
              <div className="space-y-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {selectedSheet.description && (
                    <p className="text-sm text-muted-foreground w-full mb-2">{selectedSheet.description}</p>
                  )}
                  {selectedSheet.preparation_time && (
                    <MobileListBadge>
                      <Clock className="h-3 w-3 mr-1" />
                      {selectedSheet.preparation_time} min
                    </MobileListBadge>
                  )}
                  <MobileListBadge>
                    <Users className="h-3 w-3 mr-1" />
                    {selectedSheet.yield_quantity} {selectedSheet.yield_unit}
                  </MobileListBadge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Custo Total</span>
                      </div>
                      <p className="text-xl font-bold text-primary">
                        R$ {calcularCustoTotal(selectedSheet).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calculator className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-muted-foreground">Custo/{selectedSheet.yield_unit}</span>
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        R$ {calcularCustoPorcao(selectedSheet).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {selectedSheet.ingredients && selectedSheet.ingredients.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Ingredientes</h4>
                    <div className="border rounded-lg divide-y">
                      {selectedSheet.ingredients.map((ing) => (
                        <div key={ing.id} className="flex justify-between items-center p-3">
                          <span className="font-medium text-sm">{ing.stock_item?.name || 'Item removido'}</span>
                          <div className="text-right flex items-baseline gap-3">
                            <span className="text-base font-bold">
                              {ing.quantity} {ing.unit}
                            </span>
                            {ing.total_cost && ing.total_cost > 0 && (
                              <span className="text-xs text-muted-foreground">
                                R$ {ing.total_cost.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-3 text-sm bg-muted/50 font-medium">
                        <span>Total da Receita</span>
                        <span className="text-primary font-bold">
                          R$ {calcularCustoTotal(selectedSheet).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {(!selectedSheet.ingredients || selectedSheet.ingredients.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg">
                    <p className="text-sm">Nenhum ingrediente cadastrado.</p>
                  </div>
                )}

                {selectedSheet.preparation_method && (
                  <div>
                    <h4 className="font-medium mb-2">Modo de Preparo</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedSheet.preparation_method}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingSheet ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}</DialogTitle>
            <DialogDescription>
              {editingSheet ? 'Atualize os dados da receita' : 'Preencha os dados da receita'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Image Upload */}
              <div className="flex items-start gap-4">
                <ImageUpload
                  currentImageUrl={formData.image_url || null}
                  onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                  onImageRemoved={() => setFormData({ ...formData, image_url: '' })}
                  bucket="technical-sheet-images"
                  size="lg"
                />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="nome">Nome da Receita *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Bolo de Chocolate"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Breve descrição da receita"
                />
              </div>

              {/* Tipo de Produção */}
              <div className="space-y-2">
                <Label>Tipo de Produção</Label>
                <Select
                  value={formData.productionType}
                  onValueChange={(value: 'insumo' | 'final') => setFormData({ ...formData, productionType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final">Produto Final</SelectItem>
                    <SelectItem value="insumo">Insumo Produzido</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.productionType === 'insumo' 
                    ? 'Insumo: Gera estoque intermediário (ex: Poolish, Molhos base)' 
                    : 'Final: Vai para o estoque de produções finalizadas'}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tempo">Tempo (min)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    value={formData.tempoPreparo}
                    onChange={(e) => setFormData({ ...formData, tempoPreparo: e.target.value })}
                    placeholder="60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rendimento">Rendimento</Label>
                  <Input
                    id="rendimento"
                    type="number"
                    value={formData.rendimento}
                    onChange={(e) => setFormData({ ...formData, rendimento: e.target.value })}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidadeRendimento">Unidade</Label>
                  <Select
                    value={formData.unidadeRendimento}
                    onValueChange={(value) => setFormData({ ...formData, unidadeRendimento: value })}
                  >
                    <SelectTrigger id="unidadeRendimento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">unidades</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="porções">porções</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ingredientes */}
              <div className="space-y-3">
                <Label>Ingredientes</Label>
                
                {ingredientes.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {ingredientes.map((ing) => (
                      <div key={ing.id} className="flex items-center justify-between p-2 text-sm">
                        <span className="font-medium">{ing.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {ing.quantidade} {ing.unidade}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveIngrediente(ing.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Select
                      value={novoIngrediente.stockItemId}
                      onValueChange={(value) => setNovoIngrediente({ ...novoIngrediente, stockItemId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ingrediente" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockItems.length === 0 ? (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            Cadastre ingredientes no Estoque Central
                          </div>
                        ) : (
                          stockItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Qtd"
                      value={novoIngrediente.quantidade}
                      onChange={(e) => setNovoIngrediente({ ...novoIngrediente, quantidade: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={novoIngrediente.unidade}
                      onValueChange={(value) => setNovoIngrediente({ ...novoIngrediente, unidade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="unidade">un</SelectItem>
                        <SelectItem value="dz">dz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={handleAddIngrediente}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {stockItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Os ingredientes vêm do Estoque Central. Cadastre itens lá primeiro.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preparo">Modo de Preparo</Label>
                <Textarea
                  id="preparo"
                  value={formData.modoPreparo}
                  onChange={(e) => setFormData({ ...formData, modoPreparo: e.target.value })}
                  placeholder="Descreva o passo a passo..."
                  rows={6}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={isSaving || isOwnerLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isOwnerLoading || stockOwnerLoading}>
              {isSaving || isOwnerLoading || stockOwnerLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isOwnerLoading || stockOwnerLoading ? 'Carregando...' : 'Salvando...'}
                </>
              ) : (
                'Salvar Ficha Técnica'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}