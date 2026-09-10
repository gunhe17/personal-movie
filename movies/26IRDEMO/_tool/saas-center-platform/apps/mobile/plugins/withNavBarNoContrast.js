const { withAndroidStyles } = require('expo/config-plugins');

/**
 * Edge-to-edge(Android)에서 시스템 내비게이션 바의 대비 스크림을 제어한다.
 *
 * props.enabled === true  → enforceNavigationBarContrast = false
 *   → 3버튼 내비 바가 완전히 투명, 화면 배경(필드노트 다크 #141220 등)이 버튼 뒤로 비침.
 * props.enabled === false → enforceNavigationBarContrast = true (Expo 기본값)
 *   → 대비 스크림 복구(기본 흰 바). 투명 효과 원상복구.
 *
 * 버튼 아이콘 색은 런타임 NavigationBar.setButtonStyleAsync 로 화면별 제어(useFieldNoteNavBar).
 * Android 15+ 는 edge-to-edge 강제라 setBackgroundColorAsync(배경색)는 no-op → 이 투명 방식이 정답.
 *
 * 단일 플래그(app.config.ts FIELD_NOTE_DARK_NAVBAR)로 on/off. 변경 후 재빌드 필요.
 */
module.exports = function withNavBarNoContrast(config, props) {
  const enabled = props && props.enabled === false ? false : true;
  const contrastValue = enabled ? 'false' : 'true';

  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults?.resources?.style ?? [];
    const appTheme = styles.find((s) => s.$ && s.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.item = appTheme.item ?? [];
      const key = 'android:enforceNavigationBarContrast';
      const existing = appTheme.item.find((i) => i.$ && i.$.name === key);
      if (existing) {
        existing._ = contrastValue;
      } else {
        appTheme.item.push({ _: contrastValue, $: { name: key, 'tools:targetApi': '29' } });
      }
    }
    return cfg;
  });
};
