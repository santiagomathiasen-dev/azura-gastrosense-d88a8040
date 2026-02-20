import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, UserCheck, UserX, Trash2, Eye, EyeOff, QrCode, Copy, Users, Clock } from 'lucide-react';

interface Gestor {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status_pagamento: boolean;
  created_at: string;
  last_sign_in_at?: string | null;
}

export default function Gestores() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { data: gestors = [], isLoading } = useQuery({
    queryKey: ['gestors'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('manage-gestors', {
        method: 'GET',
      });
      if (res.error) throw new Error(res.error.message);
      return (res.data?.gestors || []) as Gestor[];
    },
  });

  const createGestor = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-gestors', {
        body: { action: 'create', email: email.trim(), name: name.trim(), password },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Gestor criado com sucesso! Email de confirmação enviado.');
      queryClient.invalidateQueries({ queryKey: ['gestors'] });
      setDialogOpen(false);
      setName('');
      setEmail('');
      setPassword('');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ gestorId, active }: { gestorId: string; active: boolean }) => {
      const res = await supabase.functions.invoke('manage-gestors', {
        body: { action: 'toggle_status', gestorId, active },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success('Status atualizado!');
      queryClient.invalidateQueries({ queryKey: ['gestors'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteGestor = useMutation({
    mutationFn: async (gestorId: string) => {
      const res = await supabase.functions.invoke('manage-gestors', {
        body: { action: 'delete', gestorId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success('Gestor excluído!');
      queryClient.invalidateQueries({ queryKey: ['gestors'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Gestão de Gestores"
          description="Cadastre e gerencie os gestores do sistema"
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Gestor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Gestor</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createGestor.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do gestor"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Senha inicial</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O gestor receberá um email de confirmação e só poderá acessar após confirmar.
              </p>
              <Button type="submit" className="w-full" disabled={createGestor.isPending}>
                {createGestor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Cadastrar Gestor
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Chave PIX Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 bg-background p-2 rounded border border-primary/10">
              <code className="text-xs font-mono font-bold text-primary">000.000.000-00</code>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                navigator.clipboard.writeText("000.000.000-00");
                toast.success("Copiado!");
              }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Exiba esta chave para novos gestores realizarem o pagamento.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Resumo de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold">{gestors.length}</p>
                <p className="text-xs text-muted-foreground">Total de Gestores</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {gestors.filter(g => g.status_pagamento).length}
                </p>
                <p className="text-xs text-muted-foreground">Ativos (Pagos)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : gestors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum gestor cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gestors.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{g.full_name || 'Sem nome'}</CardTitle>
                  <Badge variant={g.status_pagamento ? 'default' : 'secondary'}>
                    {g.status_pagamento ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground truncate">{g.email}</p>
                <div className="grid grid-cols-2 gap-2 py-1">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Cadastro
                    </p>
                    <p className="text-[10px] font-medium">
                      {new Date(g.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Último Acesso
                    </p>
                    <p className="text-[10px] font-medium">
                      {g.last_sign_in_at
                        ? new Date(g.last_sign_in_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Nunca'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => toggleStatus.mutate({ gestorId: g.id, active: !g.status_pagamento })}
                  >
                    {g.status_pagamento ? (
                      <><UserX className="h-3 w-3 mr-1" /> Desativar</>
                    ) : (
                      <><UserCheck className="h-3 w-3 mr-1" /> Ativar</>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir este gestor?')) {
                        deleteGestor.mutate(g.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
