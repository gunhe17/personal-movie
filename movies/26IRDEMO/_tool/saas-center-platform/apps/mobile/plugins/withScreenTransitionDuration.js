const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Android 화면 전환(ios_from_right) 속도 + easing 곡선 조절.
 *
 * react-native-screens 의 ios_from_right 애니메이션은 라이브러리 anim XML 에
 *   - duration = `@android:integer/config_shortAnimTime`(시스템 상수 ≈ 200ms)
 *   - interpolator = `accelerate_decelerate`(대칭 ease-in-out, 게다가 background 엔 미지정)
 * 로 하드코딩돼 있고, JS prop(animationDuration)은 Android 네이티브에서 무시된다.
 *
 * 문제: 대칭 ease-in-out 은 "느리게 출발"이라 푸시 시작이 머뭇거려 거칠게 느껴진다.
 *       또 새 화면(foreground)에만 곡선이 있고 뒤 화면(background, parallax)엔 없어
 *       두 화면이 미묘하게 따로 논다.
 *
 * 개선(인터랙션 디자인 정석 + 본 프로젝트 디자인 시스템 토큰):
 *   - 등장(open)  → decelerate(ease-out) `easing-enter`  cubic-bezier(0, 0, 0.2, 1)
 *       빠르게 출발 → 끝에서 사르르 안착(= 빠른데 부드러운 토스식 느낌)
 *   - 퇴장(close) → accelerate(ease-in)  `easing-exit`   cubic-bezier(0.4, 0, 1, 1)
 *   - foreground/background 를 같은 곡선으로 잠가 parallax 두 화면이 한 몸으로 움직임.
 *
 * 동일 이름의 anim XML 4개를 app 모듈 res 에 써넣어 라이브러리 리소스를 오버라이드한다
 * (app res 가 dependency res 보다 우선). 커스텀 곡선은 pathInterpolator 리소스로 만든다.
 *
 * ⚠️ 네이티브 리소스 변경이라 적용/변경은 재빌드 필요:
 *    값 변경 → `npx expo prebuild -p android` → `npx expo run:android`.
 *    (android/ 는 CNG 라 prebuild 시 재생성되므로 이 플러그인이 매번 다시 써넣는다)
 *
 * props.durationMs: 전환 시간(ms). 기본 250.
 */
module.exports = function withScreenTransitionDuration(config, props) {
  const durationMs = props && typeof props.durationMs === 'number' ? props.durationMs : 250;

  // 디자인 시스템 easing 토큰을 pathInterpolator(=cubic-bezier)로.
  // pathInterpolator 의 control 점 = bezier 의 P1(controlX1,Y1), P2(controlX2,Y2). P0=(0,0), P3=(1,1) 고정.
  const interpolators = {
    // easeOutCubic: cubic-bezier(0.33, 1, 0.68, 1) — 자연스러운 감속(등장)
    // 표준 decelerate(0,0,0.2,1)는 앞쏠림이 심해 "빠른 1차 + 끝 기어감 2차"로 쪼개져
    // 전환이 두 번처럼 느껴졌다(특히 이동거리 짧은 parallax 뒤 화면과 desync).
    // easeOutCubic은 앞쏠림을 완화해 처음~끝이 하나의 연속 흐름으로 보이게 한다.
    'rns_ios_easing_enter.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<pathInterpolator xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:controlX1="0.33" android:controlY1="1"\n` +
      `    android:controlX2="0.68" android:controlY2="1" />\n`,
    // easing-exit: cubic-bezier(0.4, 0, 1, 1) — accelerate(퇴장)
    'rns_ios_easing_exit.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<pathInterpolator xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:controlX1="0.4" android:controlY1="0"\n` +
      `    android:controlX2="1" android:controlY2="1" />\n`,
  };

  // 원본(react-native-screens)과 동일한 delta/parallax, duration·interpolator 만 교체.
  const ENTER = '@interpolator/rns_ios_easing_enter';
  const EXIT = '@interpolator/rns_ios_easing_exit';
  const anims = {
    // 새 화면: 오른쪽(100%) → 제자리(0%) · 등장 → enter
    'rns_ios_from_right_foreground_open.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<translate xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:duration="${durationMs}"\n` +
      `    android:interpolator="${ENTER}"\n` +
      `    android:fromXDelta="100%"\n` +
      `    android:toXDelta="0%" />\n`,
    // 기존 화면(parallax): 제자리(0%) → 왼쪽 -30% · foreground 와 같은 enter 곡선으로 잠금
    'rns_ios_from_right_background_open.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<translate xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:duration="${durationMs}"\n` +
      `    android:interpolator="${ENTER}"\n` +
      `    android:fromXDelta="0%"\n` +
      `    android:toXDelta="-30%" />\n`,
    // 뒤로가기 — 현재 화면: 제자리(0%) → 오른쪽(100%) · 퇴장 → exit
    'rns_ios_from_right_foreground_close.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<translate xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:duration="${durationMs}"\n` +
      `    android:interpolator="${EXIT}"\n` +
      `    android:fromXDelta="0%"\n` +
      `    android:toXDelta="100%"/>\n`,
    // 뒤로가기 — 돌아오는 화면: 왼쪽(-30%) → 제자리(0%) · foreground 와 같은 exit 곡선으로 잠금
    'rns_ios_from_right_background_close.xml':
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<translate xmlns:android="http://schemas.android.com/apk/res/android"\n` +
      `    android:duration="${durationMs}"\n` +
      `    android:interpolator="${EXIT}"\n` +
      `    android:fromXDelta="-30%"\n` +
      `    android:toXDelta="0%" />\n`,
  };

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );
      const animDir = path.join(resDir, 'anim');
      const interpDir = path.join(resDir, 'interpolator');
      fs.mkdirSync(animDir, { recursive: true });
      fs.mkdirSync(interpDir, { recursive: true });

      for (const [name, contents] of Object.entries(interpolators)) {
        fs.writeFileSync(path.join(interpDir, name), contents);
      }
      for (const [name, contents] of Object.entries(anims)) {
        fs.writeFileSync(path.join(animDir, name), contents);
      }
      return cfg;
    },
  ]);
};
