import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Extend Window interface for Speech Recognition
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

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

export function VoiceInput({ onTranscription, isProcessing, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef<string>('');

  // Clear silence timeout on cleanup
  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Finalize transcription after silence
  const finalizeTranscription = () => {
    clearSilenceTimeout();
    if (fullTranscriptRef.current.trim()) {
      onTranscription(fullTranscriptRef.current.trim());
    }
    stopListening();
  };

  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return;
    }

    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      // Accumulate final transcripts
      if (finalTranscript) {
        fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + finalTranscript;
      }

      // Show current state (accumulated + interim)
      const displayText = fullTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : '');
      setTranscript(displayText.trim());

      // Reset silence timeout - wait 2 seconds of silence before finalizing
      clearSilenceTimeout();
      silenceTimeoutRef.current = setTimeout(() => {
        finalizeTranscription();
      }, 2000); // 2 seconds of silence to finalize
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      clearSilenceTimeout();
      if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada. Habilite o microfone nas configurações do navegador.');
      } else if (event.error !== 'aborted') {
        toast.error('Erro no reconhecimento de voz. Tente novamente.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // If we still have content, finalize it
      if (fullTranscriptRef.current.trim()) {
        clearSilenceTimeout();
        onTranscription(fullTranscriptRef.current.trim());
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimeout();
      recognition.abort();
    };
  }, [onTranscription]);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    setTranscript('');
    fullTranscriptRef.current = '';
    clearSilenceTimeout();
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    clearSilenceTimeout();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant={isListening ? 'destructive' : 'secondary'}
        size="lg"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isProcessing}
        className="h-14 w-14 rounded-full"
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
      {isListening && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Ouvindo... Fale a frase completa (2s de silêncio para finalizar)
        </p>
      )}
      {transcript && (
        <p className="text-sm text-center max-w-xs bg-muted rounded-lg px-3 py-2">
          "{transcript}"
        </p>
      )}
    </div>
  );
}
