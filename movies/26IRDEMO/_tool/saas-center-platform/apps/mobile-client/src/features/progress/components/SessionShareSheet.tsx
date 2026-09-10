/**
 * 회기 전달 내용 시트 (L2) — 센터가 전달한 상담 내용만 보여준다.
 *
 * 상담사가 쓴 임상 기록 자체는 앱으로 내려오지 않는다. 여기 보이는 글은 센터가
 * 읽는 사람 톤으로 옮겨 "전달하기"를 누른 것뿐이다.
 */
import React from "react";
import { View } from "react-native";
import { BottomSheet, Typography } from "@/shared/components/ui";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { formatKst } from "@/shared/utils/date";
import type { ProgressSession } from "../types";

interface SessionShareSheetProps {
  visible: boolean;
  onClose: () => void;
  session: ProgressSession | null;
}

export function SessionShareSheet({
  visible,
  onClose,
  session,
}: SessionShareSheetProps) {
  const share = session?.share ?? null;
  // 서버가 문단을 줄바꿈 두 번으로 나눠 보낸다
  const paragraphs = (share?.text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={session ? `${session.round}회기 상담 내용` : "상담 내용"}
      subtitle={
        share?.published_at
          ? `${formatKst(share.published_at, "M월 d일")}에 센터가 전해왔어요`
          : undefined
      }
    >
      {paragraphs.length > 0 ? (
        <View style={{ paddingHorizontal: s(16), paddingBottom: s(8) }}>
          <View style={{ rowGap: s(16) }}>
            {paragraphs.map((paragraph, index) => (
              <Typography
                key={index}
                variant="body-02-reading"
                style={{ color: COLORS.text.body.strong, lineHeight: s(26) }}
              >
                {paragraph}
              </Typography>
            ))}
          </View>

          <Typography
            variant="caption-01"
            style={{ color: COLORS.text.body.subtle, marginTop: s(24) }}
          >
            더 궁금한 점은 센터에 편하게 물어보세요.
          </Typography>
        </View>
      ) : null}
    </BottomSheet>
  );
}
