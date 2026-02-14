import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Factory, 
  ShoppingCart,
  LogOut,
  Boxes,
  PackageCheck,
  ShoppingBag,
  Users,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Painel', permission: 'can_access_dashboard' },
  { to: '/colaboradores', icon: Users, label: 'Colab.', permission: null, gestorOnly: true },
  { to: '/estoque', icon: Package, label: 'Central', permission: 'can_access_estoque' },
  { to: '/estoque-producao', icon: Boxes, label: 'Est. Prod.', permission: 'can_access_estoque_producao' },
  { to: '/fichas', icon: FileText, label: 'Fichas', permission: 'can_access_fichas' },
  { to: '/producao', icon: Factory, label: 'Produção', permission: 'can_access_producao' },
  { to: '/compras', icon: ShoppingCart, label: 'Compras', permission: 'can_access_compras' },
  { to: '/estoque-finalizados', icon: PackageCheck, label: 'Finaliz.', permission: 'can_access_finalizados' },
  { to: '/produtos-venda', icon: ShoppingBag, label: 'Venda', permission: 'can_access_produtos_venda' },
  { to: '/perdas', icon: TrendingDown, label: 'Perdas', permission: 'can_access_estoque' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', permission: 'can_access_dashboard' },
];

export function MobileNav() {
  const { logout } = useAuth();
  const { isCollaboratorMode, clearCollaboratorSession, hasAccess } = useCollaboratorContext();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isCollaboratorMode) {
      clearCollaboratorSession();
    }
    // Always do full Supabase logout
    await logout();
    navigate('/auth');
  };

  const visibleNavItems = [
    ...navItems.filter(item => {
      if (item.gestorOnly && isCollaboratorMode) return false;
      if (isCollaboratorMode && item.permission) {
        return hasAccess(item.to);
      }
      return true;
    }),
    ...(isAdmin ? [{ to: '/gestores', icon: Shield, label: 'Gestores', permission: null }] : []),
  ];

  return (
    <nav className="md:hidden fixed left-0 top-14 bottom-0 w-16 bg-card border-r border-border z-50 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center py-2 gap-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-14",
                  isActive && "text-primary bg-primary/10"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[9px] leading-tight mt-1 text-center">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </ScrollArea>
      
      <div className="border-t border-border p-2">
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[9px] leading-tight mt-1">Sair</span>
        </button>
      </div>
    </nav>
  );
}
