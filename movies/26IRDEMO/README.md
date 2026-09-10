# 26IRDEMO — 촬영 원본

> **진행 상태는 [STATUS.md](STATUS.md)** — 어느 장면이 준비됐고 환경을 어떻게 세우는지. 새 세션은 거기부터.
> **배역은 [CAST.md](CAST.md)** — 어느 장면에 누가 나오는지의 정본.

아홉 장면(`_lab/research/04-artifacts/scenes9.html`)의 실제 서비스 캡처. 장면 번호는 그 문서와 1:1.

```
_lab/         조사 자료 (research/README.md)
_seed/        시드 스냅샷 — 첫 촬영 전에 박제(`_scripts/seed-snapshot.sh <앱>`). 없으면 테이크끼리 섞을 수 없다
_scripts/     Playwright 조작 스크립트, 장면별 1개 (_lab/research/01-source/webapp-audit의 walkthrough에서 파생)
_mocks/       목 에이전트 스크립트(JSON) — 촬영 때 `capture.mjs --mock`으로 싣는다
_tool/        촬영 대상 제품 소스 사본 — saas-center-platform · mindbom. 커밋이 meta의 app.commit
manifest.csv  file, scene, device, action, take, in, out, use, note — 최종 컷에 쓴 것만 use=Y
sNN-이름/
  raw/        OS 캡처 원본. 절대 덮어쓰지 않는다
  stills/     원본에서 뽑은 프레임 (png, 2x). 파일명 뒤에 타임코드
  mockup/     raw를 무대(iMac 글라스 등)에 얹은 파생본 + 그 spec. `motion-stage` 스킬로 재생성. 원본명 + 처리명
  notes.md    조작 순서 · 캡처 지점 · 테이크 기록
```

## 캡처 규칙

- **영상이 기본, 정지는 영상에서 뽑는다.** 반대는 불가능하다.
- 웹 뷰포트 **1600×900 @2x (16:9, 3200×1800)** 고정. 처음부터 끝까지 같은 크기. 정본은 `capture.mjs`의 `SPEC`.
- **60fps**, 조작 앞뒤 **3초** 여유.
- 커서는 남긴다 — 진짜라는 신호. 이동은 느리게, 클릭 전 0.5초 멈춤.
- OS 알림 · 브라우저 확장 · 북마크바 · 다른 탭 전부 끔. 편집에서 못 지운다.
- 테마는 라이트 하나로.
- 촬영은 `capture-service` 스킬(`.claude/skills/capture-service/`)로만 한다 — Playwright가 Chromium을 전체화면으로 띄워 조작하고, `sckcap`(ScreenCaptureKit, 앱 필터·커서 제외·CFR 60)이 잡고, meta와 manifest를 쓴다. Playwright 자체 녹화·ffmpeg 화면 캡처·OBS·수동 캡처는 쓰지 않는다.
- 폰은 `capture-phone.mjs` — 같은 sckcap이 Simulator 창을 잡는다(iPhone 17 Pro · 베젤 off · 터치 표시 · 804×1748). 조작은 idb. **s06 필드노트만 실기기** — 마이크가 필요하다.
- s04 · s05는 웹과 폰을 같은 시계로 동시에 돌린다. 두 캡처를 동시에 시작하고 첫 클릭을 클랩으로 맞춘다.

## 파일명

`s05_phone_request_t02.mov` — 장면 · 기기(web / phone / tablet / device) · 조작 · 테이크.
정지: `s05_web_approve_t02_00-07-12.png` — 원본명 + 타임코드.
재촬영은 테이크 번호를 올린다. 이전 테이크는 지우지 않는다.

## 계정 · 로그인 상태

`_state/accounts.json` — 직원 5계정(김원장 admin · 이사무 manager · 박접수 staff · 정상담 counselor1 · 최치료 counselor2)과 두 제품의 주소(saas :3503 · 마인드봄 :4503). 공통 비밀번호, 실계정 아님.
`_state/local-<앱>-<key>.json` — 각 계정의 로그인 + 기관 선택 상태. 촬영 시 `--state _state/local-saas-admin.json`처럼 넘긴다.

