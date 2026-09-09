# 26IRDEMO — 촬영 원본

아홉 장면(`_lab/research/04-artifacts/scenes9.html`)의 실제 서비스 캡처. 장면 번호는 그 문서와 1:1.

```
_lab/         조사 자료 (research/README.md)
_seed/        스테이징 시드 스냅샷 — 첫 촬영 전에 박제. 없으면 테이크끼리 섞을 수 없다
_scripts/     Playwright 조작 스크립트, 장면별 1개 (_lab/research/01-source/webapp-audit의 walkthrough에서 파생)
manifest.csv  file, scene, device, action, take, in, out, use, note — 최종 컷에 쓴 것만 use=Y
sNN-이름/
  raw/        OS 캡처 원본. 절대 덮어쓰지 않는다
  stills/     원본에서 뽑은 프레임 (png, 2x). 파일명 뒤에 타임코드
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

`_state/accounts.json` — 로컬(:3503) 센터 직원 5계정(김원장 admin · 이사무 manager · 박접수 staff · 정상담 counselor1 · 최치료 counselor2), 공통 비밀번호. 실계정 아님.
`_state/local-<key>.json` — 각 계정의 로그인 + 센터 선택 상태. 촬영 시 `--state _state/local-admin.json`처럼 넘긴다.

토큰이 만료되면 다시 만든다:

    for k in admin manager staff counselor1 counselor2; do
      CAP_EMAIL=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['accounts']['$k']['email'])") \
      CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:3503 --out _state/local-$k.json
    done

## 시드

스테이징 온빛심리상담센터 · 상담사 이봄결 · 내담자 서은우(신규 6세) / 이도윤(5회 진행, 노쇼 이력) / 한지우(성인, 4회 중 3회).
`_lab/research/01-source/webapp-audit/상담사의-하루-대본.md`의 인물 그대로. 실명 데이터 금지.
