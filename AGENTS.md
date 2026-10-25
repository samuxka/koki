# KOKI — INSTRUÇÕES DO AGENTE

> **ATENÇÃO:**  
> O arquivo principal de contexto e regras deste repositório é o [CONTEXT.md](file:///c:/Users/samuk/Documents/koki/CONTEXT.md).  
> **Leia o `CONTEXT.md` na íntegra antes de iniciar qualquer trabalho.**

---

## Regras Fundamentais em Resumo

1. **Escopo Vigente:**
   - Apenas **Mobile** (`apps/mobile`) e **API Backend** (`apps/api`).
   - Não desenvolva Web ou Superadmin agora.

2. **Multi-tenancy:**
   - Todos os dados isolados por `companyId`. Validação obrigatória pelo `TenantGuard` no backend e envio de `x-company-id` no mobile.

3. **Valores Monetários:**
   - Sempre em **cêntimos inteiros** (`amountCents`, `priceCents`). Nunca use números com ponto flutuante no banco de dados ou DTOs.

4. **Estilo & Layout:**
   - Flat Design limpo com paleta da confeitaria (`#663c00`, `#fff6e9`, etc.).
   - Em novos cabeçalhos mobile: utilize sempre `useSafeAreaInsets()` com `paddingTop: Math.max(insets.top, 20) + 8` para evitar conflito com entalhe/Dynamic Island.
   - Na barra de abas inferior: inclua `insets.bottom` para não sobrepor o indicador de gestos do iOS.

5. **Qualidade de Código:**
   - Tipagem estrita: execute `npx tsc --noEmit -p apps/api` e `npx tsc --noEmit -p apps/mobile`. O resultado deve ser **0 erros**.
   - Persistência 100% real no MongoDB Atlas; sem mocks fixos em memória.

Consulte [CONTEXT.md](file:///c:/Users/samuk/Documents/koki/CONTEXT.md) para o roadmap completo dos próximos módulos (Receitas, Estoque de Insumos, Planeador de Produção, Entregas) e detalhes dos planos SaaS (Free, Pro, Business).
