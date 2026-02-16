import { useState } from 'react';
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
import { MessageCircle, ExternalLink, Send } from 'lucide-react';
import { useSupplierMessages } from '@/hooks/useSupplierMessages';
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
    supplierId,
    initialMessage = '',
}: WhatsAppDialogProps) {
    const [message, setMessage] = useState(initialMessage);
    const { sendWhatsAppMessage, isSending } = useSupplierMessages();

    // Update message when initialMessage changes
    if (open && message === '' && initialMessage !== '') {
        setMessage(initialMessage);
    }

    const handleOpenWeb = () => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/55${cleanNumber}?text=${encodedMessage}`, '_blank');
        onOpenChange(false);
    };

    const handleSendAutomated = async () => {
        if (!message.trim()) {
            toast.error('Digite uma mensagem para enviar');
            return;
        }

        const success = await sendWhatsAppMessage({
            supplierId,
            phoneNumber,
            message,
        });

        if (success) {
            onOpenChange(false);
            setMessage('');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Enviar Mensagem para {supplierName}</DialogTitle>
                    <DialogDescription>
                        Escolha como deseja enviar a mensagem para o fornecedor.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-muted p-3 rounded-md text-sm">
                        <span className="font-semibold">Número:</span> {phoneNumber}
                    </div>

                    <Textarea
                        placeholder="Digite sua mensagem aqui..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                    />
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={handleOpenWeb} className="w-full sm:w-auto">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir no WhatsApp Web
                    </Button>
                    <Button
                        onClick={handleSendAutomated}
                        disabled={isSending || !message.trim()}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                        <Send className="mr-2 h-4 w-4" />
                        {isSending ? 'Enviando...' : 'Enviar Automaticamente'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
