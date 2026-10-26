// Identification for the SaaS product
export const SAAS_CONFIG = {
  productId: 'koki',
  productName: 'Koki',
  version: '1.0.0',
} as const;

// Account & Subscription Statuses
export type AccountStatus =
  | 'active'
  | 'suspended'
  | 'pending_verification'
  | 'deactivated';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export type BusinessType = 'confeitaria' | 'padaria' | 'pastelaria' | 'outro';

export type UserRole = 'owner' | 'admin' | 'staff';

// User Preferences
export interface UserPreferences {
  hideValues: boolean;
  language: string;
  theme: 'light' | 'dark';
}

// User Profile
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  currentCompanyId?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

// Company
export interface Company {
  id: string;
  tradeName: string;
  legalName?: string;
  businessType: BusinessType;
  taxId?: string;
  currency: string;
  timezone: string;
  monthlySalesGoalCents: number;
  status: AccountStatus;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: Address;
  createdAt: string;
  updatedAt: string;
}

// Membership
export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  permissions: string[];
  createdAt: string;
}

// Address
export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
}

// Loyalty Card
export interface LoyaltyCard {
  enabled: boolean;
  targetOrders: number;
  reward?: string;
  currentOrders?: number;
  progressPercent?: number;
  completedCycles?: number;
}

export interface CustomerTopProduct {
  productId?: string;
  productName: string;
  quantity: number;
  totalSpentCents: number;
}

// Customer
export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: Address;
  notes?: string;
  photoUrl?: string;
  loyaltyCard?: LoyaltyCard;
  totalOrdersCount: number;
  totalSpentCents: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerDetailResponse {
  customer: Customer;
  stats: {
    totalOrdersCount: number;
    totalSpentCents: number;
    averageTicketCents: number;
    topProduct: CustomerTopProduct | null;
  };
  loyaltyCard: LoyaltyCard;
  recentOrders: Order[];
}

export type CustomerSortBy = 'ranking' | 'orders' | 'newest' | 'oldest' | 'name';
export type CustomerFilterType = 'all' | 'with_orders' | 'without_orders' | 'loyalty_active';

export type ProductUnit =
  | 'unit'
  | 'kg'
  | 'hundred'
  | 'portion'
  | 'unidade'
  | 'cento'
  | 'fatia'
  | 'porcao'
  | 'porção'
  | 'caixa'
  | string;

export interface ProductIngredientCost {
  name: string;
  costCents: number;
}

export interface ProductComplement {
  name: string;
  additionalPriceCents: number;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  unit: ProductUnit;
  priceCents: number;
  costCents: number;
  profitMarginPercent?: number;
  monthlySalesGoalUnits?: number;
  ingredients?: ProductIngredientCost[];
  flavors?: string[];
  complements?: ProductComplement[];
  notes?: string;
  isAvailable: boolean;
  isCombo?: boolean;
  recipeId?: string;
  totalOrdersCount?: number;
  totalUnitsSold?: number;
  totalRevenueCents?: number;
  createdAt: string;
  updatedAt?: string;
}

export type ProductPeriodFilter = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface ProductChartPoint {
  label: string;
  ordersCount: number;
  unitsSold: number;
  revenueCents: number;
}

export interface ProductDetailResponse {
  product: Product;
  metrics: {
    totalUnitsSold: number;
    totalOrdersCount: number;
    totalRevenueCents: number;
    totalCostCents: number;
    totalProfitCents: number;
    profitMarginPercentage: number;
    monthlyGoal: {
      targetUnits: number;
      soldThisMonth: number;
      progressPercentage: number;
      remainingUnits: number;
    } | null;
  };
  chartData: ProductChartPoint[];
  recentOrders: {
    id: string;
    orderNumber: number;
    customerName: string;
    deliveryDate: string;
    quantity: number;
    subtotalCents: number;
    operationalStatus: OperationalStatus;
  }[];
}

export type ProductSortBy = 'popular' | 'revenue' | 'price_high' | 'price_low' | 'newest' | 'oldest' | 'name';
export type ProductFilterType = 'all' | 'available' | 'unavailable' | 'with_goal';

