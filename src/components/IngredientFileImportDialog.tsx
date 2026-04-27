import { useState, useRef } from 'react';
import { Upload, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendToN8n } from '@/lib/n8n-webhook';
import { supabase } from '@/integrations/supabase/client';

export interface ExtractedIngredient {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price?: number | null;
  supplier?: string | null;
  minimum_quantity?: number | null;
  expiration_date?: string | null;
  selected?: boolean;
}

interface IngredientFileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport?: (ingredients: ExtractedIngredient[]) => Promise<void>;
  aba?: string;
}

type Step = 'upload' | 'sending' | 'done' | 'error';

export function IngredientFileImportDialog({
  open,
  onOpenChange,
  aba = 'Estoque',
}: IngredientFileImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Arquivo muito grande. Máximo permitido: 10 MB.');
      setStep('error');
      return;
    }

    setFileName(file.name);
    setStep('sending');

    const { data: { user } } = await supabase.auth.getUser();
    const result = await sendToN8n(file, aba, user?.id);

    if (result.ok) {
      setStep('done');
    } else {
      setErrorMsg(
        result.error?.includes('Failed to fetch') || result.error?.includes('conexão')
          ? 'Não foi possível conectar ao servidor n8n. Verifique sua conexão e tente novamente.'
          : result.error ?? 'Ocorreu um erro inesperado ao enviar o documento.'
      );
      setStep('error');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Ingredientes</DialogTitle>
          <DialogDescription>
            Envie uma foto ou arquivo. O n8n irá processar automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Câmera</span>
                </div>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Arquivo</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Formatos aceitos: JPG, PNG, PDF, TXT (máx. 10 MB)
            </p>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-medium">Enviando para n8n...</p>
            <p className="text-xs text-muted-foreground">{fileName}</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Documento enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground text-center">
              O n8n recebeu o arquivo e irá processar os dados automaticamente.
            </p>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Fechar
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col gap-4 py-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={resetState}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
