/**
 * LAB 실험 화면 레지스트리
 *
 * 새 실험 화면 추가 절차:
 *   1) `app/(main)/lab/<slug>.tsx` 파일을 만든다 (Expo Router 자동 라우팅)
 *   2) 이 배열에 항목을 한 줄 추가한다 — 끝
 *
 * slug 는 URL segment 이자 파일명. 충돌 없도록 unique.
 */

import type { LabExperiment } from './types';

export const LAB_EXPERIMENTS: LabExperiment[] = [
  {
    slug: 'schedule-weekstrip-collapse',
    title: '[일정] WeekStrip 스크롤 방향 접기/펼치기',
    description:
      '문제(디자이너 제기) — 리스트 뷰에서 WeekStrip(날짜 선택)은 ScrollView 자식이라 아래로 스크롤하면 위로 사라지고, 맨 위까지 되돌려야만 다시 나타난다. 밑으로 내린 상태에서 다음 날로 옮기려면 매번 맨 위로 올려야 해 불편. 목표 — 아래로 스크롤하면 지금처럼 접히되 위로 스크롤하면(맨 위 아니어도) 즉시 복귀, "N명을 만나요" 날짜 헤더는 항상 고정. 탭 — [현재] 대조군(자식이라 맨 위에서만 복귀) / [방향 반응] WeekStrip 높이를 스크롤 방향에 맞춰 0↔H 애니메이션(아래=접힘·위=복귀, 제안) / [항상 고정] 접지 않고 상시 노출(공간 차지하는 대안). 주의(실적용 시) — 날짜 전환 자동 스크롤은 프로그램적 onScroll이라 방향 판정에서 제외해야 함, 작은 흔들림은 임계값(8px)으로 무시. 전부 mock — 확정 시 schedule.tsx 리스트 뷰 WeekStrip/sticky 헤더 구성에 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'timeline-gap-collapse',
    title: '[일정 타임라인] 빈 시간 접기/정규화',
    description:
      '문제(디자이너 제기) — 현재 DayTimeline 은 시간 비례 그리드(00–24 spine)라 두 일정 사이가 멀면 큰 빈 공간이 그대로 노출돼 스크롤 낭비·답답함. 방향(채택, 첨부 이미지) — 빈 시간을 "N시간 비어있음"으로 생략. 단 (1) 가장자리(첫 일정 전·마지막 일정 후) 빈 시간은 접지 말고 아예 trim, (2) 내부 갭만 임계값 3시간 초과 시 접고 짧은 갭은 비례 유지(시간 감각 보존), (3) 접힌 밴드는 정보 라벨(인터랙션 없음 — 모바일은 일정 등록이 web 전용이라 빈 시간에 붙일 액션이 없음. 밀린 일은 별도 추천 카드 담당). 타임라인 → 리스트 스펙트럼 탭 — [현재] 운영시간(09–19) 비례 그리드, 큰 갭이 빈 공간(대조군, 순수 타임라인) / [선형+생략] 선형 그리드(가로 시간선)·선형 눈금 유지 + 가장자리 trim + 큰 갭만 1시간 높이로 압축(broken axis), 좌측 시간 숫자 점프(12·13·14·15 건너뜀)로 접힘 자명 — production에 가장 가깝게 시간 눈금 감각 유지 / [갭 접기] 가장자리 trim + 내부 갭>3시간 접기(죽은 공간만 잘라낸 타임라인, 이미지안 발전) / [갭 접기+] 갭 접기 + 좌측 연속 spine(일정=노드) + 요약 헤더(오늘 N건·상담/검사) + 도형/배경 위계(scaffolding 옅게·카드만 채움) + 빈 구간 추천 카드 조건부 승격(할 일=일지·소견 정리 있는 갭만 production GapRecommendationCard 자리에 카드로, 없으면 조용한 "N시간 비어있음") → 타임라인 의미 유지하며 세로선 따라 일정만 또렷이 스캔(권장 종합안) / [정규화] 갭 크기 무관 같은 높이 밴드(갭 비례감 사라져 리스트에 가까움) / [아젠다] 시간=라벨, 오전·오후·저녁 그룹 카드 리스트(빈 시간 개념 없음, 순수 리스트). 핵심 질문 = 모바일 상담사에게 타임라인이 필요한가 vs 아젠다가 맞나(접을수록 타임라인→리스트로 미끄러짐). 시나리오 토글 [일반·드문드문·몰림]으로 갭 모양이 다른 하루에서 비교. 토큰 — 밴드=border/dashed(gray-300) 점선, "비어있음"=ghost(gray-400), 일정 카드=흰 페이지 위 gray-50(보더·좌측 컬러바 없음). 전부 mock — 확정 시 DayTimeline spine/gap 렌더에 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'home-empty-hero',
    title: '[홈] 히어로 우선 + 신호 표현',
    description:
      '현재 홈(BriefStackHome)은 작은 인사말 → 일정 카드 순이라 "오늘 일정 없음"일 때 메인 자리가 비어 애매하다는 피드백. 방향(확정) — 이미지 + 히어로 문구(일정량에 적응: 여유로운 하루/좋은 오후/바쁜 하루)를 메인 앵커로, 그 아래 일정 카드는 "지금 기준 다음 1건"만, 그 아래 에이전틱 신호(일지 작성·상담 연장·검사 공유·출석 주의·미수). 이번 비교 핵심 = 신호를 캡슐 스택 대신 어떤 형태로 차분히 보여줄지. 변형 탭 — [현재] production 재현: 신호를 프로스티드 캡슐 칩 가운데 스택(히어로 톤·정렬축 충돌 대조군) / [브리프 카드] 한 카드에 묶고 1순위만 살짝 강조 + 더보기(홈=발견 스펙과 맞음, 권장) / [섹션 리스트] 박스 없이 행 나열 + 옅은 구분선(가장 가벼움, TO DO처럼 읽힐 위험) / [우선순위] 가장 중요한 1건만 크게+액션 버튼 + "외 N건" 접기(가장 절제). 시나리오 토글: [여유 0건]·[보통 2건]·[바쁨 5건]으로 히어로 문구·다음 일정 카드 적응 확인. 색은 의미 있을 때만(1순위=보라/위급=red/나머지 중립 gray). 이미지=기존 RestWithCoffeeIcon, 배경=production 블롭 재현, 카드는 흰 페이지 위 gray-50(보더·좌측 컬러바 없음). 전부 mock — 채택 시 BriefStackHome 히어로/일정/신호 분기에 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-detail-v2',
    title: '[필드노트] 상세 노트 느낌 v2',
    description:
      '실제 상세(CompletedScreen)는 "{날짜} 녹음" 제목 + 전사 + 하단 재생 독이라 "녹음 재생기" 성격 — 목록 탭 이름은 "노트"인데 상세엔 노트 정체성이 0. 피드백 반영 원칙: (1) 내용 구조(전체 대화·메모·AI 분석 탭)는 현황처럼 그대로 유지(탭 합치지 않음), (2) 노트 느낌은 텍스트 재배치가 아니라 표면/재질에서 만든다. [재질 탭 8종] 현황(실제 상세 재현, 대조군) / 노트지(다크+가로 괘선+좌측 마진선) / 페이퍼(다크 위 아이보리 종이) / 모눈(그리드지, 연구·검사 무드) / 크라프트(따뜻한 갈색 현장 수첩) / 제본(스프링 제본+측면 "노트" 인덱스 탭) / 손글씨(다크 최소변경+손글씨풍 날짜 스탬프) / 다이어리(밝은 종이+큰 날짜+리본). 모든 재질이 전체대화·메모·AI 탭 본문을 공유. [예시 케이스 4종] 상담 회기 / 집단 상담(외 N명·다화자) / 검사(HTP) / 미연결·미분석 — 한 재질이 연결/미연결·분석/미분석·화자분리·다인 케이스에서 버티는지 검증. 확정 시 CompletedScreen 적용 + INFORMATION_SPEC §3-4 갱신. mock 전용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-detail-header',
    title: '[필드노트] 상세 노트 느낌 (v1·보존)',
    description:
      '※ v2(field-note-detail-v2)로 대체됨 — 전사 구조 재해석 탐색안 보존. 탭 — [현행] 평평 다크+"…녹음"(대조군) / [A 스파인] 세로 시간축 한 줄기에 발화·메모·AI를 시각순으로 꽂고 playhead가 흐름 / [B 주석] 전사=본문, 메모·AI=여백 주석 / [C 웨이브폼] 상단 파형+메모/AI 핀, 탭=seek / [D 카드덱] 요약·키워드·이슈·정서·전사를 옆으로 넘기는 인덱스 카드. mock 전용.',
    status: 'ready',
    category: 'legacy',
  },
  {
    slug: 'body-gray-tone',
    title: '[토큰] 본문 회색(gray-600) 톤 비교',
    description:
      'text/body/default(#606A74)가 실기기에서 연하게 느껴진다는 피드백 → 토큰을 미세하게 진하게 조정할지 비교. title+body 가상 샘플(상담 요약: 타이틀·본문 단락·레이블-값·캡션)에 후보 회색을 적용해 흰 카드 / 회색 페이지 맥락에서 가독성 비교 + 후보 한눈 비교. 탭 — [현재 #606A74] 대조군 / [-8 #58626C] / [-16 #505A64] / [-24 #48525C](gray-700 근접). 블루 틴트(R<G<B, +10/+10) 유지한 등간격 단계. 확정 시 theme.ts gray-600 + design.md text/body/default 동기 개정(앱 전역 영향). 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'gap-recommendation',
    title: '[일정 타임라인] 빈 시간 추천 · 멀티',
    description:
      '일정 사이 빈 구간에 "이 시간에 할 일" 추천 카드 삽입 — Agentic 신호(§4)를 시간축에 매핑. 룰: 빈 구간 이상만 노출(production 60분) / 점심(12-13) 자동 제외 / 현재 시각 이후 첫 빈 시간 1곳에만. 멀티추천 — 한 빈 시간에 일지 작성·검사 소견·보호자 답장 등 여러 종류를 종류별 아이콘으로 묶어 노출. 노출 방식 3시안 — A 점선 스택(여러 건 위아래 stack, 한눈 스캔) / B 화살표(한 건씩 + 헤더 ‹ 1/3 › 카운터·화살표 탭 전환, 날짜 스와이프와 충돌 회피) / D 미니 스택(outline 컴팩트 행 나열, 액션 즉시). mock 하루 9~17시: 첫 빈 구간 90분(10-11:30)에 3건 노출, 점심 회색 칩 제외. 검사 소견·보호자 답장은 mock(데이터 미연동) — 실연동 종류만 production 승격.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-home-cards',
    title: '[필드노트] 홈 오늘 일정 카드 · 78·버튼',
    description:
      '오늘 일정 카드 표면 개선 — 카드 높이 78 고정 + 우측 액션 버튼화 + 진행 중 액티브 강조. 결정(사용자 확정): 두 버튼 + 상태칩 유지(미녹음=녹음 시작 블루 / 분석완료=분석 보기 다크, 녹음중·전사중은 버튼 아닌 상태칩), 검사 카드는 펼침 유지(헤더만 78, §3-4-2 task 단위). 탭 — [현재] production home.tsx 카드 재현(한 줄 컴팩트·상태 텍스트·작은 녹음 pill, 고정 높이 없음, 대조군) / [신규 78·버튼] 높이 78 세로중앙 + 카테고리 dot(상담 그린·검사 블루) + 녹음 시작/분석 보기 버튼 + 녹음중/전사중 상태칩, 진행 중(현재시간∈시작~종료) 보라 그라데이션 보더. 결정 포인트: 녹음 버튼 색 블루(이미지) vs 필드노트 보라 정체성, 카테고리 dot 신규 도입 여부. 전부 mock — 확정 시 home.tsx 오늘 일정 분기에 반영. 짝: field-note-home-assessment(검사 펼침), field-note-list-card(노트 카드).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-list-break',
    title: '[필드노트] 목록 · 도메인 필터 + 틀을 깬 레이아웃',
    description:
      '두 고민 한 화면 — (1) 필터칩 이름: "회기 미지정"은 상담 편향(검사는 task 연결)이라 상담·검사를 함께 포용하는 도메인 축 [전체·상담·검사·미지정]으로, "미지정"은 중립어(둘 다 커버). (2) 목록: 단순 세로 리스트 탈피, 음성 기록 본질을 살린 틀 깬 레이아웃. 필터칩은 세 탭 공용(상단 고정·카운트 뱃지), 다크 필드노트 스킨. 탭 — [타임라인] 시간 스파인에 노트가 꿰여 "언제"의 흐름으로(날짜 그룹+좌측 시각+미니 파형+상태 신호) / [도메인 레인] 상담·검사·미지정 띠 그룹(필터와 같은 축을 공간으로, 미지정=챙길 것 위로) / [웨이브 피드] 파형이 주연인 매거진형 큰 카드(녹음 본질 전면, 한 건씩 풍부). strip 색=진행 red/처리 purple/챙길것 orange(미지정·실패)/완료 무색, 검사=blue dot+검사명, 녹음중 라이브 파형. 전부 mock — 확정 시 FieldNoteListContent + 필터 축 반영. 짝: field-note-list-card(카드 아이템), field-note-filters(필터 축).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-task-layout-break',
    title: '[검사 항목] 틀을 깬 레이아웃 (카드 탈피)',
    description:
      '짝 lab assessment-task-record-3beat 이 "카드 표면"을 다뤘다면 이건 "카드 말고 다른 구조로?"를 탐색. 같은 데이터 모델(소견 독립 + 음성 선택 + 라이프사이클 시작/이어/분석하기/보기, 온라인 숨김, 단일 활성 미니바·충돌·인터랙티브) 유지하되 레이아웃 패러다임을 통째로 교체. 탭 — [타임라인] 좌측 세로 스파인에 검사가 노드로 꿰여 박스 아닌 "흐름"으로(진행 위→아래) / [문서] 카드 컨테이너 제거, 여백·타이포 위계·얇은 룰로만 구분하는 에디토리얼(소견=본문, 음성=여백 주석, 임상 노트 톤) / [보드] "지금 챙길 것·진행 중·끝남" 트리아지 그룹핑(리스트→할 일 판 reframe) / [접기] 평소 한 줄(검사명+소견·음성 미니 글리프), 탭하면 그 자리 펼쳐 미리보기·액션(밀도↑ 점진 노출) / [포커스] 한 검사 크게+좌우 peek 캐러셀(스와이프 한 건씩 몰입, 화살표·도트). 소견 작성분은 본문 미리보기 동반. 파형·펄스 Animated, 보라=fieldnote/빨강=녹음/blue=검사 카테고리. 전부 mock — 방향 선택 후 3beat 카드안과 비교해 production 채택.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-recording-minibar',
    title: '[필드노트] 녹음 미니바 (재사용 부품)',
    description:
      '단일 활성 녹음 모델(메모 확정: 단일 활성 녹음 + 최소화 미니바 + 멈춤≠폐기→분석 finalize)의 핵심 부품을 독립 lab으로 정리(assessment-task-record-3beat 에서 추출). 화면 가로막는 풀 시트가 아니라 어디서든 떠 있는 최소화 바 — 진입점(검사 칩·FAB·회기 카드)은 이 바를 띄우는 방아쇠일 뿐 바는 공통. 인터랙티브 — "녹음 시작"으로 띄움 → 타이머 → 일시정지/재개 → 정지(폐기 아님, 분석으로 넘어감+토스트). 탭=시각 변형 — [다크 컴팩트] 펄스+파형+라벨+타이머+아이콘 컨트롤(최소 공간) / [다크 라벨] 글자 컨트롤(일시정지/정지, 오조작↓) / [라이트] white surface+보라 accent(밝은 맥락) / [확장 핸들] 바가 "녹음 화면 복귀 핸들"(드래그 핸들+탭 시 풀 시트 힌트+정지하고 분석). 더미 배경 위에 떠 맥락 확인. 파형·펄스 Animated, 보라=fieldnote/빨강=녹음. 전부 mock — 확정 시 production 전역 RecordingMiniBar 로 추출(RecordingHost 연결).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-record-sheet',
    title: '[필드노트] 녹음 바텀시트 · 재미·직관·필요 3박자',
    description:
      '녹음 중 떠 있는 바텀시트 UI를 재미(소리가 살아있다)·직관(지금 녹음 중·누구·얼마나)·필요(상담사가 현장에서 쓰는 정보/액션) 3박자 조화로 탐색. 각 시안은 mock 타이머가 실제로 흐르고 파형·오브·자막이 움직이며 일시정지가 동작 → 정지 그림이 아니라 "녹음 중" 느낌을 만져보고 비교. 메타포 탭 — [신규 자막] 이미지 #5 채택안(기본 탭): 전사 전면 주연 + 하단 독(블루 파형+작은 타이머+[메모|⏸|■]), 메모 탭 시 컨트롤 행이 입력 행으로 morph(파형·타이머 유지·전사 안 가림), 우상단 닫기로 최소화. 히어로(큰 타이머·오브) 제거. 확정 시 production RecordingSheet의 morph 히어로를 걷어내고 이 레이아웃으로 포팅 / [현재] production RecordingSheet 핵심 재현(대조군, 무대감 약함) / [오브 호흡] 호흡 오브+할로(재미·직관◎ 필요△, 진입 인트로용) / [파형 무대] 풀폭 2단 라이브 파형(재미◎) / [컨트롤 도크] 타이머+컨트롤 한 줄+#태그+빠른 메모(필요◎). ｜ 프로덕션 두 맥락(녹음 중→분석 후) — [라이브 자막] = 프로덕션 녹음 중 화면 그대로(타이머·REC·일시정지/정지 + 실시간 전사 + 하단 시점 메모, 녹음 중엔 diarization 전이라 화자 라벨 없이 타임스탬프+텍스트 + "전사 중…" pulse) / [말풍선·상세] = 분석 후 화자분리 상세(필드노트 상세 "전체 대화", 데이터 실재=refined_transcript·diarized_transcript·speaker_map. 내담자 보라/상담사 그린 화자 버블+화자명+타임스탬프, 버블 탭→재생 점프(seek), 하단 재생바. 내부 [1:1]↔[그룹(내담자3)] 토글 — 그룹은 내담자 다수를 좌측에 색·이름으로 구분, 상담사만 우측. 좌/우 역할은 화자분리 결과에 없으므로 **서버 분석 단계가 전사 보고 판정(speaker_roles)** 전제 + 화자 편집 override 폴백. 녹음 chrome 아님 — 현 production CompletedScreen은 화자 헤더行, 이를 말풍선으로 바꾸는 안). 추가 전사 표현 변주 — [자막·포커스] 최근 발화만 크게(몰입·글랜스, 되짚기 약함) / [자막·마킹] 발화 줄 실시간 북마크→소견 인용 후보·하이라이트 직결(§3-4-3·§3-4-1) / [자막·요약레일] 키워드 실시간 누적(정리 재미, 단 해석성 출력 임상오염 리스크). 하단 3박자 점수 바 펼치면 시안별 판정. 파형·오브·REC깜빡임·자막등장·버블·칩은 Animated, 보라=fieldnote/빨강=녹음 라이브, 정체성=상담 그린 dot. STT 지연·무음 타임아웃(15초 복구)·metering 신뢰도가 직관 좌우 — 자막은 "듣는 중…" 플레이스홀더로 방어. 전부 mock — 확정 시 RecordingSheet 레이아웃에 반영. 짝: field-note-record-entry(녹음 진입).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-task-record-3beat',
    title: '[검사 항목] 소견+음성 카드 · 디자인 상향',
    description:
      'v5 디자인 상향 — 모델/데이터/액션(소견 독립 + 음성 선택 + 라이프사이클 시작·이어·분석하기·보기, 온라인 숨김, 단일활성 미니바·충돌)은 유지하고 "디자인이 진부하다"는 피드백에 표면·위계·색 리듬만 끌어올림. 레버 — 회색 평카드+구분선 → white 카드+soft shadow+sunken 트레이로 깊이 / 검사명 타이포 위계(body-01)+메타 캡션 / 카테고리 dot(assessment blue)로 색 리듬·보라는 음성에만 / 구분선 의존↓ 여백·면 그룹핑 / 녹음중 카드 은은 점등. 탭 — [현재] 회색 평카드 구분선 칩(대조군·평범) / [액션 트레이] white카드+shadow, 소견·음성을 카드 안 gray-50 sunken 트레이에 담아 정보(위)·액션(아래) 면 분리 / [컬러 스파인] 구분선 없이 여백·타이포로만+좌측 4px 음성 상태 스파인(녹음 빨강·완료 보라), airy·모던 / [대시보드] 컴팩트 타일, [소견]·[음성] 상태 pill 2개가 곧 액션, 한눈 스캔 / [세련 종합] white카드+shadow+카테고리dot+검사명 hero, 소견 당당한 행 + 음성 우아한 "(선택)" 캡슐+라이프사이클, 녹음중 점등(권장). 인터랙티브 유지(눌러서 시작→미니바→정지→분석, t3 분석하기, t1 이어, 충돌). 파형·펄스 Animated, 보라=fieldnote/빨강=녹음/blue=검사 카테고리. 전부 mock — 확정 시 assessment/[id].tsx TaskCard 반영. 짝: field-note-recording-minibar.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-home-assessment',
    title: '[필드노트 홈] 검사 세션 = 검사별 노트',
    description:
      '갭: 상담은 회기 1개=필드노트 1개(단순)인데, 검사는 세션 1개 안에 검사(task) N개 → 검사별 필드노트 N개(§3-4-2). 현재 홈 타임라인은 검사를 "검사" 뱃지 하나로 뭉개 검사별 녹음/연결을 못 함(검사 상세까지 들어가야 가능). 탭 — [현재] 검사=뱃지 하나(대조군, 갭 노출) / [확장 카드] 검사 세션 카드 탭→검사 task 서브행 펼침(완료=분석보기·녹음중·미연결=녹음연결·온라인=녹음안함), 접힘 땐 "검사 N·녹음 M" 요약(권장) / [펼친 행] task 항상 노출(밀도↑). 상담 카드는 단순 유지 — 구조 차이 그대로 반영. 인터랙티브(검사 카드 탭→펼침, 액션→배너). 서버: task별 fn 상태 묶음 홈 응답 필요(useFieldNotesByTask 재사용). 전부 mock — 확정 시 home.tsx 오늘 일정 검사 분기에 반영. 짝: assessment-task-fieldnote(검사 상세 진입점).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-record-entry',
    title: '[필드노트] 녹음 진입 · link-at-start',
    description:
      '마이크 탭 = 즉시 blind 녹음(미연결)이 맞나? 상담사는 어떤 회기/검사인지 알고 들어간다 → 연결은 의도 시점(녹음 시작)에. 탭 — [현재] 마이크=즉시 blind→미연결 노트(대조군) / [연결 선택] 마이크="무엇에 연결?" 시트(지금 회기 선점 카드 원탭 + 오늘 회기·진행중 검사 목록 + 검색 + "회기 없이 녹음" fallback 강등, 권장) / [지금 자동] 지금 진행 중 회기 있으면 시트 대신 원탭 확인 바, 애매할 때만 전체 시트(최소 마찰). 인터랙티브 — 마이크 누르면 선택 결과로 호출될 start(...) 배너 표시. 미지정은 1급 축이 아니라 예외로 강등 → 용어/필터 부담 해소. 전부 mock — 확정 시 home.tsx onRecord 라우팅 + 신규 연결 선택 시트 반영. 짝: field-note-list-card.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-list-card',
    title: '[필드노트] 목록 카드 · 신호/용어 재설계',
    description:
      '필드노트 탭 노트 목록의 카드 아이템을 상담사 관점으로 재점검. 문제 — (1) "연결/미연결"이 DB 관계어라 인지 약함 (2) 한 카드에 녹음중·미연결·분석중이 중복(녹음중=dot+배지+제목+미리보기 4곳)·play 아이콘 오해·검사(task) 노트가 "미연결"로 잘못 표시(isLinked가 schedule_id만 봄). mock 12건으로 상태·연결·카테고리 조합 다양화(녹음중·일시정지·상담/검사 분석중·전사만됨·실패·완료·과거). 탭 5개 — [이미지안] 디자이너 다크 시안 충실 재현(검색바+전체/연결/미연결 칩+오늘 그룹+행형 카드: 카테고리 dot·[세트]뱃지·프로그램|장소·녹음중 블루 인라인·미리보기2줄·미지정 "필드노트 N"+선택하기 CTA, 기본 노출) / [현재] production 충실 재현+버그 노출(대조군) / [신호 정리] 정체성 1순위+우측 단일 신호+play 제거+검사명 뱃지 / [정리함] "미연결"→"회기 미지정"+상단 "정리 필요" 존+진행중 녹음 제외 / [3요소 ✨] 재미(라이브 파형·펄스·호흡 액션)·필수(좌측 strip=빨강진행/보라처리/주황챙길것/무색완료 + 단일 액션)·직관(상태색·검사 뱃지·상대시간) 종합안(권장). 각 탭 하단 판정/서버 갭 캡션. 서버 추가 — 목록에 task brief(내담자·검사명) enrich + isLinked=schedule||task. 용어 변경은 §3-4 ❓영역(스펙 갱신). 짝: field-note-filters(필터 축). 전부 mock — 확정 시 FieldNoteListContent 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-filters',
    title: '[필드노트] 목록 필터 축 · 디자인 리프레시',
    description:
      '필드노트 목록 필터 IA + 리스트 표면 재점검. 문제 — 프로덕션 채택본 "전체 / 회기 미지정"은 (1) "회기"가 상담 특화어라 검사(task) 노트까지 포괄하지 못하고 (2) 다크 리스트가 진부하며 Segment 다크 active = 솔리드 보라(#9B5DFF) 풀블록이라 과함. mock 12건(상담 summary/processing/unanalyzed/failed·미연결 + 검사 HTP/SCT/로르샤흐). 탭 — [현재] 파이프라인 상태 5칩(대조군) / [A 미니멀] 검색만 / [B 할 일] 처리필요=미연결+실패 / [C 연결축] 전체·미연결(현 프로덕션) / [D 도메인] 필터 축을 도메인으로: 전체·상담·검사·미지정 — 검사 1급화, "회기 미지정"→중립어 "미지정"(카드는 현재 그대로, 필터 축만 비교) / [E 리프레시 ✨] 도메인 필터 + 연한 톤 칩(보라 풀블록 제거, 정체성은 텍스트색만) + 카드 리프레시(카테고리 dot 상담그린·검사블루, 좌측 상태 strip, 연한 단일 신호, 검사명 뱃지)(권장). 서버 갭 — 상담/검사 분리는 link_type 파라미터 또는 클라 필터(미지정은 기존 linked=false). 용어·필터 축 변경은 §3-4-4 스펙 갱신(별도 작업). 전부 mock — 확정 시 FieldNoteListContent 필터+카드 반영. 짝: field-note-list-card.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-notes-client-tone',
    title: '[상담일지 리스트] 내담자 톤 · 3박자 케이스',
    description:
      '상담일지 리스트(counseling/notes.tsx)에 내담자 목록·상세(client/[id])가 만족하는 "재미·직관·필요" 3박자를 옮긴 케이스 비교. 상세에서 추출한 DNA — 재미(AttentionHero spring drop-in·pill pulse ring), 직관(좌측 컬러 strip·signal별 색·D-day 배지·미리보기), 필요(신호=즉시 액션·우선순위 그룹핑). 탭(가로 스크롤) — [현재] production 대조군 / [내담자 톤] 작성=success/미작성=notice 상태 칩 + SectionLabel 톤(직관) / [미작성 Hero] 최상단 AttentionHero(미작성 N건·orange strip·spring·pulse "작성하기" pill, 필요·직관·재미) / [카드 신호] 회기 카드 좌측 strip(완료=green/부분미작성=orange) + 그룹 작성률 progress + 작성행 요약 미리보기 + 미작성 시급도 경과 배지(직관·필요) / [결합] Hero + 카드 신호 동시 적용(미작성 hero가 위에서 챙길 일을 요약하고, 각 카드 strip·작성률·요약·시급도로 카드 단위까지 한눈에). 필터는 production Segment 칩 그대로(인터랙티브), 비교 탭은 가로 스크롤 primary pill로 시각 분리. 명시적 제외 — 컬러 아바타, 검색바 focus 인터랙션(촌스러움 피드백). 사인오프 시 notes.tsx NoteRow·카운트·카드에 반영. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-fieldnote-analysis',
    title: '[검사 필드노트] 분석 뷰 (전사싱크/검사렌즈)',
    description:
      '검사 task 노트의 분석을 어떻게 보여줄지. 스펙 §3-4-3: verbatim이 임상 데이터라 전사 싱크 1순위, AI는 해석 말고 정리만(반응/관찰/인용), 산출은 검사 소견 초안. 서버는 이미 검사 렌즈 분석(responses/observations/quotes) 생성. 탭 — [상담 렌즈(현재)] 대조군: mood/issues 해석이 끼어 검사엔 부적절·위험 / [검사·구조 우선] 반응↔질문·관찰·인용 카드 먼저 / [검사·전사 우선] 전사 싱크 전면(화자 버블+탭 재생)+되짚기 점프(권장). 미니 재생바로 seek 동기화, "소견 초안 만들기"=해석 아닌 verbatim scaffold(자동저장X). 필드노트 다크 스킨. 전부 mock — 확정 시 AIAnalysisView 검사 분기 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-task-fieldnote',
    title: '[검사 항목] 필드노트 연결 진입점',
    description:
      '검사는 항목(task)마다 필드노트 연결(백엔드 반영됨: field_notes.task_id, PATCH /field-notes/{id}/link-task). 검사 항목 카드에 "필드노트 상태+녹음 연결"을 어떻게 얹을지 비교. 카드가 이미 (검사명+상태뱃지+메뉴)+구분선+(소견 행)이라 과적재 주의. 필드노트 상태 5종(완료=분석보기/녹음중/분석중/미연결=녹음연결/온라인=제외)을 mock으로 한 화면에 노출. 탭 — [현재] 소견 행만(대조군) / [한 행 통합] 필드노트+소견 한 줄(밀도↑) / [전용 행] 필드노트 별도 행(상태 또렷) / [보이스 칩] 헤더 모핑 칩(미연결→녹음중 펄스·파형→분석→완료, 카드 높이 유지=깔끔+재미+직관, 권장) / [보이스 존] 연한 보라 영역+라이브 파형(표현 풍부, 카드 길어짐) / [칩·상담사] 적응형 칩 — 상담사 동선(검사 중/후) 기준: 미연결=조용한 마이크, 녹음중=펄스·파형+카드 강조(한눈에), 완료="분석"(탭=보기), hitSlop 44pt) / [도입(첫 인지)] 신규 기능 발견성 — 섹션 힌트 1줄 + 라벨 "녹음" 칩으로 "검사에서 녹음 가능"을 인지시킴, 정착 후 조용한 아이콘으로 점진 축소(권장 도입기). 파형·펄스는 Animated, 보라(fieldnote)는 포인트에만, 온라인 검사는 진입점 숨김, "녹음"은 단일 활성 녹음·미니바 흐름과 연결. 전부 mock — 확정 시 assessment/[id].tsx TaskCard 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-detail-tone',
    title: '[검사 상세] 톤 앤 매너 재구성',
    description:
      '검사 상세(assessment/[id])를 내담자 상세(client/[id])가 세운 품질 바로 재구성. 레이아웃 복제가 아니라 "톤 앤 매너"(설계 DNA) 이식 — 검사 고유 구조(Hero 개요 + 검사 항목 + 내담자 + 청구)는 유지하되 같은 결을 입힌다. 가져올 톤: 액션 우선·강조 계층·정체성 고정(헤더 내담자명, 검사 1:1)·디자인 시스템 충실(스피너→스켈레톤·gap 토큰·헤더↔콘텐츠 16)·친절 라이팅·색 절제. 같은 톤을 "어디에 무게를 두고 표현하나"로 케이스 비교 — 탭 7개: [현재] production 재현(빈 헤더·중앙 타일 연락처 없음, 대조군) / [절제] Hero 안에 "할 일" warning 칩(가장 조용, 권장 A) / [히어로] 최상단 어텐션 카드로 시급한 1건 강조(client 상세 펄스 톤, agentic, 권장 B) / [단계] 접수→실시→소견→결과→보고서 스텝퍼로 "흐름" 정면화+다음 CTA(단, task별 단계 제각각이라 환원 무리·예시) / [항목] Hero 축소·검사 항목이 주인공(카드마다 다음 할 일 CTA, 단 케이스 정보 약화) / [콤보] 히어로+단계 합성 — 한 장의 진행 카드에 정체성(검사명·진행도)+스텝퍼+다음 행동 펄스 CTA, 일정/보고서/메모는 보조 카드로 분리 / [상담형] 상담 상세(counseling/[id]) 레이아웃을 검사에 그대로 이식 — 내담자 이름이 Hero 타이틀(검사명 부제)+소견 미작성 primary 배너+1:1 청구는 Hero 안+검사 항목을 회기 리스트처럼(제목·상태뱃지·소견여부 부제)+헤더 비움. 단, 상담 1:1처럼 내담자 연락처/보호자·항목별 필드노트 진입이 빠져 검사엔 보완 필요. 공통(상담형 제외): 정체성 헤더·내담자 정보카드(연락처 탭투콜)·결과보기 게이팅·스켈레톤 미리보기 토글. 전부 mock — 확정 시 assessment/[id].tsx + 신규 _components/AssessmentDetailSkeleton 포팅. 정보 스펙 §3-6 내담자 연락처/보호자 노출은 스펙 갱신 별도 작업.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'assessment-detail-clients',
    title: '[검사 상세] 내담자 배치 비교',
    description:
      '검사 상세에서 내담자를 (현재처럼) 맨 아래 그리드로 둘지, 위쪽에 작게 같이 보여줄지 비교. 근거 — 상담 상세는 이미 1:1을 hero 타이틀(이름+성별·나이)로, 그룹을 캐러셀로 풀었다. 검사는 스펙상 1:1 기본(§3-6)인데 hero 는 검사명으로 시작해야 해(assessment-centric) 이름을 타이틀로 못 올림 → 검사명 아래 컴팩트 1줄이 상담 1:1 패턴에 가장 근접. 탭 — [현재] 검사 항목 아래 그리드(대조군, 단일 내담자엔 과한 신호) / [상단 컴팩트] hero 검사명 아래 1줄(권장) / [상단 카드] 검사 항목 위 가로 카드. 필드노트는 본 lab 밖 — 상담처럼 케이스 상세가 아니라 일정(회기) 상세 레이어에 둔다. 전부 mock — 확정 시 assessment/[id].tsx 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-processing-steps',
    title: '[필드노트] 녹음 분석 스텝 애니메이션',
    description:
      'ProcessingScreen(녹음 분석 진행) 스텝 표시 개선. 현재는 점+라벨 느슨한 리스트라 진행도/위계가 약함 → 연결선 세로 스텝퍼 + 개선된 애니메이션: 진행 단계 라디에이팅 펄스, 완료 시 체크 ZoomIn 팝, 단계 라벨 크로스페이드, 완료선 채움, N/4 진행도. 단계별 아이콘+한 줄 설명. 탭 — [현재] 느슨한 리스트(대조군) / [스텝퍼] 개선. ▶로 단계 진행 시뮬. 사인오프되면 ProcessingScreen 에 포팅. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-sheet-dark',
    title: '[필드노트] 녹음 시트 다크 리컬러',
    description:
      'production RecordingSheet 가 라이트(핑크→블루 파스텔)라 필드노트 다크 정체성과 안 맞음 → 다크 리컬러 시안. production 구조(모프 expanded↔compact + 컨트롤 + 전사 버블 + 메모 + AI 가이드 pill)를 그대로 다크로 옮겨 대비·누락 확인용. 탭 — [차분(expanded)] 큰 타이머+파형 / [전사(compact)] 상단 바+전사 버블+메모+AI pill. 하단에 라이트→다크 색 매핑표(포팅 가이드). 사인오프되면 RecordingSheet 에 1:1 포팅. AI 가이드 보라 그라데이션은 정체성과 맞아 유지. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-analysis-detail',
    title: '[필드노트] 분석 결과 페이지 개선',
    description:
      '필드노트 상세의 AI 분석 탭 개선. 현재는 summary 평문 한 덩어리만 보여줘 50분 회기를 스캔/활용하기 어려움. 그런데 백엔드 counseling_note 스키마엔 이미 정서(mood)·주제(main_topic)·개입(intervention)·진전(progress)·과제(homework)·다음목표(next_goal)가 있음(상담일지 초안으로만 소비, 분석 화면 미노출). 개선=이미 있는 구조 surfacing + 키워드·주요이슈·하이라이트(타임스탬프)·살펴볼 신호·후속 액션을 추가(프롬프트 보강). 탭 — [현재] 평문 요약(대조군) / [개선] 구조화 대시보드(⚠️살펴볼 신호·요약·키워드·주요이슈·정서·개입·진전·과제/다음목표·하이라이트·후속액션·일지 연결). 하단 데이터 출처(기존 vs 신규) 표기. §3-4 정의 예정 — 스펙 논의용 제안. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-recording-sheet',
    title: '[필드노트] 녹음 전사 · 화자분리 모션',
    description:
      '정정된 현실: 녹음 중엔 전사 텍스트는 나오나(청크 기반) 화자분리는 안 됨(그냥 텍스트). 화자분리는 정지 후 분석에서 시작 → 같은 전사가 상담사/내담자로 나뉨. 모션이 두 군데. 탭 — [녹음 중 전사] 녹음 시트 본문에 라이브 전사가 줄별로 흘러듦(화자 칩 없음) + "화자분리는 분석 때" 안내 + 메모/한마디·최소화·정지 / [분석·화자분리] 검토 화면에서 같은 전사가 화자별 버블로 reveal(상담사 보라/내담자 초록), 헤더 "화자 분리 중→됨", AI 요약·일지 opt-in. ▶로 청크 도착(약 4초) 모사. 시트 형태(풀/디텐트/미니바)는 별개 축. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-flow-applied',
    title: '[필드노트] 개선 흐름 적용 (워크스루)',
    description:
      '진단(field-note-flow-audit)의 개선안(대안 A)을 실제 화면으로 눌러보는 인터랙티브 워크스루. 정지=저장이고 끝 → 홈 복귀(처리 화면에 안 가둠) → 처리는 카드 배지+토스트(백그라운드) → 검토는 나중에 카드 탭 → 전사는 채워져 있고 AI 요약·일지초안은 "만들기" 버튼(opt-in). 단계: 녹음 → (정지)"마칠까요?" → 홈(전사 중→전사됨) → 검토(전사+메모/AI 버튼) → AI 생성. 상단 스텝퍼로 단계 이동, 백그라운드 전사 완료는 버튼 시뮬. 백엔드 변경 0(기존 인프라). 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-flow-audit',
    title: '[필드노트] 흐름 진단 (현재 코드)',
    description:
      '6/4 재점검 — 홈 허브·FAB→홈·녹음 충돌 resolver·회기카드 라이브가 적용된 지금, 녹음→분석 흐름이 실제로 어떻게 흐르고 어디가 어색한지 진단. 핵심 결론: FAB·홈은 "공간"으로 고쳐놨는데 정지 직후만 옛 흐름(처리 풀스크린 점프)이라 불일치가 가장 큼(ProcessingHost 백그라운드가 이미 있는데도 가둠). 탭 — [흐름] 현재 실제 여정 단계별로 어색 지점을 심각도와 함께 핀 / [발견] A~G 항목별 심각도 정리 + 코드 근거. 하단 결론 카드에 권장 다음 수(대안 A: 정지→홈 복귀·처리 백그라운드·AI 노트 버튼 / Stop 모달 단순화 / vestigial 로컬 녹음 엔진 정리). 짝: field-note-flow(미래 3안) + claudedocs/fieldnote-flow-redesign.md. 전부 mock·분석용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-flow',
    title: '[필드노트] 녹음→분석 흐름 3안',
    description:
      '녹음→분석→검토 근본 흐름 재설계 인터랙티브 워크스루(문서 claudedocs/fieldnote-flow-redesign.md 의 짝). 문제: 한 화면이 7모드로 변형되는 화면=상태머신이라 (1)정지하면 처리 풀스크린에 갇히고 (2)뒤로가기가 늘 전체 탈출. 상담사 페르소나(회기 중 폰 내려둠·직후 소진·검토는 나중에) + 업계 표준(클로바노트·Otter·Granola — 누구도 처리 중 전체화면에 안 가둠) 기반. 분석 두 층위 분리: 전사+화자(자동·백그라운드) / AI 요약·일지초안(선택·호출). 탭 — [현재] 대조군 / [대안 A ≈클로바노트, 권장·최소변경] / [대안 B ≈Granola enhance 검토 대기실] / [대안 C ≈ambient 라이브 바]. 전부 mock — CTO 방향 선택 대기.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-recording-conflict',
    title: '[필드노트] 녹음 충돌·복귀 흐름',
    description:
      '진행 중 녹음을 "공간을 가로막는 모달"로 다뤄 생기는 두 문제 해결 흐름. (A) 다중 녹음 트리거 충돌 — generic 마이크 vs 회기 연결 녹음(회기 카드 버튼은 가드 없음). (B) 녹음 중 FAB→시트 직행이라 홈/목록에 갈 수 없는 덫. 확정 방향: 단일 활성 녹음 + 최소화 가능한 미니 바(멈춤≠폐기, 분석으로 finalize), FAB 녹음 중→홈(공간), 미연결 녹음+회기 B 탭→"이 회기에 연결?"(새 녹음 X), 다른 회기 A 녹음+회기 B 탭→"멈추고 새로?". 탭 — [현재(덫)] 빠져나갈 길 없는 시트+가드 없는 회기 버튼 / [공간 복귀] FAB→홈, 미니 바+가운데 마이크 라이브, 시트 최소화 / [연결 제안] 미연결→회기 연결 확인 시트 / [회기 전환] A≠B 멈추고 새로 확인 시트. 전부 mock — 채택 시 DraggableFab.handleTap·회기 카드 녹음 resolution·시트 최소화·미연결→회기 연결 API에 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-empty-guide',
    title: '[필드노트] 홈 빈 상태 가이드 카드',
    description:
      'FAB 탭 시 뜨는 필드노트 홈(field-note/home, 다크 sub-app) 첫 진입 빈 상태를 가이드 카드로 채우는 비교. (목록 아님 — 목록은 홈의 노트 탭으로 진입.) 현재 신규 진입(오늘 회기 0 + 노트 0)은 히어로 오브 + "오늘은 예정된 회기가 없어요" 헤드라인 + 체크라인 + 최근 노트 빈 카드뿐이라, 처음 쓰는 사람에겐 "회기 없어요"가 밋밋하고 이 도구가 뭘 해주는지 안내가 없음. 뉘앙스: 가이드는 완전 신규(노트 0건)에서만, 오늘 회기만 없는 기존 사용자에겐 숨김. 하단 플로팅 네비([← 홈 ◉녹음 노트 검색]) 함께 재현. 탭 — [현재] 실제 빈 홈 대조군 / [3단계 가이드] 녹음→AI정리→회기연결 카드 + 헤드라인 리프레이밍(권장) / [첫 사용 환영] 헤드라인을 가치 제안으로 + 가치 칩 / [샘플 미리보기] 최근 노트 빈 카드를 완성 노트 ghost로 교체(최소 개입). 전부 mock — 채택 시 home.tsx 헤드라인/본문 빈 분기·최근 노트 빈 카드에 반영.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-subapp-nav',
    title: '[필드노트] sub-app 플로팅 네비?',
    description:
      '토스 증권 패턴(글로벌 바텀바 숨기고 [← 나가기] + 영역 고유 플로팅 바텀 네비)을 필드노트에 적용하는 비교. 질문 — FAB 탭 시 풀스크린 홈(현재 적용본) 대신 필드노트를 독립 공간으로 만들고 자체 플로팅 네비로 움직이는 게 나은가. 관건: 필드노트 진짜 섹션은 홈+노트 2개뿐(녹음은 액션)이라 4칸 네비가 빌 수 있음 → 녹음을 가운데 액션 버튼으로 올려 [←] 홈 · ◉녹음 · 노트로 채움. 탭 — [현재] 풀스크린 홈+하단 풀폭 CTA(대조군, 안드로이드 시스템 네비 겹침 지점) / [플로팅 네비] sub-app(홈/노트 인터랙티브 전환 + 가운데 녹음 + ← 나가기, 시스템 네비 위에 떠 겹침 없음). 다크 몰입 스킨. 전부 mock — 채택 시 production은 field-note 라우트에 플로팅 네비 적용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-home-toss',
    title: '[필드노트] 홈 · 토스 결',
    description:
      '토스 온보딩/미션 화면 레퍼런스의 "결"을 필드노트 홈에 입히는 비교 — 부드러운 파스텔 그라데이션 / 큰 헤드라인+핵심어 컬러 / 둥둥 글로시 오브(3D 일러스트 자리 placeholder)+말풍선 / 초록 체크 라인 / 라운드 CTA / 친근 ~해요 톤. 갈림길은 필드노트 다크 정체성 vs 토스의 밝고 가벼운 톤 — 둘 다 만들어 탭으로 비교. 탭 — [허브(현재)] 기본 다크 대조군(헤드라인·일러스트 없이 배너+리스트) / [다크 토스] 다크 보라 유지 + 토스 구조·온기만 차용(보라 딥 그라데이션, 핵심어 보라 헤드라인, 녹음·상세와 톤 연결) / [라이트 토스] 라벤더→피치→화이트 파스텔로 홈만 밝게(흰 라운드 카드, 토스 원본 근접, 다크는 녹음·상세에만). 공통 콘텐츠=오늘 회기(스케줄 연동·바로 녹음)+바로 녹음 CTA. ⚠️ 3D 클레이 일러스트는 코드 불가(에셋 작업)라 오브 placeholder로 대체, 파스텔 hex는 DS 외 임시값. 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'field-note-home',
    title: '[필드노트] 홈, 필요한가? (진단)',
    description:
      '"필드노트 프로세스의 어색함이 홈/가이드 페이지 부재에서 오는가?"를 진단형으로 비교. 핵심 분리 — 어색함은 (1) 흐름 안의 어색함(멈춤=갇힘·뒤로가기 불명 → 내비 모델 문제, [필드노트 흐름 3안]이 다룸, 홈으로 안 고쳐짐) (2) 장소(orientation) 어색함(필드노트는 FAB 액션일 뿐 도착하는 곳이 없는 뿌리 없음)으로 나뉘고, 이 랩은 (2)만 다룬다. 결론 방향 — 답은 가이드(설명)가 아니라 허브(살아있는 홈), 가이드의 진짜 역할(첫 안내)은 허브의 빈 상태가 흡수. 탭 — [현재(홈X)] FAB 미니메뉴+평평한 목록 대조군 / [가이드] 필드노트란?+3단계 설명 밴드에이드(왜 2회차부터 죽은 화면인지) / [허브] 진행중 전사 배너+오늘 회기(스케줄 연동·바로 녹음)+최근 노트, 다크 몰입 스킨으로 장소 승격(권장) / [첫 사용] 같은 허브의 빈 상태가 온보딩 겸함. 각 탭 하단 진단 판정 카드(정체성/장소 어색함 해소/한 줄). 전부 mock.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'session-detail-spacing',
    title: '[회기 상세] 요소별 간격(리듬) 비교',
    description:
      '확정된 "세련됨" 방향(위계=타이포 크기·굵기 / 배경색은 회기 진행·결과 영역 한 곳에만 / 그룹 구분은 여백·리듬+좌측 정렬 축)을 고정한 채 **간격만** 바꿔 비교. 상태는 completed·1:1 회기로 고정, 5개 그룹(정보·메모·진행결과·필드노트·일지)을 평면+단일 강조 면(gray-50)으로 재구성하고 그 위에서 간격 리듬만 변주. 탭 — [현재] production 혼합 간격(대조군·gray 박스 적층) / [표준] DS 토큰(그룹24·섹션16·내부6) / [컴팩트](16·12·4 밀도 우선) / [여유](32·16·8 숨 트임) / [대비] 그룹 간 크게·그룹 내 타이트(36·12·4 "여백으로 그룹핑" 극대화). 탭 아래 활성 리듬 수치 캡션으로 "요소별 간격"을 눈으로 보며 선택.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'session-decision-emphasis',
    title: '[회기 상세] 일정 진행 결정 강조',
    description:
      '예정 회기 상세에서 "일정이 진행되었나요?"(완료/노쇼/취소)가 위 정보·메모와 같은 무게로 묻히는 문제 해결. 색을 더 쓰지 않고(이미 지난 일지=primary50) 구조·타이포·카드 크기로만 강조. 탭 비교 — [현재] 얇은 hairline + 작은 라벨 질문 + 인라인 카드 / [진행 결정 강조] 전체폭 gray-50 밴드로 섹션 분리 + 질문을 title-01 semibold 헤딩으로 승격 + 완료/노쇼/취소를 세로형 큰 카드(아이콘 위·라벨 아래). 동일한 상단(지난 일지 진입점·내담자/프로그램/참여자·시간·장소·메모) 위에서 진행 결정부만 다르게.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'journal-history-sheet',
    title: '[회기 상세] 지난 일지 열람 진입점 + 히스토리 시트',
    description:
      '확정 동선 — 일정 카드 탭 → 회기 상세 상단 brief의 "지난 일지 N개 ›" 단일 진입점 → 히스토리 목록 시트(날짜 내림차순, 회기 카드: 날짜·직전/N회 전·1줄 요약) → 회기 카드 탭 → 읽기 전용 일지 시트(상담 목표·상담 내용·개인 메모, CounselingNoteSheet 재활용 스타일). 핵심: 열람≠작성 — 예정(scheduled) 회기라 이 회기 일지는 잠겨 있어도 지난 일지 열람은 상단에서 항상 가능. 케이스 한정(내정보 전체 일지 리스트와 성격 다름). hero는 가볍게, 전체 히스토리는 별도 라우트 없이 시트로 분리. mock 회기 4건(목표·내용·개인 메모 포함).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'week-day-slide',
    title: '[일정 주간] 날짜 슬라이드 전환',
    description:
      '주간 보기에서 날짜 선택 시 카드 영역이 좌우 슬라이드로 전환되는 carousel 인터랙션. 26 → 27 (다음 날): 기존 카드 좌측으로 아웃 + 새 카드 우측에서 인 / 27 → 26 (이전 날): 우측으로 아웃 + 좌측에서 인. 구현 — 단일 Animated.Value progress(0→1) + direction(±1)으로 두 View의 translateX 동기화, easing-out cubic 320ms. 애니메이션 중 outgoingDate를 absolute로 별도 렌더, 끝나면 unmount. WeekStrip 미니 + 선택일 헤더 + ScheduleList(mock 일~토 다양 데이터). 빈 날은 빈 상태 메시지로 대응. lab 단계라 production schedule.tsx에 적용 전.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-session-top-grouping',
    title: '[회기 상세] 상단 영역 그룹핑 비교',
    description:
      '회기 상세 상단(정보 hierarchy + 메모 + 회기 진행 selection)의 그룹핑 4시안 비교. A 현재(gap 16 균일, 대조군) / B 공간+라벨(gap 28로 정보↔메모 분리, 메모/진행 위에 미니 라벨, light-touch) / C 통합 카드(메모+진행을 하나의 gray-50 카드 안에 hairline divider로 묶음) / D 메모만 카드(메모는 gray-50 박스, 진행 selection은 떠 있음 — 성격별 분리). 예정 그룹 회기, 메모 없음 상태로 시연.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'schedule-detail-journal-flow',
    title: '[일정 상세] 회기 일지 작성 흐름',
    description:
      'production `schedule/[id].tsx` 디자인을 그대로 유지하고(헤더 [상담] 박지훈 외 N명, gray-50 정보 카드 InfoRow, 상담 상세 보기, 내담자 3-col ClientCard 그리드 + 우상단 floating 출결 chip, 필드노트·메모 Section, 하단 액션바, Section 라벨 title-01 semibold), **추가**만 시연: (1) 내담자 그리드 하단에 primary CTA `일지 N건 작성` (미작성 있을 때만) (2) 일지 시트의 N/M progress bar + `저장하고 다음` 자동 진행 (3) 출결 노쇼·미확인/이미 작성 카드는 dim · 큐에서 자동 제외 (4) 마지막 저장 시 토스트 + 시트 닫힘. 진입점 두 가지(CTA / 카드 탭) 모두 동일한 자동 진행 흐름. mock 그룹 회기 4명(참석 미작성 2 / 참석 작성완료 1 / 노쇼 1).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-detail-current-backup',
    title: '[백업] integrated 적용 직전 상담 상세',
    description:
      'integrated 디자인을 main에 반영하기 직전 production `counseling/[id].tsx` 의 snapshot. gray top / white bottom 2-zone + 44 ClientCard grid + dateTime SessionCard 의 기존 디자인. 실데이터 확인을 원할 경우 `?id=<case_id>` 검색 파라미터로 진입. integrated 디자인 결과와 비교·롤백 참고용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-detail-integrated',
    title: '[상담 상세] 일지 통합 흐름 (작성·확인·수정)',
    description:
      '회기 상세 BottomSheet 3영역으로 명확히 분리 — (1)회기 정보 일정/프로그램/담당자 (2)내담자 출결 세로 grid 카드(우상단 floating chip, 일정 상세 ClientCard 패턴) (3)일지 = 회기 공통(목표·진행·다음 회기 계획) + 내담자별 기록 통합. Footer 위계 분리 — 회기 진행 결정 우선, 일지 작성은 그 다음. scheduled→[중단][완료], completed→"회기 중단으로 변경"(보조)+[일지 작성하기](primary), cancelled→[완료로 변경]. 일지 작성은 wizard 통합 흐름 — STEP 1 회기 공통 → STEP 2~N 각 내담자 일지. 확인은 일지 시트에서 (4)+(5) 같이 표시, 수정은 (4)→session-edit·(5)→note-edit 풀스크린 push. 출결 chip 탭 시 picker sub-sheet(미확인/참석/불참/노쇼). 작성 완료 시 base 회기 stack chip 즉시 갱신 + 토스트. mock 그룹 케이스 2명(홍길동·이영희), 회기 4건.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-note-opinion-tone',
    title: '[상담일지] 검사 소견 톤 정렬',
    description:
      '상담일지 바텀시트(CounselingNoteSheet)의 전반적 디자인을 검사 소견 시트(AssessmentOpinionSheet)와 한 가족처럼 통일(사용자 요청 + 디자이너 시안 2장). 데이터 4필드(상담 목표·진행 내용·다음 상담 내용·개인 메모, 스펙 §3-5 ✅)는 보존하고 시각 톤만 맞춤. 탭 — [현재] production 시트 본문 재현(chevron-back│날짜│X + 별도 타이틀행 / 흰 배경 보더 입력 / 보라 틴트 풀폭 초안 / 단일 등록 / cyan 액센트, 대조군) / [검사소견톤] 가운데 타이틀 + 좌우 ‹ › 내담자 이동 + 검사 소견 Chip 톤(active 블루 아웃라인·작성완료 다크+체크·미작성 회색) + double-diamond 그라데이션 풀폭 초안 + gray-50 입력 4필드 + 닫기·저장 2버튼(닫을 때 자동저장) + #4486FF 액센트, 초안 작성하기 탭 시 "일지 초안을 작성하고 있어요" 생성중 상태(이미지 2). 차이: 검사 소견은 단일 textarea지만 상담일지는 4필드 유지(구조 보존·톤만 정렬). 결정 포인트 — view/edit/create 모드를 검사 소견처럼 항상-편집+자동저장으로 단순화할지(현재는 조회/수정 분리). 전부 mock — 사인오프 시 CounselingNoteSheet 에 포팅. 짝: counseling-note-review(회기/일지 분리·별도 수정 페이지 축).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-note-review',
    title: '[상담일지] 조회·수정 시트 (wizard 짝)',
    description:
      'wizard 작성 짝이 되는 조회·수정 흐름. 수정은 인라인이 아닌 **별도 페이지 전환** 방식 — 시트의 "수정" 탭 → 헤더(← 뒤로 + 타이틀 + 저장 footer) 전용 페이지. 시트 책임 분리 — 회기 시트(회기 단위, 회기 목표·진행 + 내담자 stack) / 일지 시트(내담자 단위). 일지 본문은 **상담 목표 · 상담 내용 · 개인 메모** 3영역으로 기존 `CounselingNoteSheet` 디자인 그대로 적용 (좌측 accent goalCard + 읽기 친화 contentText + 스티키 노트 memoCard). 회기 정보 저장 시 sync 자동 + 토스트 "모든 일지에 반영됐어요". 회기 정보 미작성 상태에서 일지 시트 진입 OK — read-only 영역에 "회기 시트로 →" 안내.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-note-wizard',
    title: '[상담일지] 단계별 작성 wizard',
    description:
      '그룹 상담의 본질("동일 상황 · 개별 반응")을 작성 흐름으로 분리. 진입 → STEP 1 회기 정보(목표·진행 내용 1번) → STEP 2 홍길동 반응 → STEP 3 이영희 반응 → 완료. 한 번에 한 단계만 집중, 단계 사이 이전/저장하고 다음 navigation. 각 단계 중단 가능 — 임시저장 후 진입 화면 "이어서 작성" 표시 (작성된 단계는 green check 표시). 내담자 단계에선 STEP 1 회기 정보가 read-only 카드로 자동 노출(다시 입력 X). 완료 시 케이크 success 화면. 인터랙티브 — Play 누르면서 단계 흐름 확인. mock 그룹 회기 2명 + 회기 메타(5/15 (수) · 2상담실 · 집단상담-그룹). 데이터 모델 가정: 회기 entity에 goal/process 필드, 일지 entity는 본인 반응 + 개인 메모만 (현재 일지의 상담 목표·상담 내용 필드는 회기로 이전).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-list-horizontal',
    title: '[상담 리스트] 가로 카드 변주',
    description:
      '현재 production 2-col grid 대비 풀폭 가로 카드 3시안 비교 — SkyLife 통신 요금 카드 참고 영감 반영. 카드 정보 구성은 production 동일(이름·성별/나이·프로그램·progress N/M·상태·다음 예정일·연장필요). 4탭 비교 — A 현재(2-col grid 대조군) / B 좌 아바타 + 하단 강조 박스(SkyLife 정통 매핑, 다음 일정 또는 연장필요 알림을 하단 highlight box로 강조) / C 좌측 D-day 박스(시간 우선, 좌측 정사각형 영역에 D-N 큰 글씨 + 짧은 날짜) / D 풀폭 + 하단 strip(좌측 영역 없음, 메인 정보 stack + 하단 회색 strip에 progress·N/M·다음 일정 통합). mock 6건(grid lab과 동일 데이터셋).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-note-structure',
    title: '[상담일지] 회기 공통/내담자 개별 구조 비교',
    description:
      '상담사 피드백 — 일지는 내담자 단위로만 작성하는 게 아니라, 회기 전체를 아우르는 공통 내용 + 내담자별 개별 반응으로 자연 분리됨. 현재 시스템은 일지를 내담자 단위로만 다뤄 공통 부분이 N번 중복 작성됨. 이를 시스템적으로 해결할 작성 UX + 표시 UX 3안 비교. 옵션 1 회기→내담자 순차(회기 시트에 공통 1번 + 내담자 일지 시트에 개별, 단계 분리 명확) / 옵션 2 시트 내 두 영역(한 일지 시트에 공통·개별 두 칸 + sync, 자유도 보존) / 옵션 3 단일 입력 + 토글(기존 한 칸 + "모두에게 적용" 토글로 복제, 부담 최소 but 표시 측 활용 한계). 각 옵션마다 작성 시트 sketch + 상담 상세 흐름 영역에서의 회기 카드 표현 차이까지 같이 시각화. mock 그룹 회기(2명) 사용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-detail-flow',
    title: '[상담 상세] 흐름 중심 재구성',
    description:
      '상담 상세를 "케이스의 시간적 흐름 뷰어"로 재정의. 일정에서 처리 가능한 정보(다음 회기 카드 등)는 제거하고, 단일 일정에서 못 보는 누적 패턴 / 이전 기록을 핵심으로. 구조 — Gray zone: 케이스 정체성(program + 상태 + progress bar), 일지 미작성 alert / White zone: 내담자 그리드(mini 출석 dot 5개 — 사람별 패턴, 그룹 케이스 자연 대응) + 일지 흐름. 일지는 회기당 내담자별 작성이라 "흐름"을 어떻게 잡을지 3 variant 비교 — A 내담자 필터(사람 chip 선택 → 그 사람만 시간순, focused 내러티브) / B 회기 stack(회기 카드 시간축 + 내담자별 일지 상태 chip 가로 stack, 요약 비교) / C 회기 펼침(회기 안에 사람별 일지 summary 본문 펼침, 풍부함). mock 그룹 케이스 2명, 회기 5건 × 내담자별 일지(완료·부분·미작성 혼재).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'schedule-journal-flow',
    title: '[일정 상세] 회기 일지 흐름 접근',
    description:
      '상담사 피드백 반영 — 회기 직전 일정 메뉴에서 점검 시, 직전 일지만이 아니라 이전 회기 흐름까지 같이 보고 싶을 수 있음. 현재 spec(§3-1)은 hero에 "직전 1줄 + 다음 일자만, 도메인 경계 보존"인데, 실 사용 흐름과 충돌. 4시안 비교 — A 현재(spec 그대로) / B 하단 timeline 접힌 섹션(추천: 회기 mini 카드 stack + 전체 일지 보기 CTA) / C hero 펼침(hero 안 토글로 1줄 stack) / D CTA 직행(hero 그대로 + primary50 강조 CTA로 상담 상세 일지 timeline 섹션 직행). mock — 직전 1회 + 이전 3회기 1줄 요약. 도메인 경계와 마찰 해소의 트레이드오프 비교.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'chip-complete-fade',
    title: '액션 완료 시 chip fade-out',
    description:
      '홈 chip stack 의 액션이 의사결정으로 완료되면 chip 이 메인에서 사라지는 인터랙션. 패턴 — RN LayoutAnimation(300ms easeInEaseOut, delete:opacity + update:easeInEaseOut)으로 chip unmount 시 opacity fade-out + 남은 chips 위로 자연스럽게 흘러옴. 시연 — 이수연 종결 chip 탭 → ConfirmModal "종결" 확인 → chip 사라짐 + 박지훈·미작성 일지 chip 정돈. Reset 버튼으로 시연 반복. 정책 — 종결/연장 결정은 confirm 시점에 해소, 미작성 일지는 전체 N건 완료 시 해소, 박지훈은 시간 기반(만남 후) 별도 정책. 빈 상태 메시지 "오늘 챙길 일이 모두 정리됐어요."',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'client-preview-modal',
    title: '내담자 요약 모달 (홈 chip 진입)',
    description:
      '홈의 "상담 전 박지훈님 알아보기" chip 탭 시 보여줄 내담자 정보 요약 모달. 중앙 floating 모달(dim + radius 20 white card), 정보 = §3-3 내담자 상세 스펙(이름·성별·나이·생년월일·연락처·출석 패턴 5dot) + AI 요약(❓ 추가 예정 — sparkles 아이콘 + gray-50 카드 + 친근 ~예요 톤). 그룹 회기일 때 좌/우 chevron 으로 다른 내담자 전환(헤더 가운데에 "N/총 N" 인디케이터), 1:1 이면 화살표 숨김. 하단 자세히 보기 Primary 버튼 → 내담자 상세 페이지 push (lab 은 mock 동작). dim 탭 또는 자세히 보기 탭 시 close. production `BriefStackHome` 의 박지훈 chip 에 동일 모달 적용 완료.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'home-unwritten-transition',
    title: '홈 → 미작성 일지 전환 인터랙션',
    description:
      '홈의 "미작성 일지 N건 작성하기" chip 탭 시 단순 router push 가 아닌 시각적 연결감 부여. 4시안 비교 — A Hero Expand(chip 이 가운데로 이동 + scale 확대 → 풀스크린 카드로 morph, chip 라벨 fade-out · 페이지 콘텐츠 fade-in, layout 애니메이션 useNativeDriver:false) / B Pull-Up Sheet(chip 그대로, sheet 가 하단에서 슬라이드 업, drag handle + 상단 radius + dim layer, translateY useNativeDriver:true) / C Cascade(chip fade-out → 페이지 fade-in → 회기 카드 3개 stagger 120ms 간격 translateY(-40 → 0) + opacity, spring easing 살짝 바운스) / D Hybrid(A 의 expand + C 의 cascade 결합 sequence — expand 550ms → 헤더 fade-in 200ms → 카드 cascade, 컨테이너 배경 white → gray-50 보간으로 expand 끝에서 페이지 톤 §4.2). Play/Reset 버튼으로 시연. lab 단계 — RN Animated API 사용.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'unwritten-journals',
    title: '미작성 일지 페이지',
    description:
      '홈의 "미작성 일지 N건 작성하기" 액션에서 진입하는 미작성 일지 리스트 페이지. 회기 ⊃ 일지(1:N) 관계를 따라 카드 단위 = 회기, 카드 안 row = 미작성 일지(내담자별). 같은 회기 정보(시간·장소·프로그램)는 한 카드 안에 1번만. 시급도 순(오래된 회기 위) + 날짜 헤더 그룹("5월 15일 (목) · 7일 전"). 미작성 일지만 노출(작성된 row 는 숨김 — 페이지 정체성). row 탭 → §3-5 상담일지 바텀시트. 1:1/그룹 회기 둘 다 동일 카드 패턴. 페이지 gray-50 + white 카드 + soft shadow.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'group-attendance-signal',
    title: '[일정 카드] 그룹 출결 신호',
    description:
      '그룹 일정의 부분 노쇼/불참을 카드에서 즉시 인지 — 청구 작업 시 카드 스캔만으로 발생 일정 발견 목표. 컨텍스트: 일정 상태(예정/완료/취소/노쇼)와 내담자 출결(참석/불참/노쇼)이 독립 레이어. 그룹은 1명만 노쇼해도 일정 자체는 "완료"로 유지되어 카드만 봐서는 알 수 없음. 표시 규칙(양 시안 공통) — 개인 일정 표시 X(자동 derive), 그룹 전원 참석 X, 그룹 일부 노쇼/불참만 C안에서 노출, 그룹 전원 노쇼는 일정 자체 노쇼라 중복 X. 시안 — A 현재(신호 없음, 대조군) / C 좌측 1px red stripe + 우측 상단 배지 옆 작은 빨강 라벨("불참 1 · 노쇼 1" 형식, 발생한 것만). mock 5건(개인 완료 / 그룹 전원 참석 / 그룹 1명 노쇼 / 그룹 1불참+1노쇼 / 그룹 전원 노쇼) 시연.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-list-grid',
    title: '[상담 리스트] 2-column grid',
    description:
      '상담 현황 리스트 변주 시안 — 현재 production 의 긴 가로 카드가 내담자 상세와 시각 유사해지는 우려 해소. 2-col compact grid 로 한 화면에 더 많은 케이스, 카드 간 시각 차별 명확. 카드 구성: 우상단 [상태] chip + 연장필요 보조 라벨 / 이름·외 N명 + 성별·나이 / 진행 progress bar + N/M회 / 다음 상담일 + D-N(임박 시 orange). 헤더·검색·필터 chrome 은 production 동일.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'calendar-density-bg',
    title: '[캘린더] 칸 밀도 배경',
    description:
      '월간 캘린더에서 일정 많은 날을 한눈에 — 날짜 칸 배경 명도가 일정 수에 따라 옅게→진하게. 카테고리 dot(상담 green / 검사 blue, 종류만)과 정보 차원 분리: dot=종류, 배경=밀도. 2시안 비교 — A 현재(배경 없음, dot만) / B 밀도 배경(1~2건 white · 3~4건 gray-50 · 5+건 gray-100). 칸 작아도 텍스트 부담 없이 한 달 흐름 시각화. mock 데이터로 한 달 다양한 분포(빈 날·1건·3건·5+건) 시연.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-detail-zones',
    title: '[상담 상세] 두 영역 분리 (gray top / white bottom)',
    description:
      '상담 상세 변주 시안 — "챌린지" 류 페이지 패턴 차용. 상단 gray-50 영역에 white 카드(일지 alert · 다음 회기 · 상담 정보)를 띄우고, 하단은 white 영역으로 명확히 분리해 리스트 콘텐츠를 담음. 두 영역 사이는 background 컬러 전환으로만 구분 (divider X). 하단 white 영역의 내담자·회기 카드는 gray-50 sunken으로 색 인버전 — 시각 리듬 형성. 일지 미작성 신호·회기 카드 좌측 status 라인·인라인 CTA 등 기존 디자인 결정은 유지.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'counseling-detail-hero',
    title: '[상담 상세] 후보 시안 · 요약 카드 통합',
    description:
      '상담 상세 첫 시야 재설계 후보 — 단일 페이지(탭 비교 없음), 시안 확정 후 production main 에 반영. 구성: 요약 카드 통합(케이스 메타 + 상태 뱃지 + 시작/완료일 + 회기 진행 progress bar) + compact 가로 행 ClientCard list (참석률 행 제거, 36 아바타, 출석 주의 inline dot). §3-2 "최근 회기 hero(키워드 chips)" 컨셉은 §3-1 일정 상세 hero 로 이동돼 본 lab 후보에는 미포함.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'schedule-spec-v2',
    title: '[일정]',
    description:
      'INFORMATION_SPEC §3-1/§3-2 v2 반영판. 일정 상태 3가지(예정/완료/취소 — 노쇼 제거), 내담자 출결 3가지(참석/불참/노쇼)가 독립 레이어. 3 뷰 자유 전환 — 리스트형(주별) / 캘린더형(월별, production MonthCalendar 그대로 재사용) / 통계. 일정 카드는 진행중·취소 상태별 시각 차별화, 그룹 일정 "외 N명" 표기, 취소 카드 사유 노출. mock 데이터로 일정 상태 변화 시연.',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'home-brief-signals',
    title: '홈 시안 · Brief + 신호 + 액션',
    description:
      '각 도메인 메뉴가 이미 "그 도메인 안의 선별 정보"를 책임지는 구조에서, 홈만이 할 수 있는 가치 = 여러 도메인을 가로지르는 시점. 공통 — 가벼운 인사 + agentic 신호(§4)를 brief 와 처리 액션으로 노출. 탭 — A Voice(현재 production 다크 컨셉 미니어처) / B 최종 시안 1(컨텍스트 라벨 Hero + 보조 줄글 + 액션 chips·mic) / C 최종 시안 2(도메인 라벨 카드 + 액션 chips·mic) / D 최종 시안 3(여백의 미 — 인사 + 일정 카드 + 추천 검색어 stack, mic 없음) / E 최종 시안 4(시안 3의 UI design 적용본 — primary tint 하단 그라데이션·white floating 카드·Extended Palette 컬러 아이콘 포인트 Blue/Violet/Mint·가운데 정렬 stack). 예정된 일정 카드는 §3-1 정보 스펙 충실(컨텍스트 라벨 + 내담자 외 N명 + 시간 범위 + 장소·프로그램).',
    status: 'ready',
    category: 'final',
  },
  {
    slug: 'schedule-prev',
    title: '백업 · 기존 일정 (캘린더 + 리스트 + 통계)',
    description:
      'schedule-now-flow 적용 이전 production 일정 페이지의 스냅샷. 3-mode segment(캘린더 grid + 주간 리스트 + 월간 통계) 그대로, 실데이터(useScheduleRange) 연결. 좌상단 ← back 버튼 + 헤더 우측 "백업" pill 라벨로 lab 헤더 적응. 캘린더 그리드는 MonthCalendar + 선택일 ScheduleItem 리스트, 리스트는 WeekStrip + DayTimeline, 통계는 BigStatCard 3개 + 요일별 분포 막대 + 노쇼 내역. 새 디자인 대조군 / 롤백 참고용.',
    status: 'ready',
    category: 'legacy',
  },
  {
    slug: 'assessment-task-result',
    title: '검사 결과 시안 · 데이터 연동 + 결과지 업로드',
    description:
      '검사 상세(풀배터리)에서 개별 검사(K-WISC, BGT 등)로 진입했을 때 보여줄 결과 화면. 운영상 두 케이스 공존 — A 데이터 연동(자체 시스템에서 점수·해석 자동 연동, 종합 점수 hero + 지표별 점수 카드 + 영역별 막대 + AI 해석), B 결과지 업로드(외부 결과지 PDF/이미지 첨부, 첨부 파일 카드 + 보기/다운로드/삭제 칩 + 점선 드롭존). 공통 구조 — 헤더(검사명·일정·상태·담당자) + 결과 영역 + 검사 소견(AssessmentOpinionSheet 재활용 컨셉) + 액션(공유·종합 보고서). 페이지 white / 카드 gray-50 + shadow / palette 1~2색.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'schedule-now-flow',
    title: '일정 시안 · 지금 흐름 + 임박 강조',
    description:
      '일정 메인을 "사용자에게 중요한 일정 위주"로 디벨롭 — 두 축을 한 화면에 동시 해결: (1) 좌측 시간 spine + 실시간 NOW 가로 마커로 하루의 흐름 파악, (2) 임박도(시간 가까움) × 준비도(첫 회기·검사 결과 미확인·일지 미작성·노쇼 이력)를 합한 점수로 자동 강약 — 4점↑은 풀 HERO 카드 + N분 뒤 카운트다운 + 신호 칩 묶음 + brief + 액션 pill, 2~3점은 좌측 4px 컬러 라인이 있는 compact, 1점↓는 일반 compact. 진행 중 일정은 warning 색 dot + pill로 별도 표기. 지난 일정은 opacity 0.55 + line-through로 가라앉음. 상단엔 "지금 13:30" 히어로 + 마침·진행 중·남음 3분할 카운트. 시안 비교 — A 현재(평등한 카드 나열) / B 지금 흐름(메인).',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'home-voice-first',
    title: '홈 시안 · 음성 우선 (Voice-First)',
    description:
      '기획 변경 반영 — 각 메뉴의 첫 페이지가 도메인 메인이 되므로 홈에서 오늘 일정을 보여줄 필요가 사라짐. 홈은 진짜 AI 에이전트 메인 화면처럼 음성 입력이 주인공인 단순 화면. "오늘 일정 알려줘" 같은 음성 명령이 일정 탭으로 라우팅되거나 모달로 응답하는 컨셉. 3시안 비교 — A 호흡 오브(중앙 큰 primary 오브가 2.4s sin loop 호흡 + 외곽 halo·중간 ring·코어 그라데이션 3겹, 상단 인사 + 하단 prompt chip 2x2 4개) / B 하단 컴포저(상단 "AI 비서가 듣고 있어요" pill + 큰 hero 인사 + 가운데 waveform 일러스트 15bar 위상 애니메이션, 하단 큰 primary 그라데이션 마이크 컴포저 pill + 위 추천 명령 row 3개) / C 글래스 카드(primary600→400→300 풀배경 그라데이션 + 가운데 frosted glass 카드 floating, 카드 안에 흰 마이크 원 + 따옴표 예시 prompt 3건, 카드 뒤 펄스 링 3.2s 루프). 공통 — 모든 시안 하단에 "오늘 챙길 일 N건" 미니 collapse pill (탭하면 펼침, 일지/보호자 답장 같은 1-2건만 노출하여 TODO 시안들과 차별화).',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'home-day-ring',
    title: '홈 시안 C · 원형 하루 + 액션 그리드',
    description:
      '하루 자체를 큰 원형 segment 게이지로 표현 — 일정 N건이 가장자리 segment N개. 중앙 흰 원에 현재 일정(시간·내담자·프로그램·N회기) + "다음 일정" pill, 좌/우 화살표 + dot 캐러셀로 일정 전환(cross-fade + 슬라이드). "완료 처리" 누르면 현재 segment 가 bezier ease 로 부드럽게 채워지고 다음 일정으로 자동 진행. 중앙 원은 살짝 호흡(2.4s sin loop, scale 1.012)으로 심심하지 않게. 하단 액션 그리드 2열(학대 의심·미작성 노트·보호자 연락·평가 기한·3주 무응답·슈퍼비전, Extended Palette OpacityBG + Solid). 카드 탭 → measureInWindow → 카드 자리에서 → 바텀시트(top-rounded, 80pt 상단 여백) 모양으로 자라남, 도착 50% 부터 내부 콘텐츠 fade-in, mock 일지/액션 본문 + CTA. 시안 비교: A 라이트(그라데이션 + 얇은 stroke) / B 진한(흰 페이지 + 두꺼운 stroke).',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'schedule-concierge',
    title: '일정 시안 · 비서가 챙기는 일정',
    description:
      '홈이 "지금 뭐 해?" 비서라면 일정은 "다음 만남 누구를 어떻게 맞이할까?" 비서 — 상단에 AI 비서가 추린 준비 카드(첫 만남 / 미작성 일지 / 노쇼 리스크) + 친근한 톤(~해요/~예요), 하단에 시간순 오늘·내일. 카드 탭 → 검사·일지·내담자 화면 이동. 우상단 토글로 캘린더 시야 전환. 신호 색은 Extended Palette mint·yellow·coral 3색.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'home-previous',
    title: '이전 홈 시안 · 4변종 비교',
    description:
      '메인 홈이 SoftTasks 캐러셀로 전환되기 전 운영하던 4변종 비교 아카이브 — A 클립보드 인사(라이트) / B 다크 톤(bankcow) / C 여백 시작(primary 풀톤) / D 기존 BrandHome. 실데이터(centerId·schedules·unread·unlinked·weekStats) 그대로 연결되어 있고 상단 floating A/B/C/D pill 로 즉시 토글. 좌상단 ← floating 버튼으로 뒤로가기.',
    status: 'ready',
    category: 'legacy',
  },
  {
    slug: 'clients-agentic',
    title: '내담자 리스트 · Agentic',
    description:
      '단순 나열 대신 "강조가 필요한 내담자"를 위로 끌어올리는 시안. AI가 일지 미작성·보호자 답장 대기·회기 임박·첫 회기·종결 임박·장기 미접촉 신호로 우선순위를 매김. 탭 5시안 — A 현재(그리드 대조군) / B 나열(강조 카드 세로) / C 스택(겹친 카드 덱, 깊이감, 카드 탭=상세 / 하단 사유색 점 인디케이터로 순서 조정) / D 캐러셀(가운데 큰 카드 + 양옆 작게 peek, 좌우 스와이프 snap + 인디케이터) / E 섹션(지금 챙겨요·이번 주 관심·안정 진행 그룹). 사유칩은 Extended Palette OpacityBG + Solid.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'home-soft-tasks',
    title: '홈 시안 · 부드러운 톤 + 태스크',
    description:
      'mint→primary→cream 그라데이션 페이지 + 날짜·2줄 인사·카테고리 dot 통계 hero. 다음 상담 카드 위에 primary tooltip pill("N시간 N분 뒤에 상담이 시작돼요!")과 caret. 카드 하단 "지난 일지 검토" gray pill, 그 아래로 노란 노트 아이콘의 태스크 리스트 3장(일지 검토 / 일지 작성 / 필드노트 연결). 시안 비교: A 캐러셀(다음 카드 피크) / B 단일 카드 스택.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'schedule-agent-home',
    title: '일정 홈 · 에이전트 시안',
    description:
      '일정 진입 시 캘린더 대신 "유의미한 정보 위주의 홈"이 메인이 되는 플로우 제안. A 정보 카드(다음 일정 강조 + 오늘 진행 + 일지 알림 + 다가오는 리스트) / B 에이전트(AI 비서 톤 우선순위 task 카드). 캘린더는 헤더 아이콘 + 하단 CTA로 보조 진입.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'home-agentic',
    title: '홈 시안 · Agentic (AI 비서)',
    description:
      'AI 비서가 "오늘 챙길 일"을 우선순위 순으로 정리. 모든 task가 동일한 떠있는 pill 카드 컨테이너에 들어있고, 카드를 누르면 그 자리에서 부드럽게 확장되어 액션(회기 준비 / 일지 작성 / 검사 결과 검토 / 보호자 답장 / 사전 메모)을 수행. AI Orb · primary 그라데이션 배경 · 1위 카드 primary glow · 하단 AI 입력 pill로 에이전트 톤 완성.',
    status: 'ready',
    category: 'agentic',
  },
  {
    slug: 'fieldnote-gradient',
    title: '필드노트 CTA · 그라디언트 변주',
    description:
      'AI 기능 인상을 주는 메인 하단 필드노트 CTA 그라디언트 10시안 — A 현재 / B 시안 블룸(primary→바이올렛) / C 오로라(violet·cyan·mint) / D 코랄 웨이브(pink·violet·blue) / E 딥 오션(indigo·blue·cyan) / F 인디고 드리프트(절제된 Tailwind 500대) / G 플럼 선셋(핑크·바이올렛·인디고, SaaS 표준) / H 시안 스트림(cool 단조, 브랜드 친화) / I 라벤더 미스트(차분한 400대) / J 민트 쿨(민트·시안·인디고, healthcare 친화). 각 시안에 ✨ AI 뱃지 포함, 가로 스크롤 탭으로 전환.',
    status: 'ready',
  },
  {
    slug: 'home-dark-hierarchy',
    title: '홈 다크 · 정보 위계',
    description:
      '다크 상단 + 흰 하단의 "다음 만날 사람" 정보 중복을 푸는 4안 — A 오버뷰(N명·카테고리) / B 다음1건 풀강조 + 흰=타임라인만 / C 관계 카드 / D 일러스트(날짜 + 히어로 + sun+cloud, 흰=production 그대로). 추천 B.',
    status: 'ready',
  },
  {
    slug: 'dark-upcoming-panel',
    title: '다크 홈 · 내담자 패널 배치',
    description:
      '다크 톤 홈의 "오늘 만날 내담자" 영역 배치 2시안 — A 단일 컨테이너 정리(현재 production) / B 세로 카드 + 가로 스와이프 캐러셀(첫 카드 폭·primary 보더·CTA pill로 강조)',
    status: 'ready',
  },
  {
    slug: 'home-dark-merge',
    title: '홈 다크 · 다음 상담 통합',
    description:
      '다크 시안의 "상단 내담자 패널 + 하단 다음 상담 카드" 정보 중복을 풀어보는 3시안. A 현재(분리) / B 통합(다크=다음 상담 강조, 흰=오늘 일정 타임라인 + 각 행 이전 일지) / C 일지 hub(다크=오늘 만날 모든 내담자 일지 리스트, 흰=다음 상담 + 오늘 일정).',
    status: 'ready',
  },
  {
    slug: 'home-airy-start',
    title: '홈 시안 · 여백 시작',
    description:
      '콘텐츠로 빽빽한 기존 홈과 달리 "시작 페이지" 톤으로 여백 확보 — 큰 hero(다음 상담까지 N분) + 다음 일정 1건 + 필드노트 FAB만. A 화이트 / B primary 50→white 옅은 그라디언트 2시안.',
    status: 'ready',
  },
  {
    slug: 'schedule-monthly-stats',
    title: '일정 · 월간 통계 배치',
    description:
      '그 달의 상담·검사·노쇼 카운트를 어디에 끼울지 5시안 비교 — 현재(A) / 한 줄 칩(B) / 헤더 미니(C) / 스탯 모드(D) / 플로팅 칩(E). 화면이 빽빽한 상태이므로 추가 공간 최소화 또는 모드 분기 방향.',
    status: 'ready',
  },
  {
    slug: 'case-detail-history',
    title: '케이스 상세 · 일정과 역할 분리',
    description:
      '일정 상세 = 액션 허브 / 케이스 상세 = 이력·누적 으로 구분 — 현재(A) / 요약 카드 추가(B) / 회기 dot 타임라인 + 참석·일지율 통계(C) 3시안 비교',
    status: 'ready',
  },
  {
    slug: 'counseling-clients-emphasis',
    title: '상담 상세 · 내담자 리스트 강조',
    description: '가로형 4시안 + 세로형 2시안 — 가로(A 현재 / B 이니셜+링 / C 액센트바 / D 2단카드), 세로(E 2열 그리드 / F 회기 dot 시각화). 진행률은 Extended Palette gray→orange→greenYellow→green 매핑.',
    status: 'ready',
  },
  {
    slug: 'home-clipboard-greeting',
    title: '홈 시안 · 클립보드 인사',
    description: '참고 이미지 기반 두 시안 — A 연한 primary tint + 보라 그라디언트 CTA / B primary 풀 배경 + 다크 블루 CTA. 클립보드 일러스트 + 컴팩트 일정 불릿 + "녹음 시작" 알약',
    status: 'ready',
  },
  {
    slug: 'home-agent-style',
    title: '홈 시안 · 에이전트 톤',
    description: 'AI 에이전트 느낌으로 화면 전체 활용 — 코치 카드(A) / 포커스 카운트다운(B) / 따뜻한 카드(C) 3시안. 일정 리스트 대신 다음 상담 1건과 필드노트 CTA에 집중',
    status: 'ready',
  },
  {
    slug: 'home-stats-placement',
    title: '홈 통계 배치 비교',
    description: 'A(탭 분기) / B(하단 요약 카드) / C(히어로 하단 요약) 3시안 비교 — 페이 가늠용 통계의 위계·배치 결정',
    status: 'ready',
  },
  {
    slug: 'schedule-card-emphasis',
    title: '일정 카드 강조 비교',
    description: '"준비할 다음 한 건"을 도드라지게 — 다음 한 건 강조(A) / 긴급도 순 재정렬(B) / 과거 가라앉히기(C) 3시안 비교',
    status: 'ready',
  },
  {
    slug: 'session-note-emphasis',
    title: '회기 상세 · 일지 강조',
    description: '핵심 액션인 내담자 일지 작성을 더 눈에 띄게 — 현재/상태 차별(A)/액션 분리(B) 3시안 비교',
    status: 'ready',
  },
  {
    slug: 'home-hero-bg',
    title: '홈 히어로 배경 변주',
    description: '카드 안 탭으로 Primary 500(현재) ↔ Primary 50(신규) 두 시안을 즉시 비교. 신규 시안의 lab 작성 기준 패턴.',
    status: 'ready',
  },
  {
    slug: 'client-detail-density',
    title: '내담자 상세 · 비주얼 변주',
    description: '텍스트 크기·간격은 원본 유지, 좌측 라인 제거 + 시각/레이아웃 변주 3시안 (컬러 헤더 / 좌측 사이드 / 워터마크 명함)',
    status: 'ready',
  },
  {
    slug: 'home-color-hero',
    title: '홈 시안 1 · 컬러 헤더',
    description: '상단 영역을 primary 그라데이션으로 도장 — 큰 카운트다운 + 시계 일러스트',
    status: 'ready',
  },
  {
    slug: 'home-bold-emphasis',
    title: '홈 시안 2 · 큰 숫자 강조',
    description: '흰 배경 유지, 카운트다운/통계 숫자를 시각 무게 중심으로 키워 강약',
    status: 'ready',
  },
  {
    slug: 'home-illustrated',
    title: '홈 시안 3 · 일러스트 임팩트',
    description: '캐릭터 일러스트 + fieldnote 풀컬러 CTA 카드로 강조',
    status: 'ready',
  },
  {
    slug: 'home-dark-checklist',
    title: '홈 시안 4 · 상태 카드 + 통계',
    description: '브랜드 블루 히어로 + 오늘 일정(주/월 전환) · 통계(이번주/이번달/직접선택) 탭',
    status: 'ready',
  },
  {
    slug: 'schedule-monthly',
    title: '일정 시안 · 월 캘린더',
    description: '월별 캘린더 + 날짜 dot으로 일정 분포 표시, 탭한 날짜의 상세는 하단 펼침',
    status: 'ready',
  },
  {
    slug: 'sample',
    title: '샘플 실험',
    description: '레이아웃/카드 컴포넌트 테스트용 빈 캔버스',
    status: 'ready',
  },
  {
    slug: 'client-grid',
    title: '내담자 그리드',
    description: '성별 컬러 아바타 + 그리드 레이아웃, 초기 상담일지 강조 상세',
    status: 'ready',
  },
  {
    slug: 'schedule-status-labels',
    title: '일정 상태 라벨',
    description: '오늘 일정 카드 상태 표현 — 3가지 라벨 방식 비교',
    status: 'ready',
  },
  {
    slug: 'today-schedule-card',
    title: '오늘 일정 카드 상태',
    description: '예정/곧 시작/진행 중/완료/취소/노쇼 6가지 상태 카드 미리보기',
    status: 'ready',
  },
];

/** 라우트 경로를 안전하게 만들어주는 헬퍼 (`/(main)/lab/<slug>`). */
export function getLabRoute(slug: string): string {
  return `/(main)/lab/${slug}`;
}
