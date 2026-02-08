import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface Ingrediente {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  preco: number;
  fornecedor: string;
}

interface IngredientSearchProps {
  ingredientes: Ingrediente[];
  onSelect: (ingrediente: Ingrediente) => void;
  placeholder?: string;
}

export function IngredientSearch({ ingredientes, onSelect, placeholder = "Digite 3 letras para buscar..." }: IngredientSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter ingredients - requires at least 3 characters
  const filteredIngredientes = search.length >= 3
    ? ingredientes.filter(ing =>
        ing.nome.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const showDropdown = search.length >= 3 && filteredIngredientes.length > 0;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredIngredientes]);

  const handleSelect = (ingrediente: Ingrediente) => {
    onSelect(ingrediente);
    setSearch('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredIngredientes.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredIngredientes[highlightedIndex]) {
          handleSelect(filteredIngredientes[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      {isOpen && showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto"
        >
          {filteredIngredientes.map((ing, index) => (
            <div
              key={ing.id}
              onClick={() => handleSelect(ing)}
              className={cn(
                "flex items-center justify-between px-3 py-2 cursor-pointer text-sm",
                index === highlightedIndex ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div>
                <span className="font-medium">{ing.nome}</span>
                <span className="text-muted-foreground ml-2">({ing.unidade})</span>
              </div>
              <span className="text-muted-foreground">
                R$ {ing.preco.toFixed(2)}/{ing.unidade}
              </span>
            </div>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && search.length < 3 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
          Digite pelo menos 3 letras para buscar...
        </div>
      )}

      {isOpen && search.length >= 3 && filteredIngredientes.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
          Nenhum ingrediente encontrado
        </div>
      )}
    </div>
  );
}
