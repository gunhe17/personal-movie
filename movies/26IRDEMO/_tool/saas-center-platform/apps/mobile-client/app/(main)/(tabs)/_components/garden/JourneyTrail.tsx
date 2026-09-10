/**
 * 여정 트랙 — 상담 케이스의 회기를 보드게임식 경로로 그린다.
 *
 * 12회 이하: 6개/줄 보드게임 트랙 (완료=채움, 다음=링, 남은 길=옅은 정거장).
 * 13회+ 또는 열린 케이스: 접힘 노드(+N) + 최근 완료 3 + 다음 + 직후 1 축약.
 * 열린 케이스(총량 미정)는 끝점을 그리지 않고 옅어지는 꼬리로 '계속되는 길'.
 * 남은 회기는 결핍(빈 체크박스)이 아니라 앞으로의 길 — §7-1.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const DOT = s(26);
const LINE_H = s(3);

type NodeKind = 'done' | 'next' | 'future' | 'fold' | 'ghost';

interface TrailNode {
  key: string;
  kind: NodeKind;
  label?: string;
}

function Dot({ node }: { node: TrailNode }) {
  if (node.kind === 'ghost') {
    return <View style={{ width: DOT, height: DOT }} />;
  }
  const base = {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (node.kind === 'done') {
    return (
      <View style={[base, { backgroundColor: COLORS.brand[500] }]}>
        <Typography variant="caption-01" weight="semibold" style={{ color: COLORS.white }}>
          ✓
        </Typography>
      </View>
    );
  }
  if (node.kind === 'next') {
    return (
      <View
        style={[
          base,
          {
            backgroundColor: COLORS.white,
            borderWidth: s(3),
            borderColor: COLORS.brand[500],
          },
        ]}
      >
        <Typography variant="caption-01" weight="semibold" style={{ color: COLORS.brand[500] }}>
          {node.label}
        </Typography>
      </View>
    );
  }
  // future · fold
  return (
    <View style={[base, { backgroundColor: COLORS.gray[100] }]}>
      <Typography
        variant="caption-01"
        weight={node.kind === 'fold' ? 'medium' : 'regular'}
        style={{ color: node.kind === 'fold' ? COLORS.gray[600] : COLORS.gray[400] }}
      >
        {node.label}
      </Typography>
    </View>
  );
}

/** 다음 정거장 — 은은한 맥동 (호흡 리듬, 채근 아님) */
function NextDot({ node }: { node: TrailNode }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.09 }],
  }));
  return (
    <Animated.View style={style}>
      <Dot node={node} />
    </Animated.View>
  );
}

function renderNode(node: TrailNode) {
  return node.kind === 'next' ? <NextDot key={node.key} node={node} /> : <Dot key={node.key} node={node} />;
}

interface JourneyTrailProps {
  completed: number;
  total: number | null;
}

