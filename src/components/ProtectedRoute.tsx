import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isCollaboratorMode, hasAccess } = useCollaboratorContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profile, isLoading: profileLoading } = useProfile();
  const isLoading = authLoading || roleLoading || profileLoading;
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) setShowTimeoutMessage(true);
    }, 15000); // 15 seconds timeout
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && !showTimeoutMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (isLoading && showTimeoutMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">O carregamento está demorando...</h1>
          <p className="text-muted-foreground">O banco de dados pode estar lento ou com erro de permissão.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => setShowTimeoutMessage(false)}
              className="text-sm underline"
            >
              Continuar mesmo assim (pode falhar)
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Allow access if user is logged in OR if collaborator is logged in
  if (!user && !isCollaboratorMode) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check payment/active status for non-admin profiles
  const isSantiago = profile?.email === 'santiago.aloom@gmail.com';
  const isBlocked = profile?.status === 'inativo';
  const isPaymentPending = profile?.status_pagamento === false;

  // Admins and Santiago are never blocked/payment-restricted here for management purposes
  if (user && !isAdmin && !isSantiago) {
    if (isBlocked) {
      // If blocked, we could redirect to a specific "Account Blocked" page or just show a message
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
            <p className="text-muted-foreground">Sua conta foi desativada pelo administrador do sistema. Entre em contato para mais informações.</p>
            <Navigate to="/auth" replace />
          </div>
        </div>
      );
    }

    if (isPaymentPending && location.pathname !== '/payment-required') {
      return <Navigate to="/payment-required" replace />;
    }
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
