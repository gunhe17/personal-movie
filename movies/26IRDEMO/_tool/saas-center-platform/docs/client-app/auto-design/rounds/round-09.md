# Round 09 — 보호자 멀티프로파일 & 권한/프라이버시

## 주제/긴장
보호자가 자녀 데이터(일정/회차/검사결과)를 앱에서 보는 멀티프로파일 모델과, 그 노출 범위를 통제하는 권한/프라이버시 게이트를 확정한다.
- 관련 긴장: **T7(자녀결과 노출범위, relation 기반 인가 신설)**
- 선결 결정: R2/R3(프로파일축=데이터 내장 자녀 섹션, 전역 스위처/▾ 제외), R4(link approve 시 Client.person_id 설정·1Person 1Client 중복 가드), R6(클라이언트 셀프 JWT 조회 엔드포인트 + client-facing 응답 스키마 화이트리스트 + 멀티센터 N-call 머지), R7(자녀 결과 열람을 "relation 인가=R9 소관"으로 defer), R8(인앱 셀프 응답 본체 Phase 2 연기 → 대리 응답 자동 보류).

## A · 옹호 주장 (근거 포함)
- **보호자 멀티프로파일은 "우리 애 어디까지 했지?"의 유일한 답이라 MVP**. 단 "권한"은 새 권한 시스템이 아니라 R4/R6/R7이 깐 레일 위에 **relation 1-hop 인가 1개**를 얹는 일로 한정.
- **(code) 자녀 데이터 접근 인가 = relation 1-hop 해석 단일 추가**: `ClientRelation(center_id, client_id, related_client_id, relation_type='guardian'/'child')` + `get_children(center_id, guardian_id)` 실존하나 모든 읽기 경로가 `READ_CLIENT`(센터 admin) 전용이라 Person 호출 경로 0. 신규 비용은 "JWT Person → 센터별 본인 Client(person_id 매칭) → get_children → 자녀 Client id 집합" 해석 헬퍼 1개. 그 뒤 R6/R7 화이트리스트의 participant_id에 "본인+인가 자녀"를 주입하면 끝. 신규 데이터 노출 경로 0.
- **(px) 멀티프로파일 = "전환"이 아니라 "자녀 섹션 누적"**: R2/R3에서 전역 스위처+▾는 가짜 어포던스·2D 격자 비용으로 제외. 보호자 멘탈모델은 "내 아이 단위", 자녀 1~2명이라 한 홈에 세로 누적이 "한눈에" 욕구에 부합. R9 신규 결정은 UI가 아니라 그 섹션을 채울 인가 백엔드.
- **(code) 프라이버시 게이트 = relation 존재 + R6/R7 화이트리스트(상담사 발행 의도) 재사용**: 자녀 결과도 "send_result 발행분만" 노출하면 "전체 PDF vs 요약"(T7) 긴장이 R7 경계와 동일. 자녀용 visibility enum/컬럼은 마이그레이션+SaaS 발행 UI 개편 강제하는 중복 진실원이라 불필요.
- **(code) 성인 자녀 제외는 link/relation 구조로 자동 처리**: 성인 자녀가 자기 Person으로 직접 link하면 자녀 Client.person_id=본인. 보호자 뷰 포함 여부는 "relation을 끊느냐"의 센터 운영 문제지 앱 정책 컬럼 문제 아님. birth_date는 nullable·정확성 문제로 fail-open 위험이라 MVP 미도입.
- **(code) 인가는 center-scoped 1-hop만, 크로스센터는 R6 N-call 머지에 흡수**. **(code) link 중복 가드(R4)와 relation 인가는 다른 차원** — R4가 본인 Client 무결성, R9가 자녀 1-hop 해석. **(roi) 대리 셀프 응답은 R8 응답 엔진에 종속이라 자동 보류**.

