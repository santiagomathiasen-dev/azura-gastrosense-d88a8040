import { useState, useRef } from 'react';
import { Upload, Camera, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ImageInputProps {
  onImageCapture: (base64: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

export function ImageInput({ onImageCapture, isProcessing, disabled }: ImageInputProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use JPG, PNG, WebP, GIF ou PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!preview) return;
    onImageCapture(preview);
    setOpen(false);
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => setOpen(true)}
        disabled={disabled || isProcessing}
        className="h-14 w-14 rounded-full"
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) clearPreview(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Capturar Imagem</DialogTitle>
            <DialogDescription>
              Envie uma foto do estoque, nota fiscal ou lista de produtos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!preview ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="camera-input"
                  />
                  <label
                    htmlFor="camera-input"
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Câmera</span>
                  </label>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Arquivo</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10"
                  onClick={clearPreview}
                >
                  <X className="h-4 w-4" />
                </Button>
                {preview.startsWith('data:application/pdf') ? (
                  <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">PDF Selecionado</span>
                  </div>
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full rounded-lg max-h-64 object-contain bg-muted"
                  />
                )}
              </div>
            )}

            {preview && (
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Processar com IA'
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
