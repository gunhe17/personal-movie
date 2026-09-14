DONE — C6.5 제출 서류 파생. 제품에 최소 구현 → 촬영 → 무대까지 끝.

# C6.5 제출 서류 파생 — "같은 일지에서, 제출처마다"

배역: 회기 축 — 이하준 놀이치료 C00002 · 2026-09-06 **12회기**(C6.4가 만든 그 케이스).
바우처는 **아동비전형성지원서비스**(이하준이 실제로 가진 것, 9/12회 남음 — C7.5와 같은 바우처), 양식은 시드의 **회기 기록지**.

## 단계

1. **기능 실재 — 없어서 만들었다.** 표(`counseling_note_derivations`)만 있고 서비스·라우터·화면이 전부 없었다. 촬영용 사본에 최소로 구현했다(아래 파일 목록).
2. **시나리오 표현** — 확정 일지 옆에 바우처 양식이 **채워진 채** 선다. 좌 일지 / 우 양식 2단 모달(전달문 모달과 같은 좌→우 그림, 다른 것은 오른쪽이 **칸이 있는 문서**라는 점).
3. **목 구성** — `production_ai_configs.note_derive_form` + llm-stub(:3599). C5.5·C6.4와 같은 자리다. 요청형 1콜이라 **batch 워커는 필요 없다**.
4. **리허설** exit 0 · 11단계 8.7초 (`rehearse.mjs --headless`).
5. **촬영** `v2/s06-증명/raw/s06_web_derive_t01.mov` 10.37s · 프레임 622(dup 37, sck 593) · 타임코드 단조 증가 확인. 노컷 4.78–6.39(생성 소요).
6. **무대** `v2/_mockups/C6.5_imac.mp4` **4.00s** · spec `v2/_mockups/spec/C6.5.json`.

## 선택본

| 컷 | 촬영본 | 무대 |
|---|---|---|
| C6.5 | `v2/s06-증명/raw/s06_web_derive_t01.mov` | `v2/_mockups/C6.5_imac.mp4` |

**무대가 4초인 방법** — `render.mjs`에는 시작 오프셋이 없다(`duration`은 앞에서 자른다). 그래서
촬영본의 **5.40–9.60 구간을 잘라 `_mockups/src/C6.5_s06_web_derive_t01.mov`로 두고** 그걸 무대에 올렸다.
그 4초가 컷의 논지 전부다 — 버튼 누름(5.8) → 양식이 채워진 채 섬(6.39) → 커서가 좌우 같은 문장을 오감(7.5–8.5).
더 길게 쓰고 싶으면 `spec/C6.5.json`의 `screen`을 `raw/s06_web_derive_t01.mov`로 바꿔 다시 굽는다(10.4초). raw는 안 건드렸다.

## 화면에서 읽히는 것

- 왼쪽 일지의 `진행 내용`과 오른쪽 양식의 `회기 내용`이 **글자 그대로 같은 문장**이다 — 그래서 조작 스크립트가 `text=역할놀이에서 자신감 있게 참여 >> nth=0/1`로 두 문서를 오간다.
- 왼쪽에만 있는 것: **K-CBCL 위축/우울 T 68 · 사회적 위축 F93.8 R/O**. 제출 서류로는 안 넘어간다(프롬프트 규칙). C5.5의 논지가 제출처 쪽에서 한 번 더 선다.
- 양식은 상담사가 고르지 않는다 — 내담자 바우처에 제출처가 걸어둔 서식이 정본. 걸린 양식이 없으면 버튼이 비활성(툴팁 고지).

## 만든 파일 (촬영용 제품 사본 — `_tool/saas-center-platform`)

| 파일 | 무엇 |
|---|---|
| `apps/api/app/modules/counseling/counseling_note_derivation/repository.py` | `add` · `list_by_session`. 모델은 원래 있던 것 그대로 — **마이그레이션 없음** |
| `…/counseling_note_derivation/schemas.py` | 요청(`client_id`·`kind`) · 응답. `content` = `{template_id, template_name, instance_id, client_voucher_id, values}` |
| `…/counseling_note_derivation/services/create_derivation.py` · `list_derivations.py` · `__init__.py` | 서비스 한 파일 한 클래스 |
| `…/counseling_note_derivation/router.py` | `POST/GET /centers/{cid}/counseling/sessions/{sid}/note-derivations` |
| `apps/api/app/modules/counseling/facade/counseling_note_derivation_facade.py` | 스코프 검증 + 적재·조회 |
| `apps/api/app/runtime/note_derivation/service.py:41` `DeriveSubmissionFormService` | 요청형 LLM 1콜. config step **`note_derive_form`** · 스키마에 없는 키는 버린다 |
| `apps/api/app/application/handlers/counseling/derive_submission_form.py` | 일지 → 바우처 양식 해소 → LLM → **양식 인스턴스 생성 + 값 채움 + 바우처에 링크** → 파생 기록 |
| `apps/web/src/lib/hooks/actions/counseling-note-derivation.action.ts` | 웹 액션 둘 |
| `apps/web/src/lib/components/counseling/DeriveFormModal.svelte` | 좌 일지 / 우 양식 2단 모달. 칸 순서는 **스키마 `elements` 순서**(JSONB 키 순서는 뒤섞인다) |

