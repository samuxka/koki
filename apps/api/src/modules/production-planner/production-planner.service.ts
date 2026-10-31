import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductionBatch, ProductionBatchDocument } from './schemas/production-batch.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Recipe, RecipeDocument } from '../recipes/schemas/recipe.schema';
import { InventoryItem, InventoryItemDocument } from '../inventory/schemas/inventory-item.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  CreateProductionBatchInput,
  UpdateProductionBatchInput,
} from '@koki/validation';
import {
  DailyProductionPlan,
  ProductionBatch as IProductionBatch,
  AggregatedProductDemand,
  AggregatedIngredientRequirement,
  OperationalStatus,
  Order as IOrder,
} from '@koki/types';

@Injectable()
export class ProductionPlannerService {
  constructor(
    @InjectModel(ProductionBatch.name)
    private batchModel: Model<ProductionBatchDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Recipe.name)
    private recipeModel: Model<RecipeDocument>,
    @InjectModel(InventoryItem.name)
    private inventoryModel: Model<InventoryItemDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapBatch(doc: ProductionBatchDocument): IProductionBatch {
    const raw = doc.toObject ? doc.toObject() : doc;
    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      date: raw.date,
      batchNumber: raw.batchNumber,
      name: raw.name,
      category: raw.category,
      time: raw.time,
      temperature: raw.temperature,
      durationMinutes: raw.durationMinutes,
      status: raw.status,
      recipeId: raw.recipeId ? raw.recipeId.toString() : undefined,
      recipeName: raw.recipeName,
      items: (raw.items || []).map((item: any) => ({
        orderId: item.orderId ? item.orderId.toString() : undefined,
        orderNumber: item.orderNumber,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        flavor: item.flavor,
        notes: item.notes,
      })),
      notes: raw.notes,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  private mapOrder(order: any): IOrder {
    return {
      id: order._id.toString(),
      companyId: order.companyId.toString(),
      orderNumber: order.orderNumber,
      customerId: order.customerId ? order.customerId.toString() : '',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: (order.items || []).map((item: any) => ({
        productId: item.productId ? item.productId.toString() : '',
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        subtotalCents: item.subtotalCents,
        flavor: item.flavor,
        complements: item.complements || [],
        notes: item.notes,
      })),
      discountCents: order.discountCents || 0,
      deliveryFeeCents: order.deliveryFeeCents || 0,
      totalAmountCents: order.totalAmountCents || 0,
      paidAmountCents: order.paidAmountCents || 0,
      remainingAmountCents: order.remainingAmountCents || 0,
      operationalStatus: order.operationalStatus,
      financialStatus: order.financialStatus,
      deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : '',
      deliveryMethod: order.deliveryMethod,
      notes: order.notes,
      createdAt: order.createdAt ? order.createdAt.toISOString() : '',
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Retorna o plano diário de produção completo para uma data específica (YYYY-MM-DD)
   */
  async getDailyPlan(companyId: string | Types.ObjectId, dateStr?: string): Promise<DailyProductionPlan> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Se não fornecido, usa a data atual local/UTC no formato YYYY-MM-DD
    const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : new Date().toISOString().split('T')[0];

    // Janela ampla de 24h para cobrir qualquer fuso horário na busca do banco
    const [year, month, day] = targetDate.split('-').map(Number);
    const windowStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    windowStart.setHours(windowStart.getHours() - 14);

    const windowEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    windowEnd.setHours(windowEnd.getHours() + 14);

    // 1. Buscar pedidos ativos, estoque e fornadas em paralelo
    const [rawOrders, inventoryItems, batchDocs] = await Promise.all([
      this.orderModel
        .find({
          companyId: companyObjectId,
          deletedAt: { $exists: false },
          operationalStatus: { $ne: 'canceled' },
          deliveryDate: { $gte: windowStart, $lte: windowEnd },
        })
        .sort({ deliveryDate: 1, orderNumber: 1 })
        .exec(),
      this.inventoryModel
        .find({ companyId: companyObjectId, deletedAt: { $exists: false } })
        .exec(),
      this.batchModel
        .find({
          companyId: companyObjectId,
          date: targetDate,
          deletedAt: { $exists: false },
        })
        .sort({ time: 1, batchNumber: 1 })
        .exec(),
    ]);

    // Filtrar com precisão exata de dia (ISO ou Local)
    const matchingOrders = rawOrders.filter((o) => {
      if (!o.deliveryDate) return false;
      const isoDate = o.deliveryDate.toISOString().split('T')[0];
      const ly = o.deliveryDate.getFullYear();
      const lm = String(o.deliveryDate.getMonth() + 1).padStart(2, '0');
      const ld = String(o.deliveryDate.getDate()).padStart(2, '0');
      const localDate = `${ly}-${lm}-${ld}`;
      return isoDate === targetDate || localDate === targetDate;
    });

    // Sincronizar em tempo real com os dados mais recentes do cliente
    const customerIds = Array.from(
      new Set(
        matchingOrders
          .map((o) => (o.customerId ? o.customerId.toString() : ''))
          .filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    const customerDocs =
      customerIds.length > 0
        ? await this.customerModel
            .find({ _id: { $in: customerIds }, companyId: companyObjectId })
            .select('name phone')
            .lean()
            .exec()
        : [];
    const customerMap = new Map<string, any>();
    customerDocs.forEach((c) => customerMap.set(c._id.toString(), c));

    const mappedOrders = matchingOrders.map((o) => {
      const mapped = this.mapOrder(o);
      const liveCustomer = mapped.customerId ? customerMap.get(mapped.customerId) : undefined;
      if (liveCustomer) {
        mapped.customerName = liveCustomer.name || mapped.customerName;
        mapped.customerPhone = liveCustomer.phone || mapped.customerPhone;
      }
      return mapped;
    });

    // 2. Coletar IDs de produtos dos itens de pedidos
    const productIdsSet = new Set<string>();
    matchingOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        if (item.productId) {
          productIdsSet.add(item.productId.toString());
        }
      });
    });

    const products = await this.productModel
      .find({
        _id: { $in: Array.from(productIdsSet).map((id) => new Types.ObjectId(id)) },
        companyId: companyObjectId,
      })
      .exec();

    const productMap = new Map<string, ProductDocument>();
    products.forEach((p) => productMap.set(p._id.toString(), p));

    // 3. Agregar Demandas de Produtos
    const demandMap = new Map<string, AggregatedProductDemand>();

    matchingOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const prodId = item.productId ? item.productId.toString() : item.productName;
        const product = item.productId ? productMap.get(item.productId.toString()) : null;

        if (!demandMap.has(prodId)) {
          demandMap.set(prodId, {
            productId: prodId,
            productName: item.productName,
            category: product?.category || 'Geral',
            totalQuantity: 0,
            unit: product?.unit || 'unidade',
            flavors: [],
            complements: [],
            orderNumbers: [],
            recipeId: product?.recipeId ? product.recipeId.toString() : undefined,
          });
        }

        const demand = demandMap.get(prodId)!;
        demand.totalQuantity += item.quantity;

        // Registrar número do pedido
        if (order.orderNumber && !demand.orderNumbers.includes(order.orderNumber)) {
          demand.orderNumbers.push(order.orderNumber);
        }

        // Registrar sabores
        if (item.flavor) {
          const existingFlavor = demand.flavors.find((f) => f.flavor.toLowerCase() === item.flavor!.toLowerCase());
          if (existingFlavor) {
            existingFlavor.quantity += item.quantity;
          } else {
            demand.flavors.push({ flavor: item.flavor, quantity: item.quantity });
          }
        }

        // Registrar complementos
        if (item.complements && item.complements.length > 0) {
          item.complements.forEach((c) => {
            const existingComp = demand.complements.find((comp) => comp.name.toLowerCase() === c.name.toLowerCase());
            if (existingComp) {
              existingComp.count += item.quantity;
            } else {
              demand.complements.push({ name: c.name, count: item.quantity });
            }
          });
        }
      });
    });

    const productDemands = Array.from(demandMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);

    // 4. Agregar Insumos Necessários a partir das Fichas Técnicas / Receitas
    const recipeIds = productDemands
      .map((d) => d.recipeId)
      .filter((id): id is string => Boolean(id));

    const recipes = await this.recipeModel
      .find({
        _id: { $in: recipeIds.map((id) => new Types.ObjectId(id)) },
        companyId: companyObjectId,
      })
      .exec();

    const recipeMap = new Map<string, RecipeDocument>();
    recipes.forEach((r) => recipeMap.set(r._id.toString(), r));

    const inventoryMap = new Map<string, InventoryItemDocument>();
    inventoryItems.forEach((inv) => {
      inventoryMap.set(inv._id.toString(), inv);
      inventoryMap.set(inv.name.toLowerCase().trim(), inv);
    });

    const ingredientReqMap = new Map<string, {
      name: string;
      requiredQuantity: number;
      unit: string;
      inventoryItemId?: string;
    }>();

    productDemands.forEach((demand) => {
      if (!demand.recipeId) return;
      const recipe = recipeMap.get(demand.recipeId);
      if (!recipe) return;

      const recipeYield = recipe.yield > 0 ? recipe.yield : 1;
      const scaleMultiplier = demand.totalQuantity / recipeYield;

      (recipe.ingredients || []).forEach((ing) => {
        const key = ing.inventoryItemId
          ? ing.inventoryItemId.toString()
          : ing.name.toLowerCase().trim();

        const needed = (ing.quantity || 0) * scaleMultiplier;

        if (!ingredientReqMap.has(key)) {
          ingredientReqMap.set(key, {
            name: ing.name,
            requiredQuantity: 0,
            unit: ing.unit,
            inventoryItemId: ing.inventoryItemId ? ing.inventoryItemId.toString() : undefined,
          });
        }

        const currentReq = ingredientReqMap.get(key)!;
        currentReq.requiredQuantity += needed;
      });
    });

    const ingredientRequirements: AggregatedIngredientRequirement[] = Array.from(ingredientReqMap.values()).map((req) => {
      let matchedItem: InventoryItemDocument | undefined;
      if (req.inventoryItemId) {
        matchedItem = inventoryMap.get(req.inventoryItemId);
      }
      if (!matchedItem) {
        matchedItem = inventoryMap.get(req.name.toLowerCase().trim());
      }

      const currentStock = matchedItem ? matchedItem.currentStock : undefined;
      const isShortage = currentStock !== undefined ? currentStock < req.requiredQuantity : false;

      return {
        name: req.name,
        requiredQuantity: Number(req.requiredQuantity.toFixed(2)),
        unit: req.unit,
        currentStock,
        isShortage,
      };
    }).sort((a, b) => (b.isShortage ? 1 : 0) - (a.isShortage ? 1 : 0));

    // 5. Mapear Fornadas / Lotes criados para essa data
    const batches = batchDocs.map((b) => this.mapBatch(b));

    // 6. Calcular Métricas do Dia
    const totalItemsToProduce = mappedOrders.reduce(
      (sum, ord) => sum + ord.items.reduce((s, it) => s + it.quantity, 0),
      0,
    );

    const completedBatchesCount = batches.filter((b) => b.status === 'completed').length;

    const ordersByStatus = {
      pending: 0,
      in_production: 0,
      ready: 0,
      delivered: 0,
    };

    mappedOrders.forEach((o) => {
      if (o.operationalStatus in ordersByStatus) {
        ordersByStatus[o.operationalStatus as keyof typeof ordersByStatus]++;
      }
    });

    return {
      date: targetDate,
      totalOrdersCount: mappedOrders.length,
      orders: mappedOrders,
      productDemands,
      ingredientRequirements,
      batches,
      metrics: {
        totalItemsToProduce,
        completedBatchesCount,
        totalBatchesCount: batches.length,
        ordersByStatus,
      },
    };
  }

  /**
   * Criação manual de fornada/lote
   */
  async createBatch(companyId: string | Types.ObjectId, input: CreateProductionBatchInput): Promise<IProductionBatch> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Obter próximo número sequencial de lote do dia
    const lastBatch = await this.batchModel
      .findOne({ companyId: companyObjectId, date: input.date, deletedAt: { $exists: false } })
      .sort({ batchNumber: -1 })
      .exec();

    const batchNumber = (lastBatch?.batchNumber || 0) + 1;

    let recipeName: string | undefined;
    let temperature = input.temperature;
    let durationMinutes = input.durationMinutes;

    if (input.recipeId) {
      const recipe = await this.recipeModel.findOne({
        _id: new Types.ObjectId(input.recipeId),
        companyId: companyObjectId,
      });
      if (recipe) {
        recipeName = recipe.name;
        if (!temperature && recipe.ovenTemperature) {
          temperature = recipe.ovenTemperature;
        }
        if (!durationMinutes && recipe.bakeTimeMinutes) {
          durationMinutes = recipe.bakeTimeMinutes;
        }
      }
    }

    const created = await this.batchModel.create({
      companyId: companyObjectId,
      date: input.date,
      batchNumber,
      name: input.name.trim(),
      category: input.category || 'oven',
      time: input.time?.trim(),
      temperature,
      durationMinutes,
      status: input.status || 'pending',
      recipeId: input.recipeId ? new Types.ObjectId(input.recipeId) : undefined,
      recipeName,
      items: (input.items || []).map((it) => ({
        orderId: it.orderId ? new Types.ObjectId(it.orderId) : undefined,
        orderNumber: it.orderNumber,
        productName: it.productName.trim(),
        quantity: it.quantity,
        unit: it.unit?.trim(),
        flavor: it.flavor?.trim(),
        notes: it.notes?.trim(),
      })),
      notes: input.notes?.trim(),
    });

    return this.mapBatch(created);
  }

  /**
   * Atualização de fornada/lote
   */
  async updateBatch(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateProductionBatchInput,
  ): Promise<IProductionBatch> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const batch = await this.batchModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!batch) {
      throw new NotFoundException('Fornada/Lote não encontrado');
    }

    if (input.name !== undefined) batch.name = input.name.trim();
    if (input.category !== undefined) batch.category = input.category;
    if (input.time !== undefined) batch.time = input.time.trim();
    if (input.temperature !== undefined) batch.temperature = input.temperature;
    if (input.durationMinutes !== undefined) batch.durationMinutes = input.durationMinutes;
    if (input.status !== undefined) batch.status = input.status;
    if (input.notes !== undefined) batch.notes = input.notes.trim();

    if (input.items !== undefined) {
      batch.items = input.items.map((it: any) => ({
        orderId: it.orderId ? new Types.ObjectId(it.orderId) : undefined,
        orderNumber: it.orderNumber,
        productName: it.productName.trim(),
        quantity: it.quantity,
        unit: it.unit?.trim(),
        flavor: it.flavor?.trim(),
        notes: it.notes?.trim(),
      }));
    }

    await batch.save();
    return this.mapBatch(batch);
  }

  /**
   * Alterna status da fornada: pending -> in_progress -> completed -> pending
   */
  async toggleBatchStatus(companyId: string | Types.ObjectId, id: string): Promise<IProductionBatch> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const batch = await this.batchModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!batch) {
      throw new NotFoundException('Fornada/Lote não encontrado');
    }

    if (batch.status === 'pending') {
      batch.status = 'in_progress';
    } else if (batch.status === 'in_progress') {
      batch.status = 'completed';
    } else {
      batch.status = 'pending';
    }

    await batch.save();
    return this.mapBatch(batch);
  }

  /**
   * Excluir lote
   */
  async deleteBatch(companyId: string | Types.ObjectId, id: string): Promise<{ success: boolean }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const result = await this.batchModel.updateOne(
      { _id: new Types.ObjectId(id), companyId: companyObjectId },
      { deletedAt: new Date() },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Fornada/Lote não encontrado');
    }

    return { success: true };
  }

  /**
   * Geração automática de cronograma de fornadas e lotes com base nas demandas do dia
   */
  async autoGenerateBatches(companyId: string | Types.ObjectId, dateStr: string): Promise<IProductionBatch[]> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // 1. Obter o plano diário atual para extrair as demandas
    const dailyPlan = await this.getDailyPlan(companyId, dateStr);

    if (dailyPlan.productDemands.length === 0) {
      throw new BadRequestException('Não há pedidos ou demandas cadastradas para este dia.');
    }

    // 2. Apagar lotes anteriores gerados automaticamente ou não completados se o confeiteiro quiser regerar
    await this.batchModel.updateMany(
      {
        companyId: companyObjectId,
        date: dateStr,
        status: { $ne: 'completed' },
        deletedAt: { $exists: false },
      },
      { deletedAt: new Date() },
    );

    // 3. Agrupar produtos por tipo de processo de confeitaria
    const ovenDemands: AggregatedProductDemand[] = [];
    const stoveDemands: AggregatedProductDemand[] = [];
    const assemblyDemands: AggregatedProductDemand[] = [];

    dailyPlan.productDemands.forEach((demand) => {
      const catLower = (demand.category || '').toLowerCase();
      const nameLower = demand.productName.toLowerCase();

      if (
        catLower.includes('bolo') ||
        catLower.includes('torta') ||
        catLower.includes('pão') ||
        catLower.includes('forno') ||
        nameLower.includes('bolo') ||
        nameLower.includes('pão') ||
        nameLower.includes('cupcake') ||
        nameLower.includes('massa')
      ) {
        ovenDemands.push(demand);
      } else if (
        catLower.includes('doce') ||
        catLower.includes('brigadeiro') ||
        catLower.includes('calda') ||
        catLower.includes('fogão') ||
        nameLower.includes('brigadeiro') ||
        nameLower.includes('recheio')
      ) {
        stoveDemands.push(demand);
      } else {
        assemblyDemands.push(demand);
      }
    });

    const createdBatches: IProductionBatch[] = [];
    let currentBatchNumber = 1;

    // Horários sugeridos para o fluxo da cozinha
    const timeSlots = ['07:30', '08:45', '10:00', '11:15', '14:00', '15:30'];
    let timeIndex = 0;

    // Se houver demandas de forno: criar fornadas
    if (ovenDemands.length > 0) {
      // Agrupar itens de forno em lotes de no máximo 4 produtos por fornada
      const chunkSize = 4;
      for (let i = 0; i < ovenDemands.length; i += chunkSize) {
        const chunk = ovenDemands.slice(i, i + chunkSize);
        const batchName = `Fornada ${currentBatchNumber} - ${chunk.map((c) => c.productName).join(', ')}`.slice(0, 60);

        const batch = await this.createBatch(companyId, {
          date: dateStr,
          name: batchName,
          category: 'oven',
          time: timeSlots[timeIndex % timeSlots.length],
          temperature: 180,
          durationMinutes: 45,
          status: 'pending',
          recipeId: chunk[0]?.recipeId,
          items: chunk.map((c) => ({
            productName: c.productName,
            quantity: c.totalQuantity,
            unit: c.unit,
            flavor: c.flavors.map((f) => `${f.flavor} (${f.quantity})`).join(', ') || undefined,
            notes: c.orderNumbers.length > 0 ? `Pedidos: #${c.orderNumbers.join(', #')}` : undefined,
          })),
          notes: 'Pré-aquecer o forno a 180°C por 15 minutos antes de assar.',
        });

        createdBatches.push(batch);
        currentBatchNumber++;
        timeIndex++;
      }
    }

    // Se houver doces / fogão: criar lote de fogão (caldas e recheios)
    if (stoveDemands.length > 0) {
      const batchName = `Lote ${currentBatchNumber} - Doces e Recheios (Fogão)`.slice(0, 60);
      const batch = await this.createBatch(companyId, {
        date: dateStr,
        name: batchName,
        category: 'stove',
        time: timeSlots[timeIndex % timeSlots.length],
        durationMinutes: 60,
        status: 'pending',
        items: stoveDemands.map((c) => ({
          productName: c.productName,
          quantity: c.totalQuantity,
          unit: c.unit,
          flavor: c.flavors.map((f) => `${f.flavor} (${f.quantity})`).join(', ') || undefined,
          notes: c.orderNumbers.length > 0 ? `Pedidos: #${c.orderNumbers.join(', #')}` : undefined,
        })),
        notes: 'Ponto de colher/enrolar. Resfriar em temperatura ambiente.',
      });

      createdBatches.push(batch);
      currentBatchNumber++;
      timeIndex++;
    }

    // Demanda geral / montagem e decoração final
    if (assemblyDemands.length > 0 || dailyPlan.productDemands.length > 0) {
      const batchName = `Lote ${currentBatchNumber} - Montagem e Decoração Final`.slice(0, 60);
      const targetItems = assemblyDemands.length > 0 ? assemblyDemands : dailyPlan.productDemands;

      const batch = await this.createBatch(companyId, {
        date: dateStr,
        name: batchName,
        category: 'assembly',
        time: timeSlots[timeIndex % timeSlots.length],
        durationMinutes: 45,
        status: 'pending',
        items: targetItems.slice(0, 6).map((c) => ({
          productName: c.productName,
          quantity: c.totalQuantity,
          unit: c.unit,
          flavor: c.flavors.map((f) => `${f.flavor} (${f.quantity})`).join(', ') || undefined,
          notes: c.orderNumbers.length > 0 ? `Pedidos: #${c.orderNumbers.join(', #')}` : undefined,
        })),
        notes: 'Conferir embalagens, laços e etiquetas de validade antes da entrega.',
      });

      createdBatches.push(batch);
    }

    return createdBatches;
  }

  /**
   * Atualiza status operacional do pedido diretamente da tela do planejador
   */
  async updateOrderOperationalStatus(
    companyId: string | Types.ObjectId,
    orderId: string,
    status: OperationalStatus,
  ): Promise<IOrder> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    order.operationalStatus = status;
    await order.save();

    return this.mapOrder(order);
  }
}
