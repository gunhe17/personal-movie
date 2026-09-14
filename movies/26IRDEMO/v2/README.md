# 26IRDEMO v2 — 생성 영상

v1은 실제 서비스 화면을 촬영해 만들었다. **v2는 첫 프레임을 생성해 영상으로 잇는다.**
서비스 화면 촬영은 여전히 `capture-service`가 한다 — 이 폴더는 그 바깥의 세계를 만든다.

```
_research/   조사 (12편). 무엇을 근거로 무엇을 정했는지
_lab/        시험. 01 = 첫 프레임 모델 선정
_production/ cuts.json(정본 샷리스트) · storyboard.html · briefs · status
_assets/     여러 컷에 걸치는 자산 — steps/(씬 상단 절차 표시줄)
sNN-cN-이름/ 컷 폴더 — 스토리보드 컷 번호와 1:1 (s01-c9 = C1.9)
             AI 컷: prompt.md · meta.json · rN/ · first-frame.png
                    영상: motion.md · motion.json · tN/ · CN.N_ai.mp4 (frame-to-video 채택본)
             무대 컷: CN.N_무대.mp4 · CN.N.json(spec)
sNN-이름/    촬영 원본 raw/ · stills/ — 컷 번호가 없다 (촬영 규칙상 옮기지 않는다)
_dropped/    내린 컷 (첫 프레임 폴더 · 목업)
```

**첫 프레임을 만드는 것은 [`first-frame` 스킬](../../../.claude/skills/first-frame/SKILL.md)이다.**
아래 결정이 그 스킬의 실행 규격으로 굳어 있다 — 프롬프트 린트가 랩에서 찾은 실패 둘을 막는다.

## 정해진 것

| | |
|---|---|
| **첫 프레임 모델** | **Kling o3** `modelId 2189` · 2K · 16:9 · 정액 100 크레딧 |
| 확정 근거 | [_lab/01-model-bakeoff/DECISION.md](_lab/01-model-bakeoff/DECISION.md) |
| 프롬프트 문법 | 같은 문서 §확정된 프롬프트 문법 |
| 도구 | `first-frame` 스킬 · Artlist MCP(`.claude/skills/artlist/`) |
| **영상 모델** | **Kling 3.0 base** `modelGroupId 349` · Pro 1080p · 무음 · 끝 프레임 없음 — [`frame-to-video` 스킬](../../../.claude/skills/frame-to-video/SKILL.md) · 근거 [_research/16](_research/16-kling3-video-official.md) · [17](_research/17-kling3-i2v-field.md) |

## 읽는 순서

1. **[_lab/01-model-bakeoff/DECISION.md](_lab/01-model-bakeoff/DECISION.md)** — 결정과 그 근거. 여기부터
2. [_research/README.md](_research/README.md) — 조사 12편의 색인이자 종합
3. `_lab/01-model-bakeoff/report.html` — 프롬프트 전문과 결과 16장을 나란히 놓은 리포트

## 조사에서 나온 것 중 쓰기 전에 알아야 할 것

- **"Kling O3"는 공식 명칭이 아니다.** 공식은 `Image 3.0 Omni`. Artlist에서 이 이름이
  **이미지(354)와 영상(347) 두 모델**을 가리킨다. 별개 줄기인 `Kling v3`는 기본 등급이라 쓰지 않는다
- **네거티브 프롬프트 필드가 없다.** 영어 부정문은 억제가 아니라 **소환**으로 작동한다.
  배제는 전부 긍정문으로 뒤집는다
- **짧게 쓰면 안 된다.** Prompt Enhancer가 내장돼 있어 모델이 멋대로 채운다. 400~1,200자
- **시드가 없다.** 재현이 불가능하다. 좋은 결과는 즉시 로컬로 내려받는다
- **생성물은 30일 뒤 서버에서 삭제된다**
- **SKU 이름을 믿지 말 것.** Artlist의 표기가 실제 해상도와 어긋난다.
  호출 결과의 `resolvedSettings`로 확인한다
- **정확한 16:9를 내는 모델이 없다.** 2720×1536 = 1.771. 촬영본(3200×1800 = 1.778)과 화소가 안 맞는다

## 비용 감각

| | 크레딧 |
|---|---|
| 첫 프레임 2K **9장** (Kling o3) | **100** |
| 영상 1080p 5초 무음 | 500 |
| 영상 1080p 5초 유음 | 800 |

**후보를 많이 뽑는 것은 사실상 공짜고 영상이 비싸다.** 프레임 단계에서 충분히 고르고 영상 호출을 아낀다.
