# s08 케어보드 — 그 대화는 사라진다

장면이 약속한 것: `scenes9.html` §08.
아날로그 쪽 문장이 둘이다 — ① 한 아이의 기록이 네 곳에 흩어져 있다, ② **의사·슈퍼바이저·치료사·교사가
같은 일지를 필요로 하는데 그 일지는 한 사람의 파일에만 있다. 그래서 서로 카톡으로 묻고, 그 대화는 사라진다.**
오른쪽(해결)의 두 번째 항목이 그 답이다 — **`구성원 간 기록 공유` … "전달해야 하던 일이 남겨두면 되는 일이 된다".**

**t01(촬영 완료 · 24.55s)이 ①을 찍었다** — 진행 현황 → 회기 이력 → 문서 → 바우처 → 내담자 정보(보호자 이수진).
**이 t02는 ②를 찍는다.** 무대는 우측 **케어보드 도크** 하나이고, 논지는 *한 곳에 모인다* 위에 얹히는
**팀이 같은 화면을 본다**다.

> **탭 훑기를 버린 근거.** ①은 이미 필름에 있고(t01), 같은 것을 두 번 찍으면 편집에서 하나는 버린다.
> 게다가 **도크 스트림이 그 자체로 ①이다** — `상담`·`검사`·`문서`·`바우처`·`필드노트`·`메모`가 종류 배지를 달고
> 한 줄기에 시간순으로 선다(`KIND_META` — `view-model.ts:12`). 탭 넷을 눌러 보여준 것을 스크롤 한 번이 보여준다.
> 도크가 열려도 좌측 본문은 `pr-[360px]`로 밀려 살아 있어(`+page.svelte:319`) **첫 프레임에 진행 현황(진행률 4/8)과
> 스트림이 같이 담긴다.** 그래서 프로필·회기이력·문서·바우처를 버리는 것이 아니라, t01에 맡기고 t02는 패널로 들어간다.

## 흐름 (웹 · 우측 도크 안에서만)

| # | 화면 | 공유가 서는 자리 |
|---|---|---|
| 1 | 도크가 스스로 펼쳐진다(진입 600ms) — 접수 · 1~3회기 · 바우처 차감 · 필드노트가 날짜 구분선 아래 한 줄기 | 흩어진 것이 한 곳에 |
| 2 | 스트림을 8월까지 올렸다 내린다 | 인수인계 = 스크롤을 올리는 것 (§08 `담당 이관`) |
| 3 | **센터장 김원장의 메모**가 아바타·이름·`담당자`·시각과 함께 그 줄기에 있다 | **남의 발화가 내 화면에 있다** |
| 4 | 정상담이 그 자리에서 답을 써서 `메모 등록` | 낙관 행 → 서버 행. 같은 줄기에 쌓인다 |
| 5 | 그 메모를 **`공지로 고정`** → 상단 반투명 공지 카드로 올라간다 | **이 보드를 여는 모두의 첫 줄이 된다** |
| 6 | 도크를 접는다 → 그 사이 김원장이 **다른 계정으로 실제 API를 통해** 답을 남긴다 → 다시 연다 | **내가 남긴 것을 상대가 읽고 답한 것이 도착해 있다** |

6이 이 장면의 결정적 증거다. 3만으로는 "남이 쓴 것이 보인다"까지고, 4~5는 "내가 쓴 것이 여기 남는다"까지다.
**왕복이 한 화면에서 닫히는 것**은 6뿐이다.

대사(전문은 `_scripts/s08-setup.sql`·`s08-careboard.mjs`):
김원장 「하준이 건 다음 주 사례회의 안건으로 올릴게요. 최근 회기에서 달라진 점 한 줄만 남겨주세요.」 →
정상담 「3회기부터 또래 놀이에서 먼저 말을 겁니다. 분리할 때 울음은 없어졌어요.」 →
김원장 「확인했습니다. 회의 자료에 그대로 넣을게요. 보호자 면담은 제가 잡겠습니다.」

## 코드에서 확인한 것

경로는 `_tool/saas-center-platform` 기준.

