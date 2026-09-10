# s02 검사 실시 — 종이 채점지가 화면이 된다

무대는 **마인드봄**(투사검사 해석 보조). s01에서 접수한 아이가 여기서 검사받는다.
장면이 약속한 것: `scenes9.html` §02 — "검사는 207분" / "센터 안에 지금 어떤 검사가 몇 건 진행 중인지 한눈에 보는 화면이 없다"의 역상.

**배역: 검사 축 — 윤도현**(s01이 접수한 세 아이 중 하나) · 임상가 **정상담**(clinician).
시드가 세 아이의 로샤를 만들어 둔다 — `seed:yun-rorschach` · `seed:jang-rorschach` · `seed:hong-rorschach`.
**s01 → s02가 데이터로 이어진다.**

> ⚠️ **시드 기본 상태는 `confirmed`다. s02는 되돌리기에서 시작한다.**
> 마인드봄의 종합보고서 배터리가 박지우 → 윤도현으로 옮겨지면서(`seed.py:48` `battery-yundohyun`)
> `seed:yun-rorschach`가 **배터리의 일원**이 됐다 — `seed.py`가 `status="confirmed"`로 만들고
> `seed_content.py:91`이 반응 22 · 영역 22 · 카드 10 · 촉구 2를 채운다(s03의 재료).
> s02는 그 검사를 **반응 0 · `created`**에서 시작한다. 매 리허설·테이크 전에 `_scripts/s02-reset.sh`.
> 안 돌리면 화면은 열리지만 **모든 쓰기가 400**이다(아래 §status).
> 반대로 **s03은 확정 상태를 쓴다** — 두 장면이 같은 검사를 반대 상태로 쓰므로, 남의 촬영 지점에서 reset을 돌리지 않는다.

## 실시 화면만 보여준다

목록에서 들어가는 컷은 뺐다. 이 장면의 전부는 **반응 하나(①)를 끝까지 기록하는 것**이다.

1. **내담자 화면** — 태블릿을 피검자 쪽으로 돌린다. 기록이 전부 가려지고 카드만 남는다
2. **받아쓰기** — 마이크를 켠다. 아이가 말할 때마다 **카드를 한 번 누른다**. 그 탭이 반응의 경계고,
   탭과 탭 사이의 말이 그 줄의 자유반응이 된다. 눌린 자리에서 잔물결만 퍼진다 — 숫자를 띄우면 피검자가 자기 페이스를 계산한다
3. **임상가 화면으로** — 반응 ①을 열면 아이가 한 말이 자유반응 칸에 이미 들어와 있다.
   `free_association_stt_raw`가 나란히 남는다 — 임상가가 문장을 고쳐도 **기계가 들은 것**은 그대로 보존된다
4. **위치 부호** — `W` · `D` · `Dd` · `공백 S` 중에서. W는 반점 전체
5. **영역 그리기** — 카드 위에 직접 그린다. 그린 조각이 그 반응에 붙는다
6. **질문** — `어디가 그렇게 보였는지`. 같은 줄의 다음 칸이라 화면을 옮기지 않는다
7. **방향** — 피검자가 카드를 돌려 본 것도 기록이다

## 코드가 말하는 설계 (주석이 근거다)

| | |
|---|---|
| **§14-1** 자유반응과 질문이 **한 화면** | "모드가 둘이라는 건 지금은 이 칸만 채울 수 있다는 뜻이고, 그건 위 전제와 모순이다" |
| **§14-2** 반응 하나 = 채점지의 **한 줄** | 자유반응 / 질문 / 위치를 **아무 순서로나 언제든** 채운다 |
| **§14-7** 위치는 반응당 하나 | 그래서 조각을 고르는 것이 곧 **반응을 고르는 것**이다(`RegionOverlay`의 키가 `response_id`) |
| **§14-12** 헤더 배지가 "어느 칸이 비었나" | **누락 없음의 최전선.** 회색 → 초록으로 바뀌는 것이 이 장면의 작은 클라이맥스 |
| 임상가 화면의 반응 칸에는 **마이크가 없다** | 지난 반응을 고치려 팝오버를 열어둔 채 받아쓰기를 켜면 **지금 말하는 다른 반응의 말이 들어간다.** 자유반응은 R을 결정하는 원자료라 오염 비용이 크다. 질문 칸에만 있다. **자유반응을 받아쓰기로 채우는 자리는 내담자 화면**이고, 거기서는 경계가 팝오버가 아니라 탭이다 |
| 확정 버튼이 없다 | Enter 하나로 모으고 그 자리는 마이크가 갖는다 — "검사 중 임상가의 손이 가장 적게 움직여야 한다" |
| 표준 절차의 **두 바퀴는 유지된다** | 1바퀴에 카드 I~X 자유반응만, 2바퀴에 카드 I로 돌아와 나머지 칸. 화면이 순서를 강제하지 않는다 |

