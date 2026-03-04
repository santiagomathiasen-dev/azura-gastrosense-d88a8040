'use client';

import { createContext, useContext } from 'react';

type NavigateFunction = (to: string | number, options?: { replace?: boolean; state?: any }) => void;

interface NavigationContextType {
    navigate: NavigateFunction;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({
    children,
    navigate
}: {
    children: React.ReactNode;
    navigate: NavigateFunction;
}) {
    return (
        <NavigationContext.Provider value={{ navigate }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useAppNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        // Fallback for components used outside providers (e.g. tests)
        return (to: string | number) => {
            if (typeof window !== 'undefined') {
                if (typeof to === 'string') window.location.href = to;
                else window.history.back();
            }
        };
    }
    return context.navigate;
}
