# knowledge/ — 사용 모델 지식 대장

**모델 = 폴더, 주제 = 파일.** 실측된 사실만 적는다 — 벤더 주장은 출처를 달아 구분, 검증 전 관찰은
[hypotheses/](../hypotheses/README.md)에 open으로. 주제 파일은 해당 모델에 실측 지식이 있을 때만
만든다(억지 채움 금지).

## 구조·스키마

```
knowledge/{model}/
├── 특성.md       # 실측 강점·약점·성향 — 항목마다: 성질 | 수치 | 출처(D번호·랩·가설링크)
├── 학습방식.md   # 아키텍처·훈련이 행동에 남긴 결(구조·RL·thinking·제어 채널)
├── 계약.md       # 하드 제약 — 어기면 즉시 깨지는 것(라우팅·파라미터·불변식)
└── 운영.md       # 가용성·비용·승격/재평가 조건·관측 지표
```

각 파일 frontmatter:

```yaml
---
model: <모델 id 그대로>
topic: 특성 | 학습방식 | 계약 | 운영
updated: <최종 갱신일>
---
```

## 색인

| 모델 | 역할 | 주제 파일 |
|---|---|---|
| [laguna-s-2.1](laguna-s-2.1/) | 오케스트레이터(tool-use 루프), 2026-07-23~ | 특성 · 학습방식 · 계약 · 운영 |
| [gemini-3.1-flash-lite](gemini-3.1-flash-lite/) | responder(최종 발화), 2026-07-27~ | 특성 · 계약 · 운영 |
| [grok-stt-1.0](grok-stt-1.0/) | STT 후보 — 미채택·h06 E1 탐색 실측(조용한 절삭·언어 이탈), 2026-07-28 등재 | 특성 · 계약 · 운영 |
| [gemini-2.5-flash-lite](gemini-2.5-flash-lite/) | 바우처 캡처 1단 후보 — 미채택·h07/h08 실측(quote 최고·기권 약함) | 특성 · 계약 · 운영 |
| [claude-haiku-4.5](claude-haiku-4.5/) | 바우처 캡처 1위 후보 — h08 실측(기권 4/4·quote 재구성 성향) | 특성 |
| [claude-sonnet-5](claude-sonnet-5/) | 캡처 품질 상한 대조군 — h08 실측(값정확 93%·비용 40×) | 특성 |
| [gpt-5.4-nano](gpt-5.4-nano/) | 캡처 탈락(quote 48%)·정형화 콜 후보는 미실측 — h08 | 특성 |
| [gemini-2.5-flash](gemini-2.5-flash/) | 캡처에서 lite에 지배당함(기권 0/4) — h08 | 특성 |
