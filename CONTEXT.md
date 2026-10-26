# KOKI — CONTEXTO MESTRE DA SESSÃO & GUIA DEFINITIVO DO AGENTE

> **DIRETIVA OBRIGATÓRIA PARA QUALQUER AGENTE INICIANDO UMA NOVA SESSÃO:**  
> **LEIA ESTE ARQUIVO INTEGRALMENTE ANTES DE ESCREVER OU EDITAR QUALQUER LINHA DE CÓDIGO.**  
> Este documento é a única fonte da verdade (*single source of truth*) do projeto Koki. Ele contém todas as decisões técnicas, regras de negócio inegociáveis, padrões visuais, modelo de monetização, estado atual do código e o roadmap exato dos próximos passos.

---

## 1. Visão Geral do Produto

O **Koki** é um SaaS empresarial B2B especializado na gestão operacional e financeira de **confeitarias, pastelarias e padarias** de pequeno e médio porte.

### Escopo Atual Rigoroso:
- **O que DESENVOLVER agora:**
  1. **Aplicativo Mobile:** React Native com Expo SDK 57 (Expo Router 54, React 19.2.3, TypeScript estrito).
  2. **API Backend REST:** NestJS 10 com persistência real em MongoDB Atlas (Mongoose).
- **O que NÃO DESENVOLVER agora (Fora de escopo atual):**
  - **Koki Web** (painel web do lojista) e **Superadmin** (painel global da plataforma).
  - O código do Mobile e da API deve ser 100% autônomo, desacoplado e funcional por si só, mantendo arquitetura multi-tenant limpa e pronta para receber futuras interfaces administrativas.

---

## 2. Checklist Rápido de Inicialização da Sessão (Para o Agente)

Sempre que iniciar uma nova sessão ou receber uma nova tarefa, siga este fluxo:

1. **Verificar Ambiente:**
   - Raiz do projeto: `c:\Users\samuk\Documents\koki`.
   - Node: `v22.17.0+` | Gerenciador: `npm 11+`.
   - Backend ativo: `npm run dev:api` (porta `3333`).
   - Mobile ativo: `npm run dev:mobile` (Metro na porta `8081`).
2. **Conexão com Banco de Dados:**
   - O backend se conecta diretamente ao **MongoDB Atlas** configurado em `apps/api/.env`.
   - Teste de conexão validado: `CONNECTED_OK`.
3. **Se editar pacotes compartilhados (`@koki/types` ou `@koki/validation`):**
   - Execute o build do workspace:
     ```bash
     npm run build --workspace=@koki/types
     npm run build --workspace=@koki/validation
     ```
4. **Após qualquer alteração de código:**
   - Valide se a tipagem estrita continua 100% íntegra (0 erros):
     ```bash
     npx tsc --noEmit -p apps/api
     npx tsc --noEmit -p apps/mobile
     ```
   - Nunca entregue código com erros no compilador TypeScript.

---

## 3. Regras de Negócio e Arquitetura Inegociáveis

1. **Multi-tenancy Rigoroso por Documento:**
   - Todos os dados operacionais (pedidos, clientes, produtos, transações, caixas) pertencem a uma empresa via `companyId: Types.ObjectId`.
   - O backend protege as rotas através de `TenantGuard`, que verifica se o usuário autenticado via JWT possui `Membership` ativa naquela empresa.
   - O cliente mobile (`apps/mobile/src/services/api.ts`) injeta automaticamente o cabeçalho `x-company-id`.
   - **Regra:** Nunca confie em `companyId` vindo do corpo da requisição sem validação do guard.

2. **Precisão Monetária Sem Ponto Flutuante (Cêntimos Inteiros):**
   - **Regra:** Todos os campos financeiros no banco de dados e nos DTOs da API são gravados em **cêntimos inteiros** (`amountCents`, `priceCents`, `remainingCents`, `balanceCents`).
   - Exemplo: 15,50 € é armazenado como `1550`. 0,00 € é armazenado como `0`.
   - **Nunca use floats para dinheiro no banco.** A formatação visual (`15,50 €`) é de responsabilidade exclusiva do cliente através da função `formatCurrency(cents)`.

