# s09 회기 관리 · 정산 — 수를 세서 낸다, 그 숫자로 급여가 정해진다

장면이 약속한 것: `scenes9.html` §09 — **"사전 취소와 당일 노쇼는 페이가 다른데 구분되지 않는다"**와
**"노쇼 환불은 센터 정책에 맞춰 손으로 기록한다"**의 역상.
회기마다 상태를 표시하고, **노쇼에는 사유를 남기고 차감 여부를 센터 정책으로 선택**하며, 차감되면 배지가 붙는다.

**배역: 회기 축.** 이하준 C00002 5회기(어제) · 담당 정상담.

## 흐름 (웹)

1. 회기 상세 — 어제 5회기. 출결이 아직 안 정해졌다
2. `노쇼했어요` → **노쇼 전용 모달** "이하준님을 노쇼로 변경할까요?" (확인 팝업을 겸한다 — 팝업이 두 번 뜨지 않는다)
3. 모달 안 **사유 textarea**(500자, 선택) — 사람 말로 쓴 근거를 넣는다
4. 그 아래 **회기 차감** 스위치 — *"이번 노쇼를 남은 회기 1회 사용으로 처리해요."* 켠다
5. `변경` → 회기가 노쇼로 굳고 **잠긴다**
6. 잠긴 회기 화면에 **노쇼 사유 카드**가 선다 — 입력한 문장 + **회기 차감** 배지

**3·4가 한 모달에 함께 있는 것이 이 장면의 핵심이다.** 아날로그에서 "구분되지 않던" 것(차감 여부)은 **선택**이 되고,
"손으로 기록하던" 것(환불·귀책 사유)은 **입력 칸**이 된다. 그리고 6에서 그 둘이 회기 기록에 나란히 남는 것이 보인다 —
청구·급여가 근거로 삼는 것이 화면 위에 그대로 있다.

## 노쇼 사유가 들어가는 자리 — 코드로 확정

| 단계 | 어디 | 근거 |
|---|---|---|
| 입력 | `<textarea placeholder="사유를 입력해주세요">` (500자 카운터) | `NoShowReasonModal.svelte:87-97` |
| 반환 | `{ memo, isConsumed }` | 같은 파일 `:6-9`, `:42-45` |
| 호출 | `노쇼`만 이 모달을 쓴다 — `취소`는 사유를 받지 않는다("사전 통보라 귀책을 남길 일이 없다") | `detail-service.ts:498-536` |
| 전송 | `PATCH /centers/{id}/counseling/session-participants/{spId}` body `{attendance_status, memo, is_consumed}` | `detail-service.ts:538-547` · `counseling.action.ts:651-663` |
| 스키마 | `SessionParticipantUpdate.memo: str \| None (max_length=500)` | `counseling_session_participant/schemas.py:22` |
| 저장 | `counseling_session_participants.memo String(500)` | `counseling_session_participant/models.py:39` |
| 재조회 | 케이스 상세가 참여자마다 `memo`·`is_consumed`를 돌려준다 | `get_counseling_case_detail.py:264-268` |
| **표시** | 잠긴 회기 화면의 **노쇼 사유** 카드 — 값 + `is_consumed`면 `회기 차감` 배지 | `InlineJournalEditor.svelte:629-652` |
| 표시(카드) | 참여자 카드에도 `노쇼 사유` + 배지 | `ClientActionCard.svelte:122-152` |
| 사후 수정 | `사유 수정` 버튼 → 같은 모달을 현재 값으로 열어 PATCH | `detail-service.ts:567-601` |

**제품은 고치지 않았다.** 사유 입력은 이미 완결돼 있었다 — 앞선 준비가 그 칸을 비워 둔 채 스위치만 켰던 것이다.

## 코드에서 확인한 것

