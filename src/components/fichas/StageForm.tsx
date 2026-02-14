import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface StageIngredient {
  id: string;
  stockItemId: string;
  nome: string;
  quantidade: string;
  unidade: string;
}

export interface StageFormData {
  id: string;
  name: string;
  preparationMethod: string;
  ingredients: StageIngredient[];
  order_index: number;
}

interface StageFormProps {
  stages: StageFormData[];
  onStagesChange: (stages: StageFormData[]) => void;
  stockItems: Array<{ id: string; name: string; unit: string }>;
}

export function StageForm({ stages, onStagesChange, stockItems }: StageFormProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));
  const [newStageName, setNewStageName] = useState('');

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const addStage = () => {
    const name = newStageName.trim() || `Parte ${stages.length + 1}`;
    const newStage: StageFormData = {
      id: crypto.randomUUID(),
      name,
      preparationMethod: '',
      ingredients: [],
      order_index: stages.length,
    };
    onStagesChange([...stages, newStage]);
    setExpandedStages(prev => new Set([...prev, newStage.id]));
    setNewStageName('');
  };

  const removeStage = (stageId: string) => {
    onStagesChange(stages.filter(s => s.id !== stageId).map((s, idx) => ({ ...s, order_index: idx })));
  };

  const updateStage = (stageId: string, updates: Partial<StageFormData>) => {
    onStagesChange(stages.map(s => s.id === stageId ? { ...s, ...updates } : s));
  };

  const addIngredientToStage = (stageId: string, stockItemId: string, quantidade: string, unidade: string) => {
    const stockItem = stockItems.find(item => item.id === stockItemId);
    if (!stockItem) return;

    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;

    if (stage.ingredients.some(i => i.stockItemId === stockItemId)) {
      return; // Already exists
    }

    const newIngredient: StageIngredient = {
      id: crypto.randomUUID(),
      stockItemId,
      nome: stockItem.name,
      quantidade,
      unidade,
    };

    updateStage(stageId, {
      ingredients: [...stage.ingredients, newIngredient],
    });
  };

  const removeIngredientFromStage = (stageId: string, ingredientId: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    updateStage(stageId, {
      ingredients: stage.ingredients.filter(i => i.id !== ingredientId),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Partes da Receita</Label>
        <span className="text-xs text-muted-foreground">
          {stages.length} {stages.length === 1 ? 'parte' : 'partes'}
        </span>
      </div>

      {/* Existing Stages */}
      {stages.length > 0 && (
        <div className="space-y-3">
          {stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              stage={stage}
              index={index}
              isExpanded={expandedStages.has(stage.id)}
              onToggle={() => toggleStage(stage.id)}
              onUpdate={(updates) => updateStage(stage.id, updates)}
              onRemove={() => removeStage(stage.id)}
              onAddIngredient={(stockItemId, quantidade, unidade) => 
                addIngredientToStage(stage.id, stockItemId, quantidade, unidade)
              }
              onRemoveIngredient={(ingredientId) => removeIngredientFromStage(stage.id, ingredientId)}
              stockItems={stockItems}
            />
          ))}
        </div>
      )}

      {/* Add New Stage */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome da parte (ex: Massa, Recheio, Cobertura...)"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addStage();
            }
          }}
        />
        <Button type="button" onClick={addStage} variant="secondary">
          <Plus className="h-4 w-4 mr-2" />
          Parte
        </Button>
      </div>

      {stages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-muted/30">
          Adicione partes para organizar ingredientes e modo de preparo.
          <br />
          Ex: Massa → Recheio → Cobertura
        </p>
      )}
    </div>
  );
}

interface StageCardProps {
  stage: StageFormData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<StageFormData>) => void;
  onRemove: () => void;
  onAddIngredient: (stockItemId: string, quantidade: string, unidade: string) => void;
  onRemoveIngredient: (ingredientId: string) => void;
  stockItems: Array<{ id: string; name: string; unit: string }>;
}

function StageCard({
  stage,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  onAddIngredient,
  onRemoveIngredient,
  stockItems,
}: StageCardProps) {
  const [newIngredient, setNewIngredient] = useState({
    stockItemId: '',
    quantidade: '',
    unidade: 'kg',
  });

  const handleAddIngredient = () => {
    if (!newIngredient.stockItemId || !newIngredient.quantidade) return;
    onAddIngredient(newIngredient.stockItemId, newIngredient.quantidade, newIngredient.unidade);
    setNewIngredient({ stockItemId: '', quantidade: '', unidade: 'kg' });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className="border-l-4 border-l-primary/50">
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-sm flex-1">
                {index + 1}ª Parte: {stage.name}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {stage.ingredients.length} ingredientes
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Stage Name Edit */}
            <div className="space-y-2">
              <Label className="text-xs">Nome da Parte</Label>
              <Input
                value={stage.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Ex: Massa, Recheio..."
              />
            </div>

            {/* Ingredients */}
            <div className="space-y-2">
              <Label className="text-xs">Ingredientes</Label>
              
              {stage.ingredients.length > 0 && (
                <div className="border rounded-lg divide-y bg-background">
                  {stage.ingredients.map((ing) => (
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
                          onClick={() => onRemoveIngredient(ing.id)}
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
                    value={newIngredient.stockItemId}
                    onValueChange={(value) => setNewIngredient({ ...newIngredient, stockItemId: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Ingrediente" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          Cadastre ingredientes no Estoque
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
                    className="h-9"
                    value={newIngredient.quantidade}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantidade: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={newIngredient.unidade}
                    onValueChange={(value) => setNewIngredient({ ...newIngredient, unidade: value })}
                  >
                    <SelectTrigger className="h-9">
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
                    className="w-full h-9"
                    onClick={handleAddIngredient}
                    disabled={!newIngredient.stockItemId || !newIngredient.quantidade}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Preparation Method */}
            <div className="space-y-2">
              <Label className="text-xs">Modo de Preparo</Label>
              <Textarea
                value={stage.preparationMethod}
                onChange={(e) => onUpdate({ preparationMethod: e.target.value })}
                placeholder="Descreva o passo a passo desta parte..."
                rows={4}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
