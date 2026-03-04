'use client';

import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading: authLoading } = useAuth();
    const { userRole, isLoading: roleLoading } = useUserRole();
    const [collapsed, setCollapsed] = useState(false);

    if (authLoading || roleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar */}
            <div className={`hidden md:flex flex-col fixed inset-y-0 z-50 border-r border-border/50 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
                <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-56"}`}>
                {/* Mobile Nav */}
                <div className="md:hidden">
                    <MobileNav />
                </div>

                <main className="flex-1 p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto overflow-x-hidden" style={{ fontSize: '75%' }}>
                    <div className="max-w-7xl mx-auto pb-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
