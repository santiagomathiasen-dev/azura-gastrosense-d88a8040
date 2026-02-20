import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Estoque from "@/pages/Estoque";
import Fichas from "@/pages/Fichas";
import Producao from "@/pages/Producao";
import Compras from "@/pages/Compras";
import EstoqueProducao from "@/pages/EstoqueProducao";
import EstoqueFinalizados from "@/pages/EstoqueFinalizados";
import EstoqueInsumosProduzidos from "@/pages/EstoqueInsumosProduzidos";
import ProdutosVenda from "@/pages/ProdutosVenda";
import Colaboradores from "@/pages/Colaboradores";
import Gestores from "@/pages/Gestores";
import Relatorios from "@/pages/Relatorios";
import Financeiro from "@/pages/Financeiro";
import Perdas from "@/pages/Perdas";
import PrevisaoVendas from "@/pages/PrevisaoVendas";
import PaymentRequired from "@/pages/PaymentRequired";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CollaboratorProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAInstallPrompt />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth" element={<Auth />} />

              {/* Protected Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/colaboradores" element={<Colaboradores />} />
                <Route path="/gestores" element={<Gestores />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/estoque-producao" element={<EstoqueProducao />} />
                <Route path="/fichas" element={<Fichas />} />
                <Route path="/producao" element={<Producao />} />
                <Route path="/compras" element={<Compras />} />
                <Route path="/estoque-finalizados" element={<EstoqueFinalizados />} />
                <Route path="/estoque-insumos-produzidos" element={<EstoqueInsumosProduzidos />} />
                <Route path="/produtos-venda" element={<ProdutosVenda />} />
                <Route path="/perdas" element={<Perdas />} />
                <Route path="/previsao-vendas" element={<PrevisaoVendas />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/payment-required" element={<PaymentRequired />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CollaboratorProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