3. **Independência entre Status Operacional e Financeiro:**
   - O fluxo de produção (`operationalStatus`: `pending`, `in_production`, `ready`, `delivered`, `canceled`) e o fluxo financeiro (`financialStatus`: `unpaid`, `partial`, `paid`) são totalmente desacoplados.
   - Um pedido pode ser marcado como entregue mesmo com pagamento pendente (ex: pagamento na entrega ou fatura semanal/mensal).

4. **Congelamento de Preços Históricos:**
   - Cada item de um pedido (`OrderItem`) congela o `unitPriceCents` no momento da criação do pedido. Alterações posteriores no catálogo de produtos nunca alteram os dados históricos de pedidos fechados.

5. **Nenhum Mock / 100% Persistência Real:**
   - Não crie endpoints falsos com dados fixos em memória. Todos os módulos (Auth, Empresas, Onboarding, Pedidos, Finanças, Clientes, Produtos, Ferramentas) persistem e consultam o MongoDB Atlas real.

---

## 4. Identidade Visual e Design System (Flat Design)

O Koki utiliza **Flat Design** sofisticado, sem sombras pesadas ou skeumorfismo, com paleta de cores acolhedora inspirada no universo da confeitaria:

### 4.1 Paleta Oficial de Cores
- **Marrom Principal (`#663c00`):** Botões principais, cabeçalhos de destaque, ícones de navegação ativa.
- **Marrom Escuro (`#33220A`):** Títulos, textos primários e elementos de alto contraste.
- **Caramelo (`#cc9a53`):** Linhas de gráficos, badges secundários, acentos e destaques Pro.
- **Bege Dourado (`#ffd599`):** Badges informativos, chips selecionados e avisos leves.
- **Creme de Fundo (`#fff6e9`):** Cor padrão de fundo de todas as telas (`backgroundColor`).
- **Branco Puro (`#ffffff`):** Fundo de todos os cartões, modais e inputs em Flat Design.
- **Cinza Borda (`#f0e0cc`):** Bordas sutis em cartões e divisórias.
- **Verde Sucesso (`#009933`):** Entradas financeiras, pedidos entregues/pagos e lucros.
- **Vermelho Despesa (`#c2312a`):** Saídas de caixa, cancelamentos e erros.

### 4.2 Componentes Oficiais de Marca (`apps/mobile/src/components/ui/`)
- **`KokiCookie`:** Renderiza apenas o ícone do cookie ('o' do logo com mordida e gotas de chocolate).
- **`KokiLogo`:** Renderiza a logo completa com a tipografia e o cookie.
- **Variantes disponíveis:** `'brown' | 'darkBrown' | 'lightBrown' | 'bege' | 'white'`.
- **Arquivos SVG fonte:** Organizados em `apps/mobile/assets/svg/` (`*-cookie.svg` e `*-logo.svg`).
- **Ícones do App:** `apps/mobile/assets/icon.png` e `adaptive-icon.png` (1024x1024 em vetor nítido com fundo `#fff6e9`).

---

## 5. Regras Críticas de Layout Mobile (Safe Area & Viewport)

Para garantir visual perfeito em celulares físicos (especialmente iPhones com Dynamic Island / Notch e Androids modernos):

1. **Cabeçalho (Status Bar / Entalhe Superior):**
   - **Nunca use `paddingTop` estático pequeno (ex: 12px) no cabeçalho.**
   - Importe `useSafeAreaInsets()` de `react-native-safe-area-context`.
   - **Fórmula padrão obrigatória:** `paddingTop: Math.max(insets.top, 20) + 8`.
   - Já implementado em: `Header.tsx`, `(tabs)/orders.tsx`, `(tabs)/cash.tsx`, `(tabs)/tools.tsx`.

2. **Barra de Abas (Bottom Bar / Home Indicator):**
   - Na barra inferior (`apps/mobile/app/(tabs)/_layout.tsx`), nunca fixe `height: 60`.
   - Calcule a altura somando `insets.bottom`:
     ```typescript
     const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
     const tabHeight = (Platform.OS === 'ios' ? 52 : 58) + bottomPadding;
     ```
   - Isso impede que a linha do indicador de gestos do iOS corte as palavras "Pedidos" ou "Caixa".

