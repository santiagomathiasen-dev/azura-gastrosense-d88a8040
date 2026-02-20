import { useState, useMemo } from 'react';
import { useGestaoUsuarios, Profile, BusinessRole } from '@/hooks/useGestaoUsuarios';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Users, ShieldAlert } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';

export default function Gestores() {
  const { profiles, isLoading, updateStatus, updateRole } = useGestaoUsuarios();
  const { profile: currentProfile, isLoading: profileLoading } = useProfile();
  const { isAdmin } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const pName = p.full_name || '';
      const pEmail = p.email || '';
      const matchesSearch =
        pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'all' || p.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [profiles, searchTerm, roleFilter]);

  // Permission check: strictly santiago.aloom@gmail.com
  const isSantiago = currentProfile?.email === 'santiago.aloom@gmail.com';
  const hasAccess = isAdmin || isSantiago;

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores ou gestores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Usuários"
        description="Gerencie os status e cargos dos colaboradores e gestores do sistema"
      />

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                <p className="text-3xl font-bold">{profiles.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Usuários Ativos</p>
              <p className="text-3xl font-bold text-green-600">
                {profiles.filter(p => p.status === 'ativo').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Usuários Inativos</p>
              <p className="text-3xl font-bold text-destructive/70">
                {profiles.filter(p => p.status === 'inativo').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-[200px]">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Cargos</SelectItem>
              <SelectItem value="gestor">Gestores</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
              <SelectItem value="estoque">Estoque</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.full_name || 'Sem nome'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={p.role}
                          onValueChange={(value) => updateRole.mutate({ id: p.id, role: value as BusinessRole })}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="producao">Produção</SelectItem>
                            <SelectItem value="estoque">Estoque</SelectItem>
                            <SelectItem value="venda">Venda</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="capitalize">
                          {p.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={p.status === 'ativo' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch
                          checked={p.status === 'ativo'}
                          disabled={updateStatus.isPending || (p.id === currentProfile?.id)}
                          onCheckedChange={(checked) => {
                            updateStatus.mutate({
                              id: p.id,
                              status: checked ? 'ativo' : 'inativo'
                            });
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
