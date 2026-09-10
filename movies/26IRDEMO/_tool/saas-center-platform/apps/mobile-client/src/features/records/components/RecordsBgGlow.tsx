/**
 * 기록 배경 글로우 — 시안 271:6566(기록 탭) · 287:2879(기록 상세). 같은 타원이다.
 *
 * bg/base 위에 얹히는 582×608 타원(피그마 Position -97/-220). Fill은
 * linear-gradient(#EBFBE3→#DDF0F8), Effect는 Layer blur — 경계가 없는 소프트
 * 워시로 화면 상단을 덮고 아래로 사라진다.
 *
 * ⚠️ 블러를 SVG 필터로 못 넣는다. 두 군데서 막힌다:
 *   1. .svg 에셋 → react-native-svg-transformer가 쓰는 svgr가 `<filter>`를
 *      지원 목록에서 빼고 통째로 버린다.
 *   2. `<Filter>`/`<FeGaussianBlur>` 엘리먼트 직접 사용 → 타입·네이티브 클래스는
 *      있는데 실기기에서 블러가 적용되지 않는다(경계가 그대로 보이는 타원이 됨).
 *      newArchEnabled=true, react-native-svg 15.12.1에서 확인.
 *
 * 그래서 블러를 필터가 아니라 **알파 폴오프**로 만든다. 가우시안 블러가 걸린 단색
 * 도형의 알파 프로파일은 경계 기준 erf 곡선이라(σ=50.4 → 정규화 반지름 0.129),
 * 아래 stop들은 그 곡선을 샘플링한 값이다:
 *
 *   u(=r/391.8)  0    0.45  0.62  0.743(원래 경계)  0.86  1.0
 *   alpha        1.0  0.99  0.83  0.50              0.18  0.0
 *
 * 색은 원본이 대각(좌상 초록 → 우하 파랑)이지만 알파는 방사형이라 한 그라디언트로는
 * 못 겹친다(마스크 없이는). 타원 중심이 화면 상단 중앙(194, 84)이라 방사 방향이 곧
 * 아래쪽이므로, 색을 반지름축에 실으면 위=초록 / 아래=파랑으로 원본과 같게 읽힌다.
 */
import React from 'react';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { s } from '@/shared/utils/scale';

/**
 * 폴오프 여백까지 포함한 렌더 박스 — 시안 프레임 좌표 기준.
 * 타원 본체 582×608(-97, -220)에 사방 100.8을 더한 값(피그마 blur export 범위와 동일).
 */
const BOX = { width: 783.6, height: 809.6, left: -197.8, top: -320.8 };
const CX = BOX.width / 2;
const CY = BOX.height / 2;

export function RecordsBgGlow() {
  return (
    <Svg
      width={s(BOX.width)}
      height={s(BOX.height)}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      style={{ position: 'absolute', left: s(BOX.left), top: s(BOX.top) }}
    >
      <Defs>
        <RadialGradient
          id="recordsGlow"
          cx={CX}
          cy={CY}
          rx={CX}
          ry={CY}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#EBFBE3" stopOpacity={1} />
          <Stop offset={0.45} stopColor="#E5F6EC" stopOpacity={0.99} />
          <Stop offset={0.62} stopColor="#E2F4F0" stopOpacity={0.83} />
          <Stop offset={0.743} stopColor="#E1F3F3" stopOpacity={0.5} />
          <Stop offset={0.86} stopColor="#DFF2F5" stopOpacity={0.18} />
          <Stop offset={1} stopColor="#DDF0F8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={CX} cy={CY} rx={CX} ry={CY} fill="url(#recordsGlow)" />
    </Svg>
  );
}
