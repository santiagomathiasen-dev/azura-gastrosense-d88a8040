import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, QrCode, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function PaymentRequired() {
    const { logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const pixKey = "000.000.000-00"; // Example PIX key, should be configurable

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="max-w-md w-full shadow-lg border-primary/20">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                        <QrCode className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Acesso Suspenso</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                        Sua assinatura do Azura está pendente ou expirou. Para continuar utilizando o sistema, realize o pagamento via PIX.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-secondary/50 p-4 rounded-lg border space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chave PIX (CPF/CNPJ)</p>
                        <div className="flex items-center justify-between gap-2">
                            <code className="text-sm font-mono break-all font-bold text-primary">{pixKey}</code>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCopyPix}>
                                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium">Instruções:</p>
                            <ol className="text-xs text-muted-foreground text-left list-decimal list-inside space-y-1">
                                <li>Copie a chave PIX acima ou use o QR Code.</li>
                                <li>Realize o pagamento do seu plano mensal.</li>
                                <li>Envie o comprovante para o suporte (link abaixo).</li>
                                <li>Seu acesso será liberado em instantes!</li>
                            </ol>
                        </div>

                        <Button className="w-full font-bold" disabled>
                            Já realizei o pagamento
                        </Button>

                        <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => logout()}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sair da conta
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
