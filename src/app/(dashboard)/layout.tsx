'use client';

import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const queryClient = useQueryClient();

    // Auto-refresh data when navigating between tabs/pages
    useEffect(() => {
        // Invalidate main queries to ensure the new page has fresh data
        // but don't do it forEVERY single query to avoid overkill
        // Focus on stock, reports, and purchases
        queryClient.invalidateQueries({
            queryKey: ['stock_items'],
            exact: false,
            refetchType: 'active'
        });
        queryClient.invalidateQueries({
            queryKey: ['reports'],
            exact: false,
            refetchType: 'active'
        });
        queryClient.invalidateQueries({
            queryKey: ['purchase_list'],
            exact: false,
            refetchType: 'active'
        });
    }, [pathname, queryClient]);

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

                <main className="flex-1 p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-7xl mx-auto pb-8">
                        <ProtectedRoute>
                            {children}
                        </ProtectedRoute>
                    </div>
                </main>
            </div>
        </div>
    );
}
