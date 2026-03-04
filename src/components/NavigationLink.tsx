'use client';

import Link from 'next/link';
import { NavLink as RRNavLink, useLocation } from 'react-router-dom';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavigationLinkProps {
    to: string;
    className?: string | ((props: { isActive: boolean }) => string);
    children: React.ReactNode;
}

export function NavigationLink({ to, className, children }: NavigationLinkProps) {
    // Call hooks unconditionally to satisfy ESLint
    // We use try/catch to avoid crashing if the context isn't available
    let pathname: string | null = null;
    try {
        pathname = usePathname();
    } catch (e) { }

    let rrLocation: any = null;
    try {
        rrLocation = useLocation();
    } catch (e) { }

    // Next.js (Router context is present)
    if (pathname !== null) {
        const isActive = pathname === to;
        const resolvedClassName = typeof className === 'function'
            ? className({ isActive })
            : cn(className, isActive && "active");

        return (
            <Link href={to} className={resolvedClassName}>
                {children}
            </Link>
        );
    }

    // Vite / React Router (RR location is present)
    return (
        <RRNavLink to={to} className={className as any}>
            {children}
        </RRNavLink>
    );
}
