import { useState, lazy, Suspense } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import { useDocumentDownloadUrl } from '@/features/assessment';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

const WebView = lazy(() =>
  import('react-native-webview').then((m) => ({ default: m.WebView })),
);

/**
 * 검사 보고서 뷰어 페이지.
 *
 * report_document_id로 presigned URL을 받아 WebView로 PDF를 표시.
 * - iOS: WebView가 PDF를 네이티브 렌더링 (멀티페이지/줌)
 * - Android: WebView는 PDF 직접 렌더 불가 → Google Docs 뷰어로 임베드
 */
export default function AssessmentReportScreen() {
  const router = useRouter();
  const { documentId, taskName } = useLocalSearchParams<{
    documentId?: string;
    taskName?: string;
  }>();
  const centerId = useCenterStore((st) => st.centerId);

  const {
    data: url,
    isLoading,
    isError,
    refetch,
  } = useDocumentDownloadUrl(centerId, documentId ?? null);

  const [webError, setWebError] = useState(false);

  const viewerUrl =
    url && Platform.OS === 'android'
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
      : url;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: COLORS.bg.base }}
      edges={['top']}
    >
      {/* 헤더 */}
      <View
        className="h-[52px] flex-row items-center px-5"
        style={{ backgroundColor: COLORS.bg.base }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: s(6) }}>
          <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
            검사 결과
          </Typography>
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {taskName || '보고서'}
          </Typography>
        </View>
      </View>

      {!documentId ? (
        <EmptyState
          icon="document-text-outline"
          title="아직 보고서가 없어요"
          description="검사 보고서가 등록되면 여기에서 볼 수 있어요."
        />
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Typography variant="body-03" className="text-gray-400">
            보고서를 불러오는 중...
          </Typography>
        </View>
      ) : isError || webError || !viewerUrl ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="보고서를 불러올 수 없어요"
          description="잠시 후 다시 시도해주세요."
          onRetry={() => {
            setWebError(false);
            refetch();
          }}
        />
      ) : (
        <Suspense
          fallback={
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: COLORS.gray[100] }}
            >
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          }
        >
          <WebView
            source={{ uri: viewerUrl }}
            originWhitelist={['*']}
            startInLoadingState
            onError={() => setWebError(true)}
            onHttpError={() => setWebError(true)}
            renderLoading={() => (
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: COLORS.gray[100] }}
              >
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            )}
            style={{ flex: 1, backgroundColor: COLORS.gray[100] }}
          />
        </Suspense>
      )}
    </SafeAreaView>
  );
}

function EmptyState({
  icon,
  title,
  description,
  onRetry,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-5">
      <Ionicons name={icon} size={48} color={COLORS.gray[300]} />
      <Typography variant="body-02" weight="semibold" className="text-gray-600">
        {title}
      </Typography>
      <Typography variant="body-03" className="text-center text-gray-400">
        {description}
      </Typography>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.7}
          className="mt-2 rounded-md bg-primary px-5 py-2.5"
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Typography variant="body-03" weight="semibold" className="text-white">
            다시 시도
          </Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}
