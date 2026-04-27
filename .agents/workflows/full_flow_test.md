---
description: "Full end‑to‑end flow: register product → central stock → fichas → production and verify AI features"
---

# Full‑Flow Test Workflow

This workflow walks through the core business processes of the **Azura Gastrosense** application and validates that the AI‑powered UI features (theme toggle, toast notifications, etc.) are working correctly.

## Prerequisites
- Node.js (v20+) installed.
- PowerShell execution policy set to **Bypass** for the current process (already done in previous steps).
- The development server is running (`npm run dev`).
- You are logged in as an **admin** user (so you have permission to create products, manage stock, and start productions).

## Steps
1. **Start the development server**
   ```
   npm run dev
   ```
   The app should be reachable at `http://localhost:5175` (or the port shown in the console).

2. **Register a new product**
   - Open the **Produtos** page from the sidebar.
   - Click **"Novo Produto"**.
   - Fill in the required fields (e.g., *Nome*, *Código*, *Categoria*, *Preço*).
   - Submit the form.
   - Verify that a **toast** appears confirming the creation (powered by `sonner`).

3. **Move the product to the central stock**
   - Navigate to **Estoque Central**.
   - Locate the product you just created.
   - Use the **"Transferir"** action to move a quantity to the central warehouse.
   - Confirm the transfer and watch for a toast notification.

4. **Create a ficha (technical sheet) for the product**
   - Go to **Fichas**.
   - Click **"Nova Ficha"** and select the product.
   - Add any required technical details (ingredients, preparation steps, etc.).
   - Save the ficha and ensure a success toast appears.

5. **Start a production order using the ficha**
   - Open the **Produção** page.
   - Click **"Nova Produção"** and choose the previously created ficha.
   - Specify the quantity to produce and any additional parameters.
   - Submit the order.
   - Verify that the production appears in the list with status **"Em andamento"** and that a toast confirms the creation.

6. **Validate AI‑powered UI features**
   - **Theme toggle**: Click the sun/moon button in the sidebar to switch between light and dark mode. Ensure the UI updates instantly and the preference persists after a page refresh.
   - **Toast notifications**: Throughout the steps above, confirm that each action triggers a toast (success/failure) using the `sonner` library.
   - **Form validation**: Try submitting a product with a missing required field and verify that the UI shows an inline validation error (React‑Hook‑Form + Zod).

7. **Cleanup (optional)**
   - Delete the test product, ficha, and production order via their respective **"Excluir"** actions to keep the dev database tidy.

## Expected Outcome
- All entities (product, stock entry, ficha, production) are created without errors.
- Toast notifications appear for every successful operation.
- The theme toggle works and persists across reloads.
- No uncaught exceptions appear in the browser console.

---
*This workflow is intended for manual execution by a developer or QA engineer. Automating UI interactions would require an end‑to‑end testing framework (e.g., Playwright or Cypress), which can be added later if needed.*



SKILL NAME: Desenvolvedor Especialista em Debug e IA para SaaS

============================== VERSÃO SAAS (FOCADA EM PLATAFORMAS
DIGITAIS) ==============================

Desenvolvedor sênior especializado em arquitetura, correção e otimização
de plataformas SaaS com foco em alta disponibilidade, escalabilidade e
estabilidade operacional.

Atuação estratégica na identificação e correção de falhas críticas em
sistemas web, incluindo erros HTTP (400, 401, 403, 404, 422, 500, 502,
503), falhas de autenticação, problemas de integração com APIs externas
e inconsistências de banco de dados.

Especialista em:

-   Debug avançado de aplicações Front-end (React, Next.js) e Back-end
    (Node.js, Edge Functions)
-   Correção de falhas em deploy (Vercel, CI/CD, GitHub)
-   Diagnóstico de problemas em Supabase e PostgreSQL
-   Análise de logs, stack traces e monitoramento de performance
-   Correção de falhas em variáveis de ambiente e autenticação JWT
-   Ajustes em políticas de segurança (RLS, permissões e roles)

Foco em estabilidade, redução de downtime e melhoria contínua da
experiência do usuário final.

============================== VERSÃO DETALHADA (TÉCNICA E COMPLETA)
==============================

Desenvolvedor experto com alta capacidade analítica para visualização
sistêmica de erros, bugs estruturais e inconsistências em arquiteturas
SaaS modernas.

Especialista em:

1.  DEBUG E CORREÇÃO DE ERROS

-   Análise de requisições e respostas HTTP
-   Correção de erros 400, 401, 403, 404, 422, 500, 502 e 503
-   Diagnóstico de conflitos CORS
-   Identificação de falhas em autenticação e autorização
-   Correção de falhas em Edge Functions e Serverless
-   Mapeamento de stack trace e logs estruturados
-   Identificação de gargalos de performance

2.  BANCO DE DADOS E SEGURANÇA

-   PostgreSQL e Supabase avançado
-   Correção e modelagem de RLS (Row Level Security)
-   Ajuste de roles e permissões
-   Otimização de queries
-   Validação de integridade de dados

3.  DESENVOLVIMENTO E MELHORIA DE INTELIGÊNCIAS ARTIFICIAIS

-   Integração com APIs de modelos de linguagem
-   Estruturação técnica de prompts
-   Otimização de contexto e tokens
-   Melhoria de precisão e coerência de respostas
-   Correção de falhas em processamento de áudio e texto
-   Sistemas de extração estruturada de dados (ex: parsing de fichas
    técnicas)
-   Redução de custo por requisição
-   Robustez contra falhas inesperadas

4.  ARQUITETURA E ESCALABILIDADE

-   Estruturação de SaaS escalável
-   Otimização de tempo de resposta
-   Melhoria da experiência do usuário
-   Auditoria técnica preventiva

Perfil orientado a diagnóstico profundo, solução definitiva de problemas
e melhoria contínua da inteligência do sistema.
