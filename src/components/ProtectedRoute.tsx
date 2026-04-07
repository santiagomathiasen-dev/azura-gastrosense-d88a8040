import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

function Navigate({ to, replace }: { to: string, replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isCollaboratorMode, hasAccess } = useCollaboratorContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profile, isLoading: profileLoading } = useProfile();
  const {
    shouldBlockAccess,
    isSubscriptionExpiring,
    daysUntilExpiry,
    trialDaysRemaining,
    isFree,
    isTrialExpired,
  } = usePlanLimits();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const pathname = usePathname();

  const isEssentialLoading = authLoading;
  const isSecondaryLoading = roleLoading || profileLoading;
  const isAdminBypass = !!user;

  useEffect(() => {
    let timer: any;
    if ((isEssentialLoading || isSecondaryLoading) && !isAdminBypass) {
      timer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [isEssentialLoading, isSecondaryLoading, isAdminBypass]);

  // If essential auth is loading, show minimal loader
  if (isEssentialLoading && !showTimeoutMessage && !isAdminBypass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <p className="text-muted-foreground animate-pulse">Carregando sistema Azura...</p>
          <button
            onClick={() => {
              // Only clear Supabase auth keys, not all localStorage
              const authKeys = Object.keys(localStorage).filter(k =>
                k.startsWith('sb-') || k.includes('supabase') || k.includes('auth')
              );
              authKeys.forEach(k => localStorage.removeItem(k));
              sessionStorage.clear();
              window.location.href = '/auth';
            }}
            className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors underline"
          >
            Se demorar muito, clique aqui para resetar
          </button>
        </div>
      </div>
    );
  }

  // Handle stuck loading
  if (showTimeoutMessage && (isEssentialLoading || isSecondaryLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full p-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">Otimizando carregamento...</h1>
          <p className="text-muted-foreground">O sistema esta verificando suas permissoes.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
              Recarregar Sistema
            </button>
            {/* Only allow bypass if at least auth is resolved (user exists) */}
            {user && (
              <button onClick={() => setShowTimeoutMessage(false)} className="text-sm underline">
                Tentar entrar mesmo assim
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!authLoading && !user && !isCollaboratorMode) {
    return <Navigate to={`/auth?from=${pathname}`} replace />;
  }

  // If logged in but profile is still loading, wait
  if (user && (profileLoading || roleLoading) && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verificando permissoes...</p>
        </div>
      </div>
    );
  }

  // Check blocked accounts
  const isOwner = (profile?.role as string) === 'owner';
  const isAdminRole = (profile?.role as string) === 'admin';
  const isBlocked = profile?.status === 'inativo' && profile?.status_pagamento !== true;

  if (user && profile) {
    if (isBlocked) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] w-full p-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
            <p className="text-muted-foreground">Sua conta foi desativada pelo administrador.</p>
            <button onClick={() => window.location.href = '/auth'} className="text-sm underline mt-4">
              Voltar ao Login
            </button>
          </div>
        </div>
      );
    }

    // Block access if trial expired or subscription expired (owners exempt)
    if (!isOwner && shouldBlockAccess && pathname !== '/payment-required' && pathname !== '/assinatura') {
      return <Navigate to="/payment-required" replace />;
    }
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Build warning banner
  let warningBanner = null;

  if (user && profile && !isOwner && (profile?.role as string) !== 'colaborador') {
    if (isSubscriptionExpiring && daysUntilExpiry !== null) {
      warningBanner = (
        <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              Sua assinatura expira em {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}!
            </p>
            <p className="text-xs opacity-80">Renove para continuar usando o sistema sem interrupcoes.</p>
          </div>
          <a href="/assinatura" className="text-xs font-semibold underline whitespace-nowrap">
            Renovar
          </a>
        </div>
      );
    } else if (isFree && !isTrialExpired && trialDaysRemaining !== null && trialDaysRemaining <= 3) {
      warningBanner = (
        <div className="bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              Seu periodo de teste termina em {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}!
            </p>
            <p className="text-xs opacity-80">Assine um plano para manter o acesso.</p>
          </div>
          <a href="/assinatura" className="text-xs font-semibold underline whitespace-nowrap">
            Ver Planos
          </a>
        </div>
      );
    }
  }

  return (
    <>
      {warningBanner}
      {children}
    </>
  );
}
