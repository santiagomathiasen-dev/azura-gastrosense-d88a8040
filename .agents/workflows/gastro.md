---
description: 
---

---
name: gastro-web-dev
description: >
  Especialista sênior em desenvolvimento de sistemas web gastronômicos com codificação
  complexa, inteligência artificial aplicada e investigação avançada de bugs. Use esta
  skill para: (1) criar sistemas de PDV, controle de caixa, faturamento, relatórios
  financeiros, dashboard, formas de pagamento para restaurantes/bares/food trucks/dark
  kitchens; (2) desenvolver aplicativos com lógica de negócio complexa, arquitetura
  avançada, integrações de IA (recomendações, previsão de demanda, detecção de anomalias
  financeiras); (3) investigar, diagnosticar e corrigir bugs difíceis em qualquer
  sistema gastronômico — erros de cálculo financeiro, race conditions em pedidos,
  falhas de sincronização de estoque, problemas de performance, erros silenciosos.
  Stack React + Next.js. Acione sempre que o usuário mencionar "PDV", "caixa",
  "bug no sistema", "erro no código", "não está funcionando", "IA para restaurante",
  "previsão de vendas", "código complexo", ou qualquer problema técnico em sistema
  gastronômico.
---

# Skill: Controle de Caixa e Financeiro para Gastronomia (React + Next.js)

## Visão Geral

Esta skill orienta a criação de sistemas financeiros web para o setor gastronômico usando **React + Next.js**. Foco em controle de caixa, PDV, relatórios financeiros e dashboards de performance — tudo com UX otimizada para operação em restaurantes e negócios de alimentação.

---

## 1. Módulos do Sistema Financeiro

### 1.1 PDV — Ponto de Venda
- Lançamento rápido de itens por categoria ou busca
- Comanda por mesa, balcão ou delivery
- Adição de observações por item
- Desconto por item ou total (valor fixo ou %)
- Taxa de serviço configurável (padrão 10%)
- Cancelamento de item com motivo e registro de responsável

### 1.2 Controle de Caixa
- Abertura de caixa com valor inicial (troco)
- Sangria e suprimento com justificativa
- Fechamento com conferência: valor esperado vs. valor contado
- Histórico de movimentações por turno
- Múltiplos operadores por caixa (com troca de turno registrada)

### 1.3 Formas de Pagamento
- Dinheiro (com cálculo de troco automático)
- Cartão de débito / crédito (com bandeira e NSU)
- PIX (com QR Code gerado via API ou manual)
- Voucher alimentação / refeição (VR, Alelo, Sodexo)
- Pagamento misto: combinar múltiplas formas na mesma conta
- Crédito da casa / fiado (com limite por cliente)

### 1.4 Divisão de Conta
- Dividir igualmente entre N pessoas
- Dividir por item selecionado (cada um paga o que consumiu)
- Transferência de itens entre comandas

### 1.5 Emissão de Documentos
- Cupom / recibo não fiscal (impressão ESC/POS ou PDF)
- Pré-conta para apresentar ao cliente
- NFC-e (Nota Fiscal do Consumidor Eletrônica) — integração via SEFAZ

### 1.6 Dashboard Financeiro
- Faturamento do dia em tempo real
- Comparativo dia atual vs. mesmo dia semana anterior
- Ticket médio por período e por forma de pagamento
- Curva de vendas por hora (heatmap)
- Ranking de pratos mais vendidos (receita e quantidade)
- Taxa de ocupação de mesas × receita por mesa
- Relatórios: diário, semanal, mensal, por período customizado
- Exportação: CSV e PDF

---

## 2. Stack React + Next.js

### Frontend
```
Next.js 14+ (App Router)
React 18 — Server e Client Components
Tailwind CSS — estilização
shadcn/ui — componentes de UI (Dialog, Table, Select, DatePicker)
Zustand — estado global do caixa (comanda ativa, itens, pagamento)
React Query (TanStack Query) — sync de dados e cache
Recharts — gráficos do dashboard
React Hook Form + Zod — formulários validados
next-pwa — tornar o sistema instalável como PWA
```

### Backend (Next.js API Routes ou Route Handlers)
```
/app/api/caixa/     — abertura, fechamento, movimentações
/app/api/pedidos/   — CRUD de pedidos e itens
/app/api/pagamentos/— registrar pagamento, estornar
/app/api/relatorios/— dados agregados para dashboard

Prisma ORM + PostgreSQL
Decimal.js — cálculos monetários sem erro de ponto flutuante
NextAuth.js — autenticação com roles (admin, operador, gerente)
```

