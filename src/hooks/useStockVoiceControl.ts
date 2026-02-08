import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';

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
  quantity: number;
}

interface UseStockVoiceControlProps {
  stockItems: StockItem[];
  onQuantityUpdate: (itemId: string, quantity: number) => void;
}

export function useStockVoiceControl({ stockItems, onQuantityUpdate }: UseStockVoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<PendingVoiceUpdate | null>(null);
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

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        // If we have an active item, just parse quantity and unit
        if (activeItemId) {
          const item = stockItems.find(i => i.id === activeItemId);
          const quantity = parseQuantity(finalTranscript);
          const unit = parseUnit(finalTranscript);
          if (quantity !== null && item) {
            // Auto-apply update without confirmation
            onQuantityUpdate(activeItemId, quantity);
            const displayUnit = unit || item.unit;
            toast.success(`${item.name}: ${quantity} ${displayUnit}`);
          } else {
            toast.error('Não entendi a quantidade. Tente novamente.');
          }
        } else {
          // Try to find item, quantity, and unit from full text
          const item = findItemByVoice(finalTranscript);
          const quantity = parseQuantity(finalTranscript);
          const unit = parseUnit(finalTranscript);

          if (item && quantity !== null) {
            // Auto-apply update without confirmation
            onQuantityUpdate(item.id, quantity);
            const displayUnit = unit || item.unit;
            toast.success(`${item.name}: ${quantity} ${displayUnit}`);
          } else if (item) {
            // Found item but no quantity - activate for that item
            setActiveItemId(item.id);
            toast.info(`${item.name} selecionado. Diga a quantidade e unidade.`);
          } else {
            toast.error('Não entendi. Diga o nome do ingrediente, quantidade e unidade.');
          }
        }
        // Stop listening after processing
        setIsListening(false);
        setActiveItemId(null);
        setTranscript('');
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada. Verifique as configurações do navegador.');
      } else if (event.error === 'no-speech') {
        toast.error('Nenhuma fala detectada. Tente novamente.');
      } else if (event.error === 'audio-capture') {
        toast.error('Microfone não encontrado.');
      } else {
        toast.error('Erro no reconhecimento de voz.');
      }
      setIsListening(false);
      setActiveItemId(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [activeItemId, parseQuantity, findItemByVoice, stockItems]);

  const startListening = useCallback((itemId?: string) => {
    if (!recognitionRef.current) {
      toast.error('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    // Stop any existing recognition first
    try {
      recognitionRef.current.abort();
    } catch (e) {
      // Ignore errors from aborting
    }

    setTranscript('');
    setActiveItemId(itemId || null);
    
    try {
      recognitionRef.current.start();
      setIsListening(true);

      if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item) {
          toast.info(`Ouvindo quantidade para ${item.name}...`);
        }
      } else {
        toast.info('Ouvindo... Diga o ingrediente e quantidade.');
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast.error('Erro ao iniciar reconhecimento de voz.');
      setIsListening(false);
    }
  }, [stockItems]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors from stopping
      }
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

  const confirmPendingUpdate = useCallback(() => {
    if (pendingUpdate) {
      onQuantityUpdate(pendingUpdate.itemId, pendingUpdate.quantity);
      toast.success(`${pendingUpdate.itemName}: quantidade atualizada para ${pendingUpdate.quantity}`);
      setPendingUpdate(null);
    }
  }, [pendingUpdate, onQuantityUpdate]);

  const cancelPendingUpdate = useCallback(() => {
    setPendingUpdate(null);
  }, []);

  return {
    isSupported,
    isListening,
    activeItemId,
    transcript,
    pendingUpdate,
    startListening,
    stopListening,
    toggleListening,
    confirmPendingUpdate,
    cancelPendingUpdate,
  };
}
