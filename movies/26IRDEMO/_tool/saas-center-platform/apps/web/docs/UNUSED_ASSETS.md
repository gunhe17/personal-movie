# 미사용 에셋 정리 목록

> 2026-04-23 기준 `src/lib/assets/` 내 미사용 파일 스캔 결과.
> 모두 **참조 0건**으로 확인됨. 정리 작업 시 일괄 삭제 후보.

## 스캔 방법

- 대상: `apps/web/src/lib/assets/` 내 파일 184개
- 방법: 각 파일의 베이스 이름을 `src/`, `static/` 전체에서 단어경계(`-w`) 매치로 검색
- 제외: `assets/` 자기 참조, `node_modules/`, 빌드 산출물(`.svelte-kit/`, `build/`)

## 결과 요약

| 구분 | 개수 |
| ---- | ---- |
| 전체 | 184 |
| 사용 중 | 154 |
| **미사용** | **29** |

총 용량: **~876KB** (대부분 `BellAnimation.gif`)

## 미사용 파일 목록 (29개)

### `.svelte` 아이콘 컴포넌트 (26개)

- `ArrowRightWhiteIcon20.svelte`
- `AssessmentPocketIcon.svelte`
- `CareboardMiniIcon.svelte`
- `CircleCheckSolidIcon.svelte`
- `CounselingSchedule24Icon.svelte`
- `CursorIcon32.svelte`
- `CustomService20.svelte`
- `ExcelIcon.svelte`
- `GridViewIcon.svelte`
- `ListIcon32.svelte`
- `ListViewIcon.svelte`
- `MarkerIcon22.svelte`
- `MemoIcon.svelte`
- `MemoIcon24.svelte`
- `New40Icon.svelte`
- `NoteIcon20.svelte`
- `NoticeIcon20.svelte`
- `PackageSettingIcon.svelte`
- `Program40Icon.svelte`
- `Report20Icon.svelte`
- `SecretOffIcon16.svelte`
- `SecretOffIcon20.svelte`
- `SecretOnIcon16.svelte`
- `SecretOnIcon20.svelte`
- `TriangleAlertSolidIcon.svelte`
- `YellowPinIcon32.svelte`

### 기타 에셋 (3개)

- `BellAnimation.gif` — 용량 큰 애니메이션 파일 (미사용 중 대부분 용량 차지)
- `Icon_44_Menu.svg`
- `Noti_question_20.svg`

## 정리 시 유의사항

- `favicon.svg`는 `app.html` + `static/firebase-messaging-sw.js`에서 참조 중 → **유지**
- 삭제 전 현재 브랜치(예: `platform_admin_v2`) 외 다른 작업 브랜치에서 이 파일들을 쓸 가능성 재확인 권장
- 스캔 기준은 파일명 기반이라, 동적으로 import하는 케이스(예: `await import(\`./assets/\${name}.svelte\`)`)가 있다면 누락 가능. 현재는 해당 패턴 없음으로 확인

## 재스캔 스크립트

```bash
cd apps/web && python3 <<'EOF'
import os, subprocess
asset_dir = "src/lib/assets"
assets = [f for f in os.listdir(asset_dir) if os.path.isfile(os.path.join(asset_dir, f))]
unused = []
for fname in sorted(assets):
    base = os.path.splitext(fname)[0]
    r = subprocess.run(
        ["grep", "-rlwE", "--include=*.svelte", "--include=*.ts", "--include=*.js",
         "--include=*.json", "--include=*.html", "--exclude-dir=assets",
         base, "src", "static"],
        capture_output=True, text=True,
    )
    if not r.stdout.strip():
        unused.append(fname)
print(f"미사용 {len(unused)}/{len(assets)}")
for f in unused: print(" ", f)
EOF
```