// Order & Items
export type OperationalStatus =
  | 'pending'
  | 'in_production'
  | 'ready'
  | 'delivered'
  | 'canceled';

export type FinancialStatus = 'unpaid' | 'partial' | 'paid';

export type DeliveryMethod = 'pickup' | 'delivery';

export interface OrderItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  flavor?: string;
  complements?: ProductComplement[];
  notes?: string;
}

export interface Order {
  id: string;
  companyId: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  discountCents: number;
  deliveryFeeCents: number;
  totalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  operationalStatus: OperationalStatus;
  financialStatus: FinancialStatus;
  deliveryDate: string;
  deliveryMethod: DeliveryMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Payment
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mbway'
  | 'pix'
  | 'bank_transfer'
  | 'other';

export interface Payment {
  id: string;
  companyId: string;
  orderId: string;
  cashAccountId: string;
  cashAccountName?: string;
  cashTransactionId?: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  paidAt: string;
}

// Cashflow & Caixinhas
export type CashAccountType =
  | 'cash'
  | 'bank'
  | 'savings'
  | 'tax'
  | 'investment'
  | 'equipment';

export interface CashAccount {
  id: string;
  companyId: string;
  name: string;
  type: CashAccountType;
  icon: string;
  color: string;
  currentBalanceCents: number;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'opening_balance';

export interface CashTransaction {
  id: string;
  companyId: string;
  cashAccountId: string;
  destinationAccountId?: string;
  type: TransactionType;
  category: string;
  description: string;
  amountCents: number;
  date: string;
  orderId?: string;
  paymentId?: string;
  createdBy?: string;
  createdAt: string;
}

// Cash Summary
export interface CashSummary {
  consolidatedBalanceCents: number;
  periodIncomeCents: number;
  periodExpenseCents: number;
  periodNetCents: number;
  accounts: CashAccount[];
}

// Dashboard
export interface DashboardSalesGoal {
  monthlySalesGoalCents: number;
  currentMonthSoldCents: number;
  progressPercentage: number;
  remainingCents: number;
}

export interface DashboardOverview {
  company: {
    id: string;
    tradeName: string;
    currency: string;
  };
  salesGoal: DashboardSalesGoal;
  totalBalanceCents: number;
  pendingOrdersCount: number;
  monthlyOrdersCount: number;
  ordersComparisonPercent: number;
  urgentOrders: Order[];
  recentOrders: Order[];
}

// Entitlements & 3-Tier SaaS Plans
export type SubscriptionTier = 'free' | 'pro' | 'business';

export interface PlanLimits {
  recipesLimit: number; // 10 | 100 | -1 (unlimited)
  inventoryItemsLimit: number; // 20 | 300 | -1
  shoppingListType: 'manual' | 'automatic';
  productsLimit: number; // 5 | 100 | -1
  customersLimit: number; // 20 | 500 | -1
  activeCouponsLimit: number; // 0 | 10 | -1
  costCalculatorEnabled: boolean;
  unitConverterEnabled: boolean;
  productionPlanner: 'none' | 'manual' | 'automatic';
  monthlyDeliveryOrdersLimit: number; // 0 | 30 | -1
  whatsappBotEnabled: boolean;
  whatsappBotAllowance?: number; // Franquia de mensagens mensais
  monthlyLabelsLimit: number; // 10 | 300 | -1
  recipeScalerEnabled: boolean;
  combosLimit: number; // 2 | 30 | -1
  cashAccountsLimit?: number;
  monthlyOrders?: number;
}

export interface Plan {
  id: string;
  code: 'free' | 'pro' | 'business' | 'pro_yearly' | 'business_yearly';
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  description: string;
  badge?: string; // "Mais Popular", "Melhor Valor", "Avançado"
  isPopular?: boolean;
  priceMonthlyCents: number; // 0, 999, 2990
  priceYearlyMonthlyEquivalentCents?: number; // 799, 2390
  priceYearlyTotalCents?: number; // 9588, 28680
  currency: string;
  trialDays?: number; // 14 dias para Pro
  limits: PlanLimits;
  highlights: string[];
}

export const KOKI_PLANS: Record<SubscriptionTier, Plan> = {
  free: {
    id: 'plan_free',
    code: 'free',
    tier: 'free',
    name: 'Free',
    tagline: 'Para começar',
    description: 'Ferramentas essenciais com limites para experimentar e começar o negócio.',
    priceMonthlyCents: 0,
    currency: 'EUR',
    limits: {
      recipesLimit: 10,
      inventoryItemsLimit: 20,
      shoppingListType: 'manual',
      productsLimit: 5,
      customersLimit: 20,
      activeCouponsLimit: 0,
      costCalculatorEnabled: true,
      unitConverterEnabled: true,
      productionPlanner: 'none',
      monthlyDeliveryOrdersLimit: 0,
      whatsappBotEnabled: false,
      monthlyLabelsLimit: 10,
      recipeScalerEnabled: true,
      combosLimit: 2,
      cashAccountsLimit: 2,
      monthlyOrders: 30,
    },
    highlights: [
      'Até 10 receitas cadastradas',
      'Até 20 itens no estoque',
      '5 produtos e 20 clientes',
      'Calculadora de custos e Conversor',
      '10 etiquetas de lote por mês',
      '2 combos promocionais',
    ],
  },
  pro: {
    id: 'plan_pro',
    code: 'pro',
    tier: 'pro',
    name: 'Pro',
    tagline: 'Gestão completa do dia a dia',
    description: 'A melhor relação custo-benefício para confeitarias e padarias gerenciarem suas vendas e rotina.',
    badge: 'Mais Popular • Melhor Valor',
    isPopular: true,
    trialDays: 14,
    priceMonthlyCents: 999, // 9,99 €
    priceYearlyMonthlyEquivalentCents: 799, // 7,99 € (Economize 20%)
    priceYearlyTotalCents: 9588, // 95,88 € / ano
    currency: 'EUR',
    limits: {
      recipesLimit: 100,
      inventoryItemsLimit: 300,
      shoppingListType: 'automatic',
      productsLimit: 100,
      customersLimit: 500,
      activeCouponsLimit: 10,
      costCalculatorEnabled: true,
      unitConverterEnabled: true,
      productionPlanner: 'manual',
      monthlyDeliveryOrdersLimit: 30,
      whatsappBotEnabled: false,
      monthlyLabelsLimit: 300,
      recipeScalerEnabled: true,
      combosLimit: 30,
      cashAccountsLimit: 10,
      monthlyOrders: 500,
    },
    highlights: [
      'Até 100 receitas e fichas técnicas',
      'Estoque com até 300 insumos e alertas',
      'Lista de compras automática',
      '100 produtos e 500 clientes',
      '10 cupons de desconto ativos',
      'Planeador manual de produção e fornadas',
      'Até 30 entregas planejadas/mês',
      '300 etiquetas de validade/mês',
      'Até 30 combos de produtos',
    ],
  },
  business: {
    id: 'plan_business',
    code: 'business',
    tier: 'business',
    name: 'Business',
    tagline: 'Automação avançada e maior escala',
    description: 'Para operações maiores que precisam de automação, escalabilidade e bot WhatsApp.',
    badge: 'Avançado',
    priceMonthlyCents: 2990, // 29,90 € (~3x o Pro)
    priceYearlyMonthlyEquivalentCents: 2390, // 23,90 € (Economize 20%)
    priceYearlyTotalCents: 28680, // 286,80 € / ano
    currency: 'EUR',
    limits: {
      recipesLimit: -1, // Ilimitado
      inventoryItemsLimit: -1,
      shoppingListType: 'automatic',
      productsLimit: -1,
      customersLimit: -1,
      activeCouponsLimit: -1,
      costCalculatorEnabled: true,
      unitConverterEnabled: true,
      productionPlanner: 'automatic',
      monthlyDeliveryOrdersLimit: -1,
      whatsappBotEnabled: true,
      whatsappBotAllowance: 1000, // Franquia inclusa
      monthlyLabelsLimit: -1,
      recipeScalerEnabled: true,
      combosLimit: -1,
      cashAccountsLimit: -1,
      monthlyOrders: -1,
    },
    highlights: [
      'Receitas e Fichas Técnicas ilimitadas',
      'Estoque, produtos e clientes ilimitados',
      'Planeador automático inteligente de produção',
      'Planeador e roteirizador de entregas ilimitado',
      'Bot WhatsApp com franquia inclusa',
      'Etiquetas, lotes e cupons ilimitados',
      'Combos ilimitados e múltiplos caixas',
      'Suporte prioritário e relatórios executivos',
    ],
  },
};

export interface EntitlementsResponse {
  planCode: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPro: boolean;
  isBusiness: boolean;
  limits: PlanLimits;
  canCreateOrder: boolean;
  canCreateProduct: boolean;
  canCreateCustomer: boolean;
  canCreateCashAccount: boolean;
  canCreateInventoryItem?: boolean;
  canCreateRecipe?: boolean;
  accessibleFeatures: string[];
}

// Inventory & Supplies (Estoque e Insumos)
export type InventoryUnit = 'g' | 'kg' | 'ml' | 'l' | 'unidade' | 'caixa' | 'lata' | 'pct';

export interface InventoryItem {
  id: string;
  companyId: string;
  name: string;
  category: string;
  brand?: string;
  unit: InventoryUnit | string;
  currentStock: number;
  minStock: number;
  idealStock?: number;
  unitCostCents: number;
  packageSize?: number;
  packageCostCents?: number;
  location?: string;
  supplier?: string;
  expiryDate?: string;
  notes?: string;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type InventoryMovementType = 'in' | 'out' | 'adjustment';
export type InventoryMovementReason =
  | 'compra'
  | 'producao'
  | 'descarte'
  | 'perda_validade'
  | 'ajuste_inventario'
  | 'outro';

export interface InventoryMovement {
  id: string;
  companyId: string;
  itemId: string;
  itemName: string;
  unit: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  costCents?: number;
  reason?: InventoryMovementReason | string;
  notes?: string;
  date: string;
  createdAt: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValueCents: number;
}

export interface ShoppingListItem {
  id?: string;
  item: InventoryItem;
  inventoryItemId?: string;
  name: string;
  category?: string;
  unit: string;
  suggestedBuyQuantity: number;
  estimatedCostCents: number;
  isPurchased?: boolean;
  purchasedAt?: string;
  source?: 'low_stock' | 'manual' | 'order_demand';
  notes?: string;
}

export interface ShoppingListResponse {
  items: ShoppingListItem[];
  totalEstimatedCostCents: number;
  lowStockItemsCount: number;
  purchasedCount?: number;
  totalItemsCount?: number;
}

// Recipes & Technical Sheets (Fichas Técnicas & Receitas)
export interface RecipeIngredient {
  id?: string;
  inventoryItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
  costCents: number;
  isFlour?: boolean;
  bakersPercentage?: number;
}

export interface Recipe {
  id: string;
  companyId: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  yield: number;
  yieldUnit: string;
  prepTimeMinutes?: number;
  bakeTimeMinutes?: number;
  ovenTemperature?: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  notes?: string;
  ingredientsCostCents: number;
  packagingCostCents?: number;
  laborCostCents?: number;
  overheadCostCents?: number;
  totalCostCents: number;
  costPerYieldUnitCents: number;
  suggestedSalePriceCents?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RecipeSummary {
  totalRecipes: number;
  categoriesCount: number;
  averageCostCents: number;
}

// Production Planner
export type ProductionBatchCategory = 'oven' | 'stove' | 'assembly' | 'decoration' | 'packaging' | 'other';
export type ProductionBatchStatus = 'pending' | 'in_progress' | 'completed';

export interface ProductionBatchItem {
  orderId?: string;
  orderNumber?: number;
  productName: string;
  quantity: number;
  unit?: string;
  flavor?: string;
  notes?: string;
}

export interface ProductionBatch {
  id: string;
  companyId: string;
  date: string; // YYYY-MM-DD
  batchNumber: number;
  name: string;
  category: ProductionBatchCategory;
  time?: string;
  temperature?: number;
  durationMinutes?: number;
  status: ProductionBatchStatus;
  items: ProductionBatchItem[];
  recipeId?: string;
  recipeName?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AggregatedProductDemand {
  productId: string;
  productName: string;
  category?: string;
  totalQuantity: number;
  unit: string;
  flavors: { flavor: string; quantity: number }[];
  complements: { name: string; count: number }[];
  orderNumbers: number[];
  recipeId?: string;
}

export interface AggregatedIngredientRequirement {
  name: string;
  requiredQuantity: number;
  unit: string;
  currentStock?: number;
  isShortage?: boolean;
}

export interface DailyProductionPlan {
  date: string; // YYYY-MM-DD
  totalOrdersCount: number;
  orders: Order[];
  productDemands: AggregatedProductDemand[];
  ingredientRequirements: AggregatedIngredientRequirement[];
  batches: ProductionBatch[];
  metrics: {
    totalItemsToProduce: number;
    completedBatchesCount: number;
    totalBatchesCount: number;
    ordersByStatus: {
      pending: number;
      in_production: number;
      ready: number;
      delivered: number;
    };
  };
}

// Delivery Planner (Planejador de Entregas)
export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'failed';
export type DeliveryShift = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface DeliveryAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  formattedAddress?: string;
}

export interface DeliveryItem {
  id: string;
  companyId: string;
  date: string; // YYYY-MM-DD
  orderId?: string;
  orderNumber?: number;
  customerName: string;
  customerPhone?: string;
  address: DeliveryAddress;
  shift: DeliveryShift;
  scheduledTime?: string;
  deliveryFeeCents: number;
  remainingAmountCents: number;
  financialStatus: FinancialStatus;
  status: DeliveryStatus;
  deliveredAt?: string;
  driverName?: string;
  notes?: string;
  orderItemsCount: number;
  itemsSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyDeliveryPlan {
  date: string; // YYYY-MM-DD
  totalDeliveriesCount: number;
  completedDeliveriesCount: number;
  totalDeliveryFeesCents: number;
  totalAmountToCollectCents: number;
  deliveriesByShift: {
    morning: DeliveryItem[];
    afternoon: DeliveryItem[];
    evening: DeliveryItem[];
    anytime: DeliveryItem[];
  };
  deliveries: DeliveryItem[];
  monthlyDeliveriesCount?: number;
  monthlyLimit?: number;
}

// Labels & Batches (Gerador de Etiqueta & Lote)
export type LabelSize = 'small' | 'standard' | 'large'; // 50x30mm, 60x40mm, 80x50mm

export type BatchStorageCondition =
  | 'room_temperature'
  | 'refrigerated'
  | 'frozen'
  | 'dry_and_fresh'
  | 'after_opening_48h'
  | string;

export type LabelBatchStatus = 'active' | 'expiring_soon' | 'expired' | 'depleted';

export interface LabelBatch {
  id: string;
  companyId: string;
  batchCode: string; // ex: "LOT-20261026-001"
  productName: string;
  productId?: string;
  recipeId?: string;
  productionDate: string; // YYYY-MM-DD
  expiryDate: string;     // YYYY-MM-DD
  shelfLifeDays?: number;
  storageCondition: BatchStorageCondition;
  netWeight?: string;     // ex: "350g", "1 kg", "6 un"
  ingredientsText?: string;
  allergensText?: string;
  nutritionalHighlights?: string; // ex: "Porção 50g: 135 kcal"
  labelSize: LabelSize;
  quantity: number;
  barcodeOrQrContent?: string;
  notes?: string;
  status: LabelBatchStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateLabelBatchDto {
  batchCode?: string;
  productName: string;
  productId?: string;
  recipeId?: string;
  productionDate: string;
  expiryDate: string;
  shelfLifeDays?: number;
  storageCondition: string;
  netWeight?: string;
  ingredientsText?: string;
  allergensText?: string;
  nutritionalHighlights?: string;
  labelSize?: LabelSize;
  quantity?: number;
  notes?: string;
}

export interface LabelQuotaResponse {
  usedThisMonth: number;
  monthlyLimit: number; // 10, 300, -1
  remainingThisMonth: number; // -1 if unlimited
  isLimitReached: boolean;
  tier: SubscriptionTier;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
