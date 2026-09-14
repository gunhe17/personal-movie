-- 윤도현 — **s01 접수가 촬영 중에 만드는 내담자**를 재시드 뒤에 되살린다.
--
-- 왜 있나: `_scripts/s06-setup.sql`은 윤도현이 이미 있다고 보고 시작한다("s01을 먼저 돌려라").
-- 그런데 s01 접수는 웹 촬영 한 판(에이전트 목 + 폼 등록)이라 폰 컷 하나 찍자고 돌릴 것이 아니다.
-- 이 파일은 그 판에서 **윤도현 한 줄만** 떼어 온다 — 이름·생년월일은 s01 목 대본(`_scripts/s01-intake.mjs`)
-- 그대로다(2014-05-08 → 2026년에 만 12세, C4.4 화면의 "윤도현 · 만 12세"와 같다).
-- 검사 케이스(AC0002)·기관(햇살지역아동센터)·보호자는 만들지 않는다 — C4.3~C4.5가 쓰지 않는다.
--
-- 적용: docker exec -i saas-postgres psql -U imomtae -d imomtae -f - < v2/_scripts/c43-client.sql
-- 순서: 이 파일 → _scripts/s06-setup.sql → v2/_scripts/c44-time-fix.sql → v2/_scripts/c43-pre-record.sql
-- 멱등.

\set ON_ERROR_STOP on

insert into clients (id, center_id, code, role, status, name, birth_date, gender, created_at, updated_at)
select gen_random_uuid()::text,
       (select id from centers where deleted_at is null order by created_at limit 1),
       'YD8K2M', 'client', 'active', '윤도현', date '2014-05-08', 'male', now(), now()
where not exists (select 1 from clients where name = '윤도현' and deleted_at is null);

select code, name, birth_date from clients where name = '윤도현' and deleted_at is null;
