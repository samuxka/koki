import { z } from 'zod';

// Auth Validations
export const registerSchema = z.object({
  fullName: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Onboarding Validation
export const onboardingSchema = z.object({
  tradeName: z.string().min(2, 'O nome comercial da empresa é obrigatório'),
  businessType: z.enum(['confeitaria', 'padaria', 'pastelaria', 'outro'], {
    errorMap: () => ({ message: 'Selecione um tipo de negócio válido' }),
  }),
  currency: z.string().default('EUR'),
  timezone: z.string().default('Europe/Lisbon'),
  monthlySalesGoalCents: z.number().nonnegative('A meta não pode ser negativa').default(0),
  initialCashAccountName: z.string().min(2, 'O nome da primeira caixinha é obrigatório').default('Caixa Físico'),
  initialBalanceCents: z.number().nonnegative().default(0),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Sales Goal Update
export const salesGoalSchema = z.object({
  monthlySalesGoalCents: z.number().nonnegative('A meta deve ser um valor positivo'),
});

export type SalesGoalInput = z.infer<typeof salesGoalSchema>;

// Customer Validations
export const loyaltyCardSchema = z.object({
  enabled: z.boolean().default(false),
  targetOrders: z.number().min(1, 'A quantidade de pedidos deve ser no mínimo 1').default(10),
  reward: z.string().optional(),
});

export type LoyaltyCardInput = z.infer<typeof loyaltyCardSchema>;

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'O nome do cliente é obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  address: z
    .object({
      street: z.string().optional(),
      number: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
  loyaltyCard: loyaltyCardSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateLoyaltyCardSchema = loyaltyCardSchema;

// Product Validations
export const productIngredientCostSchema = z.object({
  name: z.string().min(1, 'Nome do ingrediente é obrigatório'),
  costCents: z.number().nonnegative('O custo não pode ser negativo'),
});

export type ProductIngredientCostInput = z.infer<typeof productIngredientCostSchema>;

export const productComplementSchema = z.object({
  name: z.string().min(1, 'Nome do complemento é obrigatório'),
  additionalPriceCents: z.number().nonnegative('O preço adicional não pode ser negativo').default(0),
});

export type ProductComplementInput = z.infer<typeof productComplementSchema>;

export const createProductSchema = z.object({
  name: z.string().min(2, 'O nome do produto é obrigatório'),
  category: z.string().min(1, 'A categoria é obrigatória'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  unit: z.string().min(1, 'A unidade é obrigatória').default('unidade'),
  priceCents: z.number().positive('O preço de venda deve ser maior que zero'),
  costCents: z.number().nonnegative('O custo não pode ser negativo').default(0),
  monthlySalesGoalUnits: z.number().nonnegative().optional(),
  ingredients: z.array(productIngredientCostSchema).optional(),
  flavors: z.array(z.string()).optional(),
  complements: z.array(productComplementSchema).optional(),
  notes: z.string().optional(),
  isAvailable: z.boolean().default(true),
  isCombo: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Order Item & Order Validations
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'ID do produto é obrigatório'),
  productName: z.string().min(1, 'Nome do produto é obrigatório'),
  unitPriceCents: z.number().positive('Preço unitário inválido'),
  quantity: z.number().positive('Quantidade deve ser maior que zero'),
  flavor: z.string().optional(),
  complements: z.array(productComplementSchema).optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  items: z.array(orderItemSchema).min(1, 'Adicione pelo menos um item ao pedido'),
  discountCents: z.number().nonnegative().default(0),
  deliveryFeeCents: z.number().nonnegative().default(0),
  deliveryDate: z.string().min(1, 'A data de entrega é obrigatória'),
  deliveryMethod: z.enum(['pickup', 'delivery']).default('pickup'),
  notes: z.string().optional(),
  initialPayment: z
    .object({
      cashAccountId: z.string().min(1, 'Selecione a caixinha de destino'),
      amountCents: z.number().positive('O valor pago deve ser maior que zero'),
      paymentMethod: z.enum(['cash', 'card', 'mbway', 'pix', 'bank_transfer', 'other']),
    })
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  operationalStatus: z.enum(['pending', 'in_production', 'ready', 'delivered', 'canceled']).optional(),
  financialStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Payment Registration
export const createPaymentSchema = z.object({
  cashAccountId: z.string().min(1, 'Selecione a caixinha de destino'),
  amountCents: z.number().positive('O valor deve ser maior que zero'),
  paymentMethod: z.enum(['cash', 'card', 'mbway', 'pix', 'bank_transfer', 'other']),
  receiptUrl: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// Cash Account (Caixinha) Validations
export const createCashAccountSchema = z.object({
  name: z.string().min(2, 'O nome da caixinha é obrigatório'),
  type: z.enum(['cash', 'bank', 'savings', 'tax', 'investment', 'equipment']).default('cash'),
  icon: z.string().default('wallet'),
  color: z.string().default('#cc9a52'),
  initialBalanceCents: z.number().nonnegative('O saldo inicial não pode ser negativo').default(0),
  description: z.string().optional(),
});

export type CreateCashAccountInput = z.infer<typeof createCashAccountSchema>;

// Cash Transaction Validations
export const createCashTransactionSchema = z.object({
  cashAccountId: z.string().min(1, 'Selecione a caixinha'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'A categoria é obrigatória'),
  description: z.string().min(2, 'A descrição é obrigatória'),
  amountCents: z.number().positive('O valor deve ser maior que zero'),
  date: z.string().optional(),
});

export type CreateCashTransactionInput = z.infer<typeof createCashTransactionSchema>;

// Internal Transfer
export const createTransferSchema = z.object({
  sourceAccountId: z.string().min(1, 'Selecione a caixinha de origem'),
  destinationAccountId: z.string().min(1, 'Selecione a caixinha de destino'),
  amountCents: z.number().positive('O valor da transferência deve ser maior que zero'),
  description: z.string().optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

// Inventory & Raw Materials Validations
export const createInventoryItemSchema = z.object({
  name: z.string().min(2, 'O nome do insumo é obrigatório'),
  category: z.string().min(1, 'A categoria é obrigatória'),
  brand: z.string().optional(),
  unit: z.string().min(1, 'A unidade de medida é obrigatória').default('g'),
  currentStock: z.number().nonnegative('O estoque atual não pode ser negativo').default(0),
  minStock: z.number().nonnegative('O estoque mínimo não pode ser negativo').default(0),
  idealStock: z.number().nonnegative().optional(),
  unitCostCents: z.number().nonnegative('O custo unitário não pode ser negativo').default(0),
  packageSize: z.number().positive('O tamanho da embalagem deve ser maior que zero').optional(),
  packageCostCents: z.number().nonnegative('O custo da embalagem não pode ser negativo').optional(),
  location: z.string().optional(),
  supplier: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const createInventoryMovementSchema = z.object({
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().positive('A quantidade deve ser maior que zero'),
  costCents: z.number().nonnegative().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementSchema>;

// Recipes & Technical Sheets Validations
export const recipeIngredientSchema = z.object({
  inventoryItemId: z.string().optional(),
  name: z.string().min(1, 'Nome do ingrediente é obrigatório'),
  quantity: z.number().positive('A quantidade deve ser maior que zero'),
  unit: z.string().min(1, 'A unidade é obrigatória').default('g'),
  unitCostCents: z.number().nonnegative().default(0),
  costCents: z.number().nonnegative().default(0),
  isFlour: z.boolean().optional(),
  bakersPercentage: z.number().optional(),
});

export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;

export const createRecipeSchema = z.object({
  name: z.string().min(2, 'O nome da receita é obrigatório'),
  category: z.string().min(1, 'A categoria é obrigatória'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  yield: z.number().positive('O rendimento deve ser maior que zero').default(1),
  yieldUnit: z.string().min(1, 'A unidade de rendimento é obrigatória').default('unidades'),
  prepTimeMinutes: z.number().nonnegative().optional(),
  bakeTimeMinutes: z.number().nonnegative().optional(),
  ovenTemperature: z.number().nonnegative().optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, 'Adicione pelo menos um ingrediente à receita'),
  instructions: z.array(z.string()).optional(),
  notes: z.string().optional(),
  packagingCostCents: z.number().nonnegative().optional(),
  laborCostCents: z.number().nonnegative().optional(),
  overheadCostCents: z.number().nonnegative().optional(),
  suggestedSalePriceCents: z.number().nonnegative().optional(),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = createRecipeSchema.partial();

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

// Shopping List Validations
export const createShoppingListItemSchema = z.object({
  name: z.string().min(1, 'O nome do item é obrigatório'),
  category: z.string().optional(),
  quantity: z.number().positive('A quantidade deve ser maior que zero').default(1),
  unit: z.string().min(1, 'A unidade é obrigatória').default('un'),
  estimatedCostCents: z.number().nonnegative().optional(),
  inventoryItemId: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateShoppingListItemInput = z.infer<typeof createShoppingListItemSchema>;

export const updateShoppingListItemSchema = z.object({
  quantity: z.number().positive().optional(),
  estimatedCostCents: z.number().nonnegative().optional(),
  isPurchased: z.boolean().optional(),
  notes: z.string().optional(),
});

export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;

// Production Planner Validations
export const createProductionBatchSchema = z.object({
  date: z.string().min(10, 'A data é obrigatória (formato AAAA-MM-DD)'),
  name: z.string().min(2, 'O nome da fornada/lote é obrigatório'),
  category: z.enum(['oven', 'stove', 'assembly', 'decoration', 'packaging', 'other']).default('oven'),
  time: z.string().optional(),
  temperature: z.number().nonnegative().optional(),
  durationMinutes: z.number().positive().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  recipeId: z.string().optional(),
  items: z.array(z.object({
    orderId: z.string().optional(),
    orderNumber: z.number().optional(),
    productName: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    flavor: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
});

export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>;

export const updateProductionBatchSchema = createProductionBatchSchema.partial();
export type UpdateProductionBatchInput = z.infer<typeof updateProductionBatchSchema>;

// Delivery Planner Validations
export const deliveryAddressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  formattedAddress: z.string().optional(),
});

export const createDeliveryItemSchema = z.object({
  date: z.string().min(10, 'A data é obrigatória (formato AAAA-MM-DD)'),
  orderId: z.string().optional(),
  orderNumber: z.number().optional(),
  customerName: z.string().min(2, 'O nome do destinatário é obrigatório'),
  customerPhone: z.string().optional(),
  address: deliveryAddressSchema,
  shift: z.enum(['morning', 'afternoon', 'evening', 'anytime']).default('morning'),
  scheduledTime: z.string().optional(),
  deliveryFeeCents: z.number().nonnegative().default(0),
  remainingAmountCents: z.number().nonnegative().default(0),
  financialStatus: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  status: z.enum(['pending', 'out_for_delivery', 'delivered', 'failed']).default('pending'),
  driverName: z.string().optional(),
  notes: z.string().optional(),
  orderItemsCount: z.number().nonnegative().default(1),
  itemsSummary: z.string().optional(),
});

export type CreateDeliveryItemInput = z.infer<typeof createDeliveryItemSchema>;

export const updateDeliveryItemSchema = createDeliveryItemSchema.partial();
export type UpdateDeliveryItemInput = z.infer<typeof updateDeliveryItemSchema>;

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['pending', 'out_for_delivery', 'delivered', 'failed']),
  deliveredAt: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;

