import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeliveryItem, DeliveryItemDocument } from './schemas/delivery-item.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  CreateDeliveryItemInput,
  UpdateDeliveryItemInput,
  UpdateDeliveryStatusInput,
  OptimizeDeliveryRouteInput,
  EstimateDeliveryFeeInput,
} from '@koki/validation';
import {
  DailyDeliveryPlan,
  DeliveryItem as IDeliveryItem,
  DeliveryStatus,
  DeliveryShift,
  DeliveryRouteSummary,
  DeliveryFeeEstimateResult,
} from '@koki/types';

interface GeoCoords {
  lat: number;
  lng: number;
}

// Coordenadas base de cidades conhecidas para fallback rápido e determinístico
const KNOWN_LOCATIONS: Record<string, GeoCoords> = {
  lisboa: { lat: 38.7223, lng: -9.1393 },
  baixa: { lat: 38.7115, lng: -9.1369 },
  chiado: { lat: 38.7107, lng: -9.1422 },
  alfama: { lat: 38.7117, lng: -9.1303 },
  belem: { lat: 38.6976, lng: -9.2064 },
  belém: { lat: 38.6976, lng: -9.2064 },
  alvalade: { lat: 38.7533, lng: -9.1442 },
  arroios: { lat: 38.7302, lng: -9.1345 },
  benfica: { lat: 38.7505, lng: -9.2011 },
  campolide: { lat: 38.7324, lng: -9.1643 },
  estrela: { lat: 38.7138, lng: -9.1604 },
  lumiar: { lat: 38.7731, lng: -9.1597 },
  marvila: { lat: 38.7429, lng: -9.1059 },
  olivais: { lat: 38.7689, lng: -9.1157 },
  parque_das_nacoes: { lat: 38.7678, lng: -9.0941 },
  sintra: { lat: 38.8029, lng: -9.3817 },
  cascais: { lat: 38.6979, lng: -9.4215 },
  oeiras: { lat: 38.6911, lng: -9.3109 },
  amadora: { lat: 38.7538, lng: -9.2308 },
  odivelas: { lat: 38.7927, lng: -9.1838 },
  loures: { lat: 38.8309, lng: -9.1685 },
  almada: { lat: 38.6765, lng: -9.1651 },
  setubal: { lat: 38.5244, lng: -8.8882 },
  setúbal: { lat: 38.5244, lng: -8.8882 },
  porto: { lat: 41.1579, lng: -8.6291 },
  gaia: { lat: 41.1239, lng: -8.6118 },
  matosinhos: { lat: 41.1844, lng: -8.6963 },
  maia: { lat: 41.2357, lng: -8.6199 },
  coimbra: { lat: 40.2033, lng: -8.4103 },
  braga: { lat: 41.5454, lng: -8.4265 },
  faro: { lat: 37.0194, lng: -7.9322 },
  aveiro: { lat: 40.6405, lng: -8.6538 },
  leiria: { lat: 39.7495, lng: -8.8077 },
  sao_paulo: { lat: -23.5505, lng: -46.6333 },
  'são paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  curitiba: { lat: -25.4284, lng: -49.2733 },
  'belo horizonte': { lat: -19.9167, lng: -43.9345 },
};

@Injectable()
export class DeliveryPlannerService {
  private static geocodeCache = new Map<string, GeoCoords>();

  // Parâmetros padrão de sugestão de taxa de entrega (em cêntimos)
  private static readonly DEFAULT_BASE_FEE_CENTS = 300; // 3,00 € até 2 km
  private static readonly DEFAULT_INCLUDED_KM = 2.0;
  private static readonly DEFAULT_PER_KM_CENTS = 80; // +0,80 € por km adicional

  constructor(
    @InjectModel(DeliveryItem.name)
    private deliveryModel: Model<DeliveryItemDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
    private entitlementsService: EntitlementsService,
  ) {}

  private mapDelivery(doc: any): IDeliveryItem {
    const raw = doc.toObject ? doc.toObject() : doc;
    return {
      id: raw._id.toString(),
      companyId: raw.companyId.toString(),
      date: raw.date,
      orderId: raw.orderId ? raw.orderId.toString() : undefined,
      orderNumber: raw.orderNumber,
      customerName: raw.customerName,
      customerPhone: raw.customerPhone,
      address: {
        street: raw.address?.street,
        number: raw.address?.number,
        complement: raw.address?.complement,
        neighborhood: raw.address?.neighborhood,
        city: raw.address?.city,
        postalCode: raw.address?.postalCode,
        formattedAddress: raw.address?.formattedAddress,
      },
      shift: raw.shift || 'morning',
      scheduledTime: raw.scheduledTime,
      deliveryFeeCents: raw.deliveryFeeCents || 0,
      suggestedDeliveryFeeCents: raw.suggestedDeliveryFeeCents,
      distanceKm: raw.distanceKm,
      routeOrder: raw.routeOrder,
      latitude: raw.latitude,
      longitude: raw.longitude,
      remainingAmountCents: raw.remainingAmountCents || 0,
      financialStatus: raw.financialStatus || 'unpaid',
      status: raw.status || 'pending',
      deliveredAt: raw.deliveredAt ? new Date(raw.deliveredAt).toISOString() : undefined,
      driverName: raw.driverName,
      notes: raw.notes,
      orderItemsCount: raw.orderItemsCount || 1,
      itemsSummary: raw.itemsSummary,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    };
  }

