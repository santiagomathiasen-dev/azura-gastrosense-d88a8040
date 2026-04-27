'use client';
import dynamic from 'next/dynamic';
const Perdas = dynamic(() => import('@/v-pages/Perdas'), {
    loading: () => (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    ),
});
export default function PerdasPage() { return <Perdas />; }
