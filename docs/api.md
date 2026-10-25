# Koki — Documentação da API REST

A API do Koki utiliza o prefixo `/api/v1` e disponibiliza documentação interativa Swagger/OpenAPI em:
`http://localhost:3333/api/docs`

---

## 1. Autenticação & Conta

### `POST /api/v1/auth/register`
* **Body:** `{ fullName, email, password, phone? }`
* **Retorno:** `{ accessToken, refreshToken, user: { id, email } }`

### `POST /api/v1/auth/login`
* **Body:** `{ email, password }`
* **Retorno:** `{ accessToken, refreshToken, user: { id, email, currentCompanyId } }`

### `POST /api/v1/auth/refresh`
* **Body:** `{ refreshToken }`
* **Retorno:** Novo par de tokens com rotação e revogação do token anterior.

### `POST /api/v1/auth/logout`
* **Headers:** `Authorization: Bearer <token>`
* **Body:** `{ refreshToken? }`

### `GET /api/v1/users/me`
* Retorna o perfil completo do usuário autenticado e suas preferências.

### `PUT /api/v1/users/me/preferences`
* **Body:** `{ hideValues?: boolean, language?: string, theme?: string }`

---

## 2. Empresas & Onboarding

### `POST /api/v1/companies/onboarding`
* **Body:**
  ```json
  {
    "tradeName": "Doce Sonho Confeitaria",
    "businessType": "confeitaria",
    "currency": "EUR",
    "timezone": "Europe/Lisbon",
    "monthlySalesGoalCents": 300000,
    "initialCashAccountName": "Caixa Físico",
    "initialBalanceCents": 5000
  }
  ```
* **Efeito:** Cria a empresa, atribui papel de `owner` ao usuário, ativa assinatura Free e cria a 1ª caixinha com saldo inicial rastreável.

### `GET /api/v1/companies/current`
* Retorna os detalhes da empresa ativa (`tradeName`, `taxId`, `currency`, `monthlySalesGoalCents`, etc.).

### `PUT /api/v1/companies/current/sales-goal`
* **Body:** `{ "monthlySalesGoalCents": 500000 }`
* Atualiza a meta mensal de vendas.

---

## 3. Dashboard

### `GET /api/v1/dashboard/overview`
* Retorna:
  * Meta mensal, vendas no mês atual, progresso percentual e valor restante
  * Saldo financeiro consolidado
  * Quantidade de pedidos pendentes
  * Pedidos que necessitam de atenção prioritária
  * Histórico recente de pedidos

### `GET /api/v1/dashboard/orders-chart?period=7d|30d|month`
* Retorna série temporal de contagem de pedidos por data.

---

## 4. Pedidos

### `GET /api/v1/orders`
* **Query Params:** `operationalStatus`, `financialStatus`, `search`, `startDate`, `endDate`, `customerId`, `page`, `limit`

### `POST /api/v1/orders`
* **Body:**
  ```json
  {
    "customerId": "65b...",
    "items": [
      {
        "productId": "65c...",
        "productName": "Bolo de Cenoura com Brigadeiro",
        "unitPriceCents": 2200,
        "quantity": 2
      }
    ],
    "discountCents": 400,
    "deliveryFeeCents": 300,
    "deliveryDate": "2026-10-25T15:00:00Z",
    "deliveryMethod": "delivery",
    "notes": "Escrita: Parabéns Sofia!",
    "initialPayment": {
      "cashAccountId": "65d...",
      "amountCents": 2000,
      "paymentMethod": "mbway"
    }
  }
  ```

### `GET /api/v1/orders/:id`
* Retorna os detalhes do pedido e a lista de pagamentos efetuados.

### `PATCH /api/v1/orders/:id/status`
* **Body:** `{ "operationalStatus": "in_production" }`

### `POST /api/v1/orders/:id/payments`
* **Body:** `{ "cashAccountId": "...", "amountCents": 2000, "paymentMethod": "cash", "idempotencyKey": "..." }`
* Registra pagamento parcial ou total com crédito automático na Caixinha escolhida.

---

## 5. Caixa & Caixinhas

### `GET /api/v1/cash/summary`
* Retorna o saldo consolidado, total de entradas, total de saídas e resultado líquido no período.

### `GET /api/v1/cash/accounts`
* Lista todas as caixinhas e reservas da empresa com seus respectivos saldos.

### `POST /api/v1/cash/accounts`
* Criação de nova caixinha.

### `GET /api/v1/cash/transactions`
* Extrato com paginação e filtros por tipo (`income`, `expense`, `transfer`), categoria e caixinha.

### `POST /api/v1/cash/transactions/income`
* Lançamento de entrada avulsa.

### `POST /api/v1/cash/transactions/expense`
* Lançamento de despesa avulsa.

### `POST /api/v1/cash/transactions/transfer`
* Transferência interna entre caixinhas sem alterar o resultado operacional do negócio.

---

## 6. Ferramentas & Entitlements

### `GET /api/v1/entitlements/features`
* Lista permissões e limites liberados para a empresa ativa conforme o plano contratado.

### `POST /api/v1/tools/cost-calculator`
* Cálculo de precificação e formação de preço sugerido (margem sobre venda vs markup sobre custo).

### `POST /api/v1/tools/unit-converter`
* Conversão culinária respeitando densidades específicas de ingredientes (farinha, açúcar, etc.).