토큰이 만료되면 다시 만든다:

    for app in saas mindbom; do
      base=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['apps']['$app']['base'])")
      for k in admin manager staff counselor1 counselor2; do
        CAP_EMAIL=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['accounts']['$k']['email'])") \
        CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base $base --out _state/local-$app-$k.json
      done
    done

## 시드

두 제품이 **같은 배역**을 쓴다 — 마인드스코프에서 접수한 아이가 마인드봄에서 검사받는 컷이 이어져야 하기 때문이다.
기관은 **마인드스코프 아동심리상담센터** 하나, 계정·내담자는 이름·생년월일·비밀번호까지 같다.
정본은 saas의 develop 시드이고, 마인드봄 `apps/api/scripts/cast.py`가 그것을 따라 적은 배역표다.
어긋나면 `python3 _scripts/check-cast.py`가 깨진다 — 고치는 쪽은 항상 마인드봄이다.

    # saas-center-platform (:3502 · :3503)
    cd _tool/saas-center-platform && pnpm db:up && cd apps/api && uv run python -m scripts.seed.develop

    # mindbom (:4502 · :4503)
    cd _tool/mindbom && pnpm db:up && pnpm db:migrate && cd apps/api && uv run python -m scripts.seed

| | |
|---|---|
| 직원 | 김원장(ADMIN) · 이사무(MANAGER) · 박접수(STAFF) · 정상담 · 최치료(COUNSELOR) |
| 내담자 | 김민준(2019) · 김서연(2021, 남매) · 김영희(모, 본인도 상담) · 김철수(부) · 이하준(2016) · 이수진(모) · 박지우(성인) |
| 케이스 | 상담 C00001 박지우 4회 · C00002 이하준 3회 / 검사 AC0001 김영희 3회(MMPI_2 완료 · SCT 진행 · HTP 대기) |
| 그 밖 | 상담실 1 · 프로그램 개인상담·놀이치료 · 필드노트 3 · 검사 18종 매핑 |

마인드봄 쪽은 그 배역 중 **검사받는 다섯 명**(김민준 · 김서연 · 김영희 · 이하준 · 박지우)만 옮긴다 — 보호자는 오지 않는다.
검사 12건은 전부 **정상담(counselor1)** 담당이다. 마인드봄의 clinician은 본인이 검사자인 건만 보이므로, 다른 계정으로 로그인하면 화면이 빈다.
종합보고서 시연의 주인공은 **박지우** — 화면의 초안(우울감·직장 내 갈등)이 saas 상담 케이스 C00001과 같은 사람의 기록이다.
역할은 3:4로 다르게 매핑된다: 김원장·이사무 → admin, 박접수 → researcher(보고서 읽기 전용), 정상담·최치료 → clinician.

전체 표는 `_tool/saas-center-platform/apps/api/scripts/seed/README.md`. 촬영 전에 `./_scripts/seed-snapshot.sh`로 `_seed/<날짜>.json`을 박제한다 — 재시드하면 id가 바뀌고, meta의 seed sha256이 달라져 이전 테이크와 섞을 수 없다.

시드 밖의 인물(단체 접수 명단 등)은 `_mocks/`에서 지어낸 이름으로만 넣는다. 실명 데이터 금지.

## 목 에이전트

에이전트가 화면에 나오는 장면(s01 등)은 LLM을 부르지 않는다. 제품의 `mock-capture` 스킬
(`_tool/saas-center-platform/.claude/skills/mock-capture/SKILL.md`)이 서버와 같은 SSE 이벤트를 스크립트대로 흘려
매 테이크가 같아진다. 촬영 러너는 그 스크립트를 `--mock _mocks/sNN-*.json`으로 실어 보낸다 —
`/lab/agent-mock` 편집기를 손으로 거치지 않는다. 절차는 `capture-service` 스킬 참조.