## B · 검증 반박 (근거 포함)
- **A의 코드 골격은 직접 검증으로 모두 사실**: `repository.py:33 get_children`가 `relation_type=='child' AND deleted_at IS NULL`로 자녀 row 조회, router 전체가 `require_permission`(admin) 게이트라 Person 경로 0, `link/models.py:17` 주석 "승인 시 Client.person_id 설정"으로 person→본인 Client 매칭 성립. 자녀 열람 3건·visibility 미신설 include.
- **(code) 정정: "1-hop 인가 1개"가 아니라 3단 연쇄**: (a)person→센터별 본인 Client 매칭 (b)get_children로 child row 해석 (c)화이트리스트 participant_id 집합 주입. 인가 검증 위치는 **Facade로 명시**. 인가의 단일 진실원이 "센터 관리자 수기 등록 relation row 품질"이라 **fail-open 표면이 코드가 아닌 운영 데이터**에 있다.
- **(code) 본인 Client 존재 보장 조건을 헬퍼가 명시 검증해야**: 보호자가 본인 상담은 안 받고 자녀만 등록된 케이스(순수 guardian role, 본인 Client에 person_id 미설정 가능)에서 get_children 진입점이 없을 수 있음.
- **(px) A의 "성인 자녀 제외=센터 운영 문제"를 리스크로 재프레이밍**: relation이 잘못 끊기면 fail-closed(과소노출, 안전)이나 잘못 남으면 fail-open. 자녀가 성인이 되어도 relation row가 남으면 보호자가 성인 자녀 임상데이터를 계속 봄. 앱이 relation 존재만 신뢰하는 순간 임상 프라이버시 리스크(T7)는 앱의 책임이 됨.
- **(code) 격상 #1 — 인가 헬퍼가 보호자 자격 + 1-hop을 코드로 강제(transitive 금지 LOCK)**: get_children는 단일 단계라 현재 transitive는 막히나 "1-hop child만"을 코드 계약으로 LOCK해야 미래 회귀 방지.
- **(code/px) 격상 #2 — 비주보호자(relation_detail=social_worker 등)/is_primary 무시 시 과다노출**: MVP는 "guardian relation 존재→child 1-hop" 단순화하되 **비주보호자 광범위 접근 정책은 R9 정책 결정 대상으로 명시**(되묻기 아닌 정책 플래그).
- 멀티프로파일 누적 모델·스위처 미부활·visibility 미신설·birth_date exclude·대리 응답 defer·미발행노트 exclude는 A와 전적으로 일치.

## 쟁점별 판정 (표)

