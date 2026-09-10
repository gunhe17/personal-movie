#!/usr/bin/env bash
# s04 · 문자 목업 — 시뮬레이터 메시지 앱에 바로링크 문자 한 통을 넣는다.
#
# 왜 DB에 직접 넣나: 시뮬레이터는 진짜 문자를 못 받는다(통신 스택이 없다). 메시지 앱
# (com.apple.MobileSMS)은 있고 sms.db도 표준 iMessage 스키마 그대로라, 그 안에 한 통을
# 세워 두면 앱이 평소처럼 읽어 그린다. **시뮬레이터 안에서만 사는 데이터**라 되돌리기는
# `--reset` 한 번이다.
#
# 문구는 제품이 실제로 보내는 알림톡 템플릿을 따른다(SendLinkModal의 '메시지 미리보기').
# 링크는 이 기계의 로컬 주소다 — 탭하면 시뮬레이터 Safari가 그 화면을 연다.
#
#   _scripts/s04-sms.sh <send_link_id> <인증번호> [udid]
#   _scripts/s04-sms.sh --reset [udid]
set -euo pipefail

UDID_DEFAULT=F6685208-9C34-4057-AAAC-71D26601D555   # iPhone 17 Pro (SPEC 기기)
SENDER='0269191234'                                  # 시드 밖 번호 — 실제 센터 번호를 쓰지 않는다
CENTER='마인드스코프 아동심리상담센터'

if [ "${1:-}" = "--reset" ]; then
  UDID="${2:-$UDID_DEFAULT}"
  DB=~/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/SMS/sms.db
  xcrun simctl spawn "$UDID" launchctl stop com.apple.MobileSMS 2>/dev/null || true
  sqlite3 "$DB" "select 'drop trigger if exists '||name||';' from sqlite_master where type='trigger';" | sqlite3 "$DB"
  sqlite3 "$DB" "delete from chat_message_join; delete from chat_handle_join; delete from chat_service; delete from message; delete from chat; delete from handle;"
  echo "문자 비움 — $UDID"
  exit 0
fi

LINK_ID="${1:?send_link_id 필요}"
CODE="${2:?인증번호 필요}"
UDID="${3:-$UDID_DEFAULT}"
DB=~/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/SMS/sms.db
[ -f "$DB" ] || { echo "sms.db 없음 — 시뮬레이터를 한 번 부팅하라: xcrun simctl boot $UDID" >&2; exit 1; }

URL="http://localhost:3503/verify-link?send_link_id=$LINK_ID"
TEXT="[$CENTER]

안녕하세요, 윤보호님.

바로링크를 안내드립니다.
아래 링크에서 인증번호를 입력한 후 이용 가능한 검사와 안내를 확인해주세요.

■ 바로링크: $URL
■ 인증번호: $CODE

감사합니다."

# 메시지 앱이 떠 있으면 캐시가 남아 새 행을 못 본다 — 먼저 내린다
xcrun simctl spawn "$UDID" launchctl stop com.apple.MobileSMS 2>/dev/null || true

# Apple epoch(2001-01-01) 기준 나노초 — 지금부터 2분 전에 온 것으로
NOW_NS=$(python3 -c "import time;print(int((time.time()-978307200-120)*1e9))")

# sms.db의 트리거는 메시지 데몬만 가진 SQLite 확장 함수(verify_chat · after_delete_message_plugin)를
# 부른다 — 일반 sqlite3로 열면 "no such function"이다. 목업 DB라 트리거를 걷어내고 쓴다.
# 이 파일은 **시뮬레이터 안에서만** 산다: 되돌리려면 `xcrun simctl erase <udid>`.
sqlite3 "$DB" "select 'drop trigger if exists '||name||';' from sqlite_master where type='trigger';" \
  | sqlite3 "$DB"

sqlite3 "$DB" <<SQL
delete from chat_message_join; delete from chat_handle_join; delete from chat_service;
delete from message; delete from chat; delete from handle;

insert into handle (id, country, service, uncanonicalized_id)
values ('$SENDER', 'kr', 'SMS', '$SENDER');

insert into chat (guid, style, state, chat_identifier, service_name, room_name, account_login, is_archived, last_addressed_handle, display_name)
values ('SMS;-;$SENDER', 45, 3, '$SENDER', 'SMS', null, 'E:', 0, '', '');

-- 평소엔 verify_chat_insert 트리거가 채우는 줄 — 트리거를 걷었으니 직접 넣는다
insert into chat_service (service, chat)
values ('SMS', (select ROWID from chat limit 1));

insert into chat_handle_join (chat_id, handle_id)
values ((select ROWID from chat limit 1), (select ROWID from handle limit 1));

insert into message (guid, text, handle_id, service, date, date_read, date_delivered,
                     is_from_me, is_read, is_sent, is_finished, is_delivered, item_type, type, cache_has_attachments, error)
values ('$(uuidgen)', '$(printf '%s' "$TEXT" | sed "s/'/''/g")',
        (select ROWID from handle limit 1), 'SMS', $NOW_NS, 0, 0,
        0, 0, 0, 1, 1, 0, 0, 0, 0);

insert into chat_message_join (chat_id, message_id, message_date)
values ((select ROWID from chat limit 1), (select ROWID from message limit 1), $NOW_NS);
SQL

echo "문자 1통 — $SENDER → 인증번호 $CODE"
echo "  $URL"
