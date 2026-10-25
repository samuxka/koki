import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../../../src/theme';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { api } from '../../../src/services/api';
import { CustomerDetailResponse } from '@koki/types';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Award,
  Trash2,
} from 'lucide-react-native';

export default function EditCustomerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Address
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Loyalty Card
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyTargetOrders, setLoyaltyTargetOrders] = useState('10');
  const [loyaltyReward, setLoyaltyReward] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch customer data
  const { data, isLoading } = useQuery<CustomerDetailResponse>({
    queryKey: ['customer-detail', id],
    queryFn: () => api.get<CustomerDetailResponse>(`/customers/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.customer) {
      const c = data.customer;
      setName(c.name || '');
      setPhone(c.phone || '');
      setEmail(c.email || '');
      setNotes(c.notes || '');
      setPhotoUrl(c.photoUrl || '');

      if (c.address) {
        setStreet(c.address.street || '');
        setNumber(c.address.number || '');
        setComplement(c.address.complement || '');
        setNeighborhood(c.address.neighborhood || '');
        setCity(c.address.city || '');
        setPostalCode(c.address.postalCode || '');
      }

      if (data.loyaltyCard) {
        setLoyaltyEnabled(data.loyaltyCard.enabled);
        setLoyaltyTargetOrders(String(data.loyaltyCard.targetOrders || 10));
        setLoyaltyReward(data.loyaltyCard.reward || '');
      }
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.put(`/customers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
      Alert.alert('Sucesso', 'Dados do cliente atualizados com sucesso!');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Erro ao atualizar', err.message || 'Falha ao salvar alterações.');
    },
  });

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar imagem.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Acesso à câmera é necessário para tirar fotos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    }
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'O nome do cliente é obrigatório.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const hasAddress =
      street.trim() ||
      number.trim() ||
      complement.trim() ||
      neighborhood.trim() ||
      city.trim() ||
      postalCode.trim();

    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl || undefined,
      address: hasAddress
        ? {
            street: street.trim() || undefined,
            number: number.trim() || undefined,
            complement: complement.trim() || undefined,
            neighborhood: neighborhood.trim() || undefined,
            city: city.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
          }
        : undefined,
      loyaltyCard: {
        enabled: loyaltyEnabled,
        targetOrders: parseInt(loyaltyTargetOrders, 10) || 10,
        reward: loyaltyReward.trim() || '',
      },
    };

    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return <LoadingState message="A carregar dados do cliente..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Editar Cliente</Text>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={updateMutation.isPending}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Seção da Foto */}
        <Card style={styles.photoCard}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => setPhotoUrl('')}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <User size={36} color={colors.caramel} />
                <Text style={styles.photoPlaceholderText}>Foto do Cliente</Text>
                <Text style={styles.optionalBadge}>(Opcional)</Text>
              </View>
            )}

            <View style={styles.photoButtonsRow}>
              <TouchableOpacity
                style={styles.photoOptionBtn}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <Camera size={16} color={colors.primary} />
                <Text style={styles.photoOptionBtnText}>Tirar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoOptionBtn}
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
              >
                <ImageIcon size={16} color={colors.primary} />
                <Text style={styles.photoOptionBtnText}>Galeria</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Informações Pessoais */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>

          <Input
            label="Nome Completo *"
            placeholder="Ex: Maria Fernandes"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            error={errors.name}
            leftIcon={<User size={18} color={colors.textMuted} />}
          />

          <Input
            label="Telefone / WhatsApp"
            placeholder="Ex: +351 912 345 678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={18} color={colors.textMuted} />}
          />

          <Input
            label="E-mail"
            placeholder="Ex: cliente@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={18} color={colors.textMuted} />}
          />
        </Card>

        {/* Endereço */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <MapPin size={18} color={colors.caramel} />
            <Text style={styles.sectionTitle}>Endereço de Entrega (Opcional)</Text>
          </View>

          <Input
            label="Rua / Morada"
            placeholder="Ex: Av. da Liberdade"
            value={street}
            onChangeText={setStreet}
          />

          <View style={styles.twoColsRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Número"
                placeholder="Ex: 120"
                value={number}
                onChangeText={setNumber}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Complemento"
                placeholder="Ex: 2º Esquerdo"
                value={complement}
                onChangeText={setComplement}
              />
            </View>
          </View>

          <View style={styles.twoColsRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Bairro / Freguesia"
                placeholder="Ex: Baixa"
                value={neighborhood}
                onChangeText={setNeighborhood}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Cidade"
                placeholder="Ex: Lisboa"
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          <Input
            label="Código Postal"
            placeholder="Ex: 1250-096"
            value={postalCode}
            onChangeText={setPostalCode}
          />
        </Card>

        {/* Observações */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <FileText size={18} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>Observações e Preferências</Text>
          </View>

          <TextInput
            style={styles.textArea}
            placeholder="Ex: Prefere bolo com recheio de brigadeiro belga. Alérgica a amendoim."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Card>

        {/* Cartão Fidelidade */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderSwitch}>
            <View style={styles.sectionTitleRow}>
              <Award size={18} color={colors.caramel} />
              <View>
                <Text style={styles.sectionTitle}>Cartão Fidelidade</Text>
                <Text style={styles.inputHelp}>
                  Gerenciado exclusivamente pela sua confeitaria
                </Text>
              </View>
            </View>

            <Switch
              value={loyaltyEnabled}
              onValueChange={setLoyaltyEnabled}
              trackColor={{ false: colors.border, true: colors.caramel }}
              thumbColor="#ffffff"
            />
          </View>

          {loyaltyEnabled && (
            <View style={styles.loyaltyInputsWrap}>
              <Input
                label="Meta de Pedidos para o Brinde"
                placeholder="Ex: 10"
                value={loyaltyTargetOrders}
                onChangeText={setLoyaltyTargetOrders}
                keyboardType="numeric"
              />

              <Input
                label="Prêmio / Recompensa"
                placeholder="Ex: 1 Bolo Caseiro Grátis"
                value={loyaltyReward}
                onChangeText={setLoyaltyReward}
              />
            </View>
          )}
        </Card>

        <Button
          title="Salvar Alterações"
          loading={updateMutation.isPending}
          onPress={handleSave}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  photoCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  imagePreviewWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  photoPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.caramel,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoPlaceholderText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginTop: 2,
  },
  optionalBadge: {
    fontSize: 9,
    color: colors.textMuted,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  photoOptionBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  sectionCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    gap: spacing.xs + 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  sectionHeaderSwitch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputHelp: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  twoColsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
    minHeight: 70,
  },
  loyaltyInputsWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
});