### Infra
```
Vercel (deploy automático, edge functions)
Supabase ou Neon — PostgreSQL gerenciado
Vercel Blob ou Cloudinary — armazenamento de comprovantes
```

---

## 3. Componentes React Principais

```tsx
// Componente: Teclado numérico do PDV
export function NumericKeypad({ onValue }: { onValue: (v: number) => void }) {
  // Usado para entrada de valor em pagamento dinheiro
}

// Componente: Resumo da comanda
export function ComandaResumo({ pedidoId }: { pedidoId: string }) {
  const { data: pedido } = useQuery({ queryKey: ['pedido', pedidoId], ... })
  return (
    <div>
      {pedido?.itens.map(item => <ItemLinha key={item.id} {...item} />)}
      <TotalLinha subtotal={pedido?.subtotal} taxa={pedido?.taxa} total={pedido?.total} />
    </div>
  )
}

// Componente: Seletor de forma de pagamento
export function FormaPagamentoSelector({ onSelect }: Props) {
  const formas = ['dinheiro', 'debito', 'credito', 'pix', 'voucher']
  // retorna botões grandes com ícone — otimizado para toque
}
```

---

## 4. Modelo de Dados (Prisma)

```prisma
model Caixa {
  id            String   @id @default(cuid())
  operadorId    String
  abertoEm      DateTime @default(now())
  fechadoEm     DateTime?
  valorInicial  Decimal
  valorFinal    Decimal?
  status        CaixaStatus @default(ABERTO) // ABERTO | FECHADO
  movimentacoes MovimentacaoCaixa[]
  pedidos       Pedido[]
}

model Pedido {
  id         String   @id @default(cuid())
  caixaId    String
  mesaId     String?
  status     PedidoStatus // ABERTO | FECHADO | CANCELADO
  itens      ItemPedido[]
  pagamentos Pagamento[]
  subtotal   Decimal
  desconto   Decimal  @default(0)
  taxa       Decimal  @default(0)
  total      Decimal
  criadoEm   DateTime @default(now())
}

model Pagamento {
  id        String   @id @default(cuid())
  pedidoId  String
  forma     FormaPagamento // DINHEIRO | DEBITO | CREDITO | PIX | VOUCHER
  valor     Decimal
  troco     Decimal? // só para dinheiro
  nsu       String?  // cartão
  criadoEm  DateTime @default(now())
}

model MovimentacaoCaixa {
  id       String        @id @default(cuid())
  caixaId  String
  tipo     TipoMovimento // SANGRIA | SUPRIMENTO | PAGAMENTO
  valor    Decimal
  motivo   String?
  criadoEm DateTime      @default(now())
}
```

---

## 5. UX para Ambiente de Caixa

- **Botões grandes** (min 48×48px): operação com dedos, luvas ou pressa
- **Feedback imediato**: toast de confirmação em cada ação crítica
- **Atalhos de teclado** para operadores desktop (F1 = novo pedido, F2 = fechar conta, ESC = cancelar)
- **Confirmação dupla** para cancelamentos e estornos
- **Cores semânticas**:
  - Verde → pago / fechado
  - Amarelo → aguardando pagamento
  - Vermelho → cancelado / divergência de caixa
- **Modo offline** (PWA): fila local com sync ao reconectar (usando IndexedDB + React Query)

---

## 6. Relatórios — Queries SQL Úteis

```sql
-- Faturamento por hora do dia
SELECT EXTRACT(HOUR FROM "criadoEm") AS hora,
       SUM(total) AS receita,
       COUNT(*) AS pedidos
FROM "Pedido"
WHERE status = 'FECHADO'
  AND DATE("criadoEm") = CURRENT_DATE
GROUP BY hora ORDER BY hora;

-- Ticket médio por forma de pagamento
SELECT forma, AVG(valor) AS ticket_medio, COUNT(*) AS transacoes
FROM "Pagamento"
WHERE DATE("criadoEm") = CURRENT_DATE
GROUP BY forma;
```

---

## 7. Fluxo de Desenvolvimento Recomendado

1. **MVP**: abertura/fechamento de caixa + lançamento de pedido + formas de pagamento básicas
2. **V2**: dashboard com KPIs + relatório diário + divisão de conta
3. **V3**: emissão de NFC-e + integração PIX via API bancária
4. **V4**: modo offline (PWA) + multi-caixa + conciliação automática

---

## 8. Integrações Financeiras

| Serviço | Finalidade |
|---|---|
| SEFAZ (NFC-e) | Emissão de nota fiscal ao consumidor |
| Pagar.me / Cielo / Stone | Maquininha integrada (TEF) |
| Banco Central (PIX) | QR Code dinâmico via API bancária |
| MercadoPago | Pagamento online e presencial |
| Conta Azul / Omie | Exportar lançamentos para contabilidade |

