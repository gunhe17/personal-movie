#!/usr/bin/env bash
# CUT.md §7의 표를 그대로 돈다. 영상에서만 뽑는다 — 반대는 불가능하다.
# 사용: _scripts/stills.sh          (없는 원본은 건너뛰고 끝에 센다)
set -u
cd "$(dirname "$0")/.." || exit 1

# 장면디렉터리 원본명 초
TABLE="
s01-접수 s01_web_intake_t07 12.80
s01-접수 s01_web_intake_t07 21.60
s02-검사실시 s02_web_collect_t05 10.50
s02-검사실시 s02_web_collect_t05 24.10
s02-검사실시 s02_web_collect_t05 26.90
s03-채점보고서 s03_web_draft_t01 13.20
s03-채점보고서 s03_web_draft_t01 16.50
s04-바로링크 s04_web_sendlink_t03 10.90
s05-일정 s05_web_approve_t05 11.90
s05-일정 s05_web_approve_t05 17.20
s06-필드노트 s06_phone_fieldnote-app_t01 14.20
s06-필드노트 s06_web_fieldnote_t02 5.70
s07-자동일지 s07_web_draft_t04 11.40
s08-케어보드 s08_web_careboard_t03 11.40
s08-케어보드 s08_web_careboard_t03 14.40
s09-회기정산 s09_web_noshow_t03 9.70
"

ok=0; miss=0
while read -r dir name t; do
  [ -z "${dir:-}" ] && continue
  src="$dir/raw/$name.mov"
  if [ ! -f "$src" ]; then echo "없음  $src"; miss=$((miss+1)); continue; fi
  # 초 → 분-초-프레임 (60fps)
  tc=$(awk -v t="$t" 'BEGIN{s=int(t);printf "%02d-%02d-%02d", s/60, s%60, (t-s)*60+0.5}')
  out="$dir/stills/${name}_${tc}.png"
  mkdir -p "$dir/stills"
  ffmpeg -nostdin -loglevel error -y -ss "$t" -i "$src" -frames:v 1 -q:v 1 "$out" \
    && { echo "뽑음  $out"; ok=$((ok+1)); }
done <<< "$TABLE"

echo "— 뽑음 $ok · 원본 없음 $miss"
[ "$miss" -gt 0 ] && echo "raw/*.mov가 .gitignore 대상이다. 원본이 있는 머신에서 돌린다."
exit 0
