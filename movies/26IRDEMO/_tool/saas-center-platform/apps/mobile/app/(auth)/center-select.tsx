import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, type UserCenterSummary } from '@/features/auth';
import { useCenterStore, usePermissionStore } from '@/features/center';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

export default function CenterSelectScreen() {
  const router = useRouter();
  const centers = useAuthStore((s) => s.centers);
  const setCenterContext = useCenterStore((s) => s.setCenterContext);
  const fetchPermissions = usePermissionStore((s) => s.fetchPermissions);

  const handleSelect = (center: UserCenterSummary) => {
    setCenterContext(center.id, center.name, center.role_code);
    fetchPermissions(center.id);
    router.replace('/(main)/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>센터 선택</Text>
        <Text style={styles.description}>
          이용할 센터를 선택해주세요.
        </Text>
      </View>

      <FlatList
        data={centers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.centerCard}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <View style={styles.centerInfo}>
              <Text style={styles.centerName}>{item.name}</Text>
              {item.role_name && (
                <Text style={styles.roleBadge}>{item.role_name}</Text>
              )}
            </View>
            <Text style={styles.centerCode}>{item.code}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.body.strong,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  centerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.default,
  },
  centerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  centerName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text.body.strong,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  roleBadge: {
    fontSize: 12,
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  centerCode: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
