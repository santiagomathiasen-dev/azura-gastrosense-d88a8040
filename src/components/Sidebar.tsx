import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Factory, 
  ShoppingCart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  ShoppingBag,
  Boxes,
  UtensilsCrossed,
  Users,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Painel', permission: 'can_access_dashboard' },
  { to: '/colaboradores', icon: Users, label: 'Colaboradores', permission: null, gestorOnly: true },
  { to: '/estoque', icon: Package, label: 'Estoque Central', permission: 'can_access_estoque' },
  { to: '/estoque-producao', icon: Boxes, label: 'Estoque Produção', permission: 'can_access_estoque_producao' },
  { to: '/estoque-insumos-produzidos', icon: UtensilsCrossed, label: 'Insumos Produzidos', permission: 'can_access_estoque_producao' },
  { to: '/fichas', icon: FileText, label: 'Fichas Técnicas', permission: 'can_access_fichas' },
  { to: '/producao', icon: Factory, label: 'Produções', permission: 'can_access_producao' },
  { to: '/compras', icon: ShoppingCart, label: 'Compras', permission: 'can_access_compras' },
  { to: '/estoque-finalizados', icon: PackageCheck, label: 'Prod. Finalizadas', permission: 'can_access_finalizados' },
  { to: '/produtos-venda', icon: ShoppingBag, label: 'Produtos p/ Venda', permission: 'can_access_produtos_venda' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', permission: 'can_access_dashboard' },
];

export function Sidebar() {
  const { logout, user } = useAuth();
  const { collaborator, isCollaboratorMode, clearCollaboratorSession, hasAccess } = useCollaboratorContext();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isCollaboratorMode) {
      clearCollaboratorSession();
    }
    // Always do full Supabase logout
    await logout();
    navigate('/auth');
  };

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(item => {
    // Gestor-only items (like Colaboradores) are hidden for collaborators
    if (item.gestorOnly && isCollaboratorMode) return false;
    // Check permission for collaborators
    if (isCollaboratorMode && item.permission) {
      return hasAccess(item.to);
    }
    return true;
  });
  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col bg-sidebar text-sidebar-foreground h-screen fixed left-0 top-0 z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo Azura - Fixed at top */}
      <div 
        className="p-3 border-b border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors flex-shrink-0"
        onClick={() => navigate('/dashboard')}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <h1 className="font-bold text-base leading-tight">Azura</h1>
              <p className="text-[10px] text-sidebar-muted truncate">Gestão Gastronômica</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "nav-item text-sm",
                isActive && "nav-item-active"
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="animate-fade-in truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-2 border-t border-sidebar-border flex-shrink-0">
        {!collapsed && (
          <div className="mb-2 px-3 animate-fade-in">
            {isCollaboratorMode && collaborator ? (
              <>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{collaborator.name}</p>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">Colaborador</Badge>
                </div>
              </>
            ) : user ? (
              <>
                <p className="text-xs font-medium truncate">{user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário'}</p>
                <p className="text-[10px] text-sidebar-muted truncate">{user.email}</p>
              </>
            ) : null}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="nav-item w-full text-destructive hover:bg-destructive/10 text-sm"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 h-5 w-5 rounded-full border bg-card shadow-md hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  );
}