3. **Cartões e Tipografia em Flat Design:**
   - Em `Card.tsx`, o padding padrão é `14px` e `marginBottom: 8px` (evita cartões inchados que empurram o conteúdo para fora da tela).
   - Valores monetários em destaque no topo usam `fontSize: 24`, `fontWeight: '800'` e `letterSpacing: -0.5`.

4. **Resolução de IP Dinâmica no Celular Físico:**
   - Em `apps/mobile/src/services/api.ts`, a URL da API é detectada automaticamente por `Constants.expoConfig?.hostUri`.
   - Isso permite rodar o Expo Go em um celular físico conectado na mesma rede Wi-Fi, conectando ao backend no IP local (ex: `192.168.1.118:3333`) sem falhas de `localhost`.

---

## 6. Modelo de Precificação SaaS em 3 Planos (Free, Pro, Business)

O Koki é comercializado em 3 patamares, com o **Pro** como a opção mais atrativa e o **Business** para operações avançadas:

### 6.1 Tabela de Planos e Preços
| Plano | Preço Mensal | Preço Anual (-20%) | Posicionamento & Proposta |
| :--- | :--- | :--- | :--- |
| **Free** | **0 €** | 0 € | Ferramentas essenciais com limites para começar a digitalizar. |
| **Pro** | **9,99 €/mês** | **7,99 €/mês** *(95,88 €/ano)* | **Mais Popular • Melhor Valor.** Gestão completa do dia a dia. Inclui **14 dias de teste grátis**. |
| **Business** | **29,90 €/mês** | **23,90 €/mês** *(286,80 €/ano)* | **Automação Avançada & Escala.** Custa aprox. 3x o Pro. Produção inteligente e integração WhatsApp. |

### 6.2 Comparação Completa de Funcionalidades e Limites
| Funcionalidade | Free (0 €) | Pro (9,99 €/mês) | Business (29,90 €/mês) |
| :--- | :--- | :--- | :--- |
| **Receitas & Fichas Técnicas** | 10 | 100 | Ilimitadas |
| **Itens no Estoque** | 20 itens | 300 itens | Ilimitado |
| **Lista de Compras** | Manual | Automática | Automática |
| **Produtos Cadastrados** | 5 | 100 | Ilimitados |
| **Clientes Cadastrados** | 20 | 500 | Ilimitados |
| **Cupons de Desconto** | — | 10 ativos | Ilimitados |
| **Calculadora de Custos** | Sim | Sim | Sim |
| **Conversor de Medidas** | Sim | Sim | Sim |
| **Escalonador de Receitas** | Sim | Sim | Sim |
| **Planeador de Produção** | — | Manual | Automático inteligente |
| **Planeador de Entrega** | — | Até 30/mês | Ilimitado |
| **Bot WhatsApp** | — | — | Incluído* (com franquia) |
| **Gerador de Etiqueta e Lote** | 10/mês | 300/mês | Ilimitado |
| **Criador de Combos** | 2 | 30 | Ilimitados |

### 6.3 Estrutura de Código dos Planos
- **Definição de Tipos:** `SubscriptionTier = 'free' | 'pro' | 'business'`, `PlanLimits` e constante `KOKI_PLANS` em `packages/types/src/index.ts`.
- **Backend API:** Endpoints `GET /api/v1/entitlements/plans` e `POST /api/v1/entitlements/upgrade` em `apps/api/src/modules/entitlements/`.
- **Mobile:** Modal interativo de conversão `PlansModal.tsx` (`apps/mobile/src/components/PlansModal.tsx`) com toggle Mensal/Anual e tabela comparativa retrátil, integrado em `(tabs)/tools.tsx` e `profile.tsx`.

---

## 7. Módulos Implementados e Arquitetura do Backend

Todos os módulos estão em `apps/api/src/modules/`:

