---
name: gastro-logistics
description: >
  Especialista em sistemas web para gestão de recursos, estoque, logística e custos
  voltados para o setor gastronômico. Use esta skill sempre que o usuário pedir para
  criar ou planejar sistemas de: controle de estoque de insumos, ficha técnica de
  receitas, cálculo de CMV (Custo da Mercadoria Vendida), gestão de fornecedores,
  ordens de compra, inventário de cozinha, precificação de pratos, rastreabilidade
  de ingredientes, planejamento de cardápio por custo, gestão de desperdício,
  e qualquer ferramenta de logística operacional para restaurantes, catering,
  cozinhas industriais ou dark kitchens. Sempre acione esta skill quando o usuário
  mencionar "CMV", "ficha técnica", "estoque de restaurante", "insumos", "custo por
  prato", "fornecedores de alimentos", "inventário de cozinha", ou quiser calcular
  rentabilidade de pratos e controlar desperdício.
---

# Skill: Gestão de Recursos e Logística Gastronômica

## Visão Geral

Esta skill orienta a criação de sistemas para controle operacional e financeiro do back-office gastronômico: do recebimento de mercadorias ao custo final do prato no cardápio, passando por fichas técnicas, gestão de fornecedores e rastreabilidade de ingredientes.

---

## 1. Módulos do Sistema

### 1.1 Controle de Estoque de Insumos
- Cadastro de ingredientes com unidade de medida (kg, L, un, g, ml)
- Entrada de estoque: nota fiscal / recebimento manual
- Saída automática: consumo vinculado a pedidos (via ficha técnica)
- Saída manual: degustação, descarte, teste
- Estoque mínimo com alertas de reposição
- Rastreabilidade: lote, validade, fornecedor
- Inventário periódico com comparativo (teórico vs. real)

### 1.2 Ficha Técnica de Receitas
- Ingredientes com quantidades brutas e líquidas
- Fator de correção (FC = peso bruto ÷ peso líquido)
- Custo automático por porção (atualizado com preço do estoque)
- Subpreparo/semi-acabados encadeados (molho base → prato final)
- Rendimento da receita (yield %)
- Modo de preparo e fotos de referência
- Comparação entre versões da receita

### 1.3 Cálculo de CMV e Precificação
```
CMV por prato = Σ (quantidade_ingrediente × custo_atual_por_unidade)

Margem de contribuição = Preço de venda - CMV

Markup = Preço de venda / CMV

CMV% = (CMV / Preço de venda) × 100
  → Meta saudável para restaurantes: 28% a 35%

Preço sugerido = CMV / CMV% desejado
```

- Dashboard de rentabilidade por prato e por categoria
- Engenharia de cardápio (matriz Stars / Plowhorses / Puzzles / Dogs)
- Simulador de precificação com impostos e mão de obra

### 1.4 Gestão de Fornecedores
- Cadastro: CNPJ, contatos, produtos fornecidos, prazo de entrega
- Comparativo de preços entre fornecedores por insumo
- Histórico de compras por fornecedor
- Avaliação de fornecedores (pontualidade, qualidade, preço)
- Integração com XML de NF-e para entrada automática de produtos

### 1.5 Ordens de Compra
- Geração automática baseada em estoque mínimo
- Aprovação por nível de acesso (cozinheiro → chef → gerente)
- Envio por e-mail/WhatsApp ao fornecedor
- Confirmação de recebimento com conferência de itens
- Divergências: quantidade, preço, qualidade

### 1.6 Planejamento de Cardápio (Food Planning)
- Previsão de demanda por prato (baseado em histórico de vendas)
- Lista de compras automática para o período planejado
- Cálculo de mise en place necessária
- Controle de sazonalidade de ingredientes

### 1.7 Controle de Desperdício
- Registro de descarte com motivo (vencimento, preparo, erro)
- Custo do desperdício por período
- Indicador: % desperdício / compras totais
- Meta e alertas configuráveis

---

## 2. Stack Recomendada

### Frontend
```
Next.js 14+ (App Router) + React 18
Tailwind CSS
TanStack Table (React Table) — tabelas complexas com filtro/ordenação/paginação
Recharts — gráficos de custo, CMV, evolução de estoque
React Hook Form + Zod — formulários validados (fichas técnicas, entradas de NF)
date-fns — manipulação de datas (validades, períodos de relatório)
Zustand — estado de estoque e ficha técnica em edição
```

### Backend (Next.js Route Handlers)
```
/app/api/estoque/     — movimentações, inventário, alertas
/app/api/fichas/      — CRUD de fichas técnicas, cálculo de CMV
/app/api/fornecedores/— cadastro, histórico de preços, avaliações
/app/api/compras/     — ordens de compra, recebimento, NF-e XML

Prisma ORM + PostgreSQL
Decimal.js — cálculos de CMV sem erro de ponto flutuante
```

### Relatórios / Exportação
```
PDFKit ou Puppeteer — fichas técnicas em PDF
ExcelJS — exportação de inventários e relatórios
node-xml2js — parsing de XML de NF-e
```

---

## 3. Modelo de Dados (Prisma Schema)

