import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import {
  useNoticeDetail,
  type NoticeCategory,
  type NoticeAttachment,
  type NoticeSiblingItem,
} from '@/features/notice';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

const CATEGORY_STYLE: Record<
  NoticeCategory,
  { label: string; bg: string; fg: string }
> = {
  announcement: { label: '공지', bg: COLORS.gray[100], fg: COLORS.gray[600] },
  update: { label: '업데이트', bg: COLORS.primary50, fg: COLORS.primary700 },
  maintenance: { label: '점검', bg: COLORS.trans.yellow, fg: COLORS.warning },
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ file }: { file: NoticeAttachment }) {
  const size = formatBytes(file.size);
  return (
    <TouchableOpacity
      className="flex-row items-center rounded-md bg-gray-50 px-3.5 py-3"
      style={{ gap: s(10) }}
      activeOpacity={0.7}
      onPress={() => file.url && Linking.openURL(file.url)}
      accessibilityRole="button"
      accessibilityLabel={`첨부파일 ${file.name}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-gray-100">
        <Ionicons name="document-text-outline" size={18} color={COLORS.gray[600]} />
      </View>
      <View className="flex-1">
        <Typography
          variant="body-03"
          weight="medium"
          className="text-gray-800"
          numberOfLines={1}
        >
          {file.name}
        </Typography>
        {!!size && (
          <Typography variant="caption-01" className="text-gray-500">
            {size}
          </Typography>
        )}
      </View>
      <Ionicons name="download-outline" size={18} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

function SiblingRow({
  direction,
  item,
  onPress,
}: {
  direction: 'prev' | 'next';
  item: NoticeSiblingItem;
  onPress: () => void;
}) {
  const isPrev = direction === 'prev';
  return (
    <TouchableOpacity
      className="flex-row items-center px-5 py-3.5"
      style={{ gap: s(10) }}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isPrev ? '이전 글' : '다음 글'} ${item.title}`}
    >
      <Typography
        variant="label-01"
        weight="semibold"
        className="text-gray-400"
        style={{ width: s(38) }}
      >
        {isPrev ? '이전' : '다음'}
      </Typography>
      <Typography
        variant="body-03"
        className="flex-1 text-gray-700"
        numberOfLines={1}
      >
        {item.title}
      </Typography>
      <Ionicons name="chevron-forward" size={16} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

export default function NoticeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centerId = useCenterStore((s) => s.centerId);

  const { data, isLoading, isError, refetch } = useNoticeDetail(id ?? null, centerId);

  const cat = data ? CATEGORY_STYLE[data.category] : null;
  const attachments = data?.attachments ?? [];
  const prev = data?.siblings?.prev ?? null;
  const next = data?.siblings?.next ?? null;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          공지사항
        </Typography>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isError || !data || !cat ? (
        <View className="flex-1 items-center justify-center px-8" style={{ gap: s(8) }}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[300]} />
          <Typography variant="body-01" weight="semibold" className="text-gray-700">
            공지사항을 불러오지 못했어요
          </Typography>
          <Typography variant="body-03" className="text-center text-gray-400">
            잠시 후 다시 시도해 주세요
          </Typography>
          <TouchableOpacity
            className="mt-3 rounded-md bg-primary px-5 py-2.5"
            onPress={() => refetch()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Typography variant="body-03" weight="semibold" className="text-white">
              다시 시도
            </Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(48) }}
          showsVerticalScrollIndicator={false}
        >
          {/* 타이틀 영역 */}
          <View className="px-5" style={{ gap: s(10) }}>
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <View
                style={{ backgroundColor: cat.bg }}
                className="rounded-full px-2.5 py-1"
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: cat.fg }}
                >
                  {cat.label}
                </Typography>
              </View>
              {data.is_pinned && (
                <View className="flex-row items-center" style={{ gap: s(2) }}>
                  <Ionicons name="bookmark" size={12} color={COLORS.warning} />
                  <Typography
                    variant="label-02"
                    weight="medium"
                    style={{ color: COLORS.warning }}
                  >
                    고정
                  </Typography>
                </View>
              )}
            </View>

            <Typography variant="headline-02" weight="semibold" className="text-gray-900">
              {data.title}
            </Typography>

            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <Typography variant="label-01" className="text-gray-500">
                {format(
                  parseDate(data.published_at ?? data.created_at),
                  'yyyy. MM. dd',
                  { locale: ko },
                )}
              </Typography>
              {data.created_by_name && (
                <>
                  <View
                    style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }}
                  />
                  <Typography variant="label-01" className="text-gray-500">
                    {data.created_by_name}
                  </Typography>
                </>
              )}
            </View>
          </View>

          {/* 구분선 */}
          <View className="mt-4 h-px bg-gray-100" />

          {/* 본문 */}
          <View className="px-5 pt-5">
            <Typography variant="body-01-reading" className="text-gray-800">
              {data.content}
            </Typography>
          </View>

          {/* 첨부파일 */}
          {attachments.length > 0 && (
            <View className="px-5 pt-6" style={{ gap: s(8) }}>
              <Typography
                variant="label-01"
                weight="semibold"
                className="text-gray-600"
              >
                첨부파일 {attachments.length}
              </Typography>
              <View style={{ gap: s(8) }}>
                {attachments.map((file) => (
                  <AttachmentRow key={file.path} file={file} />
                ))}
              </View>
            </View>
          )}

          {/* 이전 / 다음 글 */}
          {(prev || next) && (
            <View className="mt-8 border-t border-gray-100">
              {prev && (
                <SiblingRow
                  direction="prev"
                  item={prev}
                  onPress={() => router.push(`/(main)/notices/${prev.id}`)}
                />
              )}
              {prev && next && <View className="h-px bg-gray-100" />}
              {next && (
                <SiblingRow
                  direction="next"
                  item={next}
                  onPress={() => router.push(`/(main)/notices/${next.id}`)}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
