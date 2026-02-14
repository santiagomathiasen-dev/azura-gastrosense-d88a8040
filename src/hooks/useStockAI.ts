import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';

export interface StockSuggestion {
  itemName: string;
  matchedItemId?: string;
  quantity: number;
  unit: string;
  action: 'entry' | 'exit' | 'adjustment';
  confidence: number;
}

export interface AIResponse {
  suggestions: StockSuggestion[];
  message: string;
}

export function useStockAI(stockItems: StockItem[]) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [aiMessage, setAiMessage] = useState<string>('');

  const processVoiceInput = async (text: string): Promise<AIResponse | null> => {
    setIsProcessing(true);
    setSuggestions([]);
    setAiMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('process-stock-input', {
        body: {
          type: 'voice',
          content: text,
          stockItems: stockItems.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            category: item.category,
          })),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSuggestions(data.suggestions || []);
      setAiMessage(data.message || '');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar entrada';
      toast.error(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageInput = async (imageBase64: string): Promise<AIResponse | null> => {
    setIsProcessing(true);
    setSuggestions([]);
    setAiMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('process-stock-input', {
        body: {
          type: 'image',
          content: imageBase64,
          stockItems: stockItems.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            category: item.category,
          })),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSuggestions(data.suggestions || []);
      setAiMessage(data.message || '');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar imagem';
      toast.error(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    setAiMessage('');
  };

  return {
    isProcessing,
    suggestions,
    aiMessage,
    processVoiceInput,
    processImageInput,
    clearSuggestions,
  };
}