| | 근거 |
|---|---|
| 출결 버튼 라벨 | `참석했어요` · `취소했어요` · **`노쇼했어요`** — `노쇼`만으로는 안 잡힌다(실측) |
| 사유 입력 | `NoShowReasonModal.svelte:87-97` — `placeholder="사유를 입력해주세요"`. 선택이지만 **비워 두면 "기록된 사유가 없어요"가 남는다** |
| 차감 스위치 | `NoShowReasonModal.svelte:99-109` — `<Switch ariaLabel="회기 차감 여부">`. **기본 꺼짐**이라 켜지 않으면 차감으로 기록되지 않는다 |
| 확정 버튼 | 같은 모달의 `변경` |
| 완료·노쇼·취소 회기는 잠긴다 | `SessionDetailPanel.svelte:196` — "청구·차감·일지의 앵커라 직접 수정 불가" |
| 바우처는 금액 기준 | `client_vouchers.remaining_amount` — 회기 수가 아니라 금액. "잔여 회기"는 단가로 환산한 표시다 |

## 준비 단계 — `_scripts/s09-setup.sql`

시드의 회기 셋은 전부 **완료·참석**이라 상태를 바꿀 수 없다(잠긴다). 그래서 **어제 날짜의 5회기**를
예정 상태로 만든다(2026-09-09 01:00 UTC = 10:00 KST). 참여자 출결은 `scheduled`(= 미확인).

> 고침(2026-09-10): setup sql이 넣던 `pending`은 **`AttendanceStatus` enum에 없는 값**이었다
> (`models.py:16-23`). 화면이 멀쩡했던 것은 `InlineJournalEditor.svelte:123-127`이 `session.status==='scheduled'`면
> 저장값과 무관하게 미확정으로 정규화하기 때문이다 — 우연이었다. `scheduled`로 바꿨다.

```bash
.claude/skills/scene-prep/scripts/reset-seed.sh --yes
docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s09-setup.sql
```

시각은 UTC(naive) — s05와 같은 규약.

## 촬영

| | |
|---|---|
| 조작 | `_scripts/s09-noshow.mjs` — 목 대본 없음 |
| 되돌리기 | `_scripts/s09-reset.sql` — 행을 지우지 않아 **sessionId가 유지된다** |
| 시작 | `/counseling/status/<C00002 caseId>?session=<5회기 sessionId>` (id는 재시드마다 바뀐다) |
| 전제 | 5회기가 예정·미확인. 노쇼는 한 번뿐이라 **리허설·테이크마다 `s09-reset.sql`을 먼저 넣는다** |

리허설 실측(2026-09-10 사유 입력 추가 재구성 · SPEC **v4**): **10단계 10.6초 · 종료 코드 0 · 서버·페이지·콘솔 오류 0**.
DB 확인 — `attendance_status = no_show` · **`is_consumed = true`** · **`memo = '연락 없이 미참석. 보호자 통화 안 됨. 다음 회기 전 재확인.'`**
· 회기 `status = cancelled`(노쇼는 회기 단위로 취소로 굳는다).
`client_vouchers.remaining_amount`는 그대로다(1,800,000/2,400,000) — 차감의 기록은 참여자 행의 `is_consumed`이고,
금액 차감은 청구 단계의 일이다. 화면의 "잔여 회기"는 그 기록에서 환산된다.

### 실측으로 배운 것

- `button:has-text("노쇼")`는 **아무 일도 안 일으킨다** — 실제 라벨이 `노쇼했어요`다. 오류도 토스트도 없이 지나갔다
- 라벨을 고쳐도 **차감은 안 걸린다** — 확인 모달의 스위치가 기본 꺼짐이라서다. DB를 안 봤으면 두 번 다 통과로 오인했다
- **모달에 이미 있던 사유 칸을 비워 둔 채 통과했다** — `memo`가 `null`이라 잠긴 화면에 "기록된 사유가 없어요"가 떴다.
  종료 코드 0은 "화면이 장면의 논지를 보여준다"는 뜻이 아니다
- `h.reveal`은 여기서 쓰지 않는다 — 모달(420px)이 뷰포트에 다 들어와 있는데도 dy=67로 **배경을 밀었다**(실측).
  이미 보이는 요소에는 `hover`로 커서만 건너가게 한다
