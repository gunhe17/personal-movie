#!/usr/bin/env bash
# 촬영 → 충실도 검사 → 미달이면 되돌리고 재촬영. 무인 촬영용.
#
# 왜 필요한가: 60Hz 기록기는 기계 부하에 굶는다. `received > appended`가 되고 결과는
# **실제보다 빠르게 재생되는 영상**인데 `notReady`는 0이라 드롭으로도 안 잡힌다.
# 사람이 옆에 있으면 meta를 보고 다시 찍으면 되지만, 밤새 도는 배치에서는 여기서 자동으로 돈다.
#
#   PRE='되돌리기 명령' _scripts/capture-until-good.sh --scene s05-일정 --device web --action approve …
#
# PRE  — 매 시도 전에 돌릴 셸 명령(되돌리기·준비). 없으면 안 돌린다.
# MIN  — 통과 기준 충실도(기본 98)
# TRIES— 최대 시도 횟수(기본 4)
# 첫 시도 뒤부터는 `--retake-of <직전 테이크>`와 사유를 자동으로 붙인다.
set -euo pipefail
MIN=${MIN:-98}
TRIES=${TRIES:-4}
RUNNER=../../.claude/skills/capture-service/scripts/capture.mjs

scene=""; device=""; action=""
args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
  case "${args[$i]}" in
    --scene) scene="${args[$((i+1))]}" ;;
    --device) device="${args[$((i+1))]}" ;;
    --action) action="${args[$((i+1))]}" ;;
  esac
done
[ -n "$scene" ] && [ -n "$device" ] && [ -n "$action" ] || { echo "--scene --device --action 필요" >&2; exit 2; }
no=${scene%%-*}
raw="$scene/raw"

last_take() { ls "$raw" 2>/dev/null | grep -oE "${no}_${device}_${action}_t[0-9]+\.meta\.json" | sort | tail -1 | grep -oE 't[0-9]+' || true; }

fidelity() {  # $1 = meta 경로 → 정수 퍼센트
  python3 - "$1" <<'PY'
import json,sys
m=json.load(open(sys.argv[1]))
last=m['steps'][-1]['t']; dur=m['result']['duration']
print(int(dur/(last+m['timing']['tail']/1000)*100))
PY
}

prev=$(last_take)
for ((t=1; t<=TRIES; t++)); do
  [ -n "${PRE:-}" ] && eval "$PRE" >/dev/null 2>&1 || true
  extra=("")
  if [ $t -gt 1 ]; then extra=(--retake-of "$prev" --reason "부하로 60Hz 기록기가 굶어 충실도 미달 — 자동 재촬영 $t/$TRIES"); else extra=(); fi
  node "$RUNNER" "$@" ${extra[@]+"${extra[@]}"} >/dev/null 2>&1 || { echo "촬영 실패(시도 $t)" >&2; sleep 20; continue; }
  cur=$(last_take); meta="$raw/${no}_${device}_${action}_${cur}.meta.json"
  f=$(fidelity "$meta")
  echo "  시도 $t · $cur · 충실도 ${f}%"
  if [ "$f" -ge "$MIN" ]; then echo "OK $cur ${f}%"; exit 0; fi
  prev="$cur"
  sleep 25   # 부하가 가라앉기를 기다린다
done
echo "TRIES 안에 ${MIN}% 를 못 넘겼다 — 마지막 $prev" >&2
exit 1