  private buildFormattedAddress(addr?: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr.trim();
    const parts: string[] = [];
    if (addr.street) {
      parts.push(addr.street + (addr.number ? `, ${addr.number}` : ''));
    }
    if (addr.complement) parts.push(addr.complement);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(addr.city);
    if (addr.postalCode) parts.push(addr.postalCode);
    return parts.join(' - ');
  }

  /**
   * Hash determinístico de string para gerar deslocamento consistente quando endereço é parcial
   */
  private hashString(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  /**
   * Resolve coordenadas aproximadas ou exatas a partir de um endereço textual ou estruturado
   */
  private resolveFallbackCoords(addrStr: string, addrObj?: any): GeoCoords {
    const normalized = (addrStr || '').toLowerCase().trim();
    if (!normalized) {
      return { lat: 38.7223, lng: -9.1393 };
    }

    // 1. Verificar código postal Português (XXXX-XXX) ou Brasileiro (XXXXX-XXX)
    const postalMatch = normalized.match(/\b(\d{4,5})-?(\d{3})\b/);
    if (postalMatch) {
      const prefix = parseInt(postalMatch[1].slice(0, 4), 10);
      const suffix = parseInt(postalMatch[2], 10);
      if (prefix >= 1000 && prefix <= 1999) {
        // Grande Lisboa
        const latOffset = ((prefix - 1000) / 1000) * 0.08 + ((suffix % 100) / 100) * 0.015;
        const lngOffset = (((prefix % 100) - 50) / 100) * 0.08 + ((suffix % 37) / 37) * 0.015;
        return { lat: 38.715 + latOffset, lng: -9.145 + lngOffset };
      } else if (prefix >= 2000 && prefix <= 2999) {
        // Arredores de Lisboa / Margem Sul / Sintra / Cascais
        const latOffset = ((prefix - 2500) / 1000) * 0.14;
        const lngOffset = (((suffix % 100) - 50) / 100) * 0.12;
        return { lat: 38.73 + latOffset, lng: -9.22 + lngOffset };
      } else if (prefix >= 4000 && prefix <= 4999) {
        // Grande Porto
        const latOffset = ((prefix - 4000) / 1000) * 0.08 + ((suffix % 100) / 100) * 0.015;
        const lngOffset = (((prefix % 100) - 50) / 100) * 0.08;
        return { lat: 41.155 + latOffset, lng: -8.625 + lngOffset };
      }
    }

    // 2. Procurar cidade ou bairro conhecido
    let base: GeoCoords = { lat: 38.7223, lng: -9.1393 };
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (
        normalized.includes(key) ||
        addrObj?.city?.toLowerCase()?.includes(key) ||
        addrObj?.neighborhood?.toLowerCase()?.includes(key)
      ) {
        base = coords;
        break;
      }
    }

    // 3. Deslocamento determinístico pela rua e número (raio de ~0.5km a ~6.5km)
    const h1 = this.hashString(normalized);
    const h2 = this.hashString(normalized.split('').reverse().join(''));
    const latDelta = (((h1 % 1000) / 1000) - 0.5) * 0.065;
    const lngDelta = (((h2 % 1000) / 1000) - 0.5) * 0.065;

    return {
      lat: Number((base.lat + latDelta).toFixed(6)),
      lng: Number((base.lng + lngDelta).toFixed(6)),
    };
  }

