import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Collaborator } from '@/hooks/useCollaborators';

interface CollaboratorContextType {
  collaborator: Collaborator | null;
  gestorId: string | null;
  isCollaboratorMode: boolean;
  setCollaboratorSession: (collaborator: Collaborator, gestorId: string) => void;
  clearCollaboratorSession: () => void;
  hasAccess: (route: string) => boolean;
}

const CollaboratorContext = createContext<CollaboratorContextType | undefined>(undefined);

const STORAGE_KEY = 'azura_collaborator_session';

export function CollaboratorProvider({ children }: { children: ReactNode }) {
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [gestorId, setGestorId] = useState<string | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCollaborator(parsed.collaborator);
        setGestorId(parsed.gestorId);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setCollaboratorSession = (collab: Collaborator, gId: string) => {
    setCollaborator(collab);
    setGestorId(gId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collaborator: collab, gestorId: gId }));
  };

  const clearCollaboratorSession = () => {
    setCollaborator(null);
    setGestorId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const hasAccess = (route: string): boolean => {
    if (!collaborator) return true; // Gestor has full access
    
    const routePermissions: Record<string, keyof Collaborator> = {
      '/dashboard': 'can_access_dashboard',
      '/estoque': 'can_access_estoque',
      '/estoque-producao': 'can_access_estoque_producao',
      '/fichas': 'can_access_fichas',
      '/producao': 'can_access_producao',
      '/compras': 'can_access_compras',
      '/estoque-finalizados': 'can_access_finalizados',
      '/produtos-venda': 'can_access_produtos_venda',
    };

    const permission = routePermissions[route];
    if (!permission) return true;
    
    return collaborator[permission] as boolean;
  };

  return (
    <CollaboratorContext.Provider
      value={{
        collaborator,
        gestorId,
        isCollaboratorMode: !!collaborator,
        setCollaboratorSession,
        clearCollaboratorSession,
        hasAccess,
      }}
    >
      {children}
    </CollaboratorContext.Provider>
  );
}

export function useCollaboratorContext() {
  const context = useContext(CollaboratorContext);
  if (context === undefined) {
    throw new Error('useCollaboratorContext must be used within a CollaboratorProvider');
  }
  return context;
}
