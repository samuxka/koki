# Koki — Documentação de Arquitetura

O **Koki** é um SaaS multi-tenant desenvolvido com foco em confeitarias, pastelarias e padarias de pequeno e médio porte.

---

## 1. Topologia do Sistema

O monorepo Koki adota a separação estrita entre apresentação, lógica de domínio e persistência:

```
koki/
├── apps/
│   ├── mobile/         # Aplicativo React Native (Expo SDK 52+, Expo Router, Zustand, TanStack Query)
│   └── api/            # API REST NestJS (MongoDB Atlas / Mongoose, JWT + Refresh Tokens rotativos)
├── packages/
│   ├── types/          # Interfaces, Enums e Tipos de Domínio compartilhados
│   └── validation/     # Schemas de validação Zod compartilhados
└── docs/               # Documentação técnica e arquitetural
```

---

## 2. Princípios de Segurança & Multi-Tenancy

1. **Multi-tenant por Documento:**
   * Cada registro no MongoDB pertence a uma empresa através do campo `companyId`.
   * O `TenantGuard` global valida no backend a associação do usuário com a empresa ativa (`Membership`).
   * Nenhum parâmetro `companyId` é aceito de maneira cega a partir do cliente.

2. **Precisão Monetária Sem Float:**
   * Todos os valores monetários são armazenados em **cêntimos inteiros** (`amountCents`, `priceCents`, etc.).
   * O aplicativo móvel realiza a formatação visual (`formatCurrency`), garantindo que cálculos de desconto, taxas e troco nunca sofram com imprecisões de ponto flutuante.

3. **Status Operacional vs. Status Financeiro:**
   * O status operacional (`pending`, `in_production`, `ready`, `delivered`, `canceled`) e o status financeiro (`unpaid`, `partial`, `paid`) são totalmente desacoplados.
   * Pedidos podem ser entregues com saldo a receber (ex: pagamento na entrega ou fatura mensal).

4. **Preservação de Preços Históricos:**
   * Os itens do pedido (`OrderItem`) gravam um snapshot do preço unitário pago na época (`unitPriceCents`), garantindo que reajustes no cadastro de produtos não adulterem faturamentos passados.

5. **Idempotência Financeira:**
   * Lançamentos de pagamentos e transações suportam `idempotencyKey` única no banco, prevenindo cobranças duplicadas geradas por quedas de conexão móvel.

---

## 3. Preparação para Plataformas Futuras

### 3.1 Koki Web (Futuro)
* Como o backend em NestJS expõe uma API REST padronizada com contratos em `@koki/types` e validações em `@koki/validation`, o futuro painel Web (Next.js + Tailwind + shadcn/ui) consumirá exatamente os mesmos endpoints sem exigir nenhuma alteração no backend.

### 3.2 Superadmin Independente (Futuro)
* O SaaS Koki possui a constante identificadora estável:
  ```typescript
  export const SAAS_CONFIG = {
    productId: 'koki',
    productName: 'Koki',
    version: '1.0.0',
  };
  ```
* O Superadmin não acessará diretamente o banco MongoDB do Koki. Ele se integrará futuramente via endpoints administrativos autenticados por mTLS ou Service API Keys (exemplo: `POST /api/v1/platform/subscriptions/grant`).
* Estados de conta (`AccountStatus`) e assinatura (`SubscriptionStatus`) já estão modelados e integrados às regras de autorização.

---

## 4. Estrutura de Planos e Entitlements (3 Tiers)

O Koki adota uma estratégia de precificação baseada em 3 planos, posicionando o **Pro** como a opção mais atrativa e de melhor relação custo-benefício, e o **Business** como o plano avançado de automação e escala:

| Funcionalidade / Recurso | Free (0 €) | Pro (9,99 €/mês)* | Business (29,90 €/mês)** |
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
| **Planeador de Produção** | — | Manual | Automático |
| **Planeador de Entrega** | — | Até 30/mês | Ilimitado |
| **Bot WhatsApp** | — | — | Incluído (com franquia) |
| **Gerador de Etiquetas e Lotes** | 10/mês | 300/mês | Ilimitado |
| **Criador de Combos** | 2 | 30 | Ilimitados |

\* *O plano Pro conta com 14 dias de avaliação gratuita e plano anual com 20% de desconto (7,99 €/mês ou 95,88 €/ano).*
\*\* *O plano Business atende operações maiores que demandam automação contínua de fornadas e atendimento via WhatsApp (23,90 €/mês ou 286,80 €/ano).*