| 무엇 | 근거 |
|---|---|
| 우측 패널의 정체 — `fixed` 400px 도크. 진입 버튼(닫힘) ↔ 도크(열림) 두 요소만 그린다 | `apps/web/src/lib/components/care-board/CareBoardDock.svelte` (1334줄) |
| 진입하면 **스스로 펼쳐진다** — `INTRO_DELAY = 600`ms. 클릭할 필요가 없다 | 같은 파일 `:107-113` · 페이지가 `defaultOpen={careBoardIntro}` 전달 `+page.svelte:459-467` |
| 스트림 = **한 테이블**(`care_board_entries`)의 커서 조회. 상담·검사·문서·바우처·필드노트·메모가 같은 행 모양 | `apps/api/app/modules/care_board/entry/models.py:31` · `GET …/care-board/stream` |
| 메모는 `care_memos`에 저장되고, 스트림에 뜨는 것은 그 **스냅샷 엔트리**(kind=`memo`) | `apps/api/app/application/handlers/care_board/write_care_board.py:181-199` `_record_memo_entry` |
| 작성자 이름은 저장 스냅샷이 아니라 **읽을 때 해소**된다(`actor_name`) — 이름이 바뀌면 과거 메모도 따라 바뀐다 | `list_care_board_stream.py:161-189` `_resolve_member_names` · 스키마 `entry/schemas.py:30` |
| **누가 썼는지로 거르지 않는다** — 보드에 들어오면 그 내담자의 전 이력을 본다. 그래야 인계가 성립한다 | `list_care_board_stream.py:1-6` 주석 + `assert_client_accessible:112-138` |
| 메모 **작성 게이트는 권한이 아니라 담당 관계**다. 라우터는 `READ_CLIENT`로 두고 실제 게이트는 접근 판정 | `apps/api/app/modules/care_board/router.py:103-129` · `write_care_board.py:6-9` 주석 |
| 메모 행에는 **kind 권한이 없다** — `KIND_PERMISSION`에 `memo`가 없어, 보드에 들어온 사람이면 전원 읽는다 | `list_care_board_stream.py:24-32` |
| 수정·삭제는 작성자 본인 + 관리자. **UI에는 그 버튼이 없다**(API·서비스 계층만 존재) | `memo/services/update_memo.py:27-28` · `care-board-service.ts:247,256` 호출부 없음 |
| 핀(`공지로 고정`)은 **전역**이다 — 내가 고정하면 모두의 보드 상단에 뜬다. 해제도 누구나 | `entry/services/toggle_pin.py` · `POST …/entries/{id}/pin` |
| 핀은 **엔트리 id**로 걸린다 → 낙관 행의 임시 id로 누르면 404다. 스크립트가 재조회를 기다리는 이유 | `care-board-service.ts:226-246` · 스크립트 `restreamed` |
| 공유 범위는 **UI에 없다**. `share_class`(`fact`/`clinical`/`internal`)는 응답 필드일 뿐이고 어떤 조회도 읽지 않는다. 메모는 항상 `internal`(센터 내부 발화 — 내담자·타 센터에 안 나간다) | `entry/models.py:22` · `write_care_board.py:192` |
| 셀렉터 (라벨은 추측하지 않았다 — 전부 실측) | 입력 `placeholder="공유할 메모를 남겨보세요"` `:1006` · 전송 `aria-label="메모 등록"` `:1021` · 핀 `공지로 고정`/`고정 해제` `:951` · 접기 `케어보드 접기` `:619` · 열기 `케어보드 열기` `:586` · 필터 칩 `전체·메모·상담·검사·기타` (`view-model.ts:22`) |

### 배역 — 두 번째 사람이 김원장이어야 하는 이유

메모를 남길 상대는 **`access_level=all`인 사람**뿐이다. 최치료(COUNSELOR)는 이하준의 담당이 아니라
보드 접근 자체가 404이고(`assert_client_accessible`이 쓰기 경로에도 걸린다 — `write_care_board.py:31`),
그러니 최치료 이름의 메모는 화면에 올릴 수 없다. `access_level=all`은 김원장(관리자)·이사무(매니저)·박접수(직원)이고,
scenes9가 이름을 댄 사람("센터장 · 실장")과 사례회의를 여는 사람은 **김원장**이다.

## 제품에서 발견한 것 (고치지 않고 기록)