export function JourneyTrail({ completed, total }: JourneyTrailProps) {
  const finished = total != null && total > 0 && completed >= total;
  const nextRound = finished ? null : completed + 1;

  // ── 축약 모드: 13회+ 또는 열린 케이스 ──
  if (total == null || total > 12) {
    const nodes: TrailNode[] = [];
    const recentDone = Math.min(completed, 3);
    const folded = completed - recentDone;
    if (folded > 0) nodes.push({ key: 'fold', kind: 'fold', label: `+${folded}` });
    for (let i = 0; i < recentDone; i += 1) {
      nodes.push({ key: `d${i}`, kind: 'done' });
    }
    if (nextRound != null && (total == null || nextRound <= total)) {
      nodes.push({ key: 'next', kind: 'next', label: String(nextRound) });
    }
    const afterNext = nextRound != null ? nextRound + 1 : null;
    const closedFuture = total != null && afterNext != null && afterNext <= total;
    if (closedFuture) {
      nodes.push({ key: 'future', kind: 'future', label: String(afterNext) });
    }

    return (
      <View className="flex-row items-center" style={{ marginTop: s(12) }}>
        {nodes.map((node, i) => (
          <React.Fragment key={node.key}>
            {i > 0 ? (
              // 연결선은 flex로 카드 폭을 채운다 — 고정폭이면 트랙이 중간에 끊겨 보인다
              <View
                style={{
                  flex: 1,
                  minWidth: s(10),
                  height: LINE_H,
                  borderRadius: LINE_H / 2,
                  backgroundColor:
                    node.kind === 'done' || node.kind === 'next'
                      ? COLORS.brand[500]
                      : COLORS.gray[100],
                }}
              />
            ) : null}
            {renderNode(node)}
          </React.Fragment>
        ))}
        {/* 열린 케이스 — 끝점 없는 길 (옅어지는 꼬리, 남은 폭을 채운다) */}
        {total == null ? (
          <View
            className="flex-row items-center"
            style={{ flex: 2, columnGap: s(6), marginLeft: s(6) }}
          >
            {[0.5, 0.32, 0.16].map((opacity, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: LINE_H,
                  borderRadius: LINE_H / 2,
                  backgroundColor: COLORS.brand[300],
                  opacity,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // ── 보드게임 모드: 12회 이하 ──
  // 총 5회 이하는 한 줄에서 카드 폭 전체로 균등 분배 — 고스트로 채우면
  // 트랙이 중간에 끝나 잘려 보인다. 6회 이상만 6칸 그리드 2줄.
  const rounds = Array.from({ length: total }, (_, i) => i + 1);
  const compact = total <= 5;
  const rowsRounds = compact ? [rounds] : [rounds.slice(0, 6), rounds.slice(6)];
  const toNode = (round: number): TrailNode =>
    round <= completed
      ? { key: `r${round}`, kind: 'done' }
      : round === nextRound
        ? { key: `r${round}`, kind: 'next', label: String(round) }
        : { key: `r${round}`, kind: 'future', label: String(round) };

  const hasSecondRow = rowsRounds.length > 1 && rowsRounds[1].length > 0;
  const rowHeight = DOT + s(8);
  const rowGap = s(16);

  return (
    <View style={{ marginTop: s(12) }}>
      {rowsRounds.map((rowRounds, rowIndex) => {
        if (rowRounds.length === 0) return null;
        const nodes: TrailNode[] = rowRounds.map(toNode);
        if (!compact) {
          while (nodes.length < 6) {
            nodes.push({ key: `g${rowIndex}-${nodes.length}`, kind: 'ghost' });
          }
        }
        const ghost = compact ? 0 : 6 - rowRounds.length;
        return (
          <View
            key={rowIndex}
            className="flex-row items-center justify-between"
            style={{
              paddingVertical: s(4),
              marginTop: rowIndex > 0 ? rowGap : 0,
              flexDirection: rowIndex % 2 === 0 ? 'row' : 'row-reverse',
            }}
          >
            {/* 경로 선 — 실제 정거장 구간까지만 (정거장 1개면 선 없음) */}
            {rowRounds.length > 1 ? (
              <View
                style={{
                  position: 'absolute',
                  top: '50%',
                  marginTop: -LINE_H / 2,
                  height: LINE_H,
                  borderRadius: LINE_H / 2,
                  backgroundColor: COLORS.gray[100],
                  left: rowIndex % 2 === 0 ? s(13) : undefined,
                  right: rowIndex % 2 === 1 ? s(13) : undefined,
                  width: ghost > 0 ? `${((6 - ghost) / 6) * 100 - 4}%` : undefined,
                  ...(ghost === 0
                    ? rowIndex % 2 === 0
                      ? { right: s(13) }
                      : { left: s(13) }
                    : null),
                }}
              />
            ) : null}
            {nodes.map((node) => renderNode(node))}
          </View>
        );
      })}
      {/* 줄 사이 회전 연결부 */}
      {hasSecondRow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -s(6),
            top: s(4) + DOT / 2,
            width: s(20),
            height: rowHeight + rowGap - s(6),
            borderWidth: s(3),
            borderLeftWidth: 0,
            borderColor: COLORS.gray[100],
            borderTopRightRadius: s(24),
            borderBottomRightRadius: s(24),
          }}
        />
      ) : null}
    </View>
  );
}