## status — `/collect`는 무엇에서 열리는가 (코드 확인)

**단계 자체는 status로 잠기지 않는다.** 로샤 모듈의 `collect`에는 `enabled`가 없다
(`apps/web/.../rorschach/module.ts:45-51` "벽 없음 — 언제든 되돌아와 고칠 수 있다").
잠긴 단계는 `results` 하나뿐이다(`module.ts:68` `enabled: isConfirmed`).

막는 것은 **쓰기**다. 확정 이후면 기록을 바꾸는 모든 경로가 400을 뱉는다.

| 근거 | 무엇 |
|---|---|
| `apps/api/.../rorschach/services.py:80-95` `_ensure_editable` | `is_confirmed(status)`면 `InvalidOperationException` — "확정된 검사의 기록은 수정할 수 없습니다" |
| 같은 파일 `217-220` (CreateResponse) · `411-415` (DeleteResponse) | 반응 추가·삭제도 같은 게이트 |
| `apps/api/.../common/state_machine.py:101` | `CONFIRMED_STATUSES = {confirmed, report_generated, completed}` |
| `apps/web/.../[examId]/(exam)/[step]/+page.svelte:55-84` | 첫 진입에서 `resolveActiveStep`으로 옮긴다. `collect.done`은 `progress.collect_done`이고, 반응을 지우면 `administration_done`이 false라(`rorschach/completion.py:147-167` 카드가 responded인데 반응 0이면 미완) collect가 "아직 안 끝난 첫 단계"가 된다 |

**실측(2026-09-10)**: status를 `confirmed`로 둔 채 리허설하면 화면은 열리지만
`PUT …/rorschach/cards/1/status` 400 · `POST …/rorschach/responses` 400이 나고
9단계에서 멈춘다(반응이 안 생기니 `반응 1 선택`이 영영 안 뜬다).
`created`로 되돌리면 화면이 `startSession`으로 `created → in_progress`를 직접 밟는다
(`FreeAssociation.svelte:430-441` · `services.py:139` — 실제 실시와 같은 경로다).

**실시 완료의 정의가 넓다** — "완료 버튼을 눌렀다"가 아니라 **10장 전부 실시/거부 + 모든 정식 반응이 영역·질문 보유**이고
서버 `completion.administration_done`이 판정한다. s02는 이걸 채우지 않는다. 카드 한 장만 시연하고 컷한다 — 실제 검사는 90분이다.

## 저장 확인 (DB)

리허설 뒤 한 줄이 이렇게 남는다.

| 자유반응 | 질문 | 위치 | 방향 | 영역 |
|---|---|---|---|---|
| 박쥐 같아요. 날개를 펴고 있는. | 가운데 검은 부분이 몸통이고 양옆이 날개요. | `W` | `right` | ✅ |

### 확인 방법의 함정 (실측)

**`rorschach_responses.region_id`를 보면 안 된다.** 그 칸은 안 채워진다 — 링크가 반대라
`rorschach_regions.response_id`가 반응을 가리킨다(§14-7의 "조각을 고르는 것이 곧 반응을 고르는 것"). 이걸 몰라
"영역 그리기가 저장되지 않는다"고 한 번 오판했다. 올바른 확인은 이렇다.

```sql
exists(select 1 from rorschach_regions g where g.response_id = r.id and g.deleted_at is null)
```

## 촬영

