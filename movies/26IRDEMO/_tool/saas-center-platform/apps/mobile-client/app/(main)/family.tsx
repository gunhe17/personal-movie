/**
 * 가족 연결 관리 — 구성원 목록 + 초대(owner)·합류(코드)·내보내기·나가기.
 * 한 아이를 여러 어른이 본다: 링크는 복제되지 않고 family 단위로 공유된다.
 * 마이 탭 리뉴얼 톤(bg-base · 흰 카드 · 섹션 타이틀 body-01 semibold)에 맞춘 전용 화면.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMe } from "@/features/auth";
import {
  useFamilyMembers,
  useLeaveFamily,
  useRemoveFamilyMember,
  type FamilyMember,
} from "@/features/family";
import { getErrorMessage } from "@/shared/api/client";
import {
  Badge,
  Button,
  ConfirmModal,
  ErrorView,
  LoadingView,
  Typography,
} from "@/shared/components/ui";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { useRefreshControl } from "@/shared/hooks/useRefreshControl";
import { FamilyInviteSheet } from "./(tabs)/_components/FamilyInviteSheet";
import PlusIcon20 from "@assets/icons/20/PlusIcon20.svg";
import FamilyEmptyIllust from "@assets/images/family/family-empty.svg";

/** 빈 화면 일러스트 — 시안 1531:16141 (114 정사각) */
const EMPTY_ILLUST = 114;

