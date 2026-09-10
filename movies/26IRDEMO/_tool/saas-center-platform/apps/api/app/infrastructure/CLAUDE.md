# CLAUDE.md — apps/api/app/infrastructure

이 디렉터리(인프라 어댑터)를 추가/수정/리팩토링할 때 **반드시** 아래를 따른다.

## 권위 문서 (작업 전 확인)
- **설계 규칙**: [guide.md](./guide.md) — 폴더 표준, 추상화(base 패턴), 입출력 계약, 예외(§4), 주석 §7, factory(§5), **부록 C 흔한 실수 + 자가 점검 체크리스트**.
- **실행/codemod 규칙**: [.claude/rules/api/infra-refactor-codemod.md](../../../../.claude/rules/api/infra-refactor-codemod.md) — sed 자기훼손·substring 함정, `git mv` 폴백, Edit 전 Read, **AST 동치 증명**, 대량변경 규모 고지.

## 표준 구조 (provider-추상화 모듈)
```
{module}/
├── factory.py            # 모든 get_X() 취득 진입점 (유일)
├── common/               # base(계약)·schemas(DTO)·exception·cost/util — 프리미티브 전용
└── {provider|mode}/client.py   # impl 클래스 (root에 impl 금지)
```
- **root엔 `factory.py`·`__init__`(docstring)·`common/`만.** impl은 예외 없이 `{provider|mode}/`.
- 비대상: `persistence`(DB 커널)뿐. 그 외(hash·token·scheduler 포함)는 단일 impl이어도 표준 적용.

## codemod 필수 가드 (소비처 일괄 변경 시)
1. 모듈 **자기 디렉터리 제외**하고 sed (자기 `factory.py` 훼손 방지).
2. 함수명 sed 전 **substring 충돌**(`_name`) 확인 — 파일별 스코프.
3. **인자순서/시그니처 변경은 호출처 before→after 직접 검토** (특히 auth — 테스트가 소비처 인자오류 못 잡음).
4. 변경 후 **옛 경로/심볼 잔재 0** + import 스윕 + 소비처 compile 검증.

## 민감 모듈 (persistence·hash·token)
- 주석/docstring만 정리할 때 **AST(docstring 제거) 비교로 기능 동치 증명**. `mapped_column(comment=...)`·`# type:`는 보존.
