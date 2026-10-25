# KOKI — SaaS de Gestão para Confeitarias, Pastelarias e Padarias

> 📖 **Guia Mestre de Desenvolvimento e Contexto da Sessão:**  
> Consulte o arquivo [**`CONTEXT.md`**](file:///c:/Users/samuk/Documents/koki/CONTEXT.md) para obter o contexto arquitetural completo, regras de negócio inegociáveis, modelo de precificação em 3 planos e diretrizes para agentes de IA e desenvolvedores.

O **Koki** é uma plataforma SaaS especializada no ecossistema gastronômico artesanal (confeitarias, pastelarias, padarias e docerias de pequeno e médio porte), desenhada em **Flat Design** com paleta quente e acolhedora inspirada no universo da confeitaria.

---

## 🚀 Tecnologias

### Mobile (`apps/mobile`)
* **React Native & Expo (SDK 57)**
* **Expo Router** (Roteamento baseado em arquivos com rotas aninhadas)
* **Zustand** (Gerenciamento global de sessão e preferências)
* **TanStack Query** (Cache inteligente e sincronização da API)
* **React Native SVG & Lucide Icons**
* **Expo SecureStore** (Armazenamento seguro de tokens com rotação)
* **Flat Design System** (Botões, inputs monetários com cêntimos inteiros, cards, barras de progresso, badges)

### Backend (`apps/api`)
* **Node.js & NestJS** (TypeScript estrito)
* **MongoDB & Mongoose** (Suporte ao MongoDB Atlas e fallback dev automático)
* **OpenAPI / Swagger** (`/api/docs`)
* **JWT & Refresh Tokens rotativos e revogáveis**
* **Multi-tenancy rigoroso com TenantGuard e RolesGuard**
* **Validação com Zod e class-validator**

### Pacotes Compartilhados
* **`@koki/types`**: Interfaces de domínio, enums e DTOs
* **`@koki/validation`**: Schemas Zod de validação de formulários e payloads

---

## 🎨 Identidade Visual (Flat Design)

| Cor | Código | Aplicação |
|---|---|---|
| **Marrom Principal** | `#663c00` | Botões principais, navegação e destaques |
| **Marrom Escuro** | `#33220A` | Textos principais e títulos |
| **Caramelo** | `#cc9a52` | Gráficos, ícones e detalhes |
| **Bege Dourado** | `#ffd599` | Elementos secundários |
| **Creme** | `#fff6e9` | Fundo principal da aplicação |
| **Vermelho** | `#c2312a` | Erros, cancelamentos e saídas |
| **Verde** | `#009933` | Sucesso, quitados e entradas |

---

## 📁 Estrutura do Monorepo

```text
koki/
├── apps/
│   ├── mobile/            # Aplicativo React Native (Expo Router)
│   │   ├── app/           # Rotas: (auth), (onboarding), (tabs), orders, cash, profile, settings
│   │   └── src/           # Design System, Stores, Services, Theme
│   │
│   └── api/               # Backend NestJS
│       └── src/
│           ├── common/    # Guards, Filters, Interceptors, Decorators, Utils
│           ├── config/    # Configurações de ambiente
│           ├── database/  # Conexão Mongoose (Atlas / Dev Memory Fallback)
│           └── modules/   # auth, users, companies, memberships, dashboard, orders, cashflow, products, customers, tools, entitlements
│
├── packages/
│   ├── types/             # Tipagem estrita de domínio
│   └── validation/        # Schemas Zod compartilhados
│
├── docs/                  # Documentação de arquitetura e API REST
└── README.md
```

---

## ⚡ Como Executar Localmente

### 1. Instalar as Dependências
Na raiz do projeto:
```bash
npm install
```

### 2. Rodar a API Backend NestJS
```bash
npm run dev:api
```
* **API REST:** `http://localhost:3333/api/v1`
* **Swagger OpenAPI:** `http://localhost:3333/api/docs`

> **Nota sobre o MongoDB:** Caso a variável `MONGODB_URI` não esteja configurada no arquivo `.env`, a API inicializará automaticamente um servidor MongoDB em memória para desenvolvimento imediato com persistência real em tempo de execução. Para conectar ao **MongoDB Atlas**, basta preencher a variável `MONGODB_URI` em `apps/api/.env`.

### 3. Rodar o Aplicativo Mobile (Expo)
Em outro terminal:
```bash
npm run dev:mobile
```
* Pressione `w` para abrir no navegador web
* Pressione `a` para rodar no emulador Android
* Pressione `i` para rodar no simulador iOS
* Escaneie o QR Code com o aplicativo **Expo Go** no celular físico
