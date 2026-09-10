#!/usr/bin/env bash
# s06 촬영용 **전사 목** — 앱 화면에 전사가 실제로 뜨게 한다.
#
# 왜 DB에 직접 쓰나: 모델은 이미 대역으로 갈아 끼웠고(`_scripts/llm-stub.mjs`가
# `/v1/audio/transcriptions`에 대본을 돌려준다) 서버 로그에도 `Chunk STT completed`가 찍힌다.
# 그런데 **서버가 그 전사를 저장하는 데서 실패한다** — `field_note_audio/repository.py:56`의
# `assert updated is not None`. 행은 있고 WHERE는 id·deleted_at뿐인데 UPDATE가 아무것도 못 잡는다
# (제품/환경 쪽 문제 · 2026-09-11 실측). 촬영을 그것에 걸어 둘 이유가 없어 여기서 채운다.
#
# 앱은 필드노트 상세를 1~2초마다 폴링하므로, 채워 넣으면 그 다음 폴링에서 화면에 뜬다.
# 대사는 `_scripts/s06-setup.sql`이 넣는 윤도현 1회기 전사와 같은 줄이다 — 지어낸 말이 아니다.
#
#   _scripts/s06-stt-mock.sh &      # 촬영 시작 전에 띄우고, 끝나면 kill
set -euo pipefail
PSQL=(docker exec -i saas-postgres psql -U imomtae -d imomtae -q -t -A)

LINES=(
  "도현아, 지난번 검사 때 얘기했던 거 기억나?"
  "…네. 근데 별로 안 해요, 딱히 할 말이 없어서."
  "학교에서는 어때? 친구들이랑은."
  "애들이랑 축구도 하고 그래요."
  "이런 것도 말해도 돼요?"
  "무엇을 말해도 괜찮아. 여기서는 그래도 돼."
  "말하면 걱정하잖아요. 그냥 제가 참으면 되니까요."
  "참는 동안 몸은 어때? 잠은 잘 자?"
  "잠이 잘 안 와요. 한 2~3주 됐어요."
  "오늘 말해 줘서 고마워. 그 이야기를 같이 보자."
)

echo "[stt-mock] 대기 — 새 청크가 생기면 전사를 채운다"
while true; do
  # 아직 전사가 없는 청크를 chunk_index 순서로 하나씩
  row=$("${PSQL[@]}" -c "select id||'|'||chunk_index from field_note_audios
        where (transcript is null or transcript='') and deleted_at is null
        order by created_at asc limit 1" || true)
  if [ -n "$row" ]; then
    id="${row%%|*}"; idx="${row##*|}"
    text="${LINES[$(( idx % ${#LINES[@]} ))]}"
    "${PSQL[@]}" -c "update field_note_audios
        set transcript='${text//\'/\'\'}', transcript_status='completed',
            stt_model_used='mock-whisper', updated_at=now()
      where id='$id'" >/dev/null
    echo "[stt-mock] 청크 $idx ← \"${text:0:18}…\""
  fi
  sleep 1
done