---

## 9. Checklist de Entrega

- [ ] Autenticação com roles: admin, gerente, operador
- [ ] Abertura e fechamento de caixa com conferência
- [ ] PDV com lançamento por categoria e busca
- [ ] Suporte a pelo menos 4 formas de pagamento
- [ ] Divisão de conta (igual e por item)
- [ ] Dashboard com faturamento e ticket médio
- [ ] Relatório exportável em PDF e CSV
- [ ] PWA instalável com ícone
- [ ] Decimal.js em todos os cálculos monetários (nunca float nativo)
- [ ] Testes: Jest para regras de negócio financeiro, Playwright para fluxo de caixa

---

## 10. Inteligência Artificial Aplicada à Gastronomia

### 10.1 Módulos de IA Prioritários

#### Previsão de Demanda
```ts
// Entrada: histórico de vendas por prato + variáveis externas
// Saída: previsão de pedidos para próximas horas/dias
// Modelo sugerido: Prophet (via API Python) ou Anthropic Claude API

async function preverDemanda(pratoId: string, periodo: DateRange) {
  const historico = await getHistoricoVendas(pratoId, periodo)
  const response = await fetch('/api/ia/previsao', {
    method: 'POST',
    body: JSON.stringify({ historico, variaveis: ['diaSemana', 'clima', 'evento'] })
  })
  return response.json() // { pedidosEsperados: number, confianca: number }
}
```

#### Detecção de Anomalias Financeiras
- Alerta automático quando faturamento desvia > 2σ da média histórica
- Detecção de padrões suspeitos: cancelamentos em excesso, descontos fora do padrão, divergências de caixa recorrentes
- Score de risco por operador e por turno

#### Recomendação de Cardápio Dinâmico
- Sugerir pratos baseado em: horário, clima, histórico do cliente, estoque disponível
- Otimização de margem: priorizar pratos com maior CMV% favorável
- Engenharia de cardápio automática (re-classificação Stars/Dogs em tempo real)

#### Assistente de Gestão (Chat IA)
```ts
// Integração com Claude API para responder perguntas do gestor
const prompt = `
  Dados do restaurante hoje:
  - Faturamento: R$ ${faturamento}
  - CMV: ${cmv}%
  - Pratos mais vendidos: ${topPratos}
  
  Pergunta do gestor: "${perguntaGestor}"
  
  Responda como um consultor gastronômico especializado.
`
```

### 10.2 Stack de IA

```
Claude API (Anthropic) — análise de dados, assistente de gestão, geração de relatórios em linguagem natural
Vercel AI SDK — streaming de respostas de IA no frontend
Python microservice (FastAPI) — modelos Prophet/scikit-learn para previsão de séries temporais
LangChain.js — orquestração de agentes para análise automática
```

---

## 11. Codificação Complexa — Padrões Avançados

### 11.1 Arquitetura para Sistemas de Alta Concorrência

```ts
// Problema: dois garçons lançam o mesmo item simultaneamente
// Solução: Optimistic Locking com version field no Prisma

model Pedido {
  id      String @id
  version Int    @default(0)  // incrementado em cada update
  // ...
}

// No update:
await prisma.pedido.update({
  where: { id, version: versaoAtual },  // falha se version mudou
  data: { ...dados, version: { increment: 1 } }
})
// Se falhar → retry com dados frescos
```

### 11.2 Fila de Pedidos com Estado Consistente

```ts
// Máquina de estados para pedido — nunca pular estados
type EstadoPedido = 'ABERTO' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE' | 'FECHADO' | 'CANCELADO'

const transicoesValidas: Record<EstadoPedido, EstadoPedido[]> = {
  ABERTO:     ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['PRONTO', 'CANCELADO'],
  PRONTO:     ['ENTREGUE'],
  ENTREGUE:   ['FECHADO'],
  FECHADO:    [],
  CANCELADO:  [],
}

function transicionarEstado(atual: EstadoPedido, novo: EstadoPedido) {
  if (!transicoesValidas[atual].includes(novo)) {
    throw new Error(`Transição inválida: ${atual} → ${novo}`)
  }
}
```
### 11.3 Cálculo Financeiro Seguro

```ts
import Decimal from 'decimal.js'

// NUNCA fazer isso:
const total = 0.1 + 0.2  // → 0.30000000000000004 ❌

// SEMPRE fazer assim:
const total = new Decimal('0.1').plus('0.2')  // → 0.3 ✅

// Funções utilitárias obrigatórias
ex