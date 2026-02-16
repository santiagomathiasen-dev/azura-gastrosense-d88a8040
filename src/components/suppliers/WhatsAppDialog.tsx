import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplierName: string;
    phoneNumber: string;
    supplierId: string;
    initialMessage?: string;
}

export function WhatsAppDialog({
    open,
    onOpenChange,
    supplierName,
    phoneNumber,
    initialMessage = '',
}: WhatsAppDialogProps) {
    const [message, setMessage] = useState(initialMessage);

    // Sync message when dialog opens with a new initialMessage
    useEffect(() => {
        if (open && initialMessage) {
            setMessage(initialMessage);
        }
        if (!open) {
            setMessage('');
        }
    }, [open, initialMessage]);

    const handleOpenWhatsApp = () => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/55${cleanNumber}?text=${encodedMessage}`, '_blank');
        onOpenChange(false);
    };

    const handleCopyMessage = () => {
        navigator.clipboard.writeText(message);
        toast.success('Mensagem copiada!');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md mx-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        Enviar Pedido para {supplierName}
                    </DialogTitle>
                    <DialogDescription>
                        Edite a mensagem se necessário e envie pelo WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="bg-muted p-3 rounded-md text-sm">
                        <span className="font-semibold">Número:</span> {phoneNumber}
                    </div>

                    <Textarea
                        placeholder="Digite sua mensagem aqui..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        className="resize-none"
                    />
                </div>

                <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        variant="outline"
                        onClick={handleCopyMessage}
                        className="w-full sm:w-auto"
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Mensagem
                    </Button>
                    <Button
                        onClick={handleOpenWhatsApp}
                        disabled={!message.trim()}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Enviar pelo WhatsApp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
