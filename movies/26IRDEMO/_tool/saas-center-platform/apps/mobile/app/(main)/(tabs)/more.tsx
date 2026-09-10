import { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/features/auth";
import { useCenterStore, useRole, usePermissionStore, usePermission } from "@/features/center";
import { unregisterCurrentDevice } from "@/features/notification";
import Constants from "expo-constants";
import { COLORS } from "@/shared/constants/theme";
import { Icon, type IconName } from "@/shared/components/icons";
import { Typography } from "@/shared/components/ui/Typography";
import { Badge } from "@/shared/components/ui/Badge";
import { useTabBarClearance } from "@/shared/hooks/useTabBarClearance";
import { s } from "@/shared/utils/scale";
import { withTabTransition } from "./_components/TabTransition";
import counselorMale from "@assets/avatar/male/counselor_male.png";
import counselorFemale from "@assets/avatar/female/counselor_female.png";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  MANAGER: "매니저",
  COUNSELOR: "상담사",
};

interface QuickMenuItem {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export default withTabTransition(MoreScreen);

function MoreScreen() {
  const router = useRouter();
  const tabClear = useTabBarClearance();
  const person = useAuthStore((s) => s.person);
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const centerName = useCenterStore((s) => s.centerName);
  const centerId = useCenterStore((s) => s.centerId);
  const clearCenter = useCenterStore((s) => s.clearCenter);
  const { roleCode } = useRole();
  const clearPermissions = usePermissionStore((s) => s.clearPermissions);
  const { can } = usePermission();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 그리드 카드 고정 너비: (화면폭 - 좌우 px-5(20*2) - 카드 사이 gap(10)) / 2.
  // flex-1로 행마다 분배하면 카드가 1개뿐인 행(상담일지)이 gap만큼 더 넓어지므로,
  // 모든 카드에 동일한 고정 너비를 줘서 행 구성과 무관하게 위·아래 카드 폭을 일치시킨다.
  const { width: windowWidth } = useWindowDimensions();
  const gridCardWidth = (windowWidth - 40 - 10) / 2;

  const handleOpenCenters = () => {
    router.push("/(main)/my-centers");
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    if (centerId) {
      await unregisterCurrentDevice(centerId);
    }
    logout();
    clearCenter();
    clearPermissions();
    router.replace("/(auth)/login");
  };

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleNotices = () => {
    router.push("/(main)/notices");
  };

  const roleLabel = roleCode ? (ROLE_LABELS[roleCode] ?? roleCode) : null;

  const avatarSource =
    person?.gender === "male"
      ? counselorMale
      : person?.gender === "female"
        ? counselorFemale
        : null;

  const quickMenuItems: QuickMenuItem[] = [
    {
      icon: "counseling2-28",
      label: "상담 현황",
      onPress: () => router.push("/(main)/counseling"),
    },
    {
      icon: "assessment2-28",
      label: "검사 현황",
      onPress: () => router.push("/(main)/assessment"),
    },
    {
      icon: "memo2-28",
      label: "상담일지",
      onPress: () => router.push("/(main)/counseling/notes"),
    },
    ...(can("read:billing")
      ? [
          {
            icon: "cost-28" as IconName,
            label: "청구 현황",
            onPress: () => router.push("/(main)/billing"),
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 헤더 */}
      <View className="h-[52px] justify-center bg-background px-5">
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          내 정보
        </Typography>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: s(16), paddingBottom: tabClear }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 프로필 (중앙 정렬) ─── */}
        <View className="items-center px-5" style={{ paddingTop: s(8) }}>
          <View
            style={{ width: s(76), height: s(76) }}
            className="items-center justify-center overflow-hidden rounded-full bg-gray-100"
          >
            {avatarSource ? (
              <Image
                source={avatarSource}
                style={{ width: s(76), height: s(76) }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={s(36)} color={COLORS.gray[400]} />
            )}
          </View>
          <View className="mt-4 flex-row items-center gap-2">
            <Typography
              variant="headline-02"
              weight="semibold"
              className="text-gray-900"
            >
              {person?.name ?? "-"}
            </Typography>
            {roleLabel && <Badge variant="blue">{roleLabel}</Badge>}
          </View>
          <Typography variant="body-03" className="mt-1 text-gray-500">
            {account?.email ?? "-"}
          </Typography>
        </View>

        {/* ─── 센터 선택 ─── */}
        <View className="mb-3 mt-5 items-center px-5">
          <TouchableOpacity
            style={{ width: s(240), height: s(40) }}
            className="flex-row items-center gap-2.5 rounded-md border border-[#E9EEF0] bg-surface px-4"
            onPress={handleOpenCenters}
            activeOpacity={0.7}
            accessibilityLabel="내 센터"
            accessibilityRole="button"
          >
            <Icon name="center-filled-16" size={16} color={COLORS.gray[600]} />
            <Typography
              variant="body-02"
              weight="medium"
              className="flex-1 text-gray-800"
              numberOfLines={1}
            >
              {centerName ?? "-"}
            </Typography>
            <Icon name="arrow-right-2-20" size={20} />
          </TouchableOpacity>
        </View>

        {/* ─── 업무 바로가기 (2×2 그리드) ─── */}
        <View className="gap-2.5 px-5 py-[10px]">
          {[quickMenuItems.slice(0, 2), quickMenuItems.slice(2)].map(
            (row, rowIdx) => (
              <View key={rowIdx} className="flex-row gap-2.5">
                {row.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={{ width: gridCardWidth, height: s(94) }}
                    className="justify-between rounded-lg bg-surface p-4"
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    accessibilityLabel={item.label}
                    accessibilityRole="button"
                  >
                    <Icon name={item.icon} size={28} />
                    <View className="flex-row items-center justify-between gap-1">
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        className="flex-1 text-title-default"
                        numberOfLines={1}
                      >
                        {item.label}
                      </Typography>
                      <Icon name="arrow-right-2-20" size={20} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ),
          )}
        </View>

        {/* ─── 설정 ─── */}
        <View className="px-4 pb-2.5 pt-4">
          <Typography variant="body-03" weight="medium" className="text-gray-600">
            설정
          </Typography>
        </View>
        <View style={{ marginHorizontal: s(16) }} className="rounded-lg bg-surface">
          <SettingItem icon="notice" label="공지사항" onPress={handleNotices} />
          <SettingItem
            icon="bell"
            label="알림설정"
            onPress={() => router.push("/(main)/notification-settings")}
          />
          <SettingItem
            icon="verinfo-20"
            label="버전 정보"
            value={`v${appVersion}`}
          />
          <SettingItem
            icon="logout-20"
            label="로그아웃"
            onPress={handleLogout}
          />
        </View>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
        statusBarTranslucent
      >
        <View className="flex-1 items-center justify-center bg-black/40">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutModal(false)}
          />
          <View
            style={{ width: s(280), height: s(138) }}
            className="justify-between rounded-lg bg-surface px-6 py-6"
          >
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-center text-gray-900"
            >
              정말 로그아웃 할까요?
            </Typography>
            <TouchableOpacity
              className="items-center rounded-md bg-primary py-3"
              onPress={confirmLogout}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
            >
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-white"
              >
                로그아웃
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingItem({
  icon,
  label,
  onPress,
  value,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  const content = (
    <>
      <View className="flex-row items-center gap-3">
        <Icon name={icon} size={20} />
        <Typography variant="body-02" weight="medium" className="text-gray-800">{label}</Typography>
      </View>
      {value ? (
        <Typography variant="body-03" className="text-gray-500">
          {value}
        </Typography>
      ) : (
        <Icon name="arrow-right-2-20" size={20} />
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        className="flex-row items-center justify-between px-[18px] py-4"
        accessibilityLabel={label}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-[18px] py-4"
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {content}
    </TouchableOpacity>
  );
}
