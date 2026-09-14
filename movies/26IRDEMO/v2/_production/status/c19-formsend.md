DONE — C1.9 "보호자 폰에 뜬 그 서식" 촬영·무대 완료. 제품 결함 둘 다 해소(서명은 연출하지 않는다).

# c19-formsend — C1.9 보호자 폰에 뜬 그 서식

갱신: 2026-09-14 새벽 · 앞 기록은 `screen-pipeline.md` §C1.9

## 단계

| 단계 | 결과 |
|---|---|
| 환경 | API 3502 · web 3503 · saas-postgres(3501) 확인. `local-saas-admin.json` 토큰이 22분 전 만료 → `login.mjs`로 재생성(admin=김원장) |
| ① 수신자 결함 | **고침** — `ClientSummary`에 `guardian_phone`을 실었다(아래 표). 실측: `GET /clients/`가 `이하준 → 이수진 / 010-3000-0001`을 돌려준다 |
| ② 서명 | **연출하지 않는다.** 자막은 **"작성까지 돌아온다"**. 제품에 서명 패드가 없어(캔버스 0개) 시드 서식의 `sign.required`를 내렸다 — 안 내리면 `VerifyRequiredFieldsService`가 제출 자체를 400으로 막는다 |
| 재기동 | API 재기동(uvicorn, `--reload` 없음). web은 vite dev HMR |
| ④ 리허설 | `c19-formsend.mjs` exit0 10.4s · `c19-formfill.mjs`(--profile phone) exit0 26.8s · `c19-formreturn.mjs` exit0 5.3s |
| ⑤ 촬영 | 아래 세 테이크. 전부 드롭 없음 · meta `steps[].t` 단조 증가 |
| ⑥ 무대 | `C1.9_phone.mp4`(8.00s) · `C1.9_send_imac.mp4`(12.03s) · `C1.9_return_imac.mp4`(7.47s) |

## 고친 파일 : 줄

제품 사본 `movies/26IRDEMO/_tool/saas-center-platform` (촬영용 사본).

| 파일:줄 | 무엇 |
|---|---|
| `apps/api/app/modules/client/profile/schemas.py:184` | `ClientSummary.guardian_phone` 필드 추가 |
| `apps/api/app/modules/client/facade/profile_facade.py:281,286,292` | `_attach_primary_guardian`이 이미 읽어 오는 보호자 행에서 `phone`도 같이 담아 summary에 채운다 (쿼리 추가 없음) |
| `apps/web/src/lib/hooks/actions/client.action.ts:40` | `ClientListItem.guardian_phone` 타입 추가 |
| `apps/web/src/lib/components/assessment/receive/ClientMultiSelect.svelte:48` | `guardian_phone: item.phone` → `item.guardian_phone ?? item.phone`. **근본 자리다** — 아동의 `phone`은 비어 있고, 이 매퍼가 서식 발송·검사 접수 두 화면의 수신자를 같이 만든다 |
| `apps/web/src/lib/components/form/FormFillBody.svelte:177` | 목록 폴백이 `date`·`phone`도 그린다. 안 그리면 **필수 필드를 폰에서 채울 길이 없어 제출이 영원히 400**이다. `signature`는 그대로 안 그린다(서명 패드를 만들지 않는다) |
| `v2/_scripts/c17-form-asset.mjs` BOXES `sign` | `required` 제거 → `c17-form-setup.sql` 재생성·재적용. 서명 UI가 없는 동안 필수 서명은 제출을 막는 잠금장치다 |

조작 스크립트에서 고친 것(제품 아님):
- `c19-formsend.mjs` — `전송` 버튼. `button:has-text("전송")`은 발급 내역 행의 **`재전송`**에 먼저 걸린다(목록이 비어 있을 때만 운으로 통과). `:text-is`도 안 된다 — 라벨이 `Typography`(`<p>`) 안이라 버튼의 직계 텍스트가 아니다. `page.getByRole('button', { name: '전송', exact: true })`로 갔다.
- `c19-formfill.mjs` — `<input type=date>`의 연도 칸은 **6자리까지 먹는다**. `'20160922'`를 한 번에 치면 `201609-02-02`가 저장된다(실측). 연도만 치고 `ArrowRight`로 칸을 넘긴다.