export default function FamilyScreen() {
  const router = useRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const familyQuery = useFamilyMembers();
  const familyMembers = familyQuery.data ?? [];
  const removeMemberMutation = useRemoveFamilyMember();
  const leaveFamilyMutation = useLeaveFamily();
  const refreshControl = useRefreshControl(() => familyQuery.refetch());

  const [inviteVisible, setInviteVisible] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);

  const isFamilyOwner = familyMembers.some(
    (m) => m.person_id === me?.person.id && m.role === "owner",
  );
  // 구성원이 나 혼자면 정보가 없다 — 초대/합류 안내로 대체
  const isSolo =
    familyMembers.length === 1 && familyMembers[0]?.person_id === me?.person.id;
  const hasSelfProfile = (me?.profiles ?? []).some(
    (p) => p.relation === "self",
  );

  const handleRemoveMember = () => {
    if (!removeTarget) return;
    setFamilyError(null);
    removeMemberMutation.mutate(removeTarget.id, {
      onSuccess: () => setRemoveTarget(null),
      onError: (err) =>
        setFamilyError(
          getErrorMessage(
            err,
            "내보내지 못했어요. 잠시 후 다시 시도해 주세요.",
          ),
        ),
    });
  };

  const handleLeaveFamily = () => {
    setFamilyError(null);
    leaveFamilyMutation.mutate(undefined, {
      onSuccess: () => setLeaveVisible(false),
      onError: (err) =>
        setFamilyError(
          getErrorMessage(err, "나가지 못했어요. 잠시 후 다시 시도해 주세요."),
        ),
    });
  };

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: isSolo ? COLORS.surface : COLORS.bg.base }}
    >
      <View
        className="h-[52px] flex-row items-center px-4"
        style={{ columnGap: 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          가족 연결
        </Typography>
      </View>

      {meQuery.isLoading || familyQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : isSolo ? (
        /* 아직 나 혼자 — 시안 652:8166. 목록 대신 초대로 가는 길만 보여준다 */
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: s(16) }}
        >
          <View
            className="flex-1 items-center justify-center"
            style={{ rowGap: s(8), paddingBottom: s(40) }}
          >
            <FamilyEmptyIllust
              width={s(EMPTY_ILLUST)}
              height={s(EMPTY_ILLUST)}
            />

            <View className="w-full items-center" style={{ rowGap: s(24) }}>
              <View className="w-full items-center" style={{ rowGap: s(12) }}>
                <Typography
                  variant="title-01"
                  weight="semibold"
                  className="text-center"
                  style={{ color: COLORS.text.title.default }}
                >
                  등록된 가족 구성원이 없어요
                </Typography>
                <Typography
                  variant="body-02-reading"
                  className="text-center"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {hasSelfProfile
                    ? "가족을 초대하면 내 일정과 소식을 함께 확인할 수 있어요."
                    : "가족을 초대하면 아이의 일정과 소식을 함께 확인할 수 있어요."}
                </Typography>
              </View>

              {isFamilyOwner ? (
                <Button
                  label="가족 초대하기"
                  size="lg"
                  icon={<PlusIcon20 width={s(20)} height={s(20)} />}
                  onPress={() => setInviteVisible(true)}
                />
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(main)/family-join")}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Typography
                  variant="body-02"
                  className="text-center"
                  style={{ color: COLORS.text.state["brand-strong"] }}
                >
                  초대 코드를 받으셨나요?{" "}
                  <Typography
                    variant="body-02"
                    style={{
                      color: COLORS.text.state["brand-strong"],
                      textDecorationLine: "underline",
                    }}
                  >
                    코드 입력하기
                  </Typography>
                </Typography>
              </Pressable>
            </View>
          </View>

          {familyError ? (
            <Typography
              variant="body-03"
              className="text-center"
              style={{ paddingBottom: s(24), color: COLORS.status.danger }}
            >
              {familyError}
            </Typography>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingTop: s(8), paddingBottom: s(40) }}
        >
          <View className="px-4">
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              가족 구성원
            </Typography>

            <View className="mt-3 rounded-2xl bg-surface p-4">
              {familyMembers.map((member, i) => {
                const isMe = member.person_id === me?.person.id;
                return (
                  <View key={member.id}>
                    {i > 0 ? (
                      <View
                        className="my-4"
                        style={{
                          height: 1,
                          backgroundColor: COLORS.border.default,
                        }}
                      />
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <Typography
                        variant="body-01"
                        weight="medium"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {member.name ?? "이름 없음"}
                        {isMe ? " (나)" : ""}
                      </Typography>
                      <View
                        className="flex-row items-center"
                        style={{ columnGap: s(8) }}
                      >
                        <Badge
                          label={member.role === "owner" ? "관리자" : "구성원"}
                          color={member.role === "owner" ? "blue" : "gray"}
                        />
                        {isFamilyOwner && !isMe ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${member.name ?? "구성원"} 내보내기`}
                            onPress={() => setRemoveTarget(member)}
                            hitSlop={8}
                          >
                            <Ionicons
                              name="close"
                              size={18}
                              color={COLORS.icon.secondary}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* owner — 초대 코드 발급 */}
            {isFamilyOwner ? (
              <Button
                label="가족 초대하기"
                variant="secondary"
                onPress={() => setInviteVisible(true)}
                className="mt-5"
                style={{ alignSelf: "stretch" }}
              />
            ) : null}

            {/* 관리자는 나갈 수 없다(프로필·연결이 주인을 잃는다) — 서버도 400으로 막는다 */}
            {!isFamilyOwner && familyMembers.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setLeaveVisible(true)}
                className="mt-4 items-center py-2"
                hitSlop={8}
              >
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.text.caption.default }}
                >
                  가족에서 나가기
                </Typography>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}

      <FamilyInviteSheet
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
      />

      {/* 가족 내보내기 — 상대의 아이·센터 접근이 끊긴다 */}
      <ConfirmModal
        visible={removeTarget !== null}
        title={`${removeTarget?.name ?? "구성원"}님을 내보낼까요?`}
        message={
          familyError ??
          "내보내면 이 분은 아이의 일정과 기록을 더 이상 볼 수 없어요. 다시 초대할 수 있어요."
        }
        confirmLabel="내보내기"
        cancelLabel="취소"
        loading={removeMemberMutation.isPending}
        onConfirm={handleRemoveMember}
        onCancel={() => {
          setRemoveTarget(null);
          setFamilyError(null);
        }}
      />

      {/* 가족에서 나가기 */}
      <ConfirmModal
        visible={leaveVisible}
        title="가족에서 나갈까요?"
        message={
          familyError ??
          "나가면 아이의 일정과 기록을 더 이상 볼 수 없어요. 초대 코드를 다시 받으면 합류할 수 있어요."
        }
        confirmLabel="나가기"
        cancelLabel="취소"
        loading={leaveFamilyMutation.isPending}
        onConfirm={handleLeaveFamily}
        onCancel={() => {
          setLeaveVisible(false);
          setFamilyError(null);
        }}
      />
    </SafeAreaView>
  );
}
