import type React from 'react';
import type { SvgProps } from 'react-native-svg';
import type { BadgeColor } from '@/shared/components/ui';
import type { RecordMood } from './types';
import MoodExcited from '@assets/images/records/mood-excited.svg';
import MoodCalm from '@assets/images/records/mood-calm.svg';
import MoodNeutral from '@assets/images/records/mood-neutral.svg';
import MoodSad from '@assets/images/records/mood-sad.svg';
import MoodAngry from '@assets/images/records/mood-angry.svg';
import MoodAnxious from '@assets/images/records/mood-anxious.svg';
import CapturePhoto from '@assets/images/records/capture-photo.svg';
import CaptureVideo from '@assets/images/records/capture-video.svg';

/**
 * 기분 6종 — 값은 서버 통제 vocabulary라 임의 확장 금지(설계.md §15-1).
 *
 * 표정 일러스트는 시안(기록/작성 271:6568) export 벡터다. 여섯 파일 모두
 * 얼굴 원이 48 박스 안에서 44로 보이도록 viewBox를 정규화해 뒀으므로
 * 렌더 크기만 맞추면 서로 같은 크기로 보인다.
 */
export const MOODS: { value: RecordMood; label: string; color: BadgeColor }[] =
  [
    { value: 'excited', label: '신나요', color: 'orange' },
    { value: 'calm', label: '편안해요', color: 'green' },
    { value: 'neutral', label: '그저그래요', color: 'teal' },
    { value: 'sad', label: '슬퍼요', color: 'blue' },
    { value: 'angry', label: '화나요', color: 'red' },
    { value: 'anxious', label: '불안해요', color: 'purple' },
  ];

export const MOOD_LABEL: Record<RecordMood, string> = MOODS.reduce(
  (acc, m) => ({ ...acc, [m.value]: m.label }),
  {} as Record<RecordMood, string>,
);

/**
 * 본문 작성 팁 아코디언(시안 287:2708) 문구.
 *
 * 시안에는 접힌 줄만 있어 펼친 내용은 기획 근거로 짠 초안이다 —
 * 카피가 확정되면 이 배열만 갈아끼운다.
 * 근거: 기록-기획안-v1.md §3-3(한 줄도 1등 시민 / 길이 강제 없음),
 * 기록-시안-정합-요청.md §2-1("왜 이 이야기를 남기는지도 함께 적어보세요").
 */
export const RECORD_WRITING_TIPS: string[] = [
  '무슨 일이 있었는지 순서대로 적어주세요. 언제 시작해서 어떻게 끝났는지가 특히 도움이 돼요.',
  '아이가 한 말은 들은 그대로 따옴표로 남겨주세요.',
  '왜 이 이야기를 남기는지도 함께 적어보세요.',
  '한 줄이어도 충분해요. 길게 쓰지 않아도 돼요.',
];

/**
 * 촬영 가이드(시안 374:2188) 문구 — 레이아웃은 시안, 문구는 기획 정본이다.
 *
 * ⚠️ 시안 원문("찢어진 책, 낙서, 상처" · "떼쓰기, 다툼")은 기록-시안-정합-요청.md
 * §1이 🔴로 막은 결핍 프레임이다 — §17-2 *"결핍 프레임 하나가 카메라를 채증
 * 도구로 되돌린다"*, 특히 "상처"는 §16-5(신고의무 프로토콜)와 겹쳐 카메라를
 * 증거 수집으로 읽히게 한다. 그래서 예시는 §17-2의 중립 12상황으로,
 * 리드 문구는 §11-4 확정본으로 적었고 안전 지침 5를 상시 노출로 덧붙였다.
 *
 * ⚠️ 이 화면 문구는 치료사 감수 대상(§11-4 감수 열 "치") — 감수본이 나오면
 * 이 상수만 갈아끼운다. 임의 개작 금지.
 */
export const CAPTURE_GUIDE = {
  title: '이럴 때 30초만 찍어두면 좋아요',
  description:
    '검사실에서는 안 나오는 평소 모습이, 선생님에게 가장 큰 힌트가 돼요',
  /** 형식별 분량 안내 — emphasis만 굵게 */
  formats: [
    {
      key: 'photo',
      label: '사진',
      icon: CapturePhoto,
      lead: '그림책, 밥, 새 장난감처럼 ',
      emphasis: '한 장면',
      tail: '을 남길 때',
      hint: '3장 이내 권장',
    },
    {
      key: 'video',
      label: '동영상',
      icon: CaptureVideo,
      lead: '몸놀이, 또래와 놀이처럼 ',
      emphasis: '움직임',
      tail: '이 이어질 때',
      hint: '30초~1분 이내 권장',
    },
  ] as const,
  /** §17-2 중립 12상황 — 영역명은 숨기고 상황만 노출한다 */
  situations: [
    '이름 불렀을 때',
    '원하는 게 있을 때',
    '그림책',
    '몸놀이',
    '또래',
    '새 장난감',
    '혼자 놀이 30초',
    '밥',
    '새 음식',
    '계단',
    '같은 움직임 반복',
    '전환 순간',
  ],
  /** §17-2 안전 지침 5 — "다시 표시 안할게요" 대상이 아니다(상시 노출) */
  safety: [
    '목욕·탈의 장면은 찍지 않기',
    '다른 아이가 나오는 기관 안에서는 찍지 않기',
    '우는 장면을 만들어 찍지 않기',
    '위험한 순간엔 카메라보다 손',
    '소리 끄지 않기 — 영상은 절반이 소리예요',
  ],
};

/** 표정 일러스트 — 렌더 박스는 48 정사각(얼굴 44 + 장식 여백) */
export const MOOD_ICON: Record<RecordMood, React.FC<SvgProps>> = {
  excited: MoodExcited,
  calm: MoodCalm,
  neutral: MoodNeutral,
  sad: MoodSad,
  angry: MoodAngry,
  anxious: MoodAnxious,
};

export const MOOD_COLOR: Record<RecordMood, BadgeColor> = MOODS.reduce(
  (acc, m) => ({ ...acc, [m.value]: m.color }),
  {} as Record<RecordMood, BadgeColor>,
);