| Módulo | Prefixo de Rota | Responsabilidade Principal |
| :--- | :--- | :--- |
| **Auth** | `/api/v1/auth` | Cadastro de usuário, login JWT, rotação de refresh token, logout. |
| **Users** | `/api/v1/users` | Perfil do confeiteiro, preferências (modo de privacidade de saldos). |
| **Companies** | `/api/v1/companies` | Onboarding em 3 etapas (Dados da loja, moeda, metas de vendas, 1ª caixinha). |
| **Memberships**| `/api/v1/memberships` | Vínculo entre usuário e empresa com papéis (`owner`, `admin`, `staff`). |
| **Entitlements**| `/api/v1/entitlements` | Catálogo de planos, limites de recursos, verificação e upgrade de plano. |
| **Dashboard** | `/api/v1/dashboard` | Resumo financeiro, progresso da meta mensal e pedidos urgentes. |
| **Orders** | `/api/v1/orders` | Numeração sequencial (#1001), itens de pedido, pagamentos parciais, status. |
| **Cashflow** | `/api/v1/cash` | Múltiplas caixinhas, extrato paginado, transferências entre caixas e fluxo. |
| **Customers** | `/api/v1/customers` | Cadastro de clientes, contatos, total gasto e histórico de pedidos. |
| **Products** | `/api/v1/products` | Produtos simples e combos com desconto. |
| **Inventory**| `/api/v1/inventory`| Catálogo de insumos, matérias-primas, movimentações e lista de compras inteligente. |
| **Tools** | `/api/v1/tools` | Calculadora de custos e conversor de medidas gastronômicas. |

---

## 8. Telas Implementadas no Aplicativo Mobile

Todas as rotas usam Expo Router em `apps/mobile/app/`:

| Rota | Descrição da Tela |
| :--- | :--- |
| `(auth)/login.tsx` | Tela de login limpa com logo oficial e tratamento de erros. |
| `(auth)/register.tsx` | Cadastro de novos usuários. |
| `(onboarding)/index.tsx` | Fluxo guiado em 3 passos: Empresa -> Meta Financeira -> 1ª Caixinha. |
| `(tabs)/index.tsx` | Dashboard com meta mensal, saldo consolidado, gráfico e pedidos críticos. |
| `(tabs)/orders.tsx` | Gestão de encomendas com busca, filtros de status e cards informativos. |
| `(tabs)/cash.tsx` | Gestão financeira, saldo de caixinhas e extrato de entradas/saídas. |
| `(tabs)/tools.tsx` | Hub de ferramentas operacionais com modais e upgrade de planos. |
| `orders/new.tsx` | Formulário ágil de criação de nova encomenda. |
| `orders/[id].tsx` | Detalhes do pedido, recebimento de pagamentos e avanço de produção. |
| `cash/new-transaction.tsx` | Lançamento de receita, despesa ou transferência entre caixas. |
| `cash/accounts.tsx` | Criação e acompanhamento de caixinhas de reserva. |
| `inventory/index.tsx` | Visão geral do estoque com métricas, busca, filtros de categoria e alertas. |
| `inventory/new.tsx` | Cadastro de novo insumo com calculadora de custo por embalagem. |
| `inventory/[id].tsx` | Detalhes do insumo, extrato completo de movimentações e ações de entrada/saída. |
| `recipes/index.tsx` | Catálogo de receitas e fichas técnicas com métricas, busca e filtros. |
| `recipes/new.tsx` | Cadastro de ficha técnica com Baker's %, insumos, custos adicionais e passos. |
| `recipes/[id].tsx` | Detalhes da ficha com escalonador proporcional (0.5x, 1x, 2x...), checklist e margem. |
| `recipes/edit/[id].tsx` | Edição completa da ficha técnica e ingredientes vinculados. |
| `shopping-list/index.tsx` | Lista de compras inteligente com checklist para supermercado, itens em falta e entrada no estoque. |
| `production-planner/index.tsx` | Planejador diário de produção com cronograma de fornadas, demandas consolidadas, insumos necessários e avanço de pedidos. |
| `delivery-planner/index.tsx` | Planejador diário de entregas com rotas por turnos, deep links Waze/Google Maps, contato WhatsApp, valores a cobrar e atribuição de motoristas. |
| `recipe-scaler/index.tsx` | Escalonador profissional de receitas por rendimento/multiplicador, tamanho de forma (Cake Pan Scaling) e Baker's Percentage com recalculo de custos e envio via WhatsApp. |
| `profile.tsx` | Perfil do confeiteiro, plano ativo com botão de upgrade e logout. |
| `settings.tsx` | Configurações gerais e modo de privacidade. |

---

## 9. Próximos Módulos a Serem Desenvolvidos (Roadmap de Execução)

Para continuar o desenvolvimento nas próximas sessões, implemente os módulos a seguir na ordem de prioridade estabelecida:

### Prioridade 1: Gestão de Receitas e Fichas Técnicas (`recipes`) — CONCLUÍDO ✅
- **Backend:**
  - `apps/api/src/modules/recipes/` (schema, service, controller, DTOs).
  - Campos: Nome da receita, categoria, rendimento, tempo de preparo, tempo de forno, temperatura, modo de preparo.
  - Tabela de ingredientes com: insumo vinculado (`inventoryItemId`), quantidade em gramas/ml, custo unitário e Baker's Percentage (percentual do padeiro baseado no peso da farinha).
  - Custos adicionais estruturados: embalagem, mão de obra, energia/gás e margem bruta sugerida.
  - Cálculo automático do custo total da receita e custo por fatia/unidade.
  - Verificação de limites do plano: Free (10), Pro (100), Business (Ilimitado).
- **Mobile:**
  - Telas em `apps/mobile/app/recipes/`: catálogo de receitas com filtro por categoria, criação/edição com adição dinâmica de ingredientes, escalonador proporcional (`0.5x`, `1x`, `2x`, `3x` e personalizado) e checklist interativo de passos na cozinha.

### Prioridade 2: Estoque de Insumos e Ingredientes (`inventory`) — CONCLUÍDO ✅
- **Backend:**
  - Criado `apps/api/src/modules/inventory/`.
  - Catálogo de matérias-primas: Farinhas, ovos, chocolates, manteigas, embalagens, fitas.
  - Unidades: `g`, `kg`, `ml`, `l`, `un`.
  - Custo médio ponderado por unidade e estoque mínimo para alerta de reposição.
  - Lista de compras inteligente: no plano Pro/Business, gera sugestão automática de compras baseada nos pedidos da semana e ingredientes em falta.
  - Verificação de limites: Free (20 itens), Pro (300 itens), Business (Ilimitado).
- **Mobile:**
  - Tela de estoque com badges de alerta vermelho para itens abaixo do mínimo e botão "Gerar Lista de Compras".

### Prioridade 3: Planeador de Produção Diária (`production_planner`) — CONCLUÍDO ✅
- **Backend:**
  - Criado `apps/api/src/modules/production-planner/` (schema `ProductionBatch`, service, controller e module).
  - `GET /production-planner/daily?date=YYYY-MM-DD`: consolida todos os pedidos do dia, agrega demandas de produtos com sabores/complementos, calcula insumos necessários a partir das fichas técnicas vinculadas e compara com o estoque real identificando faltas.
  - `POST /production-planner/auto-generate`: algoritmo inteligente que agrupa produtos por categoria/processo (forno com temperatura e tempo, fogão/caldas e montagem/decoração final).
  - `POST /production-planner/batches`, `PUT`, `PATCH toggle`, `DELETE`: controle completo de fornadas e lotes com checklist de conclusão na cozinha.
  - `PATCH /production-planner/orders/:orderId/status`: atualização instantânea do status do pedido com 1 toque.
- **Mobile:**
  - Tela `apps/mobile/app/production-planner/index.tsx` com navegação por data (Hoje, Amanhã, setas), KPIs consolidados com barra de progresso visual, 4 abas interativas (Fornadas, Demandas, Insumos, Pedidos), geração automática com 1 clique, envio do resumo formatado para o WhatsApp (`Share.share`) e integração direta para adicionar insumos em falta à Lista de Compras.

### Prioridade 4: Planeador de Entregas (`delivery_planner`) — CONCLUÍDO ✅
- **Backend:**
  - Criado `apps/api/src/modules/delivery-planner/` (schema `DeliveryItem`, service, controller e module).
  - `GET /delivery-planner/daily?date=YYYY-MM-DD`: auto-sincroniza pedidos de entrega agendados para a data com dados do cliente e endereço, agrupa por turnos (`morning`, `afternoon`, `evening`, `anytime`), calcula o somatório de fretes e de valores a cobrar na entrega (`remainingAmountCents`).
  - `POST /delivery-planner`, `PUT`, `DELETE`: gestão de paradas personalizadas e controle de limites SaaS (30 no Pro, ilimitado no Business).
  - `PATCH /delivery-planner/:id/status`: avanço de status da rota (`out_for_delivery` e `delivered`). Quando entregue, sincroniza e conclui o pedido automaticamente!
  - `PATCH /delivery-planner/:id/driver`: atribuição rápida de motorista/entregador.
- **Mobile:**
  - Tela `apps/mobile/app/delivery-planner/index.tsx` com navegação por data, KPIs de progresso da rota, fretes faturados e valores a cobrar na porta do cliente.
  - Abas por turno (Todas, Manhã, Tarde, Noite).
  - Ações rápidas por parada com 1 toque: **Google Maps**, **Waze**, **WhatsApp do cliente com mensagem pré-formatada** e **Ligação telefônica**.
  - Compartilhamento do roteiro/romaneio completo com o motoboy via WhatsApp (`Share.share`).

### Prioridade 5: Gerador de Etiquetas & Lotes (`labels`) — CONCLUÍDO ✅
- **Backend:**
  - Criado `apps/api/src/modules/labels/` (schema `LabelBatch`, service, controller e module).
  - Multi-tenancy isolado por `companyId` com controle de quotas mensais por plano (Free: 10/mês, Pro: 300/mês, Business: Ilimitado).
  - `GET /labels/batches`: listagem paginada com busca por código de lote ou produto, e filtros de validade (Todos, Válidos, A Vencer, Vencidos).
  - `GET /labels/quota`: consumo mensal atual vs limites do plano SaaS.
  - `POST /labels/batches`: emissão de novos lotes com código sequencial automático (`LOT-AAAAMMDD-001`), cálculo de validade e especificações sanitárias.
  - `GET /labels/batches/:id/html`: geração de HTML profissional formatado com regras CSS `@page` para rolos de etiquetas térmicas (50x30mm, 60x40mm, 80x50mm) e impressão A4.
  - `PATCH /labels/batches/:id/status` e `DELETE /labels/batches/:id`.
- **Mobile:**
  - Telas em `apps/mobile/app/labels/`:
    - `index.tsx`: Dashboard de franquia mensal com barra de progresso, atalho de upgrade Pro, busca e cards informativos com compartilhamento direto.
    - `new.tsx`: Formulário completo com importação ágil de receitas e produtos existentes, atalhos de validade (+3d, +5d, +7d...), seleção de armazenamento, alérgenos regulatórios e **Pré-visualização Interativa em Tempo Real** do rótulo com código de barras visual.
    - `[id].tsx`: Detalhes completos do lote, visualização de impressão e compartilhamento via WhatsApp (`Share.share`).

### Prioridade 6: Carregamento das Páginas com Skeletons Shimmer — CONCLUÍDO ✅
- Removido o bounce do biscoito do carregamento das páginas.
- Implementado sistema de Skeleton (`Skeleton.tsx` e `LoadingState.tsx`) com animação fluida de shimmer/pulso Flat Design nos tons suaves da confeitaria (`#ebdccb` / `#f0e4d4`).
- Suporte a variantes inteligentes: `list`, `dashboard`, `detail` e cards.

### Prioridade 7: Automações e WhatsApp Bot (Plano Business)
- Envio automático de recibos e notificações de "Pedido Pronto para Retirada".

---

## 10. Guia de Comandos Úteis

Execute a partir da raiz do repositório (`c:\Users\samuk\Documents\koki`):

```bash
# Iniciar a API Backend (porta 3333):
npm run dev:api

# Iniciar o Expo Mobile (porta 8081):
npm run dev:mobile

# Recompilar pacotes compartilhados (obrigatório se alterar @koki/types ou @koki/validation):
npm run build --workspace=@koki/types
npm run build --workspace=@koki/validation

# Verificar se não há nenhum erro de TypeScript no projeto todo:
npx tsc --noEmit -p apps/api
npx tsc --noEmit -p apps/mobile

# Diagnóstico de integridade do Expo:
npx expo-doctor --prefix apps/mobile
```

---

> **Lembrete Final:** Mantenha sempre a estética Flat Design, preserve o tratamento de Safe Area nos novos cabeçalhos e nunca use valores flutuantes para valores monetários.
