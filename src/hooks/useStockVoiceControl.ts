import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';
import { addDays, format, isValid } from 'date-fns';
import { getNow } from '@/lib/utils';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface PendingVoiceUpdate {
  itemId: string;
  itemName: string;
  quantity?: number;
  expirationDate?: string;
}

interface UseStockVoiceControlProps {
  stockItems: StockItem[];
  onQuantityUpdate: (itemId: string, quantity: number) => void;
  onExpiryUpdate?: (itemId: string, expirationDate: string) => void;
}

export function useStockVoiceControl({ stockItems, onQuantityUpdate, onExpiryUpdate }: UseStockVoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Parse quantity from voice input
  const parseQuantity = useCallback((text: string): number | null => {
    // Clean the text
    const cleanText = text.toLowerCase().trim();

    // Try to find numbers (including decimals with comma or dot)
    const numberMatch = cleanText.match(/(\d+[,.]?\d*)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1].replace(',', '.'));
    }

    // Word to number mapping (Portuguese)
    const wordToNumber: Record<string, number> = {
      'zero': 0, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9,
      'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14, 'catorze': 14,
      'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
      'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50,
      'sessenta': 60, 'setenta': 70, 'oitenta': 80, 'noventa': 90,
      'cem': 100, 'cento': 100, 'duzentos': 200, 'trezentos': 300,
      'meio': 0.5, 'meia': 0.5,
    };

    // Check for word numbers
    for (const [word, num] of Object.entries(wordToNumber)) {
      if (cleanText.includes(word)) {
        return num;
      }
    }

    return null;
  }, []);

  // Parse date from voice input
  const parseDate = useCallback((text: string): Date | null => {
    const cleanText = text.toLowerCase().trim();
    const now = getNow();

    // Handles keywords
    if (cleanText.includes('amanhã') || cleanText.includes('amanha')) return addDays(now, 1);
    if (cleanText.includes('hoje')) return now;
    if (cleanText.includes('ontem')) return addDays(now, -1);

    // Month mapping
    const months: Record<string, number> = {
      'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3, 'maio': 4,
      'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
    };

    // Try format: [dia] de [mês]
    const dateMatch = cleanText.match(/(\d+)\s+de\s+([a-zç]+)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const monthName = dateMatch[2];
      const month = months[monthName];

      if (month !== undefined && day >= 1 && day <= 31) {
        let year = now.getFullYear();
        let targetDate = new Date(year, month, day);

        // If date already passed this year, assume next year
        if (targetDate < now) {
          targetDate.setFullYear(year + 1);
        }
        return targetDate;
      }
    }

    // Try format: dd/mm/aaaa or dd/mm
    const slashMatch = cleanText.match(/(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?/);
    if (slashMatch) {
      const day = parseInt(slashMatch[1]);
      const month = parseInt(slashMatch[2]) - 1;
      let year = slashMatch[4] ? parseInt(slashMatch[4]) : now.getFullYear();
      if (slashMatch[4] && slashMatch[4].length === 2) year += 2000;

      const targetDate = new Date(year, month, day);
      if (isValid(targetDate)) return targetDate;
    }

    return null;
  }, []);

  // Parse unit from voice input
  const parseUnit = useCallback((text: string): string | null => {
    const cleanText = text.toLowerCase().trim();

    // Unit mapping (Portuguese words to stock_unit values)
    const unitMappings: Record<string, string> = {
      'quilo': 'kg', 'quilos': 'kg', 'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg',
      'grama': 'g', 'gramas': 'g', 'g': 'g',
      'litro': 'L', 'litros': 'L', 'l': 'L',
      'mililitro': 'ml', 'mililitros': 'ml', 'ml': 'ml',
      'unidade': 'unidade', 'unidades': 'unidade', 'un': 'unidade',
      'caixa': 'caixa', 'caixas': 'caixa',
      'dúzia': 'dz', 'duzia': 'dz', 'duzias': 'dz', 'dz': 'dz',
    };

    for (const [word, unit] of Object.entries(unitMappings)) {
      if (cleanText.includes(word)) {
        return unit;
      }
    }

    return null;
  }, []);

  // Find item by name in voice input
  const findItemByVoice = useCallback((text: string): StockItem | null => {
    const cleanText = text.toLowerCase().trim();

    // Try exact match first
    const exactMatch = stockItems.find(item =>
      cleanText.includes(item.name.toLowerCase())
    );
    if (exactMatch) return exactMatch;

    // Try partial match
    for (const item of stockItems) {
      const itemWords = item.name.toLowerCase().split(' ');
      for (const word of itemWords) {
        if (word.length > 2 && cleanText.includes(word)) {
          return item;
        }
      }
    }

    return null;
  }, [stockItems]);

  // Initialize speech recognition once
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported]);

  // Setup event handlers separately to avoid recreating recognition
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += resultTranscript;
        } else {
          interimTranscript += resultTranscript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        const cleanFinal = finalTranscript.toLowerCase().trim();

        // If we have an active item, parse quantity/unit OR date
        if (activeItemId) {
          const item = stockItems.find(i => i.id === activeItemId);
          if (!item) return;

          // Check if it's a date update (keywords: validade, vencimento, vence, dia)
          if (cleanFinal.includes('validade') || cleanFinal.includes('vencimento') || cleanFinal.includes('vence') || cleanFinal.includes('dia')) {
            const date = parseDate(cleanFinal);
            if (date && onExpiryUpdate) {
              const formattedDate = format(date, 'yyyy-MM-dd');
              onExpiryUpdate(activeItemId, formattedDate);
              toast.success(`${item.name}: validade atualizada para ${format(date, 'dd/MM/yyyy')}`);
            } else {
              toast.error('Não entendi a data de validade.');
            }
          } else {
            // Assume quantity update
            const quantity = parseQuantity(cleanFinal);
            const unit = parseUnit(cleanFinal);
            if (quantity !== null) {
              onQuantityUpdate(activeItemId, quantity);
              const displayUnit = unit || item.unit;
              toast.success(`${item.name}: ${quantity} ${displayUnit}`);
            } else {
              toast.error('Não entendi a quantidade.');
            }
          }
        } else {
          // Try to find item and then action
          const item = findItemByVoice(cleanFinal);
          if (item) {
            // If keywords for date present
            if (cleanFinal.includes('validade') || cleanFinal.includes('vencimento') || cleanFinal.includes('vence')) {
              const date = parseDate(cleanFinal);
              if (date && onExpiryUpdate) {
                const formattedDate = format(date, 'yyyy-MM-dd');
                onExpiryUpdate(item.id, formattedDate);
                toast.success(`${item.name}: validade atualizada para ${format(date, 'dd/MM/yyyy')}`);
              } else {
                setActiveItemId(item.id);
                toast.info(`${item.name} selecionado. Diga a data de validade.`);
              }
            } else {
              // Assume quantity
              const quantity = parseQuantity(cleanFinal);
              const unit = parseUnit(cleanFinal);
              if (quantity !== null) {
                onQuantityUpdate(item.id, quantity);
                const displayUnit = unit || item.unit;
                toast.success(`${item.name}: ${quantity} ${displayUnit}`);
              } else {
                setActiveItemId(item.id);
                toast.info(`${item.name} selecionado. Diga a quantidade.`);
              }
            }
          } else {
            toast.error('Não entendi. Diga o nome do ingrediente e a quantidade ou validade.');
          }
        }
        setIsListening(false);
        setActiveItemId(null);
        setTranscript('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setActiveItemId(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [activeItemId, parseQuantity, parseDate, parseUnit, findItemByVoice, stockItems, onQuantityUpdate, onExpiryUpdate]);

  const startListening = useCallback((itemId?: string) => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
    } catch (e) { }

    setTranscript('');
    setActiveItemId(itemId || null);

    try {
      recognitionRef.current.start();
      setIsListening(true);
      if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        toast.info(item ? `Ouvindo para ${item.name}...` : 'Ouvindo...');
      } else {
        toast.info('Ouvindo... Diga ingrediente e quantidade/validade.');
      }
    } catch (error) {
      setIsListening(false);
    }
  }, [stockItems]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
    setIsListening(false);
    setActiveItemId(null);
    setTranscript('');
  }, []);

  const toggleListening = useCallback((itemId?: string) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(itemId);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    isListening,
    activeItemId,
    transcript,
    toggleListening,
    startListening,
    stopListening,
  };
}
