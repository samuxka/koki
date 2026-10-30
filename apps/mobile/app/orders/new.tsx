import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { Button } from '../../src/components/ui/Button';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import {
  Customer,
  Product,
  CashAccount,
  ProductComplement,
  Coupon,
  ValidateCouponResult,
  DeliveryFeeEstimateResult,
} from '@koki/types';
import {
  Plus,
  Trash2,
  Calendar,
  User,
  ShoppingBag,
  Wallet,
  X,
  Check,
  Ticket,
  Tag,
  Search,
  UserPlus,
  MapPin,
  Sparkles,
} from 'lucide-react-native';

interface SelectedItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  flavor?: string;
  complements?: ProductComplement[];
  notes?: string;
}

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function NewOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Customer Autocomplete & Quick Registration State
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId || '');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerStreet, setNewCustomerStreet] = useState('');
  const [newCustomerNumber, setNewCustomerNumber] = useState('');
  const [newCustomerNeighborhood, setNewCustomerNeighborhood] = useState('');
  const [newCustomerCity, setNewCustomerCity] = useState('');
  const [newCustomerPostalCode, setNewCustomerPostalCode] = useState('');

  // Order Form State
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  ); // tomorrow
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0);
  const [feeEstimate, setFeeEstimate] = useState<DeliveryFeeEstimateResult | null>(null);
  const [isEstimatingFee, setIsEstimatingFee] = useState(false);

  const [discountCents, setDiscountCents] = useState(0);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [notes, setNotes] = useState('');

  // Product Customization Modal State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [selectedComplements, setSelectedComplements] = useState<ProductComplement[]>([]);
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Initial Payment
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [initialPaymentAccountId, setInitialPaymentAccountId] = useState('');
  const [initialPaymentAmountCents, setInitialPaymentAmountCents] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<any>('cash');

  const [errorMessage, setErrorMessage] = useState('');

  // Fetch Customers
  const { data: customersData } = useQuery<{ items: Customer[] } | Customer[]>({
    queryKey: ['customers-list-mini'],
    queryFn: () => api.get('/customers?limit=200'),
  });

  // Fetch Products
  const { data: productsData } = useQuery<{ items: Product[] } | Product[]>({
    queryKey: ['products-list-mini'],
    queryFn: () => api.get('/products?availableOnly=true'),
  });

  // Fetch Accounts for payment
  const { data: accountsData } = useQuery<CashAccount[] | { items: CashAccount[] }>({
    queryKey: ['cash-accounts-mini'],
    queryFn: () => api.get('/cash/accounts'),
  });

  const customers: Customer[] = useMemo(
    () =>
      Array.isArray(customersData)
        ? customersData
        : (customersData as any)?.items || [],
    [customersData],
  );

  const products: Product[] = useMemo(
    () =>
      Array.isArray(productsData)
        ? productsData
        : (productsData as any)?.items || [],
    [productsData],
  );

  const accounts: CashAccount[] = useMemo(
    () =>
      Array.isArray(accountsData)
        ? accountsData
        : (accountsData as any)?.items || [],
    [accountsData],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  // Sync customerSearchText when params.customerId loads a customer
  useEffect(() => {
    if (selectedCustomer && !customerSearchText) {
      setCustomerSearchText(selectedCustomer.name);
    }
  }, [selectedCustomer]);

  // Filter customers matching what is being typed
  const matchingCustomers = useMemo(() => {
    const query = normalizeSearchText(customerSearchText);
    if (!query) {
      return customers.slice(0, 6);
    }
    return customers
      .filter((c) => {
        const nameNorm = normalizeSearchText(c.name);
        const phoneNorm = normalizeSearchText(c.phone || '');
        return nameNorm.includes(query) || phoneNorm.includes(query);
      })
      .slice(0, 8);
  }, [customers, customerSearchText]);

  // Estimate delivery fee when customer & deliveryMethod === 'delivery'
  useEffect(() => {
    let active = true;
    const addr = selectedCustomer?.address;
    const hasAddress = !!(addr?.street || addr?.postalCode || addr?.city || addr?.neighborhood);

    if (deliveryMethod === 'delivery' && hasAddress && addr) {
      setIsEstimatingFee(true);
      api
        .post<DeliveryFeeEstimateResult>('/delivery-planner/estimate-fee', {
          destinationAddress: {
            street: addr.street,
            number: addr.number,
            neighborhood: addr.neighborhood,
            city: addr.city,
            postalCode: addr.postalCode,
          },
        })
        .then((res) => {
          if (!active) return;
          setFeeEstimate(res);
          if (deliveryFeeCents === 0 && res.suggestedFeeCents > 0) {
            setDeliveryFeeCents(res.suggestedFeeCents);
          }
        })
        .catch(() => {
          if (active) setFeeEstimate(null);
        })
        .finally(() => {
          if (active) setIsEstimatingFee(false);
        });
    } else {
      setFeeEstimate(null);
    }

    return () => {
      active = false;
    };
  }, [selectedCustomerId, deliveryMethod, selectedCustomer?.address?.street, selectedCustomer?.address?.postalCode]);

  // Quick Customer Creation Mutation
  const quickCreateCustomerMutation = useMutation({
    mutationFn: async () => {
      const nameToSave = (newCustomerName || customerSearchText).trim();
      if (!nameToSave) {
        throw new Error('Informe o nome do cliente para cadastrar.');
      }
      const hasAddr =
        newCustomerStreet.trim() ||
        newCustomerCity.trim() ||
        newCustomerPostalCode.trim() ||
        newCustomerNeighborhood.trim();

      return api.post<Customer>('/customers', {
        name: nameToSave,
        phone: newCustomerPhone.trim() || undefined,
        ...(hasAddr
          ? {
              address: {
                street: newCustomerStreet.trim() || undefined,
                number: newCustomerNumber.trim() || undefined,
                neighborhood: newCustomerNeighborhood.trim() || undefined,
                city: newCustomerCity.trim() || undefined,
                postalCode: newCustomerPostalCode.trim() || undefined,
              },
            }
          : {}),
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData(['customers-list-mini'], (old: any) => {
        const prevList: Customer[] = Array.isArray(old) ? old : old?.items || [];
        return [created, ...prevList];
      });
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      setSelectedCustomerId(created.id);
      setCustomerSearchText(created.name);
      setIsCreatingCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerStreet('');
      setNewCustomerNumber('');
      setNewCustomerNeighborhood('');
      setNewCustomerCity('');
      setNewCustomerPostalCode('');
    },
    onError: (err: any) => {
      Alert.alert('Erro ao cadastrar cliente', err.message || 'Verifique os dados informados.');
    },
  });

  const handleOpenQuickCustomerCreate = () => {
    setNewCustomerName(customerSearchText.trim());
    setSelectedCustomerId('');
    setIsCreatingCustomer(true);
  };

  // Calculate Subtotals & Total
  const itemsTotalCents = items.reduce((acc, item) => acc + item.subtotalCents, 0);
  const totalAmountCents = Math.max(0, itemsTotalCents - discountCents + deliveryFeeCents);

  // Add product to order or open customization modal
  const handleAddProduct = (product: Product) => {
    const hasFlavors = product.flavors && product.flavors.length > 0;
    const hasComplements = product.complements && product.complements.length > 0;

    if (hasFlavors || hasComplements) {
      setCustomizingProduct(product);
      setSelectedFlavor(hasFlavors ? product.flavors![0] : '');
      setSelectedComplements([]);
      setCustomQuantity(1);
      setItemNotes('');
    } else {
      const existingIndex = items.findIndex(
        (i) =>
          i.productId === product.id &&
          !i.flavor &&
          (!i.complements || i.complements.length === 0),
      );
      if (existingIndex >= 0) {
        const updated = [...items];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].subtotalCents =
          updated[existingIndex].quantity * updated[existingIndex].unitPriceCents;
        setItems(updated);
      } else {
        setItems([
          ...items,
          {
            productId: product.id,
            productName: product.name,
            unitPriceCents: product.priceCents,
            quantity: 1,
            subtotalCents: product.priceCents,
          },
        ]);
      }
    }
  };

  const handleConfirmCustomizedProduct = () => {
    if (!customizingProduct) return;

    if (
      customizingProduct.flavors &&
      customizingProduct.flavors.length > 0 &&
      !selectedFlavor.trim()
    ) {
      Alert.alert('Sabor obrigatório', 'Por favor, selecione um sabor para o produto.');
      return;
    }

    const complementsPriceCents = selectedComplements.reduce(
      (acc, c) => acc + c.additionalPriceCents,
      0,
    );
    const finalUnitPriceCents = customizingProduct.priceCents + complementsPriceCents;
    const subtotalCents = finalUnitPriceCents * customQuantity;

    setItems([
      ...items,
      {
        productId: customizingProduct.id,
        productName: customizingProduct.name,
        unitPriceCents: finalUnitPriceCents,
        quantity: customQuantity,
        subtotalCents,
        flavor: selectedFlavor || undefined,
        complements: selectedComplements.length > 0 ? selectedComplements : undefined,
        notes: itemNotes.trim() || undefined,
      },
    ]);

    setCustomizingProduct(null);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].subtotalCents = newQty * updated[index].unitPriceCents;
    }
    setItems(updated);
  };

  const handleApplyCoupon = async () => {
    const codeToTest = couponCodeInput.trim().toUpperCase();
    if (!codeToTest) {
      Alert.alert('Cupom', 'Digite o código do cupom que deseja aplicar.');
      return;
    }
    if (itemsTotalCents === 0) {
      Alert.alert('Cupom', 'Adicione pelo menos um produto antes de aplicar o cupom.');
      return;
    }
    try {
      setIsValidatingCoupon(true);
      const res = await api.post<ValidateCouponResult>('/coupons/validate', {
        code: codeToTest,
        orderTotalCents: itemsTotalCents,
        customerId: selectedCustomerId || undefined,
      });

      if (res.valid && res.coupon) {
        setAppliedCoupon(res.coupon);
        setDiscountCents(res.discountCents);
        Alert.alert(
          'Cupom Aplicado!',
          `Cupom ${res.coupon.code} aplicado com sucesso! Desconto: ${formatCurrency(res.discountCents, currency)}.`,
        );
      } else {
        Alert.alert('Cupom Não Aplicado', res.message || 'Cupom inválido ou expirado.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao validar cupom.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountCents(0);
    setCouponCodeInput('');
  };

  // Submit Mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      let customerId = selectedCustomerId;

      // Create customer on the fly if user is in quick-create form or typed a new customer
      if (isCreatingCustomer) {
        const nameToCreate = (newCustomerName || customerSearchText).trim();
        if (!nameToCreate) {
          throw new Error('Informe o nome do novo cliente');
        }
        const hasAddr =
          newCustomerStreet.trim() ||
          newCustomerCity.trim() ||
          newCustomerPostalCode.trim() ||
          newCustomerNeighborhood.trim();
        const createdCustomer = await api.post<Customer>('/customers', {
          name: nameToCreate,
          phone: newCustomerPhone.trim() || undefined,
          ...(hasAddr
            ? {
                address: {
                  street: newCustomerStreet.trim() || undefined,
                  number: newCustomerNumber.trim() || undefined,
                  neighborhood: newCustomerNeighborhood.trim() || undefined,
                  city: newCustomerCity.trim() || undefined,
                  postalCode: newCustomerPostalCode.trim() || undefined,
                },
              }
            : {}),
        });
        customerId = createdCustomer.id;
      }

      if (!customerId) {
        throw new Error('Selecione um cliente na lista ou clique em "Cadastrar cliente"');
      }

      if (items.length === 0) {
        throw new Error('Adicione pelo menos um produto ao pedido');
      }

      return api.post('/orders', {
        customerId,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          flavor: i.flavor,
          complements: i.complements,
          notes: i.notes,
        })),
        discountCents,
        couponCode: appliedCoupon?.code,
        couponId: appliedCoupon?.id,
        deliveryFeeCents,
        deliveryDate: new Date(deliveryDate).toISOString(),
        deliveryMethod,
        notes,
        ...(hasInitialPayment && initialPaymentAmountCents > 0
          ? {
              initialPayment: {
                cashAccountId: initialPaymentAccountId || accounts?.[0]?.id,
                amountCents: initialPaymentAmountCents,
                paymentMethod,
              },
            }
          : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan'] });
      router.back();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Falha ao criar pedido');
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* 1. Cliente (Caixa de texto com busca automática + botão Cadastrar cliente) */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <User size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Cliente</Text>
        </View>

        {!isCreatingCustomer ? (
          <View>
            {/* Caixa de texto de busca de cliente */}
            <View style={styles.customerSearchInputWrapper}>
              <Search size={16} color={colors.textMuted} style={styles.customerSearchIcon} />
              <TextInput
                style={styles.customerSearchInput}
                placeholder="Digite o nome ou telefone do cliente..."
                placeholderTextColor={colors.textMuted}
                value={customerSearchText}
                onChangeText={(text) => {
                  setCustomerSearchText(text);
                  if (selectedCustomer && text.trim() !== selectedCustomer.name) {
                    setSelectedCustomerId('');
                  }
                }}
              />
              {customerSearchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCustomerSearchText('');
                    setSelectedCustomerId('');
                  }}
                  style={styles.clearSearchBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Cliente Selecionado */}
            {selectedCustomer ? (
              <View style={styles.selectedCustomerBanner}>
                <View style={styles.selectedCustomerBadgeIcon}>
                  <Check size={14} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                  {selectedCustomer.phone ? (
                    <Text style={styles.selectedCustomerMeta}>{selectedCustomer.phone}</Text>
                  ) : null}
                  {selectedCustomer.address?.street || selectedCustomer.address?.city ? (
                    <Text style={styles.selectedCustomerMeta} numberOfLines={1}>
                      📍 {[
                        selectedCustomer.address?.street,
                        selectedCustomer.address?.number,
                        selectedCustomer.address?.neighborhood,
                        selectedCustomer.address?.city,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCustomerId('');
                    setCustomerSearchText('');
                  }}
                  style={styles.changeCustomerBtn}
                >
                  <Text style={styles.changeCustomerBtnText}>Trocar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Lista de Clientes que correspondem ao texto digitado */
              <View style={styles.customerMatchesContainer}>
                {matchingCustomers.length > 0 ? (
                  <>
                    <Text style={styles.matchesHeaderLabel}>
                      {customerSearchText.trim()
                        ? `Clientes encontrados (${matchingCustomers.length})`
                        : 'Sugestões de clientes'}
                    </Text>
                    <View style={styles.customerMatchesList}>
                      {matchingCustomers.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.customerMatchItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchText(c.name);
                          }}
                        >
                          <View style={styles.customerMatchAvatar}>
                            <Text style={styles.customerMatchAvatarText}>
                              {c.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customerMatchName}>{c.name}</Text>
                            {c.phone || c.address?.street ? (
                              <Text style={styles.customerMatchSub} numberOfLines={1}>
                                {[
                                  c.phone,
                                  c.address?.street
                                    ? `${c.address.street}${c.address.number ? `, ${c.address.number}` : ''}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.selectMatchActionText}>Selecionar</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  /* Caso não tenha nenhum cliente que corresponda, aparece o botão "Cadastrar cliente" */
                  <View style={styles.noCustomerMatchBox}>
                    <Text style={styles.noCustomerMatchText}>
                      Nenhum cliente encontrado para{' '}
                      <Text style={{ fontWeight: '700', color: colors.primaryDark }}>
                        "{customerSearchText.trim()}"
                      </Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.registerCustomerBtn}
                      activeOpacity={0.85}
                      onPress={handleOpenQuickCustomerCreate}
                    >
                      <UserPlus size={16} color="#ffffff" />
                      <Text style={styles.registerCustomerBtnText}>Cadastrar cliente</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          /* Formulário rápido de cadastro de cliente inline */
          <View style={styles.quickCreateCustomerBox}>
            <View style={styles.quickCreateHeaderRow}>
              <Text style={styles.quickCreateTitle}>Novo Cadastro de Cliente</Text>
              <TouchableOpacity
                onPress={() => setIsCreatingCustomer(false)}
                style={styles.switchCustomerBtn}
              >
                <Text style={styles.switchCustomerText}>← Voltar para busca</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Nome do Cliente *"
              placeholder="Ex: Ana Beatriz"
              value={newCustomerName}
              onChangeText={setNewCustomerName}
            />

            <Input
              label="Telefone / WhatsApp"
              placeholder="Ex: +351 912 345 678"
              value={newCustomerPhone}
              onChangeText={setNewCustomerPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.quickAddressSectionTitle}>
              Endereço de Entrega (Opcional — usado para calcular rota e taxa)
            </Text>
            <Input
              label="Rua / Avenida"
              placeholder="Ex: Rua Augusta"
              value={newCustomerStreet}
              onChangeText={setNewCustomerStreet}
            />

            <View style={styles.quickRowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Número"
                  placeholder="Ex: 120"
                  value={newCustomerNumber}
                  onChangeText={setNewCustomerNumber}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Input
                  label="Bairro / Freguesia"
                  placeholder="Ex: Baixa"
                  value={newCustomerNeighborhood}
                  onChangeText={setNewCustomerNeighborhood}
                />
              </View>
            </View>

            <View style={styles.quickRowInputs}>
              <View style={{ flex: 1.2 }}>
                <Input
                  label="Cidade"
                  placeholder="Ex: Lisboa"
                  value={newCustomerCity}
                  onChangeText={setNewCustomerCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Código Postal / CEP"
                  placeholder="Ex: 1100-053"
                  value={newCustomerPostalCode}
                  onChangeText={setNewCustomerPostalCode}
                />
              </View>
            </View>

            <Button
              title="Salvar e Selecionar Cliente"
              size="sm"
              loading={quickCreateCustomerMutation.isPending}
              onPress={() => quickCreateCustomerMutation.mutate()}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        )}
      </Card>

      {/* 2. Produtos do Catálogo */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <ShoppingBag size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Selecionar Produtos</Text>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyCatalogBox}>
            <Text style={styles.emptyCatalogText}>Nenhum produto cadastrado ou disponível.</Text>
            <TouchableOpacity
              onPress={() => router.push('/products/new' as any)}
              style={styles.emptyCatalogBtn}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={styles.emptyCatalogBtnText}>Cadastrar Produto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsCatalogRow}>
            {products.map((p) => {
              const hasFlavors = p.flavors && p.flavors.length > 0;
              const hasComplements = p.complements && p.complements.length > 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => handleAddProduct(p)}
                  style={styles.productCatalogCard}
                >
                  <Text style={styles.productCatalogName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.productCatalogPrice}>
                    {formatCurrency(p.priceCents, currency)}
                  </Text>
                  {(hasFlavors || hasComplements) && (
                    <View style={styles.productBadgeRow}>
                      <Text style={styles.productBadgeText}>
                        {hasFlavors ? `${p.flavors!.length} sab.` : ''}
                        {hasFlavors && hasComplements ? ' • ' : ''}
                        {hasComplements ? `${p.complements!.length} compl.` : ''}
                      </Text>
                    </View>
                  )}
                  <View style={styles.addMiniBtn}>
                    <Plus size={14} color="#ffffff" />
                    <Text style={styles.addMiniBtnText}>
                      {hasFlavors || hasComplements ? 'Personalizar' : 'Adicionar'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Itens Adicionados */}
        <Text style={[styles.subTitle, { marginTop: spacing.md }]}>Itens do Pedido ({items.length})</Text>
        {items.length === 0 ? (
          <Text style={styles.noItemsText}>Nenhum produto adicionado ainda.</Text>
        ) : (
          items.map((item, index) => (
            <View key={index} style={styles.orderItemRow}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.itemName}>{item.productName}</Text>
                {item.flavor ? (
                  <View style={styles.flavorBadge}>
                    <Text style={styles.flavorBadgeText}>Sabor: {item.flavor}</Text>
                  </View>
                ) : null}
                {item.complements && item.complements.length > 0 ? (
                  <Text style={styles.itemComplementsText}>
                    + {item.complements.map((c) => c.name).join(', ')}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text style={styles.itemNotesText}>Obs: {item.notes}</Text>
                ) : null}
                <Text style={styles.itemPriceUnit}>
                  {formatCurrency(item.unitPriceCents, currency)} un.
                </Text>
              </View>

              <View style={styles.quantityControls}>
                <TouchableOpacity
                  onPress={() => handleUpdateQuantity(index, -1)}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => handleUpdateQuantity(index, 1)}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemRightSide}>
                <Text style={styles.itemSubtotal}>
                  {formatCurrency(item.subtotalCents, currency)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveItem(index)}
                  style={styles.removeItemBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 3. Entrega e Prazos */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calendar size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Entrega e Data</Text>
        </View>

        <Input
          label="Data Prevista de Entrega (AAAA-MM-DD) *"
          placeholder="2026-10-25"
          value={deliveryDate}
          onChangeText={setDeliveryDate}
        />

        <Text style={styles.fieldLabel}>Método de Entrega</Text>
        <View style={styles.deliveryMethodsRow}>
          {[
            { label: 'Retirada na Loja', val: 'pickup' as const },
            { label: 'Entrega / Delivery', val: 'delivery' as const },
          ].map((m) => (
            <TouchableOpacity
              key={m.val}
              onPress={() => setDeliveryMethod(m.val)}
              style={[
                styles.deliveryMethodBtn,
                deliveryMethod === m.val && styles.deliveryMethodBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.deliveryMethodText,
                  deliveryMethod === m.val && styles.deliveryMethodTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {deliveryMethod === 'delivery' && (
          <View>
            <CurrencyInput
              label="Taxa de Entrega"
              cents={deliveryFeeCents}
              onChangeCents={setDeliveryFeeCents}
              currency={currency}
            />

            {isEstimatingFee ? (
              <Text style={styles.feeEstimateHintText}>
                Calculando distância e taxa sugerida para o endereço do cliente...
              </Text>
            ) : feeEstimate ? (
              <View style={styles.feeSuggestionBanner}>
                <View style={styles.feeSuggestionLeft}>
                  <Sparkles size={15} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeSuggestionTitle}>
                      Taxa sugerida ({feeEstimate.distanceKm} km • ~{feeEstimate.estimatedDurationMinutes} min):{' '}
                      <Text style={{ fontWeight: '800', color: colors.primary }}>
                        {formatCurrency(feeEstimate.suggestedFeeCents, currency)}
                      </Text>
                    </Text>
                    {feeEstimate.destinationFormatted ? (
                      <Text style={styles.feeSuggestionAddress} numberOfLines={1}>
                        Destino: {feeEstimate.destinationFormatted}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {deliveryFeeCents !== feeEstimate.suggestedFeeCents && (
                  <TouchableOpacity
                    style={styles.applySuggestedFeeBtn}
                    onPress={() => setDeliveryFeeCents(feeEstimate.suggestedFeeCents)}
                  >
                    <Text style={styles.applySuggestedFeeBtnText}>Aplicar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        )}

        <CurrencyInput
          label="Desconto Concedido"
          cents={discountCents}
          onChangeCents={setDiscountCents}
          currency={currency}
        />

        <Input
          label="Observações do Pedido"
          placeholder="Ex: Escrita no bolo: Parabéns Lucas! Recheio sem nozes."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </Card>

      {/* 4. Pagamento Inicial */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Wallet size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Pagamento Inicial (Opcional)</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const next = !hasInitialPayment;
            setHasInitialPayment(next);
            if (next && initialPaymentAmountCents === 0) {
              setInitialPaymentAmountCents(Math.round(totalAmountCents / 2)); // sugere 50% de sinal
            }
          }}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, hasInitialPayment && styles.checkboxActive]} />
          <Text style={styles.checkboxLabel}>Registrar entrada/sinal de pagamento agora</Text>
        </TouchableOpacity>

        {hasInitialPayment && (
          <View style={{ marginTop: spacing.md }}>
            <CurrencyInput
              label="Valor Pago Inicialmente"
              cents={initialPaymentAmountCents}
              onChangeCents={setInitialPaymentAmountCents}
              currency={currency}
            />

            <Text style={styles.fieldLabel}>Caixinha de Destino</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsRow}>
              {accounts.map((acc) => {
                const isSelected = (initialPaymentAccountId || accounts[0]?.id) === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => setInitialPaymentAccountId(acc.id)}
                    style={[styles.accountChip, isSelected && styles.accountChipSelected]}
                  >
                    <Text
                      style={[
                        styles.accountChipText,
                        isSelected && styles.accountChipTextSelected,
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Card>

      {/* Cupom Promocional */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ticket size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Cupom Promocional</Text>
        </View>

        {appliedCoupon ? (
          <View style={styles.appliedCouponBox}>
            <View style={styles.appliedCouponLeft}>
              <Tag size={16} color={colors.success} style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
                <Text style={styles.appliedCouponDesc}>
                  Desconto de {formatCurrency(discountCents, currency)} aplicado
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleRemoveCoupon} style={styles.removeCouponBtn}>
              <X size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.couponInputRow}>
            <TextInput
              style={styles.couponTextInput}
              placeholder="Código (ex: DOCE10)"
              placeholderTextColor={colors.textMuted}
              value={couponCodeInput}
              onChangeText={(txt: string) => setCouponCodeInput(txt.toUpperCase())}
              autoCapitalize="characters"
            />
            <Button
              title="Aplicar"
              size="sm"
              loading={isValidatingCoupon}
              onPress={handleApplyCoupon}
              style={{ minWidth: 84 }}
            />
          </View>
        )}
      </Card>

      {/* Resumo Final e Botão Criar */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal Itens:</Text>
          <Text style={styles.summaryValue}>{formatCurrency(itemsTotalCents, currency)}</Text>
        </View>
        {deliveryFeeCents > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de Entrega:</Text>
            <Text style={styles.summaryValue}>+{formatCurrency(deliveryFeeCents, currency)}</Text>
          </View>
        )}
        {discountCents > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Desconto:</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              -{formatCurrency(discountCents, currency)}
            </Text>
          </View>
        )}
        <View style={styles.totalDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total do Pedido:</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalAmountCents, currency)}</Text>
        </View>

        <Button
          title="Salvar Pedido"
          loading={createOrderMutation.isPending}
          onPress={() => createOrderMutation.mutate()}
          style={styles.submitOrderBtn}
        />
      </Card>

      {/* Modal de Personalização de Produto (Sabores e Complementos) */}
      <Modal visible={!!customizingProduct} transparent animationType="slide">
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalContent}>
            <View style={styles.customModalHeader}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.customModalTitle} numberOfLines={1}>
                  {customizingProduct?.name}
                </Text>
                <Text style={styles.customModalBasePrice}>
                  Preço Base: {formatCurrency(customizingProduct?.priceCents || 0, currency)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCustomizingProduct(null)}
                style={styles.customModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.customModalScrollBody}
            >
              {/* Seleção de Sabor */}
              {customizingProduct?.flavors && customizingProduct.flavors.length > 0 && (
                <View style={styles.customSection}>
                  <View style={styles.customSectionHeader}>
                    <Text style={styles.customSectionTitle}>Selecione o Sabor *</Text>
                    <View style={styles.customRequiredBadge}>
                      <Text style={styles.customRequiredBadgeText}>Obrigatório</Text>
                    </View>
                  </View>

                  <View style={styles.flavorsGrid}>
                    {customizingProduct.flavors.map((flavor) => {
                      const isSelected = selectedFlavor === flavor;
                      return (
                        <TouchableOpacity
                          key={flavor}
                          activeOpacity={0.8}
                          onPress={() => setSelectedFlavor(flavor)}
                          style={[
                            styles.flavorOptionChip,
                            isSelected && styles.flavorOptionChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.flavorOptionText,
                              isSelected && styles.flavorOptionTextActive,
                            ]}
                          >
                            {flavor}
                          </Text>
                          {isSelected && <Check size={14} color="#ffffff" style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Seleção de Complementos */}
              {customizingProduct?.complements && customizingProduct.complements.length > 0 && (
                <View style={styles.customSection}>
                  <Text style={styles.customSectionTitle}>Complementos / Adicionais</Text>
                  <Text style={styles.customSectionHelp}>
                    Selecione quantos desejar para somar ao item
                  </Text>

                  <View style={styles.complementsList}>
                    {customizingProduct.complements.map((comp) => {
                      const isSelected = selectedComplements.some((c) => c.name === comp.name);
                      return (
                        <TouchableOpacity
                          key={comp.name}
                          activeOpacity={0.8}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedComplements(
                                selectedComplements.filter((c) => c.name !== comp.name),
                              );
                            } else {
                              setSelectedComplements([...selectedComplements, comp]);
                            }
                          }}
                          style={[
                            styles.complementItemRow,
                            isSelected && styles.complementItemRowActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.complementCheckbox,
                              isSelected && styles.complementCheckboxActive,
                            ]}
                          >
                            {isSelected && <Check size={12} color="#ffffff" />}
                          </View>
                          <Text style={styles.complementItemName}>{comp.name}</Text>
                          <Text style={styles.complementItemPrice}>
                            +{formatCurrency(comp.additionalPriceCents, currency)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Quantidade */}
              <View style={styles.customSection}>
                <Text style={styles.customSectionTitle}>Quantidade</Text>
                <View style={styles.customQtyRow}>
                  <TouchableOpacity
                    onPress={() => setCustomQuantity(Math.max(1, customQuantity - 1))}
                    style={styles.customQtyBtn}
                  >
                    <Text style={styles.customQtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.customQtyNumber}>{customQuantity}</Text>
                  <TouchableOpacity
                    onPress={() => setCustomQuantity(customQuantity + 1)}
                    style={styles.customQtyBtn}
                  >
                    <Text style={styles.customQtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Observação do Item */}
              <View style={styles.customSection}>
                <Input
                  label="Observação do Item (Opcional)"
                  placeholder="Ex: Pouco açúcar, escrever Parabéns Bia"
                  value={itemNotes}
                  onChangeText={setItemNotes}
                />
              </View>

              {/* Botão de confirmação */}
              {customizingProduct && (
                <View style={styles.customFooter}>
                  <View style={styles.customPricePreviewRow}>
                    <Text style={styles.customPricePreviewLabel}>Total do Item:</Text>
                    <Text style={styles.customPricePreviewValue}>
                      {formatCurrency(
                        (customizingProduct.priceCents +
                          selectedComplements.reduce((acc, c) => acc + c.additionalPriceCents, 0)) *
                          customQuantity,
                        currency,
                      )}
                    </Text>
                  </View>
                  <Button
                    title="Adicionar ao Pedido"
                    icon={<Plus size={18} color="#ffffff" />}
                    onPress={handleConfirmCustomizedProduct}
                    style={{ marginTop: spacing.xs }}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  subTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  errorBox: {
    backgroundColor: `${colors.danger}15`,
    borderColor: `${colors.danger}40`,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  customerSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 46,
  },
  customerSearchIcon: {
    marginRight: spacing.xs,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  clearSearchBtn: {
    padding: 4,
  },
  selectedCustomerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.goldenBeige}25`,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  selectedCustomerBadgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustomerName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  selectedCustomerMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  changeCustomerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeCustomerBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  customerMatchesContainer: {
    marginTop: spacing.sm,
  },
  matchesHeaderLabel: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginBottom: 6,
  },
  customerMatchesList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  customerMatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: spacing.sm,
  },
  customerMatchAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${colors.goldenBeige}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerMatchAvatarText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  customerMatchName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  customerMatchSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  selectMatchActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  noCustomerMatchBox: {
    backgroundColor: `${colors.goldenBeige}20`,
    borderWidth: 1,
    borderColor: `${colors.primary}35`,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  noCustomerMatchText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  registerCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  registerCustomerBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  quickCreateCustomerBox: {
    backgroundColor: `${colors.surface}80`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickCreateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  quickCreateTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  quickAddressSectionTitle: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  quickRowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  switchCustomerBtn: {
    paddingVertical: spacing.xs,
  },
  switchCustomerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  feeEstimateHintText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  feeSuggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.goldenBeige}30`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  feeSuggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  feeSuggestionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  feeSuggestionAddress: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  applySuggestedFeeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  applySuggestedFeeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  productsCatalogRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  productCatalogCard: {
    width: 130,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    marginRight: spacing.xs,
  },
  productCatalogName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  productCatalogPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  addMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.caramel,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  addMiniBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  noItemsText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  itemPriceUnit: {
    fontSize: 11,
    color: colors.textMuted,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  qtyValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    paddingHorizontal: 6,
  },
  itemSubtotal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    minWidth: 60,
    textAlign: 'right',
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  deliveryMethodsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  deliveryMethodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
  },
  deliveryMethodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}25`,
  },
  deliveryMethodText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  deliveryMethodTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  accountsRow: {
    flexDirection: 'row',
  },
  accountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    marginRight: spacing.xs,
  },
  accountChipSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}30`,
  },
  accountChipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  accountChipTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  totalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  totalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  submitOrderBtn: {
    marginTop: spacing.lg,
  },
  emptyCatalogBox: {
    backgroundColor: `${colors.goldenBeige}20`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyCatalogText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  emptyCatalogBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  productBadgeRow: {
    backgroundColor: `${colors.goldenBeige}40`,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  productBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  flavorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    marginTop: 2,
    marginBottom: 2,
  },
  flavorBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  itemComplementsText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  itemNotesText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  itemRightSide: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    minWidth: 70,
  },
  removeItemBtn: {
    padding: 4,
  },
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  customModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  customModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  customModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  customModalBasePrice: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  customModalCloseBtn: {
    padding: 4,
  },
  customModalScrollBody: {
    paddingBottom: spacing.lg,
  },
  customSection: {
    marginBottom: spacing.lg,
  },
  customSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  customSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  customSectionHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  customRequiredBadge: {
    backgroundColor: `${colors.danger}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  customRequiredBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.danger,
  },
  flavorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flavorOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flavorOptionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  flavorOptionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  flavorOptionTextActive: {
    color: '#ffffff',
  },
  complementsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  complementItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  complementItemRowActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}20`,
  },
  complementCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  complementCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  complementItemName: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  complementItemPrice: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  customQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    marginTop: spacing.xs,
  },
  customQtyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  customQtyBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  customQtyNumber: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  customFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  customPricePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  customPricePreviewLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  customPricePreviewValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  appliedCouponBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f8f3',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#c6e7ce',
    marginTop: spacing.xs,
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appliedCouponCode: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  appliedCouponDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  removeCouponBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0d5c5',
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  couponTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
});
