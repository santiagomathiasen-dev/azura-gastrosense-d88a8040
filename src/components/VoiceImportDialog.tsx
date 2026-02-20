import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

export interface ExtractedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price?: number | null;
  supplier?: string | null;
  expiration_date?: string | null;
}

interface VoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ExtractedItem[], recipeName?: string, preparationMethod?: string) => Promise<void>;
  title?: string;
  description?: string;
  mode: 'ingredients' | 'recipe' | 'products';
}

type Step = 'listening' | 'processing' | 'done';

const SILENCE_TIMEOUT_MS = 6000; // Stop after 6 seconds of silence

export function VoiceImportDialog({
  open,
  onOpenChange,
  onImport,
  title = 'Importar por Voz',
  description = 'Fale os ingredientes e quantidades que deseja cadastrar.',
  mode,
}: VoiceImportDialogProps) {
  const [step, setStep] = useState<Step>('listening');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [extractedRecipeName, setExtractedRecipeName] = useState<string | undefined>();
  const [extractedPrepMethod, setExtractedPrepMethod] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const resetState = () => {
    setStep('listening');
    setIsListening(false);
    setTranscript('');
    setFinalTranscript('');
    setExtractedItems([]);
    setExtractedRecipeName(undefined);
    setExtractedPrepMethod(undefined);
    setIsSaving(false);
    clearSilenceTimeout();
    hasSpokenRef.current = false;
  };

  const handleClose = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
    }
    resetState();
    onOpenChange(false);
  };

  // Initialize speech recognition with silence detection
  useEffect(() => {
    if (!isSupported || !open) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(interim);
      if (final.trim()) {
        setFinalTranscript(prev => prev + final);
        hasSpokenRef.current = true;
      }

      // Reset silence timeout - user is speaking
      clearSilenceTimeout();
      silenceTimeoutRef.current = setTimeout(() => {
        // Auto-stop after silence and auto-process if user spoke
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore
          }
        }
        setIsListening(false);
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      clearSilenceTimeout();
      if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada.');
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // No speech detected - stop listening
        setIsListening(false);
      } else if (event.error !== 'aborted') {
        console.log('Recognition error:', event.error);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      clearSilenceTimeout();
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimeout();
      recognition.abort();
    };
  }, [isSupported, open, isListening, clearSilenceTimeout]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Reconhecimento de voz não suportado.');
      return;
    }

    setTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
      // Start initial silence timeout
      silenceTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current && isListening) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore
          }
          setIsListening(false);
          toast.info('Nenhuma fala detectada.');
        }
      }, SILENCE_TIMEOUT_MS * 2); // Give more time initially
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast.error('Erro ao iniciar o microfone.');
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    clearSilenceTimeout();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsListening(false);
  }, [clearSilenceTimeout]);

  // Auto-process when listening stops and we have speech
  useEffect(() => {
    if (!isListening && hasSpokenRef.current && (finalTranscript.trim() || transcript.trim())) {
      // Auto-process the voice input
      processVoiceInput();
      hasSpokenRef.current = false;
    }
  }, [isListening]);

  // Auto-start listening when dialog opens
  useEffect(() => {
    if (open && isSupported && step === 'listening') {
      // Small delay to allow the dialog to mount
      const timer = setTimeout(() => {
        startListening();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, isSupported, step, startListening]);

  const processVoiceInput = async () => {
    const textToProcess = (finalTranscript + ' ' + transcript).trim();
    if (!textToProcess) {
      toast.error('Nenhum texto capturado. Fale novamente.');
      return;
    }

    stopListening();
    setStep('processing');

    try {
      const now = new Date();
      const dateContext = `Data atual: ${now.toLocaleDateString('pt-BR')} (${now.toLocaleDateString('pt-BR', { weekday: 'long' })}).`;

      const systemPrompt = mode === 'ingredients'
        ? `${dateContext}
Você é um assistente que extrai ingredientes e suas validades de texto falado em português brasileiro.
Retorne SOMENTE um array JSON válido com os itens extraídos.
Cada item deve ter: name, quantity (número), unit (kg, g, l, ml, unidade, caixa, dz), category (laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros), e expiration_date (no formato YYYY-MM-DD ou null).

IMPORTANTE para validades:
- Se falarem "validade amanhã", calcule a data baseada na data atual fornecida.
- Se falarem "vencimento 10 de maio", use o ano corrente ou o próximo se já passou.
- Formatos aceitos para expiration_date no JSON: "YYYY-MM-DD".

IMPORTANTE para números decimais:
- Reconheça "vírgula" como separador decimal: "125 vírgula 033" = 125.033
- Aceite formato brasileiro: "125,033" = 125.033
- Exemplos: "dois vírgula cinco kg" = 2.5, "três vírgula dois litros" = 3.2

Se não conseguir determinar quantidade, use 1. Se não conseguir determinar unidade, use "unidade".
Exemplo: [{"name": "Farinha", "quantity": 5, "unit": "kg", "category": "secos_e_graos", "expiration_date": "2026-05-10"}]`
        : mode === 'recipe'
          ? `${dateContext}
Você é um assistente que extrai ingredientes de receitas de texto falado em português brasileiro.
Retorne SOMENTE um objeto JSON válido com a estrutura:
{
  "recipeName": "nome da receita extraído",
  "preparationMethod": "passo a passo detalhado",
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string}]
}`
          : `Você é um assistente que extrai produtos para venda de texto falado em português brasileiro.
Retorne SOMENTE um array JSON válido com os produtos extraídos.
Cada produto deve ter: name (nome do produto), price (número decimal para o preço de venda).

Exemplo: [{"name": "Kit Festa 1", "price": 150.00}, {"name": "Bolo Chocolate", "price": 85.50}]

IMPORTANTE:
- Extraia o preço corretamente mesmo se falarem "reais" ou símbolos.
- Se não houver preço, use null.`;

      const { data, error } = await supabase.functions.invoke('process-voice-text', {
        body: {
          text: textToProcess,
          systemPrompt,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const items: ExtractedItem[] = data.ingredients || [];
      const recipeName = data.recipeName || undefined;
      const preparationMethod = data.preparationMethod || undefined;

      if (items.length === 0) {
        toast.error('Não foi possível extrair ingredientes. Tente novamente.');
        setStep('listening');
        setFinalTranscript('');
        return;
      }

      setExtractedItems(items);
      setExtractedRecipeName(recipeName);
      setExtractedPrepMethod(preparationMethod);
      setStep('done');

      // Auto-import without confirmation
      await handleImport(items, recipeName, preparationMethod);
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error('Erro ao processar. Tente novamente.');
      setStep('listening');
    }
  };

  const handleImport = async (items: ExtractedItem[], recipeName?: string, preparationMethod?: string) => {
    setIsSaving(true);
    try {
      await onImport(items, recipeName, preparationMethod);
      toast.success(`${items.length} ingrediente(s) cadastrado(s)!`);
      handleClose();
    } catch (error) {
      toast.error('Erro ao salvar. Tente novamente.');
      setIsSaving(false);
    }
  };

  if (!isSupported) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Não Suportado</DialogTitle>
            <DialogDescription>
              Seu navegador não suporta reconhecimento de voz.
              Use Chrome, Edge ou Safari para esta funcionalidade.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'done' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {step === 'processing' && <Sparkles className="h-5 w-5 text-primary animate-pulse" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Listening Step */}
          {step === 'listening' && (
            <div className="flex flex-col items-center gap-4">
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'default'}
                size="lg"
                className="h-20 w-20 rounded-full"
                onClick={isListening ? stopListening : startListening}
              >
                {isListening ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>

              {isListening && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  🎙️ Ouvindo... Cadastra automaticamente ao parar de falar
                </p>
              )}

              {(transcript || finalTranscript) && (
                <div className="w-full max-h-48 overflow-y-auto bg-muted rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">
                    {finalTranscript}
                    <span className="text-muted-foreground">{transcript}</span>
                  </p>
                </div>
              )}

              {(finalTranscript || transcript) && !isListening && (
                <p className="text-sm text-muted-foreground text-center">
                  Processando automaticamente...
                </p>
              )}
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
              </div>
              <p className="text-center text-muted-foreground">
                Processando e cadastrando ingredientes...
              </p>
            </div>
          )}

          {/* Done Step */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              {isSaving ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Salvando...</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <p className="font-medium">{extractedItems.length} ingrediente(s) cadastrado(s)!</p>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