| 기능 | A | B | 결정 | Phase | 이유 |
|---|---|---|---|---|---|
| 보호자→자녀 relation 1-hop 인가 헬퍼 (person→본인 Client→get_children→자녀 id 집합) | include | include | **include** | MVP | 자녀 열람의 유일한 핵심 신규 비용. R7 defer 빚 청산. 단 "1개"가 아니라 person매칭+get_children+화이트리스트주입 3단 연쇄, 검증 위치=Facade (code) |
| 인가 헬퍼 자격 조건 LOCK (본인 Client 존재 + guardian relation + child 1-hop만 + transitive 금지 코드 강제) | (암묵) | include | **include** | MVP | A의 암묵 전제를 명시 비용으로 격상. relation 존재만으로 두면 비주보호자/미래 transitive fail-open 표면. 헬퍼 계약으로 LOCK (code/px) |
| 보호자 자녀 일정/회차 진행 열람 (R6 엔드포인트에 인가 자녀 participant_id 주입) | include | include | **include** | MVP | R3 자녀섹션 1차 그룹핑·회차진행 보호자 1급. R6 participant_id=JWT client를 "본인+인가 자녀"로 확장, 노출 0·집합만 확장 (px/code) |
| 보호자 자녀 검사 결과 열람 (R7 /me/assessment-results에 자녀 case 포함, send_result 발행분만) | include | include | **include** | MVP | R7이 R9로 defer한 빚 청산. send_result 발행 게이트가 노출 통제, 자녀 case_id 화이트리스트 추가. visibility 컬럼 0 (code) |
| 프라이버시 게이트 = relation 존재 + send_result 발행 의도 재사용 (visibility enum 미신설) | include | include | **include** | MVP | R7 화이트리스트+라이프사이클이 T7 "전체PDF vs 요약"을 상담사 발행 책임으로 해결. 단 게이트 신뢰원이 relation row 운영 품질임을 명시 (code) |
| 멀티프로파일 = 홈 자녀 섹션 누적 (전역 스위처/▾ 미부활) | include | include | **include** | MVP | R2/R3 확정 R9 재확인, 번복 근거 없음. 보호자 멘탈모델 "한 화면 한눈에" (px) |
| 마이페이지 자녀 정보 카드 (F08, relation 기반 목록) | include | include | **include** | MVP | F08 명세 실존, 동일 인가 헬퍼 재사용, R3 빈영역 미노출 일치. 추가 인가 0 (px/code) |
| 멀티센터 자녀 데이터 통합 = 센터별 1-hop 해석 후 N-call 시간순 머지 | include | include | **include** | MVP | ClientRelation.center_id 필수로 크로스센터 쿼리 불가. R6 N-call 머지에 자녀 흡수, 집계 엔드포인트 불필요(R6 제외 정합) (code) |
| 비주보호자(social_worker 등)/성인 자녀 잔존 relation 접근 정책 | (운영 위임) | defer | **defer** | Phase 2 | B 채택. MVP는 "guardian→child 1-hop" 단순 모델, fail-closed 기본 유지. 비혈연·is_primary 제한·relation 만료는 임상 프라이버시 정책(비즈니스 결정)이라 Phase 2 (px/roi) |
| 보호자 자녀 배정 task 대리 셀프 응답 인가 | defer | defer | **defer** | Phase 2 | R8 인앱 셀프 응답 본체가 write-side net-new로 연기. 대리 응답은 본체 종속, 인가만 풀어도 가치 0. 응답 엔진 동반 설계 (roi) |
| 자녀 전용 공개수준 3단 enum/visibility 컬럼 (전체/요약/비공개) | exclude | exclude | **exclude** | - | R7 send_result+화이트리스트가 노출 통제. 별도 enum은 마이그레이션+SaaS UI 개편 강제 중복 진실원, R7 원칙 위반 (code) |
| birth_date 기반 만 N세 성인 자녀 자동 인가 차단 | exclude | exclude | **exclude** | - | birth_date nullable→null 시 fail-open. 성인 자녀 분리는 link/relation 구조 또는 잔존 정책(defer)으로, 부정확 연령 컬럼을 인가 게이트로 안 씀 (code) |
| 보호자 프로파일 전역 전환 스위처 + 이름 옆 ▾ | exclude | exclude | **exclude** | - | R2/R3 가짜 어포던스·2D 격자 비용 제외 확정, R9 번복 근거 없음. 전환은 마이탭, 누적으로 충족 (px) |
| 보호자→자녀 미발행 노트/내부메모/취소회차 노출 | exclude | exclude | **exclude** | - | R6/R7 화이트리스트가 비노출 LOCK. 자녀라고 확장 시 T10 위반, 인가 대상만 늘 뿐 노출 스키마 동일 (code/px) |

## 결정 요약
보호자 멀티프로파일은 MVP로 포함하되, **T7의 신규 비용은 "relation 1-hop 인가" 하나로 수렴**한다는 A의 골격을 채택하고, 여기에 B의 두 정정을 LOCK한다.

