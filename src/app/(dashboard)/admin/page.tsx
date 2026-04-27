'use client';
import dynamic from 'next/dynamic';
const AdminPanel = dynamic(() => import('@/v-pages/AdminPanel'), {
    loading: () => (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    ),
});
export default function AdminPage() { return <AdminPanel />; }
