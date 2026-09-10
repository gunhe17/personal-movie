import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';
import { useNotesBySession } from '@/features/counseling/note';
import type { CounselingSessionDetail } from '@/features/counseling/types';

export interface JournalHistoryNoteTarget {
  sessionId: string;
  sessionStart: string;
  clientId: string;
  clientName: string;
}

/**
 * 지난 일지 히스토리 시트 — 케이스의 지난 완료 회기 일지를 날짜 내림차순으로 모아 본다.
 *
 * 상담 직전, 이 케이스의 지난 기록을 빠르게 복습하기 위한 열람 전용 진입.
 * 회기/내담자 행을 탭하면 부모의 CounselingNoteSheet(view 모드)로 해당 일지를 연다.
 */
export function JournalHistorySheet({
  visible,
  onClose,
  centerId,
  sessions,
  isGroup,
  onOpenNote,
}: {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  /** 지난 완료 회기 (날짜 내림차순 정렬됨) */
  sessions: CounselingSessionDetail[];
  isGroup: boolean;
  onOpenNote: (target: JournalHistoryNoteTarget) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(20),
            borderTopRightRadius: s(20),
            maxHeight: '88%',
            paddingTop: s(8),
          }}
        >
          {/* drag handle */}
          <View
            style={{
              width: s(36),
              height: s(4),
              borderRadius: s(2),
              backgroundColor: COLORS.gray[300],
              alignSelf: 'center',
              marginBottom: s(4),
            }}
          />

          {/* 헤더 */}
          <View
            style={{
              paddingHorizontal: s(20),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              지난 일지
            </Typography>
            <View
              style={{
                paddingHorizontal: s(7),
                paddingVertical: s(2),
                borderRadius: s(6),
                backgroundColor: COLORS.gray[100],
              }}
            >
              <Typography
                variant="label-02"
                weight="medium"
                style={{ color: COLORS.gray[600] }}
              >
                {sessions.length}개
              </Typography>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
              <Ionicons name="close" size={s(22)} color={COLORS.gray[800]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: s(20),
              paddingTop: s(6),
              paddingBottom: Math.max(s(20), insets.bottom + s(8)),
              gap: s(10),
            }}
            showsVerticalScrollIndicator={false}
          >
            {sessions.length === 0 ? (
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[400], textAlign: 'center', paddingVertical: s(40) }}
              >
                아직 지난 일지가 없어요
              </Typography>
            ) : (
              sessions.map((session, idx) => (
                <SessionBlock
                  key={session.session_id}
                  centerId={centerId}
                  session={session}
                  index={idx}
                  isGroup={isGroup}
                  onOpenNote={onOpenNote}
                />
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SessionBlock({
  centerId,
  session,
  index,
  isGroup,
  onOpenNote,
}: {
  centerId: string | null;
  session: CounselingSessionDetail;
  index: number;
  isGroup: boolean;
  onOpenNote: (target: JournalHistoryNoteTarget) => void;
}) {
  const { data: notes } = useNotesBySession(centerId, session.session_id);
  const dateLabel = format(parseDate(session.start), 'M월 d일 (E)', { locale: ko });
  const relLabel = index === 0 ? '직전 회기' : `${index + 1}회 전`;

  const summaryFor = (clientId: string) => {
    const note = notes?.find((n) => n.client_id === clientId);
    return note?.summary?.trim() || null;
  };

  // 1:1 — 단일 카드 (날짜 + 요약, 카드 전체 탭)
  if (!isGroup) {
    const client = session.clients[0];
    if (!client) return null;
    const summary = summaryFor(client.participant_id);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          onOpenNote({
            sessionId: session.session_id,
            sessionStart: session.start,
            clientId: client.participant_id,
            clientName: client.participant_name,
          })
        }
        style={{
          borderRadius: s(12),
          backgroundColor: COLORS.gray[50],
          padding: s(14),
          gap: s(6),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900] }}>
            {dateLabel}
          </Typography>
          <Typography variant="label-02" style={{ color: COLORS.gray[500] }}>
            {relLabel}
          </Typography>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={s(16)} color={COLORS.gray[400]} />
        </View>
        <Typography
          variant="body-03"
          style={{
            color: summary ? COLORS.gray[700] : COLORS.gray[400],
            lineHeight: s(20),
          }}
          numberOfLines={2}
        >
          {summary ?? '아직 일지를 작성하지 않았어요'}
        </Typography>
      </TouchableOpacity>
    );
  }

  // 그룹 — 날짜 헤더 + 내담자별 행
  return (
    <View
      style={{
        borderRadius: s(12),
        backgroundColor: COLORS.gray[50],
        padding: s(14),
        gap: s(10),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900] }}>
          {dateLabel}
        </Typography>
        <Typography variant="label-02" style={{ color: COLORS.gray[500] }}>
          {relLabel}
        </Typography>
      </View>
      <View style={{ gap: s(8) }}>
        {session.clients.map((client) => {
          const summary = summaryFor(client.participant_id);
          return (
            <TouchableOpacity
              key={client.participant_id}
              activeOpacity={0.7}
              onPress={() =>
                onOpenNote({
                  sessionId: session.session_id,
                  sessionStart: session.start,
                  clientId: client.participant_id,
                  clientName: client.participant_name,
                })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(8),
                backgroundColor: COLORS.white,
                borderRadius: s(10),
                paddingHorizontal: s(12),
                paddingVertical: s(10),
              }}
            >
              <View style={{ flex: 1, gap: s(2) }}>
                <Typography variant="body-03" weight="semibold" style={{ color: COLORS.gray[900] }}>
                  {client.participant_name}
                </Typography>
                <Typography
                  variant="label-01"
                  style={{
                    color: summary ? COLORS.gray[600] : COLORS.gray[400],
                    lineHeight: s(18),
                  }}
                  numberOfLines={1}
                >
                  {summary ?? '아직 일지를 작성하지 않았어요'}
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={s(16)} color={COLORS.gray[400]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