| 무엇 | 근거 | 장면에서 |
|---|---|---|
| **안 읽음 배지는 실제로 뜨지 않는다.** 배지는 *닫힌* 진입 버튼에 붙는데(`:591-602`), 그 값을 만드는 스트림 쿼리는 `enabled: () => open`이라 **닫혀 있으면 조회되지 않는다**(`care-board-service.ts:57`). 열리면 값이 오지만 그때 버튼은 사라졌고, 열림당 1회 `markSeen()`이 0으로 내린다(`:135-144`) | 실측: 첫 진입 600ms 동안만 0으로 뜬다. `unread_count` 자체는 서버에서 정상 계산된다(`entry/repository.py:177-204` — 내가 주체인 행 제외) | **쓰지 않았다.** 대신 "접었다 열면 새 메모가 와 있다"로 도착을 세웠다 |
| **메모를 남겨도 알림이 가지 않는다.** `care_memo_created` 이벤트는 `EVENT_REACTIONS`에 배선이 없다 | `application/events/routes.py`에 그 이벤트 없음 · 설계 의도는 `docs/careboard/domain.md:298-314`에 남아 있다 | 알림은 화면에 올리지 않는다. §08의 "변경은 알림으로 간다"는 **이 기능에 대해서는 아직 참이 아니다** |
| **멘션·댓글 없음** | `CareMemoCreate`는 `body` 한 필드 · `docs/careboard/domain.md:508` 유보 | 대사로 상대를 부르는 방식으로 우회 |
| 차트 모달(헤더 `차트`)은 **전부 목업**이다 | `CareBoardDock.svelte:168-273` `CHART` 리터럴 + `:163` TODO(백엔드) | **누르지 않는다** |
| 원천이 하드 삭제된 엔트리는 `backfill_care_board`도 못 지운다(원천을 열거해 비교하므로 없는 원천은 시야에 없다) | `rebuild_care_board.py` · 실측: s09를 되돌리면 `놀이치료 5회기 · 취소됨 · 원본 삭제됨` 유령 행이 남는다 | `s08-setup.sql` ①이 가리키는 것 없는 행만 골라 지운다 |

## t01이 남긴 것 — 관계 목록의 N+1 (제품을 고쳐 없앴다)

t02는 `내담자 정보` 패널로 가지 않지만, t01을 세우려고 고친 제품 변경은 그대로 살아 있다. 요지만 남긴다.

케어보드가 보호자(이수진)의 **이름 하나** 때문에 담당 범위 가드가 걸린 단건 조회를 관계마다 불러 **404**가 났고,
`Promise.all` 거부로 `가족관계` 행이 통째로 사라졌다. 가드(`_resolve_assigned_client_ids` · `get_client.py`)는
**한 줄도 건드리지 않고**, 관계 응답이 상대 이름을 동반하게 고쳤다 — 이 저장소 자체 규약
(`.claude/rules/api/agent-query.md` "`{ref}_id`에는 `{ref}_name`을 동반")이 이미 요구하던 형태다.

| 무엇 | 파일 |
|---|---|
| 응답 스키마에 `related_client_name` 추가 | `apps/api/app/modules/client/relation/schemas.py` `RelationResponse` |
| 엔드포인트가 `ListClientsByIdsService`로 이름을 **한 번에** 채움 | `relation/handlers/list_relations.py` |
| 웹이 `getClientDetail()` 호출 제거 | `apps/web/src/lib/features/clients/detail/detail-service.ts` `fetchRelations` |
| 웹 타입 동반 | `apps/web/src/lib/hooks/actions/client.action.ts` `RelationResponse` |

전문가 앱(`apps/mobile/src/features/client/hooks.ts` `useClientRelations`)은 `phone`까지 쓰므로 손대지 않았다.
**API에 reload가 없어 재시작해야 적용된다.**

## 촬영

| | |
|---|---|
| 조작 | `_scripts/s08-careboard.mjs` — 목 대본 없음(에이전트가 나오지 않는다) |
| 시작 | `/clients/<이하준 clientId>` (재시드마다 바뀐다. 2026-09-10 시드: `77458809-084e-4779-bb30-eabd17a868f6`) |
| 선행 | **`_scripts/s08-setup.sql`** — 유령 엔트리 정리 + 김원장 메모 1건(`now() - 40분`). 촬영 직전에 되돌리고 다시 넣는다 |
| 두 번째 계정 | `_state/local-saas-admin.json` (김원장). 스크립트가 그 파일의 **refresh 토큰**으로 access 토큰을 새로 받아 API에 POST한다 — 자격증명은 파일에도 스크립트에도 없다. access 토큰은 30분짜리라 상태 파일의 것을 그대로 쓰면 곧 만료된다 |
| 상태가 쌓인다 | 메모 3건 + 핀 1건 + `care_board_reads` 갱신. **되돌리기 SQL은 `s08-setup.sql` 맨 아래** |

리허설 실측(2026-09-10 · SPEC **v4** · 되돌린 뒤 setup 적용 상태): **17단계 15.3초 · 종료 코드 0 · "깨끗하다"**
— 서버·페이지·콘솔 오류 0. 노컷 후보 **3.64 – 12.98 (9.3초)**.