1. **신규 비용의 정확한 형태(B 채택)**: "1개"가 아니라 **person→센터별 본인 Client 매칭 → get_children(child 1-hop) → R6/R7 화이트리스트 participant_id 주입의 3단 연쇄**. 인가 검증은 **Facade에 위치**시켜 현 `WRITE/READ_CLIENT`(센터 admin) 권한과 충돌하지 않게 한다.
2. **인가 헬퍼 계약 LOCK(B 격상 채택)**: 헬퍼는 "relation 존재"만 신뢰하지 않고 **(a)본인 Client 존재 보장 (b)본인이 guardian relation 보유 (c)child 1-hop만 — transitive 금지를 코드로 강제**를 계약으로 명시한다. fail-open 표면이 코드가 아닌 "센터 관리자 수기 relation row 품질"에 있음을 명시 LOCK한다.
3. **자녀 열람 3건(일정/회차, 검사결과)은 R6/R7 화이트리스트에 인가된 자녀 id를 주입**하는 방식으로, 신규 데이터 노출 경로 0·신규 visibility 컬럼 0. R7이 "relation 인가=R9 소관"으로 미뤄둔 빚을 청산.
4. **멀티프로파일 UI는 "자녀 섹션 누적" 모델 유지**(R2/R3 재확인) — 전역 스위처/▾ 부활 없음.
5. **비주보호자/성인 자녀 잔존 relation 과다노출 정책은 Phase 2로 defer(B 채택)** — MVP는 fail-closed 기본의 단순 모델. 이는 A의 "센터 운영 문제" 프레이밍을 "앱이 relation 존재만 신뢰하면 그 순간 앱 책임이 되는 프라이버시 리스크"로 재정의해 정책 결정 대상으로 격상한 것.
6. **대리 셀프 응답 defer / visibility enum·birth_date 게이트·전역 스위처·미발행 노출 exclude**는 양측 일치.

이전 결정 번복: 없음. R2/R3/R6/R7/R8 경계를 모두 보존하며 R7의 자녀 결과 defer만 청산. A의 "1-hop 인가 1개" 비용 최소화 프레이밍을 "3단 연쇄 + 헬퍼 자격 계약 LOCK"으로 정정(번복 아닌 비용 명시 강화).

## 남은 질문
- 인가 헬퍼 구현 위치 확정: Facade 단일 헬퍼로 둘지(R6 셀프 회차 + R7 결과 목록 양쪽이 공유), 본인 상담 없이 자녀만 등록된 보호자(순수 guardian role)의 본인 Client/person_id 부재 케이스에서 진입점 보장 방식.
- 비주보호자(relation_detail=social_worker 등)·is_primary 비주보호자의 자녀 데이터 접근 범위 정책(Phase 2): is_primary=true만 전체 접근 vs 모든 guardian relation 접근 — 임상 프라이버시 비즈니스 결정.
- 자녀가 성인 도달 시 relation 잔존으로 인한 fail-open 차단 정책(Phase 2): relation 만료/검토 트리거를 센터 운영 프로세스로 둘지 앱 측 안전장치를 둘지.
- 멀티센터 자녀 N-call 머지의 부분 실패 폴백이 R6 본인 데이터 폴백(성공 센터만+하단 배너)과 동일 처리되는지, 자녀 섹션별 실패 표현.
- F08 자녀 정보 카드의 정보 범위(기본정보 화이트리스트)가 R6/R7 임상 화이트리스트와 별개 항목(이름/생년 등)일 때 노출 경계 — 마이페이지 라운드와 연동.
- 대리 셀프 응답(Phase 2)이 R8 응답 엔진과 동반 설계될 때 자녀 task participant 인가가 본 라운드 열람 인가 헬퍼를 write-side로 재사용 가능한지.

## 다음 라운드로 이어받기
T7의 신규 비용은 **relation 1-hop 인가**로 수렴하며, 그 정확한 형태는 "person→본인 Client→get_children(child 1-hop)→R6/R7 화이트리스트 주입"의 **3단 연쇄(Facade 위치)**이고, 헬퍼는 relation 존재만 신뢰하지 않고 **본인 Client 존재+guardian 자격+1-hop/transitive 금지를 코드 계약으로 LOCK**한다. 자녀 일정/회차/결과 열람 3건은 MVP(신규 노출 0·visibility 0)로 R7 defer 빚을 청산했고, 멀티프로파일 UI는 자녀 섹션 누적(스위처 미부활)로 재확인됐다. **비주보호자/성인 자녀 잔존 relation 과다노출 정책과 대리 셀프 응답은 Phase 2**로 명시 연기됐다(fail-open 표면이 센터 운영 relation row 품질에 있음을 인지). 후속 라운드는 이 인가 헬퍼 계약과 화이트리스트 경계를 건드리지 말고 남은 영역(마이페이지/F08 정보 범위·알림·오브 비주얼 등)을 채우되, 자녀 데이터 접근은 본 라운드의 1-hop 인가 계약을 단일 진실원으로 재사용한다.
