import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FieldNoteWave from '@assets/Fieldnote_Wave.svg';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { FieldNoteFabBars } from './FieldNoteFabBars';

/**
 * 필드노트 FAB 비주얼 — 64 원 + 그라데이션 + 가운데 흰 네모(21.8×25.3) + 물결(Fieldnote_Wave).
 * 바텀 내비 도킹(탭 화면)과 전역 FieldNoteFab(그 외 페이지) 양쪽에서 공유한다.
 * Figma: LinearGradient #4486FF→#00C2E5 · Drop shadow #002C53 6% · Inner shadow #FFFFFF 86%(흰 림으로 근사).
 *
 * active(녹음 중)일 때도 원 모습을 그대로 유지하고, 흰 네모 안 물결만
 * 부드럽게 움직이는 이퀄라이저 막대(FieldNoteFabBars)로 바꾼다. paused면 막대는 정지.
 */
// 물결 SVG 원본 비율 16×11 — 흰 네모 폭에 맞춰 스케일.
const WAVE_W = 15.4;
const WAVE_H = (WAVE_W * 11) / 16;

export function FieldNoteFabMark({
  active = false,
  paused = false,
}: {
  active?: boolean;
  paused?: boolean;
} = {}) {
  return (
    <View
      style={{
        width: s(64),
        height: s(64),
        borderRadius: s(32),
        shadowColor: '#002C53',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.06,
        shadowRadius: s(8),
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={['#4486FF', '#00C2E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: s(32),
          alignItems: 'center',
          justifyContent: 'center',
          // Inner shadow(#FFFFFF 86%) 근사 — 얇은 흰색 림 라이트
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
        }}
      >
        {/* 가운데 흰 네모(21.8×25.3) + 물결(Fieldnote_Wave.svg) */}
        <View
          style={{
            width: s(21.8),
            height: s(25.3),
            borderRadius: s(5.4),
            backgroundColor: COLORS.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {active ? (
            <FieldNoteFabBars paused={paused} />
          ) : (
            <FieldNoteWave width={s(WAVE_W)} height={s(WAVE_H)} />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}