## 고친 파일

| 파일:줄 | 무엇 |
|---|---|
| `apps/api/app/modules/llm/credit_balance/plan_config.py:28·75·93` | `AIPurpose.COUNSELING_NOTE_DERIVE` + 예상 크레딧 3 + 한글 라벨 |
| `apps/api/app/modules/routers.py:21` · `app/main.py:105` | 라우터 등록 |
| `apps/api/app/modules/counseling/facade/__init__.py` | 새 facade export |
| `apps/api/app/application/handlers/counseling/__init__.py` | 새 handler export |
| `apps/web/src/lib/components/counseling/InlineJournalEditor.svelte:362·367·929` | 바우처 양식 유무 쿼리 · `openDeriveForm` · **`제출 서류 초안 작성`** 버튼(`내담자에게 전달` 옆) |

## 만든 것 (이 저장소)

| 파일 | 무엇 |
|---|---|
| `v2/_scripts/c65-derive-setup.sql` | 바우처(아동비전형성지원서비스) ↔ `회기 기록지` 연결 + 파생 본문 고정(llm-stub용). 멱등 |
| `v2/_scripts/c65-derive.mjs` | C6.5 조작 |
| `v2/_mockups/spec/C6.5.json` · `src/C6.5_s06_web_derive_t01.mov` | 무대 spec · 4초 트림 입력 |

## 함정 (다음 사람이 밟지 않게)

- **회기 상세의 일지는 `CounselingJournalModal`이 아니라 `InlineJournalEditor`다.** 둘 다 `내담자에게 전달` 버튼을 갖고 있어 모달 쪽에 붙였다가 한 판을 잃었다(버튼이 화면에 안 나옴). 모달 쪽(좁은 화면 변형)에는 파생 버튼을 **안 붙였다** — 업스트림에 올릴 때 판단할 자리다.
- **양식 칸 순서는 `schema.fields`의 키 순서가 아니다.** JSONB가 키를 길이·바이트순으로 재배열한다(`remark, content, next_plan, session_no, session_date`). 종이 위 순서는 `schema.elements` 배열 순서다.
- `llm_call_id`는 `null`로 남는다 — 이 로컬에서는 공유문(C5.5)도 같다(`ai_gateway._record_call`이 기록 실패를 삼킨다). `llm_calls` 행 자체는 생긴다.
- 재촬영 전에는 앞 판이 만든 파생·양식을 지워야 버튼이 `이 일지로 양식 채우기`로 돌아온다(남아 있으면 `다시 옮기기` + 오른쪽이 이미 채워진 상태로 시작한다):
  ```sql
  delete from form_values where instance_id in (select content->>'instance_id' from counseling_note_derivations);
  delete from client_voucher_resources where resource_id in (select content->>'instance_id' from counseling_note_derivations);
  delete from forms where id in (select content->>'instance_id' from counseling_note_derivations);
  delete from counseling_note_derivations;
  ```

## 데이터에 남은 것 (촬영이 실제로 만든 것)

`voucher_form_templates` 1행(setup) · `counseling_note_derivations` 1(draft · 기록지) ·
`forms` 1(draft) + `form_values` 5 · `client_voucher_resources` 1(이하준 바우처에 달린 제출 서류).

## 업스트림에 옮길 때

- 마이그레이션 불필요 — `counseling_note_derivations`는 이미 `4629c1fe0a2a`로 올라가 있고 컬럼을 더하지 않았다. 양식 인스턴스 id는 `content` JSONB 안에 산다.
- 새 의존성 없음. 기존 경로만 조립했다: `FormFacade.create_instance` · `upsert_answers_with_response` · `ClientVoucherResourceFacade.link_form_instance` · `AIFacade.generate_json`.
- 이벤트는 새로 만들지 않고 `form_created`를 쓴다(이 요청이 바깥에 남기는 것은 결국 양식 1장이다). 파생 자체의 이벤트가 필요하면 그때 `events.py`를 더한다.
- 파생은 **덮어쓰지 않는다** — 제출처(kind)마다 한 장이고 다시 만들면 양식 인스턴스도 새로 태어난다. `published`만 note×kind 하나로 잠겨 있다(모델의 `uq_note_derivation_published`). 발행(publish) 경로는 **안 만들었다** — 촬영에 필요 없었다.
- 프롬프트 본문(`runtime/note_derivation/service.py` `SYSTEM_PROMPT`)은 운영에서 `production_ai_configs.note_derive_form`이 이긴다. 촬영용 SQL이 그 자리를 쓰므로 **업스트림에는 그 행을 넣지 않는다.**
- 서명 패드·PDF 출력은 범위 밖이라 손대지 않았다(C1.9의 미구현 그대로).