| | |
|---|---|
| 조작 | `_scripts/s02-collect.mjs` |
| 받아쓰기 | `--stt _mocks/s02-stt.json` — **마이크와 전사 모델만 갈아 끼운다.** 제품 경로(getUserMedia → VAD → 조각 → 전사 요청 → 이어붙기)는 그대로 돈다. Chromium에 말–침묵이 번갈아 드는 WAV를 마이크로 물리고(`capture-service/scripts/stt.mjs`), `/transcribe-clip`만 대본으로 답한다. 목 에이전트와 같은 원칙 — 촬영 중에 모델을 부르지 않는다 |
| 시작 | `/examinations/<윤도현 로샤 examId>/collect` (마인드봄 **4503**). id는 재시드마다 바뀐다 — `PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom -t -A -c "select id from examinations where note='seed:yun-rorschach'"` |
| 계정 | `_state/local-mindbom-counselor1.json` — clinician은 **본인이 examiner인 검사만** 본다 |
| 전제 | **매번 `_scripts/s02-reset.sh` 먼저.** 시드 기본이 `confirmed`+반응 22라 안 돌리면 400이고, 돌린 뒤 또 돌리지 않으면 반응이 쌓인다 |

리허설 실측(2026-09-10, 배터리 이관 후 재시드 위에서): **24단계 26.9초 · 종료 코드 0 · 서버 오류 0**.
노컷 **0.70–13.24 / 13.24–23.73**. DB — 자유반응·`_stt_raw`·질문·`W`·`right`·영역 전부 저장 · 촉구 0.

### 셀렉터 함정

- 목록의 유형 표기는 **`로샤`**(로르샤흐 아님), 행은 `<tr>`이 아니라 `.cursor-pointer` DIV
- 방향 버튼은 `aria-label^="카드 방향"` — 아이콘 이름(`chevron_right`)으로는 안 잡힌다
- 영역은 캔버스 드래그다 — `h.drawOnCanvas(sel, 0~1 비율 점들, note)`
- 마인드봄 토큰은 saas의 `reset-seed.sh`로 갱신되지 않는다. 401이면 `login.mjs --base http://localhost:4503`
- **툴바 칩은 번호만 보여준다** — 받아쓴 말은 팝오버 안 textarea에 있다. `text=박쥐…`로 기다리면 영원히 안 온다

## 제품에서 발견한 것

**전사가 도착하기 전에 팝오버를 열면 자유반응이 지워진다.** 팝오버가 뜨는 순간 `freeDraft`가 그때의
값(빈 문자열)으로 굳고, 나중에 그 칸이 블러될 때 빈 값이 저장돼 **받아쓴 말을 덮는다**. 서버는 200을
돌려주므로 4xx로도 안 잡힌다 — 실제로 한 번 이렇게 날아갔다(DB에 자유반응만 빈 줄이 남았다).
동기화 `$effect`는 `document.activeElement`가 textarea가 아닐 때만 도는데, 그 조건이 이 경로를 못 막는다.
촬영에서는 팝오버를 연 뒤 값이 보이는 것을 확인하고 진행해 피했다. 제품 수정은 이 스킬 범위 밖이다.

**영역 자동 매칭이 임상가가 고른 위치 부호를 덮은 적이 있다.** `CardCanvas.svelte:257-262`는
"부호가 비어 있고 매칭 후보가 있으면 최고점을 자동 제안"하고 `if (areaCode) return`으로 자기를 막는데,
`W`를 누른 직후(같은 화면 첫 방문·콜드 컴파일)에 그린 한 번은 그 가드를 지나 **`W`가 `D4`로 바뀌어 저장됐다**.
4회 중 1회(첫 회)만 재현됐고 이후 3회는 `W`로 안정. 4xx도 토스트도 없다 — **테이크마다 DB로 확인해야 한다**.

```sql
select area_code from rorschach_responses r join rorschach_sessions s on s.id=r.session_id
 join examinations e on e.id=s.examination_id where e.note='seed:yun-rorschach';
```

촬영 전에 그 화면을 한 번 열어 웜업하고(첫 방문에서만 나왔다), 테이크 뒤 `W`가 아니면 그 테이크는 버린다.
