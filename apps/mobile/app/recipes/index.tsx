import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Plus,
  Search,
  X,
  Clock,
  Flame,
  PieChart,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { Recipe, RecipeSummary, EntitlementsResponse } from '@koki/types';
import { colors, borderRadius, spacing } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { Badge, LoadingState, EmptyState } from '../../src/components/ui';
import { PlansModal } from '../../src/components/PlansModal';

export default function RecipesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  // Queries
  const {
    data: recipesData,
    isLoading,
    isRefetching,
    refetch: refetchRecipes,
  } = useQuery<{ items: Recipe[]; total: number }>({
    queryKey: ['recipes', selectedCategory, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (search.trim()) params.append('search', search.trim());
      const qs = params.toString();
      return api.get<{ items: Recipe[]; total: number }>(`/recipes${qs ? `?${qs}` : ''}`);
    },
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery<RecipeSummary>({
    queryKey: ['recipes-summary'],
    queryFn: () => api.get<RecipeSummary>('/recipes/summary'),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['recipes-categories'],
    queryFn: () => api.get<string[]>('/recipes/categories'),
  });

  const { data: entitlements } = useQuery<EntitlementsResponse>({
    queryKey: ['company-entitlements'],
    queryFn: () => api.get<EntitlementsResponse>('/entitlements/features'),
  });

  const recipes = recipesData?.items || [];
  const totalRecipes = summaryData?.totalRecipes || recipes.length;
  const averageCostCents = summaryData?.averageCostCents || 0;

  const recipesLimit = entitlements?.limits?.recipesLimit ?? 10;
  const isNearLimit = recipesLimit !== -1 && totalRecipes >= recipesLimit;

  const handleRefresh = async () => {
    await Promise.all([refetchRecipes(), refetchSummary()]);
  };

  const handleNewRecipePress = () => {
    if (isNearLimit && !entitlements?.isPro) {
      setPlansModalVisible(true);
      return;
    }
    router.push('/recipes/new' as any);
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.title}>Fichas Técnicas</Text>
          <Text style={styles.subtitle}>
            {totalRecipes} {totalRecipes === 1 ? 'receita cadastrada' : 'receitas cadastradas'}
            {recipesLimit !== -1 ? ` (${totalRecipes}/${recipesLimit})` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.newRecipeBtn}
          activeOpacity={0.85}
          onPress={handleNewRecipePress}
        >
          <Plus size={16} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.newRecipeBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { flex: 1.2 }]}>
          <Text style={styles.kpiLabel}>Custo Médio por Receita</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {formatCurrency(averageCostCents)}
          </Text>
          <Text style={styles.kpiHint}>Média de custo dos insumos</Text>
        </View>

        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>Categorias</Text>
          <Text style={styles.kpiValue}>
            {categories.length || 1}
          </Text>
          <Text style={styles.kpiHint}>Linhas de confeitaria</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por receita ou ingrediente..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Categories Horizontal Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          <TouchableOpacity
            style={[styles.chip, selectedCategory === 'all' && styles.chipActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === 'all' && styles.chipTextActive,
              ]}
            >
              Todas
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Recipes List */}
      {isLoading ? (
        <LoadingState message="Carregando fichas técnicas..." />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<BookOpen size={46} color={colors.caramel} />}
              title="Nenhuma receita cadastrada"
              description={
                search || selectedCategory !== 'all'
                  ? 'Nenhuma ficha técnica encontrada com os filtros atuais.'
                  : 'Crie fichas técnicas com cálculo de custo automático por fatia, Baker’s % e escalonador.'
              }
              actionTitle={
                search || selectedCategory !== 'all' ? 'Limpar Filtros' : 'Criar Ficha Técnica'
              }
              onAction={
                search || selectedCategory !== 'all'
                  ? () => {
                      setSearch('');
                      setSelectedCategory('all');
                    }
                  : handleNewRecipePress
              }
            />
          }
          renderItem={({ item }) => {
            const ingredientsCount = item.ingredients?.length || 0;

            return (
              <TouchableOpacity
                style={styles.recipeCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/recipes/${item.id}` as any)}
              >
                {/* Header Row */}
                <View style={styles.recipeCardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.recipeName}>{item.name}</Text>
                    <Text style={styles.recipeCategory}>{item.category}</Text>
                  </View>

                  <Badge
                    label={`${item.yield} ${item.yieldUnit || 'unidades'}`}
                    color={colors.primary}
                  />
                </View>

                {/* Info Chips (Time, Oven, Ingredients) */}
                <View style={styles.metaRow}>
                  {item.prepTimeMinutes ? (
                    <View style={styles.metaChip}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={styles.metaChipText}>{item.prepTimeMinutes}m prep</Text>
                    </View>
                  ) : null}

                  {item.bakeTimeMinutes ? (
                    <View style={styles.metaChip}>
                      <Flame size={12} color={colors.warning} />
                      <Text style={styles.metaChipText}>{item.bakeTimeMinutes}m forno</Text>
                    </View>
                  ) : null}

                  {item.ovenTemperature ? (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{item.ovenTemperature}°C</Text>
                    </View>
                  ) : null}

                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{ingredientsCount} ingredientes</Text>
                  </View>
                </View>

                {/* Financial Footer */}
                <View style={styles.recipeFooter}>
                  <View>
                    <Text style={styles.costLabel}>Custo por {item.yieldUnit || 'porção'}:</Text>
                    <Text style={styles.costValue}>
                      {formatCurrency(item.costPerYieldUnitCents)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.totalCostLabel}>Custo Total da Receita:</Text>
                    <Text style={styles.totalCostValue}>
                      {formatCurrency(item.totalCostCents)}
                    </Text>
                  </View>

                  <ChevronRight size={18} color={colors.border} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Upgrade Plans Modal */}
      <PlansModal
        visible={plansModalVisible}
        onClose={() => setPlansModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  newRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  newRecipeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  kpiHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
    paddingVertical: 0,
  },
  chipsWrapper: {
    marginBottom: 12,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  recipeCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  recipeCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  recipeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  costLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  costValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 1,
  },
  totalCostLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  totalCostValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
});
