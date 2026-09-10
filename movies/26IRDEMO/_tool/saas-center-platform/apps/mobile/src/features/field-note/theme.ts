/**
 * 필드노트 다크 정체성 팔레트.
 *
 * ⚠️ 자립(self-contained) — 전역 테마(@/shared/constants/theme)에 의존하지 않는다.
 * 필드노트를 별도 앱으로 추출할 때 이 파일이 팔레트의 단일 소스가 되도록,
 * 값을 여기서 리터럴로 소유한다. (앱 셸의 씬 배경 오버라이드는 전역 COLORS.fieldnoteDark
 * 를 계속 쓰되, 그건 셸 코드이므로 추출 시 새 셸에서 이 DK 값을 참조하면 된다.)
 *
 * 키 이름은 기존 소비처(NewScreen/RecordingScreen 등) 호환을 위해 유지.
 */
export const DK = {
  bg: '#171717', // 딥 잉크 (base)
  surface: '#1D2227', // 카드
  elevated: '#2A2440', // 카드보다 한 톤 위(시트·강조 블록)
  border: '#322B49', // 보라-그레이 보더(solid)
  borderSub: '#241E33', // 약한 구분선
  text: '#E7E3F5', // 본문
  textSec: '#A39DBF', // 보조
  textMuted: '#6B6485', // 더 약한 보조(placeholder)
  accent: '#B98BFF', // 강조(다크 위 가독)
  accentDim: '#9B5DFF', // 브랜드(채운 버튼) = purple/500
} as const;
