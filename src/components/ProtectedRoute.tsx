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
  const location = useLocation();

  const isLoading = authLoading || roleLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Allow access if user is logged in OR if collaborator is logged in
  if (!user && !isCollaboratorMode) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check payment status for non-admin gestors
  if (user && !isAdmin && profile && !profile.status_pagamento && location.pathname !== '/payment-required') {
    return <Navigate to="/payment-required" replace />;
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