  private async geocodeAddress(addrStr: string, addrObj?: any): Promise<GeoCoords> {
    const clean = (addrStr || '').trim();
    if (!clean) {
      return { lat: 38.7223, lng: -9.1393 };
    }

    const cacheKey = clean.toLowerCase();
    const cached = DeliveryPlannerService.geocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1600);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'KokiConfeitariaSaaS/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          const coords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          DeliveryPlannerService.geocodeCache.set(cacheKey, coords);
          return coords;
        }
      }
    } catch {
      // Fallback determinístico imediato se sem rede ou timeout
    }

    const fallback = this.resolveFallbackCoords(clean, addrObj);
    DeliveryPlannerService.geocodeCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Calcula distância rodoviária estimada (Haversine * fator de vias urbanas 1.32) em km
   */
  private calculateDrivingDistanceKm(a: GeoCoords, b: GeoCoords, sameAddress = false): number {
    if (sameAddress) return 0.5;
    const R = 6371; // Raio da Terra em km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const c =
      sinDLat * sinDLat +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        sinDLng *
        sinDLng;
    const straightKm = R * (2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c)));
    const roadKm = straightKm * 1.32;
    return Math.max(0.8, Math.min(60, Number(roadKm.toFixed(1))));
  }

  /**
   * Calcula a taxa de entrega sugerida em cêntimos com base na distância (km)
   */
  public calculateSuggestedFeeCents(
    distanceKm: number,
    baseFeeCents = DeliveryPlannerService.DEFAULT_BASE_FEE_CENTS,
    perKmCents = DeliveryPlannerService.DEFAULT_PER_KM_CENTS,
    includedKm = DeliveryPlannerService.DEFAULT_INCLUDED_KM,
  ): number {
    if (distanceKm <= includedKm) {
      return baseFeeCents;
    }
    const extraKm = Math.max(0, distanceKm - includedKm);
    const rawCents = baseFeeCents + Math.round(extraKm * perKmCents);
    // Arredondar para múltiplos de 10 cêntimos para facilitar troco
    return Math.round(rawCents / 10) * 10;
  }

  /**
   * Constrói o link oficial do Google Maps com múltiplas paradas na ordem da rota
   */
  private buildGoogleMapsMultiStopUrl(
    originAddress: string | undefined,
    deliveries: IDeliveryItem[],
  ): string | undefined {
    const activeStops = deliveries.filter(
      (d) =>
        d.status !== 'delivered' &&
        Boolean(
          d.address?.formattedAddress ||
            d.address?.street ||
            d.address?.neighborhood ||
            d.address?.postalCode,
        ),
    );
    const targetStops =
      activeStops.length > 0
        ? activeStops
        : deliveries.filter((d) =>
            Boolean(
              d.address?.formattedAddress ||
                d.address?.street ||
                d.address?.neighborhood ||
                d.address?.postalCode,
            ),
          );

    if (targetStops.length === 0) return undefined;

    const stopAddresses = targetStops.map((d) =>
      (
        d.address.formattedAddress ||
        this.buildFormattedAddress(d.address) ||
        d.customerName
      ).trim(),
    );

    const destination = encodeURIComponent(stopAddresses[stopAddresses.length - 1]);
    const waypointsList = stopAddresses.slice(0, -1);

    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    if (originAddress && originAddress.trim()) {
      url += `&origin=${encodeURIComponent(originAddress.trim())}`;
    }
    if (waypointsList.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypointsList.join('|'))}`;
    }

    return url;
  }

  /**
   * Obtém o plano diário de entregas (com sincronização automática de pedidos agendados e cálculo de rota/taxas)
   */
  async getDailyDeliveries(companyId: string | Types.ObjectId, dateStr?: string): Promise<DailyDeliveryPlan> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : new Date().toISOString().split('T')[0];

    const [year, month, day] = targetDate.split('-').map(Number);
    const windowStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    windowStart.setHours(windowStart.getHours() - 14);

    const windowEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    windowEnd.setHours(windowEnd.getHours() + 14);

    // 1. Buscar pedidos de entrega, entregas já existentes, empresa e limites em paralelo
    const [rawOrders, existingDeliveries, company, entitlements] = await Promise.all([
      this.orderModel
        .find({
          companyId: companyObjectId,
          deletedAt: { $exists: false },
          operationalStatus: { $ne: 'canceled' },
          deliveryMethod: 'delivery',
          deliveryDate: { $gte: windowStart, $lte: windowEnd },
        })
        .sort({ deliveryDate: 1, orderNumber: 1 })
        .lean()
        .exec(),
      this.deliveryModel
        .find({
          companyId: companyObjectId,
          date: targetDate,
          deletedAt: { $exists: false },
        })
        .select('orderId')
        .lean()
        .exec(),
      this.companyModel.findById(companyObjectId).select('address tradeName').lean().exec(),
      this.entitlementsService.getEntitlements(companyId),
    ]);

    const originAddress = this.buildFormattedAddress(company?.address) || 'Centro, Lisboa';
    const originCoords = this.resolveFallbackCoords(originAddress, company?.address);

    const matchingOrders = rawOrders.filter((o) => {
      if (!o.deliveryDate) return false;
      const d = new Date(o.deliveryDate);
      const isoDate = d.toISOString().split('T')[0];
      const ly = d.getFullYear();
      const lm = String(d.getMonth() + 1).padStart(2, '0');
      const ld = String(d.getDate()).padStart(2, '0');
      const localDate = `${ly}-${lm}-${ld}`;
      return isoDate === targetDate || localDate === targetDate;
    });

    // 2. Auto-sincronizar pedidos que ainda não possuem DeliveryItem
    if (matchingOrders.length > 0) {
      const existingOrderIds = new Set(
        existingDeliveries.map((d) => (d.orderId ? d.orderId.toString() : '')),
      );

      const unsyncedOrders = matchingOrders.filter(
        (o) => !existingOrderIds.has(o._id.toString()),
      );

      if (unsyncedOrders.length > 0) {
        const customerIds = unsyncedOrders.map((o) => o.customerId);
        const customers = await this.customerModel
          .find({ _id: { $in: customerIds } })
          .lean()
          .exec();

        const customerMap = new Map<string, any>();
        customers.forEach((c) => customerMap.set(c._id.toString(), c));

        const docsToInsert: any[] = [];

        for (const order of unsyncedOrders) {
          const customer = customerMap.get(order.customerId.toString());
          const addr = customer?.address || {};
          const formattedAddress = this.buildFormattedAddress(addr);
          const stopCoords = this.resolveFallbackCoords(
            formattedAddress || order.customerName,
            addr,
          );
          const distanceKm = this.calculateDrivingDistanceKm(originCoords, stopCoords);
          const suggestedDeliveryFeeCents = this.calculateSuggestedFeeCents(distanceKm);

          const itemsSummary = (order.items || [])
            .map((it: any) => `${it.quantity}x ${it.productName}${it.flavor ? ` (${it.flavor})` : ''}`)
            .join(', ');

          let shift: DeliveryShift = 'morning';
          let scheduledTime: string | undefined;
          if (order.deliveryDate) {
            const dDate = new Date(order.deliveryDate);
            const hour = dDate.getHours();
            if (hour >= 12 && hour < 18) {
              shift = 'afternoon';
            } else if (hour >= 18) {
              shift = 'evening';
            }
            const h = String(hour).padStart(2, '0');
            const m = String(dDate.getMinutes()).padStart(2, '0');
            if (h !== '00' || m !== '00') {
              scheduledTime = `${h}:${m}`;
            }
          }

          docsToInsert.push({
            companyId: companyObjectId,
            date: targetDate,
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone || customer?.phone,
            address: {
              street: addr.street,
              number: addr.number,
              complement: addr.complement,
              neighborhood: addr.neighborhood,
              city: addr.city,
              postalCode: addr.postalCode,
              formattedAddress,
            },
            shift,
            scheduledTime,
            deliveryFeeCents: order.deliveryFeeCents || 0,
            suggestedDeliveryFeeCents,
            distanceKm,
            latitude: stopCoords.lat,
            longitude: stopCoords.lng,
            remainingAmountCents: order.remainingAmountCents || 0,
            financialStatus: order.financialStatus,
            status: order.operationalStatus === 'delivered' ? 'delivered' : 'pending',
            orderItemsCount: (order.items || []).reduce((s: number, it: any) => s + it.quantity, 0),
            itemsSummary,
            notes: order.notes,
          });
        }

        if (docsToInsert.length > 0) {
          await this.deliveryModel.insertMany(docsToInsert);
        }
      }
    }

    // 3. Buscar todas as entregas do dia e contagem mensal em paralelo
    const [y, m] = targetDate.split('-');
    const monthPrefix = `${y}-${m}`;

    const [deliveryDocs, monthlyDeliveriesCount] = await Promise.all([
      this.deliveryModel
        .find({
          companyId: companyObjectId,
          date: targetDate,
          deletedAt: { $exists: false },
        })
        .sort({ routeOrder: 1, scheduledTime: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.deliveryModel.countDocuments({
        companyId: companyObjectId,
        date: { $regex: `^${monthPrefix}` },
        deletedAt: { $exists: false },
      }),
    ]);

    // Garantir que todas as entregas tenham distância e sugestão de taxa calculadas com base no endereço da empresa
    const mappedDeliveries = deliveryDocs.map((d) => {
      const item = this.mapDelivery(d);
      if (
        item.routeOrder === undefined ||
        item.distanceKm === undefined ||
        item.suggestedDeliveryFeeCents === undefined
      ) {
        const addrText =
          item.address.formattedAddress ||
          this.buildFormattedAddress(item.address) ||
          item.customerName;
        const coords = this.resolveFallbackCoords(addrText, item.address);
        item.latitude = coords.lat;
        item.longitude = coords.lng;
        item.distanceKm = this.calculateDrivingDistanceKm(originCoords, coords);
        item.suggestedDeliveryFeeCents = this.calculateSuggestedFeeCents(item.distanceKm);
      }
      return item;
    });

    // Ordenar por routeOrder (se otimizado) ou horário
    mappedDeliveries.sort((a, b) => {
      if (a.routeOrder !== undefined && b.routeOrder !== undefined) {
        return a.routeOrder - b.routeOrder;
      }
      if (a.routeOrder !== undefined) return -1;
      if (b.routeOrder !== undefined) return 1;
      return (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99');
    });

    // 4. Agrupamento por turnos
    const deliveriesByShift = {
      morning: mappedDeliveries.filter((d) => d.shift === 'morning'),
      afternoon: mappedDeliveries.filter((d) => d.shift === 'afternoon'),
      evening: mappedDeliveries.filter((d) => d.shift === 'evening'),
      anytime: mappedDeliveries.filter((d) => d.shift === 'anytime'),
    };

    // 5. Cálculos de totais e valores a receber
    const totalDeliveriesCount = mappedDeliveries.length;
    const completedDeliveriesCount = mappedDeliveries.filter((d) => d.status === 'delivered').length;
    const totalDeliveryFeesCents = mappedDeliveries.reduce((sum, d) => sum + d.deliveryFeeCents, 0);

    const totalAmountToCollectCents = mappedDeliveries.reduce((sum, d) => {
      if (d.financialStatus !== 'paid' && d.status !== 'delivered') {
        return sum + d.remainingAmountCents;
      }
      return sum;
    }, 0);

    // 6. Resumo da Rota e Link Multi-Paradas do Google Maps
    const isOptimized = mappedDeliveries.some((d) => d.routeOrder !== undefined);
    const totalDistanceKm = Number(
      mappedDeliveries.reduce((sum, d) => sum + (d.distanceKm || 0), 0).toFixed(1),
    );
    const estimatedDurationMinutes = Math.max(
      mappedDeliveries.length > 0 ? 10 : 0,
      Math.round(totalDistanceKm * 2.6 + mappedDeliveries.length * 4),
    );
    const totalSuggestedFeeCents = mappedDeliveries.reduce(
      (sum, d) => sum + (d.suggestedDeliveryFeeCents || 0),
      0,
    );
    const googleMapsRouteUrl = this.buildGoogleMapsMultiStopUrl(
      this.buildFormattedAddress(company?.address) || undefined,
      mappedDeliveries,
    );

    const routeSummary: DeliveryRouteSummary = {
      isOptimized,
      originAddress: this.buildFormattedAddress(company?.address) || undefined,
      totalDistanceKm,
      estimatedDurationMinutes,
      totalSuggestedFeeCents,
      stopsCount: mappedDeliveries.length,
      googleMapsRouteUrl,
    };

    return {
      date: targetDate,
      totalDeliveriesCount,
      completedDeliveriesCount,
      totalDeliveryFeesCents,
      totalAmountToCollectCents,
      deliveriesByShift,
      deliveries: mappedDeliveries,
      routeSummary,
      monthlyDeliveriesCount,
      monthlyLimit: entitlements.limits.monthlyDeliveryOrdersLimit,
    };
  }

  /**
   * Calcula estimativa de distância e taxa sugerida para um endereço de destino
   */
  async estimateDeliveryFee(
    companyId: string | Types.ObjectId,
    input: EstimateDeliveryFeeInput,
  ): Promise<DeliveryFeeEstimateResult> {
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const company = await this.companyModel
      .findById(companyObjectId)
      .select('address tradeName')
      .lean()
      .exec();

    const originFormatted =
      input.originAddress?.trim() ||
      this.buildFormattedAddress(company?.address) ||
      'Centro, Lisboa';
    const destinationFormatted =
      input.destinationAddress?.formattedAddress?.trim() ||
      this.buildFormattedAddress(input.destinationAddress);

    if (!destinationFormatted) {
      throw new BadRequestException('Informe o endereço do cliente para calcular a rota e a taxa.');
    }

    const [originCoords, destCoords] = await Promise.all([
      this.geocodeAddress(originFormatted, company?.address),
      this.geocodeAddress(destinationFormatted, input.destinationAddress),
    ]);

    const distanceKm = this.calculateDrivingDistanceKm(
      originCoords,
      destCoords,
      originFormatted.toLowerCase() === destinationFormatted.toLowerCase(),
    );

    const baseFeeCents = input.baseFeeCents ?? DeliveryPlannerService.DEFAULT_BASE_FEE_CENTS;
    const perKmCents = input.perKmCents ?? DeliveryPlannerService.DEFAULT_PER_KM_CENTS;
    const includedKm = DeliveryPlannerService.DEFAULT_INCLUDED_KM;

    const suggestedFeeCents = this.calculateSuggestedFeeCents(
      distanceKm,
      baseFeeCents,
      perKmCents,
      includedKm,
    );
    const estimatedDurationMinutes = Math.max(8, Math.round(distanceKm * 2.5 + 4));

    return {
      distanceKm,
      estimatedDurationMinutes,
      suggestedFeeCents,
      originFormatted,
      destinationFormatted,
      breakdown: {
        baseFeeCents,
        includedKm,
        extraKm: Number(Math.max(0, distanceKm - includedKm).toFixed(1)),
        ratePerExtraKmCents: perKmCents,
      },
    };
  }

  /**
   * Otimiza a sequência de paradas (Nearest-Neighbor + 2-opt TSP) e sugere/aplica taxas baseadas na distância
   */
  async optimizeRoute(
    companyId: string | Types.ObjectId,
    input: OptimizeDeliveryRouteInput,
  ): Promise<DailyDeliveryPlan> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    // Garantir que os pedidos do dia já estejam sincronizados
    await this.getDailyDeliveries(companyId, input.date);

    const company = await this.companyModel
      .findById(companyObjectId)
      .select('address')
      .lean()
      .exec();

    const originFormatted =
      this.buildFormattedAddress(company?.address) ||
      input.originAddress?.trim() ||
      'Centro, Lisboa';
    const originCoords = await this.geocodeAddress(originFormatted, company?.address);

    const filter: Record<string, any> = {
      companyId: companyObjectId,
      date: input.date,
      deletedAt: { $exists: false },
    };
    if (input.shift && input.shift !== 'all') {
      filter.shift = input.shift;
    }

    const deliveries = await this.deliveryModel.find(filter).exec();
    if (deliveries.length === 0) {
      throw new BadRequestException('Não há entregas neste período para otimizar a rota.');
    }

    // Resolver coordenadas de todas as paradas em paralelo
    const stopsWithCoords = await Promise.all(
      deliveries.map(async (doc) => {
        const addrText =
          doc.address?.formattedAddress ||
          this.buildFormattedAddress(doc.address) ||
          doc.customerName;
        const coords = await this.geocodeAddress(addrText, doc.address);
        // Distância direta da loja até o cliente (para cálculo justo da taxa de entrega do cliente)
        const directDistanceFromStoreKm = this.calculateDrivingDistanceKm(originCoords, coords);
        const suggestedFeeCents = this.calculateSuggestedFeeCents(
          directDistanceFromStoreKm,
          input.baseFeeCents ?? DeliveryPlannerService.DEFAULT_BASE_FEE_CENTS,
          input.perKmCents ?? DeliveryPlannerService.DEFAULT_PER_KM_CENTS,
        );
        return {
          doc,
          coords,
          directDistanceFromStoreKm,
          suggestedFeeCents,
        };
      }),
    );

    // Separar entregas pendentes/em rota (que entram na otimização ativa) das já entregues
    const pendingStops = stopsWithCoords.filter((s) => s.doc.status !== 'delivered');
    const completedStops = stopsWithCoords.filter((s) => s.doc.status === 'delivered');

    // Algoritmo Nearest-Neighbor a partir do ponto de partida (Loja)
    const unvisited = [...pendingStops];
    const orderedRoute: typeof stopsWithCoords = [];
    let currentPos: GeoCoords = originCoords;

    while (unvisited.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const dist = this.calculateDrivingDistanceKm(currentPos, candidate.coords);
        // Leve preferência por turnos mais cedo quando a distância for muito próxima
        const shiftWeight =
          candidate.doc.shift === 'morning'
            ? 0
            : candidate.doc.shift === 'afternoon'
            ? 0.4
            : candidate.doc.shift === 'evening'
            ? 0.8
            : 0.2;
        const score = dist + shiftWeight;

        if (score < bestDist) {
          bestDist = score;
          bestIdx = i;
        }
      }

      const nextStop = unvisited.splice(bestIdx, 1)[0];
      orderedRoute.push(nextStop);
      currentPos = nextStop.coords;
    }

    // Refinamento 2-opt para eliminar cruzamentos na rota
    if (orderedRoute.length >= 4) {
      let improved = true;
      let iterations = 0;
      while (improved && iterations < 20) {
        improved = false;
        iterations++;
        for (let i = 0; i < orderedRoute.length - 2; i++) {
          for (let k = i + 2; k < orderedRoute.length; k++) {
            const pA = i === 0 ? originCoords : orderedRoute[i - 1].coords;
            const pB = orderedRoute[i].coords;
            const pC = orderedRoute[k].coords;
            const pD = k + 1 < orderedRoute.length ? orderedRoute[k + 1].coords : null;

            const currentEdgeDist =
              this.calculateDrivingDistanceKm(pA, pB) +
              (pD ? this.calculateDrivingDistanceKm(pC, pD) : 0);
            const swappedEdgeDist =
              this.calculateDrivingDistanceKm(pA, pC) +
              (pD ? this.calculateDrivingDistanceKm(pB, pD) : 0);

            if (swappedEdgeDist + 0.1 < currentEdgeDist) {
              const reversed = orderedRoute.slice(i, k + 1).reverse();
              orderedRoute.splice(i, k - i + 1, ...reversed);
              improved = true;
            }
          }
        }
      }
    }

    const finalSequence = [...orderedRoute, ...completedStops];
    const bulkOps: any[] = [];
    const orderBulkOps: any[] = [];

    let prevCoords = originCoords;
    for (let idx = 0; idx < finalSequence.length; idx++) {
      const stop = finalSequence[idx];
      const legDistanceKm = this.calculateDrivingDistanceKm(prevCoords, stop.coords);
      prevCoords = stop.coords;

      const updateFields: Record<string, any> = {
        routeOrder: idx + 1,
        distanceKm: legDistanceKm,
        suggestedDeliveryFeeCents: stop.suggestedFeeCents,
        latitude: stop.coords.lat,
        longitude: stop.coords.lng,
      };

      if (input.applySuggestedFees) {
        updateFields.deliveryFeeCents = stop.suggestedFeeCents;
        if (stop.doc.orderId) {
          orderBulkOps.push({
            orderId: stop.doc.orderId,
            newFeeCents: stop.suggestedFeeCents,
          });
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: stop.doc._id },
          update: { $set: updateFields },
        },
      });
    }

    if (bulkOps.length > 0) {
      await this.deliveryModel.bulkWrite(bulkOps);
    }

    // Se applySuggestedFees foi marcado, atualizar também os pedidos vinculados
    if (orderBulkOps.length > 0) {
      await Promise.all(
        orderBulkOps.map(async ({ orderId, newFeeCents }) => {
          const ord = await this.orderModel.findOne({ _id: orderId, companyId: companyObjectId });
          if (ord) {
            const oldFee = ord.deliveryFeeCents || 0;
            const diff = newFeeCents - oldFee;
            ord.deliveryFeeCents = newFeeCents;
            ord.totalAmountCents = Math.max(0, (ord.totalAmountCents || 0) + diff);
            ord.remainingAmountCents = Math.max(0, ord.totalAmountCents - (ord.paidAmountCents || 0));
            if (ord.remainingAmountCents > 0 && ord.financialStatus === 'paid') {
              ord.financialStatus = (ord.paidAmountCents || 0) > 0 ? 'partial' : 'unpaid';
            }
            await ord.save();
          }
        }),
      );
    }

    return this.getDailyDeliveries(companyId, input.date);
  }

  /**
   * Aplica a taxa de entrega sugerida por distância a uma parada específica (e sincroniza com o pedido)
   */
  async applySuggestedFee(
    companyId: string | Types.ObjectId,
    id: string,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    let suggested = delivery.suggestedDeliveryFeeCents;
    if (!suggested) {
      const company = await this.companyModel.findById(companyObjectId).select('address').lean();
      const originCoords = this.resolveFallbackCoords(
        this.buildFormattedAddress(company?.address) || 'Centro, Lisboa',
        company?.address,
      );
      const stopCoords = this.resolveFallbackCoords(
        delivery.address?.formattedAddress || this.buildFormattedAddress(delivery.address),
        delivery.address,
      );
      const dist = this.calculateDrivingDistanceKm(originCoords, stopCoords);
      suggested = this.calculateSuggestedFeeCents(dist);
      delivery.distanceKm = dist;
      delivery.suggestedDeliveryFeeCents = suggested;
    }

    const oldFee = delivery.deliveryFeeCents || 0;
    const diff = suggested - oldFee;
    delivery.deliveryFeeCents = suggested;

    if (delivery.orderId) {
      const ord = await this.orderModel.findOne({
        _id: delivery.orderId,
        companyId: companyObjectId,
      });
      if (ord) {
        ord.deliveryFeeCents = suggested;
        ord.totalAmountCents = Math.max(0, (ord.totalAmountCents || 0) + diff);
        ord.remainingAmountCents = Math.max(0, ord.totalAmountCents - (ord.paidAmountCents || 0));
        if (ord.remainingAmountCents > 0 && ord.financialStatus === 'paid') {
          ord.financialStatus = (ord.paidAmountCents || 0) > 0 ? 'partial' : 'unpaid';
        }
        delivery.remainingAmountCents = ord.remainingAmountCents;
        delivery.financialStatus = ord.financialStatus;
        await ord.save();
      }
    }

    await delivery.save();
    return this.mapDelivery(delivery);
  }

  /**
   * Criação manual de entrega / parada de rota
   */
  async createDelivery(companyId: string | Types.ObjectId, input: CreateDeliveryItemInput): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const entitlements = await this.entitlementsService.getEntitlements(companyId);
    const limit = entitlements.limits.monthlyDeliveryOrdersLimit;

    if (limit !== -1) {
      const [y, m] = input.date.split('-');
      const monthPrefix = `${y}-${m}`;
      const currentMonthCount = await this.deliveryModel.countDocuments({
        companyId: companyObjectId,
        date: { $regex: `^${monthPrefix}` },
        deletedAt: { $exists: false },
      });

      if (limit === 0) {
        throw new BadRequestException(
          'O Planejador de Entregas é exclusivo dos planos Pro e Business. Faça o upgrade para gerenciar suas rotas.',
        );
      }

      if (currentMonthCount >= limit) {
        throw new BadRequestException(
          `Você atingiu o limite de ${limit} entregas planejadas neste mês no plano ${entitlements.planCode.toUpperCase()}. Faça upgrade para o plano Business para entregas ilimitadas.`,
        );
      }
    }

    const formattedAddress =
      input.address?.formattedAddress || this.buildFormattedAddress(input.address);

    const company = await this.companyModel.findById(companyObjectId).select('address').lean();
    const originCoords = this.resolveFallbackCoords(
      this.buildFormattedAddress(company?.address) || 'Centro, Lisboa',
      company?.address,
    );
    const stopCoords = await this.geocodeAddress(
      formattedAddress || input.customerName,
      input.address,
    );
    const distanceKm = input.distanceKm ?? this.calculateDrivingDistanceKm(originCoords, stopCoords);
    const suggestedDeliveryFeeCents =
      input.suggestedDeliveryFeeCents ?? this.calculateSuggestedFeeCents(distanceKm);

    const created = await this.deliveryModel.create({
      companyId: companyObjectId,
      date: input.date,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined,
      orderNumber: input.orderNumber,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim(),
      address: {
        ...input.address,
        formattedAddress,
      },
      shift: input.shift || 'morning',
      scheduledTime: input.scheduledTime?.trim(),
      deliveryFeeCents: input.deliveryFeeCents || 0,
      suggestedDeliveryFeeCents,
      distanceKm,
      routeOrder: input.routeOrder,
      latitude: stopCoords.lat,
      longitude: stopCoords.lng,
      remainingAmountCents: input.remainingAmountCents || 0,
      financialStatus: input.financialStatus || 'unpaid',
      status: input.status || 'pending',
      driverName: input.driverName?.trim(),
      notes: input.notes?.trim(),
      orderItemsCount: input.orderItemsCount || 1,
      itemsSummary: input.itemsSummary?.trim(),
    });

    return this.mapDelivery(created);
  }

  /**
   * Atualização de dados da entrega
   */
  async updateDelivery(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateDeliveryItemInput,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    if (input.customerName !== undefined) delivery.customerName = input.customerName.trim();
    if (input.customerPhone !== undefined) delivery.customerPhone = input.customerPhone.trim();
    if (input.shift !== undefined) delivery.shift = input.shift;
    if (input.scheduledTime !== undefined) delivery.scheduledTime = input.scheduledTime.trim();
    if (input.driverName !== undefined) delivery.driverName = input.driverName.trim();
    if (input.notes !== undefined) delivery.notes = input.notes.trim();
    if (input.deliveryFeeCents !== undefined) delivery.deliveryFeeCents = input.deliveryFeeCents;
    if (input.remainingAmountCents !== undefined) delivery.remainingAmountCents = input.remainingAmountCents;
    if (input.routeOrder !== undefined) delivery.routeOrder = input.routeOrder;

    if (input.address) {
      const formattedAddress =
        input.address.formattedAddress || this.buildFormattedAddress(input.address);
      delivery.address = {
        ...input.address,
        formattedAddress,
      };
      const company = await this.companyModel.findById(companyObjectId).select('address').lean();
      const originCoords = this.resolveFallbackCoords(
        this.buildFormattedAddress(company?.address) || 'Centro, Lisboa',
        company?.address,
      );
      const stopCoords = await this.geocodeAddress(formattedAddress, input.address);
      delivery.latitude = stopCoords.lat;
      delivery.longitude = stopCoords.lng;
      delivery.distanceKm = this.calculateDrivingDistanceKm(originCoords, stopCoords);
      delivery.suggestedDeliveryFeeCents = this.calculateSuggestedFeeCents(delivery.distanceKm);
    }

    await delivery.save();
    return this.mapDelivery(delivery);
  }

  /**
   * Atualização de status da entrega (Pendente -> Em Rota -> Entregue -> Não Entregue)
   */
  async updateDeliveryStatus(
    companyId: string | Types.ObjectId,
    id: string,
    input: UpdateDeliveryStatusInput,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    delivery.status = input.status;
    if (input.status === 'delivered') {
      delivery.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : new Date();

      if (delivery.orderId) {
        await this.orderModel.updateOne(
          { _id: delivery.orderId, companyId: companyObjectId },
          { operationalStatus: 'delivered' },
        );
      }
    } else if (input.status === 'out_for_delivery') {
      if (delivery.orderId) {
        await this.orderModel.updateOne(
          { _id: delivery.orderId, companyId: companyObjectId },
          { operationalStatus: 'ready' },
        );
      }
    }

    if (input.notes !== undefined) {
      delivery.notes = input.notes.trim();
    }

    await delivery.save();
    return this.mapDelivery(delivery);
  }

  /**
   * Atribuição de entregador
   */
  async assignDriver(
    companyId: string | Types.ObjectId,
    id: string,
    driverName: string,
  ): Promise<IDeliveryItem> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const delivery = await this.deliveryModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: companyObjectId,
      deletedAt: { $exists: false },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    delivery.driverName = driverName.trim();
    await delivery.save();

    return this.mapDelivery(delivery);
  }

  /**
   * Exclusão da entrega
   */
  async deleteDelivery(companyId: string | Types.ObjectId, id: string): Promise<{ success: boolean }> {
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const result = await this.deliveryModel.updateOne(
      { _id: new Types.ObjectId(id), companyId: companyObjectId },
      { deletedAt: new Date() },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Entrega não encontrada');
    }

    return { success: true };
  }
}
