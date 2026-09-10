// 테마 — **라이트 고정**.
//
// 앱 전체 크롬(사이드바·헤더·툴바)을 참조 프로젝트와 같은 흰 톤으로 통일하면서
// 다크 경로를 닫았다. A4 본문과 결과지 썸네일은 원래도 종이라 항상 흰색이었다.
//
// app.css의 :root[data-theme='dark'] 블록과 --chrome-* 토큰은 남겨 뒀다.
// 되살리려면 set()이 다시 data-theme을 심게 하고 app.html에 초기화 스크립트를
// 복원하면 된다. (이전에 다크를 쓰던 사용자의 localStorage 값은 무시된다.)

export type Theme = 'light' | 'dark'

export const theme = {
  get value(): Theme {
    return 'light'
  },
  get isDark(): boolean {
    return false
  },
  // 호출부가 남아 있어도 깨지지 않도록 API 형태는 유지한다 — 동작만 없앤다.
  set(_next: Theme) {},
  toggle() {}
}
