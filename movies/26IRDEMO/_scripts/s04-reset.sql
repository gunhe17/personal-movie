-- s04 되돌리기 — 전송 내역을 비운다.
-- s04는 "전송 내역에 한 줄이 남는다"로 끝나므로, 매 판은 그 목록이 빈 상태에서 출발해야 한다.
-- 앞 판의 링크가 남아 있으면 `until('text=윤보호')`가 즉시 통과해 **이미 있던 줄**을 찍게 된다.
--   docker exec -i saas-postgres psql -U imomtae -d imomtae -f- < _scripts/s04-reset.sql
-- s01이 만든 케이스(AC0002~4)는 건드리지 않는다 — 그건 재시드 + s01 리허설로만 다시 만든다.
delete from message_logs where send_link_id is not null;
delete from assessment_send_links;
select '바로링크 '||(select count(*) from assessment_send_links)||' · 메시지로그 '||(select count(*) from message_logs) as 상태;
