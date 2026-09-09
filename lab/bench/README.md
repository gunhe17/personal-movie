# video editing feasibility bench

브라우저에서 로컬 영상을 편집기 수준으로 다룰 수 있는지 실측한다.
드래그한 파일은 업로드되지 않는다 — `URL.createObjectURL()`로 브라우저 안에서만 처리된다.

## 실행

    python3 serve.py &
    open http://127.0.0.1:8777/index.html

영상 파일을 드롭하면 측정이 시작된다. 여러 개 동시 가능.
번들 baseline이 필요하면 먼저 `./make-test-videos.sh` (ffmpeg 필요).

정확한 수치를 원하면 throttling을 끈 전용 프로필로 띄운다:

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --user-data-dir=/tmp/bench-profile --no-first-run \
      --autoplay-policy=no-user-gesture-required \
      --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
      http://127.0.0.1:8777/index.html

## 측정 항목

| 항목 | 의미 |
|---|---|
| 첫 프레임 | 파일 → 첫 프레임 표시까지 |
| 재생 fps / 드롭 | 실시간 재생을 버티는지 |
| 프레임 스텝 | `currentTime`으로 1프레임 이동. **가장 중요** |
| 랜덤 seek | 스크러빙 / 클립 간 점프 |
| 컷 전환 | 다음 클립을 미리 seek해둔 상태의 컷 비용 |
| WC 디코드 | WebCodecs 처리량 (실시간 대비 배수 = 레이어 합성 예산) |
| WC 캐시프레임 | 디코딩된 프레임을 canvas에 그리는 실비용 |
| WC 점프 med/p95 | 키프레임부터 목표 프레임까지 디코딩 |

fps는 표시된 프레임의 `mediaTime` 간격으로 자동 감지한다 (포맷 무관, demux 불필요).

## 읽는 법

60Hz 화면에서 **16.7ms = vsync 1회 = 물리적 최소값**이다. 대부분의 수치가
16.7의 배수로 나오는 건 디코딩이 아니라 화면 주사율에 물렸다는 뜻이고, 곧 여유가 있다는 뜻이다.

WebCodecs가 미지원이거나 파일이 600MB를 넘으면 WC 항목만 건너뛰고 나머지는 측정한다
(mp4box가 파일 전체를 메모리에 올려야 해서다).

## 익스포트 벤치 (render.html)

    open http://127.0.0.1:8777/render.html?auto=1            # 전체, 약 4분
    open http://127.0.0.1:8777/render.html?auto=1&only=parallel   # 병렬 인코더만, 약 40초

WebCodecs `VideoEncoder`, `MediaRecorder`, ffmpeg.wasm의 익스포트 속도를 비교한다.
결과는 `render-result.json`. 공통 단위는 실시간 대비 배수 = (프레임수 / fps) / 경과시간.

## 쿼리 파라미터

- `?auto=1` — 번들 파일 자동 실행
- `?files=a.mp4,b.mp4` — 번들 목록 교체
- `?sweep=a.mp4&offsets=4.0,5.0` — 같은 파일에서 시작 위치만 바꿔가며 프레임 스텝 측정
  (GOP 내 위치에 따라 비용이 달라지는지 확인용)

결과는 화면에 표로 뜨고, 서버가 살아있으면 `result.json`으로도 저장된다.

## 개선 레버 벤치 (loop2.html)

    ./make-loop2-videos.sh                                   # 파생 클립 생성
    open http://127.0.0.1:8777/loop2.html                    # 전체, 약 4분
    open http://127.0.0.1:8777/loop2.html?only=e1,e3         # 개별 실험만

e1 스트림 복사 · e2 프록시 · e3 GOP 길이 · e4 썸네일 · e5 인코더 설정.
결과는 `loop2-result.json`.

## 개선 루프 3·4차

    ./make-loop3-videos.sh                                   # 5분 소스 생성
    open http://127.0.0.1:8777/loop3.html      # e1 혼합 타임라인 · e2 프록시비용 · e3 긴소스 · e4 썸네일 · e5 정규화
    open http://127.0.0.1:8777/loop4.html      # k1 스트리밍 색인 · k2 임포트비용 · k3 임의 컷

결과는 `loop3-result.json`, `loop4-result.json`.

## 보고서

- `report.html` — 1차: 프리뷰/프레임 단위 편집
- `report-render.html` — 1차: 익스포트 속도
- `report-loop2.html` — 2차: 개선 레버 5가지
- `report-loop3.html` — 3차: 스마트 렌더링이 깨지는 지점
- `report-loop4.html` — 4차: 수렴 판정과 최종 설계
- `data/` — 모든 보고서의 원본 측정값

## 공통 코드

`bench-core.js` — 측정 함수(디먹싱, 프레임 스텝, seek, fps 감지, 백프레셔 게이트).
`loop2.html`이 사용한다. `index.html`과 `render.html`은 이 파일보다 먼저 만들어져
자체 사본을 쓴다.