```prisma
model Ingrediente {
  id              Int      @id @default(autoincrement())
  nome            String
  unidade         String   // kg, L, un, g, ml
  estoqueAtual    Decimal  @default(0)
  estoqueMinimo   Decimal
  custoMedio      Decimal  // atualizado automaticamente
  fornecedores    FornecedorIngrediente[]
  movimentacoes   MovimentacaoEstoque[]
}

model FichaTecnica {
  id          Int      @id @default(autoincrement())
  nome        String   // nome do prato
  rendimento  Decimal  // porções que a receita produz
  ingredientes IngredienteFicha[]
  custoTotal  Decimal  // calculado automaticamente
  precoVenda  Decimal?
  // CMV% = custoTotal / precoVenda * 100
}

model IngredienteFicha {
  id              Int          @id @default(autoincrement())
  fichaTecnicaId  Int
  ingredienteId   Int
  quantidadeBruta Decimal      // antes do preparo
  fatorCorrecao   Decimal      @default(1)
  // quantidadeLiquida = quantidadeBruta / fatorCorrecao
}

model MovimentacaoEstoque {
  id            Int      @id @default(autoincrement())
  ingredienteId Int
  tipo          TipoMovimentacao // ENTRADA | SAIDA_PRODUCAO | SAIDA_DESCARTE | INVENTARIO
  quantidade    Decimal
  custo         Decimal?
  lote          String?
  validade      DateTime?
  fornecedorId  Int?
  pedidoId      Int?   // vínculo automático com pedidos
  criadoEm      DateTime @default(now())
}
```

---

## 4. Fórmulas e Cálculos Importantes

### Custo Médio Ponderado (CMP)
```
Novo custo médio = (qtd_atual × custo_atual + qtd_entrada × custo_entrada)
                   ÷ (qtd_atual + qtd_entrada)
```

### Fator de Correção (FC)
```
FC = Peso Bruto (compra) ÷ Peso Líquido (utilizável após limpeza)
Ex: 1kg de frango inteiro → 700g aproveitável → FC = 1 ÷ 0,7 = 1,43
```

### Engenharia de Cardápio (Menu Engineering)
```
Popularidade média = total_pedidos ÷ número_de_pratos
Margem média = média das margens de todos os pratos

Classificação:
  Alta popularidade + Alta margem = ESTRELA (manter e promover)
  Alta popularidade + Baixa margem = VACA LEITEIRA (aumentar preço levemente)
  Baixa popularidade + Alta margem = ENIGMA (reposicionar no menu)
  Baixa popularidade + Baixa margem = ABACAXI (considerar remover)
```

---

## 5. Alertas e Automações

| Trigger | Ação |
|---|---|
| Estoque abaixo do mínimo | Notificação + gerar ordem de compra sugerida |
| Validade próxima (X dias) | Alerta para uso prioritário ou descarte |
| CMV% acima da meta | Alerta no dashboard com prato em destaque |
| NF-e recebida | Atualizar estoque e custo médio automaticamente |
| Inventário divergente | Relatório de variação com possíveis causas |

---

## 6. Dashboard KPIs Essenciais

```
┌─────────────────────────────────────────────────────┐
│  CMV do Mês: 31.4%  ↓ Meta: 33%  ✅                │
│  Desperdício: R$ 847  ↑ vs mês anterior             │
│  Insumos em alerta: 3 itens abaixo do mínimo        │
│  Compras do mês: R$ 12.430                          │
│  Fornecedor com melhor custo: Distribuidora ABC     │
└─────────────────────────────────────────────────────┘
```

Métricas principais:
- CMV% por período e por categoria
- Giro de estoque (dias de cobertura)
- Top 10 insumos por custo
- Evolução do custo dos pratos mais vendidos
- Taxa de desperdício mensal

---

## 7. Fluxo de Desenvolvimento Recomendado

1. **MVP**: cadastro de ingredientes + ficha técnica + cálculo de CMV
2. **V2**: controle de estoque com movimentações + fornecedores
3. **V3**: ordens de compra + integração NF-e XML
4. **V4**: planejamento de cardápio + engenharia de menu + previsão de demanda

---

## 8. Integrações Relevantes

| Integração | Utilidade |
|---|---|
| SEFAZ (NF-e XML) | Entrada automática de compras no estoque |
| Sistema de PDV/Pedidos | Baixa automática de estoque por ficha técnica |
| WhatsApp Business | Envio de ordens de compra a fornecedores |
| Google Sheets / Excel | Importação de fichas técnicas existentes |
| Balança digital (serial/USB) | Pesagem direta no inventário |

---

## 9. Checklist de Entrega

- [ ] CRUD completo de ingredientes com unidades de medida
- [ ] Ficha técnica com cálculo automático de custo
- [ ] Movimentações de estoque (entrada/saída/inventário)
- [ ] Dashboard com CMV% e alertas
- [ ] Relatório de rentabilidade por prato
- [ ] Exportação de fichas técnicas em PDF
- [ ] Controle de acesso por perfil (cozinheiro, chef, gestor)
- [ ] Histórico de preços de insumos (gráfico de evolução)
- [ ] Backup automático de dados

---

## 10. Referências

- Consulte `/references/cmv-formulas.md` para fórmulas detalhadas e exemplos
- Consulte `/references/nfe-xml-parser.md` para parsing de notas fiscais eletrônicas
