/**
 * 발달 지표 레이더 — 활동 요약 카드의 6축 육각 차트 (피그마 928:6683).
 *
 * 격자(외곽 육각 + 6 스포크)와 데이터 폴리곤은 SVG로, 축 라벨은 Typography로 그린다
 * (SVG <Text>는 디자인 시스템 variant를 못 쓴다 — 라벨만 절대배치로 얹는다).
 * 지오메트리는 R 하나에서 파생하고 R은 s()로 스케일 → 시안(375 기준) 비율이 유지된다.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { DevelopmentAxis } from './summaryData';

/** 육각 반지름 — 시안 99.23 */
const R = s(99);
/** 라벨이 차지하는 위아래 여백 (시안: 꼭짓점에서 16 띄우고 16 행간) */
const LABEL_BAND = s(32);
/** 라벨 박스 폭 — 좌우 라벨은 이 폭 안에서 꼭짓점 쪽으로 정렬 */
const LABEL_W = s(80);
/** 옆 꼭짓점 기준 라벨 세로 오프셋 (시안: 위쪽 -22.4 / 아래쪽 +27.4) */
const SIDE_UP = s(22.4);
const SIDE_DOWN = s(27.4);
/** body-03 실제 행간(14/20) — 시안은 16이나 variant 값을 따른다(mobile-client.md §2) */
const LABEL_LINE = s(20);
const DOT_R = s(4);

export const RADAR_HEIGHT = R * 2 + LABEL_BAND * 2;

/** 위 → 우상 → 우하 → 아래 → 좌하 → 좌상 (시계 방향) */
const ANGLES = [90, 30, -30, -90, -150, 150];

function point(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
}

function toPolygon(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

interface DevelopmentRadarProps {
  axes: DevelopmentAxis[];
  /** 차트가 놓일 폭 (카드 폭) — 중심 x를 여기서 잡는다 */
  width: number;
}

export function DevelopmentRadar({ axes, width }: DevelopmentRadarProps) {
  const cx = width / 2;
  const cy = LABEL_BAND + R;

  const outer = ANGLES.map((angle) => point(cx, cy, angle, R));
  const valuePoints = axes.map((axis, index) =>
    point(cx, cy, ANGLES[index], R * axis.value),
  );
  const hasCompare = axes.every((axis) => axis.compare != null);
  const comparePoints = hasCompare
    ? axes.map((axis, index) =>
        point(cx, cy, ANGLES[index], R * (axis.compare as number)),
      )
    : null;

  return (
    <View style={{ width, height: RADAR_HEIGHT }}>
      <Svg width={width} height={RADAR_HEIGHT}>
        <Polygon
          points={toPolygon(outer)}
          fill="none"
          stroke={COLORS.gray[200]}
          strokeWidth={1}
        />
        {outer.map((vertex, index) => (
          <Line
            key={`spoke-${index}`}
            x1={cx}
            y1={cy}
            x2={vertex.x}
            y2={vertex.y}
            stroke={COLORS.gray[200]}
            strokeWidth={1}
          />
        ))}

        {/* 지난 회차 — 점선 회색 폴리곤 (시안 928:6689) */}
        {comparePoints ? (
          <Polygon
            points={toPolygon(comparePoints)}
            fill="none"
            stroke={COLORS.gray[400]}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}

        <Polygon
          points={toPolygon(valuePoints)}
          fill={COLORS.brand[500]}
          fillOpacity={0.08}
          stroke={COLORS.brand[500]}
          strokeWidth={1}
        />
        {valuePoints.map((p, index) => (
          <Circle
            key={axes[index].key}
            cx={p.x}
            cy={p.y}
            r={DOT_R}
            fill={COLORS.white}
            stroke={axes[index].color}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {axes.map((axis, index) => {
        const vertex = outer[index];
        const angle = ANGLES[index];
        // 위·아래 꼭짓점은 가운데 정렬, 옆 꼭짓점은 바깥쪽으로 밀어 좌/우 정렬
        const isTop = angle === 90;
        const isBottom = angle === -90;
        const isRight = angle === 30 || angle === -30;
        const isUpper = angle > 0;

        const left = isTop || isBottom
          ? cx - LABEL_W / 2
          : isRight
            ? vertex.x
            : vertex.x - LABEL_W;
        const top = isTop
          ? vertex.y - s(16) - LABEL_LINE
          : isBottom
            ? vertex.y + s(16)
            : vertex.y - LABEL_LINE / 2 + (isUpper ? -SIDE_UP : SIDE_DOWN);

        return (
          <View
            key={axis.key}
            style={{
              position: 'absolute',
              left,
              top,
              width: LABEL_W,
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="body-03"
              weight="medium"
              numberOfLines={1}
              style={{
                color: COLORS.text.body.default,
                textAlign: isTop || isBottom ? 'center' : isRight ? 'left' : 'right',
              }}
            >
              {axis.label}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}
