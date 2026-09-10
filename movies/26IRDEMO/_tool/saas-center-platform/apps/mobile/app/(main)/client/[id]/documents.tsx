import { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCenterStore } from '@/features/center';
import {
  useClientDetail,
  useClientFormInstances,
  useClientDocuments,
  getDocumentDownloadUrl,
} from '@/features/client';
import { formatKstDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { SearchField } from '@/shared/components/ui/SearchField';
import { Icon, type IconName } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 내담자 문서 화면 — form_instance + document 실데이터를 카드 리스트로.
 *
 * web의 PreAdmissionTab과 동일 API 재사용 (조회 only):
 * - GET /clients/{id}/form-instances · GET /clients/{id}/documents
 *
 * 다운로드·공유는 파일 URL(서명 URL) 엔드포인트가 모바일에 아직 없어 임시 처리.
 */

type DocItem = { id: string; title: string; date: string; documentId?: string };

const CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
} as const;

export default function ClientDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const centerId = useCenterStore((store) => store.centerId);
  const { data: client } = useClientDetail(centerId, id!);
  const { data: formData, isLoading: formLoading } = useClientFormInstances(centerId, id!);
  const { data: docData, isLoading: docLoading } = useClientDocuments(centerId, id!);

  const [search, setSearch] = useState('');
  const isLoading = formLoading || docLoading;

  const items = useMemo<DocItem[]>(() => {
    const forms = (formData?.items ?? []).map((f) => ({
      id: f.mapping_id,
      title: '폼 응답',
      date: f.instance.submitted_at ?? f.instance.created_at,
    }));
    const docs = (docData?.items ?? []).map((d) => ({
      id: d.mapping_id,
      title: d.document.original_name ?? d.document.name,
      date: d.created_at,
      documentId: d.document.id,
    }));
    return [...forms, ...docs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [formData, docData]);

  const q = search.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;

  const title = client?.name ? `${client.name}의 문서` : '문서';

  // 문서 파일: 서명 URL 조회 → 다운로드(브라우저) / 공유(URL)
  const onDownload = async (item: DocItem) => {
    if (!item.documentId || !centerId) return;
    try {
      const url = await getDocumentDownloadUrl(centerId, item.documentId);
      await Linking.openURL(url);
    } catch {
      Alert.alert('다운로드', '문서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  const onShare = async (item: DocItem) => {
    if (!item.documentId || !centerId) return;
    try {
      const url = await getDocumentDownloadUrl(centerId, item.documentId);
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch {
      // 사용자 취소 등 — 무시
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar style="dark" />
      {/* 헤더 + 검색바 — 페이지 배경(회색)과 통일 */}
      <View className="bg-background">
      {/* 헤더 — 뒤로가기 */}
      <View style={{ height: s(52), paddingHorizontal: s(12) }} className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={s(24)} />
        </TouchableOpacity>
      </View>

      {/* 검색바 */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(4), paddingBottom: s(16) }}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="문서 제목으로 검색해주세요"
          containerStyle={{ borderWidth: 1, borderColor: '#E3EAEF' }}
        />
      </View>
      </View>

      <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 타이틀 — 아이콘 + "{이름}의 문서 N" */}
        <View className="flex-row items-center" style={{ gap: s(6), marginBottom: s(14) }}>
          <Icon name="documents-24" size={s(20)} />
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            {title}
          </Typography>
          <Typography variant="body-03" weight="regular" className="text-gray-400">
            {items.length}
          </Typography>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: s(64) }} className="items-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState searching={q.length > 0} />
        ) : (
          <View style={{ gap: s(12) }}>
            {filtered.map((item) => (
              <DocCard
                key={item.id}
                item={item}
                onDownload={() => onDownload(item)}
                onShare={() => onShare(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── 문서 카드 (제목 + 날짜 + 다운로드/공유 버튼) ───
function DocCard({
  item,
  onDownload,
  onShare,
}: {
  item: DocItem;
  onDownload: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        gap: s(14),
        ...CARD_SHADOW,
      }}
    >
      <View style={{ gap: s(4) }}>
        <Typography variant="body-01" weight="semibold" className="text-gray-900" numberOfLines={2}>
          {item.title}
        </Typography>
        <Typography variant="body-03" weight="regular" className="text-gray-400">
          {formatKstDate(item.date)}
        </Typography>
      </View>
      {item.documentId && (
        <View className="flex-row" style={{ gap: s(8) }}>
          <DocButton label="다운로드" icon="download-16" onPress={onDownload} />
          <DocButton label="공유하기" icon="share-16" onPress={onShare} />
        </View>
      )}
    </View>
  );
}

function DocButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: s(44),
        borderRadius: s(10),
        backgroundColor: '#F1F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={s(16)} color={COLORS.gray[600]} />
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[600] }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── 빈 상태 ───
function EmptyState({ searching }: { searching: boolean }) {
  return (
    <View style={{ paddingVertical: s(64), gap: s(8) }} className="items-center">
      <Icon name="document" size={s(40)} color={COLORS.gray[300]} />
      <Typography variant="body-02" weight="semibold" className="text-gray-600">
        {searching ? '검색 결과가 없어요' : '등록된 문서가 없어요'}
      </Typography>
      <Typography
        variant="body-03"
        className="text-center text-gray-400"
        style={{ lineHeight: s(20) }}
      >
        {searching
          ? '다른 검색어를 입력해 보세요'
          : '사전기록지·동의서·파일은 웹에서 등록할 수 있어요'}
      </Typography>
    </View>
  );
}
