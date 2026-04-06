'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <ChefHat className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-2">404</h1>
            <h2 className="text-xl font-semibold mb-4">Página não encontrada</h2>
            <p className="text-muted-foreground max-w-md mb-8">
                A página que você está procurando não existe ou foi movida.
            </p>
            <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
                Voltar para o Painel
            </Link>
        </div>
    );
}
