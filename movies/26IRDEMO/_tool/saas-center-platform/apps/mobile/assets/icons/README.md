# 커스텀 SVG 아이콘

디자이너가 만든 SVG 아이콘을 여기에 드롭합니다.

## 📐 SVG Export 규칙 (디자이너 공유)

| 항목 | 값 |
|------|-----|
| `viewBox` | `0 0 24 24` (24px 그리드 통일) |
| `fill` / `stroke` | **`currentColor`** — 색을 prop으로 주입해야 하므로 고정 색 금지 |
| `stroke-width` | 1.5 또는 2 (디자인팀 합의) |
| 파일명 | kebab-case (`home.svg`, `bell-filled.svg`) |
| 변형 접미사 | `-outline`, `-filled`, `-solid` |

## 🗂️ 폴더 구조 (사이즈별 분리)

```
assets/icons/
├── 16/   # 16×16 아이콘 (인라인 보조)
├── 20/   # 20×20 아이콘 (라벨/리스트)
├── 24/   # 24×24 아이콘 (버튼/탭 기본)
├── 28/   # 28×28 아이콘 (브랜드/일러스트형)
├── 32/   # 32×32 아이콘
└── 44/   # 44×44 아이콘 (대형 상태/일러스트)
```

## ➕ 새 아이콘 추가

1. 사이즈에 맞는 폴더(`16/`, `20/`, `24/`, `28/`, `32/`, `44/`)에 `*.svg` 드롭
2. `src/shared/components/icons/Icon.tsx`의 `ICON_MAP`에 import + 키 등록
   - 경로 예: `@assets/icons/20/BellIcon20.svg`
3. `<Icon name="..." />` 로 사용

## 💡 사용 예시

```tsx
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';

<Icon name="home" size={24} color={COLORS.primary} />
```
