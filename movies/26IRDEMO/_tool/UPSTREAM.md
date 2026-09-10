# _tool — 촬영 대상 제품 소스 사본

두 폴더는 원래 **중첩 git 저장소(gitlink)** 였다. 부모 저장소는 커밋 SHA 하나만 기록하고 파일은 받지 않아서,
촬영용 수정(시드 · 프리셋 본문 · 드래그 앤 드롭 등)이 어디에도 커밋되지 않았다. 2026-09-10에 `.git`을 걷어내고
**보통 파일로 이 저장소에 넣었다.** 이후 `meta.app.commit`은 이 저장소(personal-movie)의 커밋이다.

| 폴더 | 원본 | 기준 커밋 (사본을 뜬 지점) |
|---|---|---|
| `mindbom/` | https://github.com/insightercorperation/mindbom.git `main` | `5e89cbd3e5f74c2bb5e7f6524b080cac06d483fb` |
| `saas-center-platform/` | https://github.com/insightercorperation/saas-center-platform.git `record-video` | `b6d7ceb94b9f4c4b3035a9c5b4e0d8ae619910ae` |

원본과 비교하려면: `git clone <원본> && git diff <기준 커밋> -- <경로>` 에 이 사본을 대조한다.
각 폴더의 `.gitignore`는 그대로라 `node_modules` · 빌드 산출물 · `.venv`는 여기서도 무시된다.
