import { useState } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalAIDialog } from './GlobalAIDialog';

export function AIAssistant() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="fixed bottom-20 right-4 z-50 md:bottom-8 md:right-8">
                <Button
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 group relative overflow-hidden"
                    onClick={() => setOpen(true)}
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-white/20 to-primary/0 animate-shimmer" />
                    <Mic className="h-6 w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1">
                        <Sparkles className="h-4 w-4 text-primary-foreground animate-pulse" />
                    </div>
                </Button>
            </div>

            <GlobalAIDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