## 촬영본

| 파일 | 길이 | 충실도 | 노컷 |
|---|---|---|---|
| `v2/s01-접수서류/raw/s01_web_formsend_t01.mov` | 12.03s | 688/722 (드롭0) | 8.79–10.34 전송 → 발급 내역에 한 줄 |
| `v2/s01-접수서류/raw/s01_phone_formfill_t01.mov` | 28.80s · **phone 프로필**(390×844@3x → 1170×2532) | 1630/1728 (드롭0) | 6.56–26.84 보호자가 폰에서 채운다 → 제출 |
| `v2/s01-접수서류/raw/s01_web_formreturn_t01.mov` | 7.47s | 427/448 (드롭0) | — |

셋 다 `manifest.csv` 13·14·15행. 시드 `_seed/saas-2026-09-14.json`(sha256 `2bfdf7ce09b1`).

## 무대

| mp4 | spec | 원본 |
|---|---|---|
| `v2/_mockups/C1.9_phone.mp4` **(8.00s)** | `spec/C1.9.json` | `src/C1.9_s01_phone_formfill_t01.mov` — 촬영본에서 **두 토막을 이어 8초로** 잘랐다: `3.9–7.9`(코드 확인 → 그 서식이 뜬다 → `목록으로 보기`) + `24.2–28.2`(동의 → 제출 → 제출 완료). 한 토막으로는 "서식이 떴다"와 "제출했다"가 같이 안 들어간다 |
| `v2/_mockups/C1.9_send_imac.mp4` (12.03s) | `spec/C1.9_send.json` | 웹 앞 컷 — 발급 → 수신자 → 적용 → 전송 |
| `v2/_mockups/C1.9_return_imac.mp4` (7.47s) | `spec/C1.9_return.json` | 웹 뒤 컷 — 발급 내역의 그 줄이 `작성완료` |

편집 순서는 **send_imac → phone → return_imac**. `render.mjs`는 무대 하나에 클립 하나라 이어 붙이기는 편집에서 한다.

## 브리프와 제품이 어긋난 자리

| 브리프 | 제품 |
|---|---|
| "**서명까지** 돌아온다" | 서명 패드가 없다(API `POST …/forms/{id}/signature`만 있고 UI 0개). **"작성까지 돌아온다"**로 바꿨다. 서명은 화면에 한 번도 안 나온다 — 목록 폴백이 `signature`를 아예 안 그린다 |
| "**회수됨**" | 제품 배지는 **`작성완료`**다(`view-model.ts` `issuanceStatus`). 그 줄은 `이하준 · mother · 010-3000-0001 · 2026.09.14 03:53 · 문자 · 작성완료` |
| 폰 화면 | 원본 스캔 오버레이는 390px 폭에서 A4가 302px로 눌려 글자가 안 읽힌다. 제품이 준 **`목록으로 보기`**로 갈아탄다 — 폰용 폴백이 제품의 의도다(`+page.svelte` 주석: "대부분 휴대폰으로 연다") |

## 남은 것 (제품 쪽, 이 컷을 막지는 않는다)

- **서명 패드 미구현.** API는 있고 UI가 없다. 붙으면 C1.9를 "서명까지"로 다시 찍을 수 있다.
- **`forms`에 `client_id`가 없다** — 제출된 서식이 내담자 상세에 안 붙고, 작성된 답변을 여는 화면도 없다. 그래서 뒤 컷의 끝이 배지 하나다.
- 목록 폴백은 여전히 `select`·`signature` 등 나머지 타입을 안 그린다. 이번엔 `date`·`phone`만 열었다(필수 필드를 막고 있던 둘).

## 데이터에 남은 것

`form_sends` 1 · `forms` 1(submitted) · `form_values` 8(이하준·2016-09-22·이수진·010-3000-0001·주호소·염려 3·이전상담 없음·동의).
리허설이 만든 행은 촬영 전에 지웠다 — 발급 내역이 0에서 시작해야 "한 줄이 생긴다"가 보인다.
