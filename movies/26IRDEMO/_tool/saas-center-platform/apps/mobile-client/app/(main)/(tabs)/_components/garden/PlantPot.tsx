/**
 * 화분 + 식물 — 성장 정원의 케이스 1개 (코드 드로잉, 1차 출시용).
 *
 * 시각 언어: 화이트 세라믹 화분 + 그린 식물 + 바닥 그림자 — 3톤 절제.
 * 에셋 규격 계약: viewBox 70×88, 식물 뿌리 = 화분 윗전 중앙. 2차 일러스트
 * PNG(plant-s0..s6 · pot-s/m/l) 교체 시에도 이 인터페이스는 유지된다.
 * SVG 필터·블러 금지 — react-native-svg가 렌더링하지 못한다(홈 글로우에서 실측).
 *
 * 색은 콘텐츠성 일러스트 고정값(토큰 아님).
 */
import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { PlantStage, PotSize } from '@/features/progress/garden';

/** 잎 그린 듀오톤 — 채도 낮춘 정원 그린 */
const LEAF_A = '#3FBF77';
const LEAF_B = '#2FA45E';
const STEM = '#2E9C59';
const POT_FILL = '#FFFFFF';
const POT_LINE = '#E2EAE3';
const SHADOW = 'rgba(24,70,46,0.08)';

/** 잎 슬롯 — 화분 윗전 y=66(md) 기준, 아래→위 좌우 교차. scale로 위쪽일수록 작게 */
const LEAF_SLOTS = [
  { x: 33, y: 58, rot: -136, sc: 1.0 },
  { x: 37, y: 54, rot: -44, sc: 1.0 },
  { x: 33, y: 48, rot: -138, sc: 0.95 },
  { x: 37, y: 43, rot: -42, sc: 0.95 },
  { x: 33, y: 37, rot: -140, sc: 0.85 },
  { x: 37, y: 32, rot: -40, sc: 0.85 },
  { x: 33, y: 27, rot: -142, sc: 0.72 },
  { x: 37, y: 23, rot: -38, sc: 0.72 },
  { x: 35, y: 17, rot: -90, sc: 0.66 },
] as const;

/** 잎 — 양끝이 뾰족한 티어드롭 (원점에서 오른쪽으로 뻗는 형태) */
const LEAF_PATH = 'M0 0 Q 8 -6.5 16.5 -1.5 Q 9 4.5 0 0 Z';

const POT: Record<PotSize, { top: number; body: string; rimW: number }> = {
  // 라운드 탑 세라믹 — 아래로 살짝 좁아지는 실루엣
  sm: { top: 68, body: 'M23 68 L47 68 L45 78.5 Q44.6 81 42 81 L28 81 Q25.4 81 25 78.5 Z', rimW: 27 },
  md: { top: 66, body: 'M20 66 L50 66 L47.6 79.5 Q47.2 82.5 44.4 82.5 L25.6 82.5 Q22.8 82.5 22.4 79.5 Z', rimW: 33 },
  lg: { top: 64, body: 'M17 64 L53 64 L50.4 80.5 Q50 84 46.8 84 L23.2 84 Q20 84 19.6 80.5 Z', rimW: 39 },
};

interface PlantPotProps {
  stage: PlantStage;
  size: PotSize;
  /** 완료 회기 수 — 모종기(잎 1:1) 잎 개수의 원천 */
  completed: number;
  /** 성목기 수확 개수 (완료 12회마다 1개) */
  harvest?: number;
  /** 렌더 폭(px) — 높이는 88/70 비율 자동 */
  width: number;
}

export function PlantPot({ stage, size, completed, harvest = 0, width }: PlantPotProps) {
  const pot = POT[size];
  const shift = pot.top - 66;

  const grown = stage === 'bud' || stage === 'bloom' || stage === 'fruit';
  const leafCount =
    stage === 'seed' ? 0 : grown ? 6 : Math.min(Math.max(completed, 1), 9);
  const leaves = LEAF_SLOTS.slice(0, leafCount).map((slot) => ({
    ...slot,
    y: slot.y + shift,
  }));

  const stemTop = grown
    ? pot.top - 50
    : leaves.length > 0
      ? Math.min(...leaves.map((l) => l.y)) - 5
      : null;

  return (
    <Svg width={width} height={(width * 88) / 70} viewBox="0 0 70 88">
      {/* 바닥 그림자 — 선반 대신 공중감만 */}
      <Ellipse cx={35} cy={85} rx={pot.rimW * 0.62} ry={2.6} fill={SHADOW} />

      {/* 줄기 — 미세한 곡률 */}
      {stemTop != null ? (
        <Path
          d={`M35 ${pot.top + 1} Q 33.6 ${(pot.top + stemTop) / 2} 35 ${stemTop}`}
          stroke={STEM}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}

      {/* 잎 — 모종기엔 완료 회기 수만큼, 개화기+는 대표형 6장 */}
      {leaves.map((leaf, i) => (
        <Path
          key={i}
          d={LEAF_PATH}
          fill={i % 2 === 0 ? LEAF_A : LEAF_B}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot}) scale(${leaf.sc})`}
        />
      ))}

      {/* 씨앗 (0회 — 빈 화분 금지): 흙 둔덕 + 새싹 틱 */}
      {stage === 'seed' ? (
        <>
          <Ellipse cx={35} cy={pot.top - 1} rx={7} ry={2.4} fill="#D8E8DC" />
          <Path
            d={`M35 ${pot.top - 2} Q 35 ${pot.top - 8} 39 ${pot.top - 10}`}
            stroke={STEM}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}

      {/* 꽃봉오리 */}
      {stage === 'bud' && stemTop != null ? (
        <Ellipse cx={35} cy={stemTop - 3} rx={5.5} ry={7} fill={LEAF_B} />
      ) : null}

      {/* 개화 · 열매 단계의 꽃 — 미니멀 5점 */}
      {(stage === 'bloom' || stage === 'fruit') && stemTop != null ? (
        <>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Circle
                key={deg}
                cx={35 + Math.sin(rad) * 6.4}
                cy={stemTop - 4 - Math.cos(rad) * 6.4}
                r={3.6}
                fill="#FFC24B"
              />
            );
          })}
          <Circle cx={35} cy={stemTop - 4} r={3.4} fill="#FF9E45" />
        </>
      ) : null}

      {/* 열매 */}
      {stage === 'fruit' && stemTop != null ? (
        <>
          <Circle cx={26} cy={stemTop + 12} r={3.2} fill="#FFA94D" />
          <Circle cx={44} cy={stemTop + 8} r={3.2} fill="#FFA94D" />
        </>
      ) : null}

      {/* 화이트 세라믹 화분 */}
      <Path d={pot.body} fill={POT_FILL} stroke={POT_LINE} strokeWidth={1.2} />

      {/* 수확 — 성목기 장기 단위, 화분 앞에 쌓인다 (최대 4개 표시) */}
      {Array.from({ length: Math.min(harvest, 4) }).map((_, i) => (
        <Circle key={i} cx={27 + i * 6} cy={pot.top + 9} r={2.6} fill="#FFA94D" />
      ))}
    </Svg>
  );
}
