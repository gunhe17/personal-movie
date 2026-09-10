# Round 12 — 바우처 — 발견(정부지원) vs 잔여(센터종속)

## 주제/긴장

T8: 바우처 두 갈래(정부지원 제도 발견 vs 센터종속 보유 바우처 잔여 조회)가 둘 다 MVP인가? "발견"은 R01에서 이미 exclude, "잔여"는 R01에서 R12 판정으로 defer된 상태로 들어온 라운드다. 핵심은 (1) 묶음 판정 거부, (2) 잔여를 MVP로 끌어올릴지 vs Phase2로 둘지, (3) 만약 Phase2라면 게이트가 카피만으로 충분한지.

## A · 옹호 주장 (근거 포함)

- **발견 exclude 유지** (code/roi): voucher 모듈 전체(client_voucher/center_voucher/voucher_extraction/voucher_document)가 센터종속 청구·카탈로그 도메인. 정부지원 제도DB·자격판정 엔진은 코드에 전무. 외부 제도DB+매칭엔진 신규구축이고 오안내 시 신뢰·법적 리스크가 동반자 정체성을 훼손. R01 3중 근거 번복할 새 사실 없음.
- **잔여 조회는 px 가치 분명** (px): 정부 바우처로 상담받는 보호자에게 "몇 회 남았고 언제 만료인지"는 "다음에 뭐 하지"만큼 강한 1차 행동 질문. remaining_sessions/valid_until 실재, 회당 차감되므로 전화로 묻던 마찰을 앱이 흡수. R09 자녀 회차진행 1급과 동일 멘탈모델.
- **잔여는 기존 패턴에 얹히는 저비용 확장** (code): ClientVoucher가 (center_id, client_id) 종속이라 R06 셀프 JWT 조회와 동일 패턴. 멀티센터도 center_id 필수라 R06/R09 N-call 머지에 흡수, 집계 엔드포인트 불필요. 자녀는 R09 인가헬퍼 재사용. 현 조회 전부 READ_VOUCHER 센터admin 게이트라 내담자 경로 0, 신규비용은 R04/R06/R07 동급의 인증게이트 교체+화이트리스트.
- **진실원이 외부 전자바우처 앱이라 신선도 리스크가 MVP를 막음** (roi): 모델 주석에 "잔여 회기·유효기간은 담당자가 수기 입력(사회서비스 전자바우처 앱이 진실)" 명시. 앱과 실제 잔액 불일치 시 "갔더니 0회" 경험으로 T10 신뢰붕괴. remaining_amount는 음수 허용 보정영역. 최종갱신일+진실원 카피 게이트 동반 필요로 Phase2 정당.
- **잔여는 소속홈 기능이고 R01 defer를 Phase2로 종결** (px): 연동 후에만 존재하므로 미소속 정체성과 무관. 신선도 게이트 조건부로 Phase2 소속홈 임상데이터 한 카드 종결. 묶음 MVP 판정 거부.
- **사용이력 월별집계 노출은 화이트리스트 밖** (code): usage/monthly는 BillableItem 차감내역의 단가·subsidy 노출, R06/R07 화이트리스트 밖. 잔여 메타(remaining/total_sessions/valid_until/최종갱신일)만 충분.

## B · 검증 반박 (근거 포함)

- **A의 핵심 코드 4사실 전부 검증 통과** (code): client_voucher/models.py 확인 — center_id+client_id 종속(24-33행), remaining_sessions/total_sessions(43-52행), valid_until(73행), 주석 15행 수기입력·전자바우처 진실원 명시, remaining_amount 음수 허용(61-65행). router.py 70/89/140/158행 모든 GET이 READ_VOUCHER 센터admin 게이트. A 주장 그대로다.
- **발견 exclude는 새 사실 없이 유지** (code): voucher 모듈 어디에도 제도DB·자격판정 로직 없음. R01 3중근거 뒤집을 코드 변화 없음. exclude 동의.
- **잔여 Phase2의 진짜 게이트는 카피가 아니라 신선도 신호의 부재** (code): A는 "최종갱신일" 카피 게이트면 된다지만 ClientVoucher에 동기화 시각 컬럼(last_synced_at)이 없다. updated_at은 센터 직원 임의 수정 시각이지 전자바우처 앱과의 동기화 시각이 아니다. 신선도를 정직하게 표현하려면 (a) updated_at을 "센터 최종수정"으로 정직 라벨링하거나 (b) last_synced_at 신규 컬럼+SaaS 입력 UI 추가가 필요. 이 결정이 Phase2 설계에 들어가야 진짜 T10 방어. 카피만으로 불충분.
- **사용이력·월별집계 제외는 화이트리스트 위반 방지로 정당** (code): schemas.py VoucherUsageItem(172 amount/173 subsidy_amount)·VoucherMonthlyUsageItem(196/197 동일)·CenterVoucherSummary(89 unit_price)는 단가·보조금 정산 필드. R06/R07 client-facing 화이트리스트 밖. 잔여 카드는 remaining/total_sessions/valid_until만으로 행동 질문 충족.
- **멀티센터 집계 엔드포인트 제외는 R06 정합** (code): ClientVoucher center_id 필수라 크로스센터 단일 쿼리 구조적 불가. N-call 시간순 머지로 동일 결과, 멀티 소수라 신규 집계 정당화 불가.
- **홈 다음일정 카드 인라인 잔여 표시 제외는 R06 LOCK 보존** (px): R06 카드 정보밀도 LOCK(날짜·D-day/대상·센터라벨/회차 한 줄/길찾기)에 잔여를 끼우면 0.5초 행동 응답 최소 적재 원칙 위반. 잔여는 별도 카드(소속홈/마이).
- **추가 제기 — 만료/소진 바우처 표시 정책** (px): valid_until 만료분·remaining_sessions 0을 완전제거 vs 비활성 표시할지가 R07 만료/회수 UX·R08 톤과 동일 차원. 혼란 방지 카피 통일 위해 잔여 본체와 함께 Phase2.

## 쟁점별 판정

| 기능 | A | B | 결정 | Phase | 이유 |
| --- | --- | --- | --- | --- | --- |
| 정부 바우처 발견·자격 매칭 안내 | exclude | exclude | **exclude** | - | code/roi: voucher 모듈 전체가 센터 청구 도메인, 제도DB·자격판정 엔진 코드 전무. 오안내 신뢰·법적 리스크로 동반자 정체성 훼손. R01 3중근거 번복할 새 사실 없음 |
| 잔여 바우처 조회 (소속홈·마이, JWT 화이트리스트 N-call 머지) | defer | defer | **defer** | Phase 2 | px: "몇 회 남았나"는 1차 행동 질문. code: (center_id,client_id) 종속이라 R06 셀프 JWT 패턴 저비용 흡수. 단 수기입력·외부 진실원이라 신선도 게이트 동반 Phase2 소속홈 |
| 잔여 조회 client-facing 화이트리스트 스키마 | defer | defer | **defer** | Phase 2 | code: 잔여 본체 동반. remaining_sessions/total_sessions/valid_until/센터명만, subsidy_amount·unit_price·remaining_amount(음수 보정) 비노출로 R06/R07 원칙 재사용 |
| 데이터 신선도 게이트 (갱신시각 표시 + 진실원 카피) | defer | defer | **defer** | Phase 2 | roi/code: 잔액 불일치 시 "갔더니 0회"로 T10 신뢰붕괴 방어. **B 조임 채택**: last_synced_at 컬럼 부재 — updated_at 정직 라벨링 vs 신규 동기화시각 컬럼 결정이 Phase2 설계 포함 필수. 카피만으로 불충분. R08 톤 연동 |
| 보호자 자녀 바우처 잔여 조회 (relation 1-hop 인가) | defer | defer | **defer** | Phase 2 | code: R09 인가헬퍼(person→본인Client→get_children→화이트리스트 주입)+화이트리스트 재사용으로 추가인가 0. 잔여 본체 종속 동반 Phase2 |
| 만료/소진 바우처 목록 표시 정책 | (미제기) | defer | **defer** | Phase 2 | px: valid_until 만료분·remaining 0을 완전제거 vs 비활성 표시할지 R07 만료/회수 UX·R08 톤과 동일 차원. **B 추가 채택**: 혼란 방지 카피 통일 위해 잔여 본체와 함께 Phase2 |
| 사용이력 월별집계 내담자 노출 | exclude | exclude | **exclude** | - | code/px: VoucherUsageItem·VoucherMonthlyUsageItem이 subsidy_amount·amount·unit_price 정산 필드 노출, R06/R07 화이트리스트 밖. 잔여 메타만으로 행동 질문 충분 |
| 신규 멀티센터 바우처 집계 엔드포인트 | exclude | exclude | **exclude** | - | code: center_id 필수라 크로스센터 쿼리 구조적 부재, N-call 머지로 동일결과. 멀티 소수로 정당화 불가. R06 제외 정합 |
| 홈 다음일정 카드에 잔여회기 인라인 표시 | exclude | exclude | **exclude** | - | code: R06 다음일정 카드 정보밀도 LOCK 위반. 잔여는 별도 카드(소속홈/마이) |

## 결정 요약

T8 묶음 판정은 거부한다. **발견은 exclude(번복 근거 없음), 잔여는 Phase2 소속홈 기능**으로 분리 종결한다. A와 B는 전 9개 featureCall에서 verdict 완전 일치했고, B가 A의 핵심 코드 4사실(center_id+client_id 종속, READ_VOUCHER 센터admin 게이트, 주석 15행 수기입력 진실원, remaining_amount 음수 허용)을 직접 라인 검증해 통과시켰다. 본 중재 검증에서도 client_voucher/models.py·router.py·schemas.py를 재확인해 동일 결과를 얻었다.

이번 라운드의 실질 산출은 두 가지 B 조임의 채택이다. (1) **신선도 게이트를 카피→데이터 결정으로 격상**: ClientVoucher에 last_synced_at이 없으므로 Phase2는 "updated_at을 '센터 최종수정'으로 정직 라벨링" vs "last_synced_at 신규 컬럼+SaaS 입력 UI 추가" 중 하나를 반드시 설계에 포함해야 진짜 T10 방어가 된다. updated_at을 동기화 시각인 양 "최종갱신"으로 표기하는 것은 오히려 거짓 신선도라 금지. (2) **만료/소진 표시 정책 추가**: valid_until 만료·잔여 0 바우처의 표시 방식(완전제거 vs 비활성)을 R07 만료/회수 UX·R08 톤과 통일.

R01 잔여 defer는 이로써 종결한다. 잔여는 연동 후에만 존재하는 (center_id,client_id) 종속 임상데이터이므로 소속홈/마이의 별도 카드로 두며, R06 다음일정 카드 정보밀도 LOCK·R06/R07/R09 화이트리스트·N-call 머지·집계 엔드포인트 제외 경계를 모두 그대로 계승한다. 클라이언트-facing 노출은 remaining_sessions/total_sessions/valid_until/센터명만이고 subsidy_amount·unit_price·remaining_amount(음수 보정 영역)·usage 차감내역은 정산 도메인이라 영구 비노출이다.

## 남은 질문

- **신선도 표현 방식 확정(Phase2 설계 핵심)**: updated_at "센터 최종수정" 정직 라벨링 vs last_synced_at 신규 컬럼+SaaS 입력 UI 추가. 후자는 마이그레이션+센터 입력 동선 비용, 전자는 동기화 시각이 아님을 카피로 솔직히 드러내야 함. 어느 쪽도 "최종갱신일=전자바우처 동기화 시각" 오인을 만들면 안 됨.
- **만료/소진 표시 정책 확정**: valid_until 경과·remaining_sessions 0 바우처를 목록에서 완전 제거할지 "만료됨/소진됨" 비활성 표시할지 — R07 검사결과 만료/회수 UX와 동일 차원이므로 통일 카피·톤(R08) 일괄 결정.
- **자녀 바우처 인가 정합**: R09 인가헬퍼(person→본인Client→get_children→화이트리스트 주입) 재사용 시 잔여 조회 화이트리스트에 자녀 ClientVoucher 주입 경계가 R06/R07 자녀 데이터 접근 인가와 동일 헬퍼로 묶이는지 Phase2 구현 시 확인.
- **fan-out 형태 정합**: 잔여 N-call 머지가 client N-call vs 서버 fan-out 후 합산 어느 쪽이든 R06 집계 엔드포인트 제외 결정과 모순 없는지(잔여 목록은 voucher 단위 단순 머지=집계 아님으로 정리). R06/R07/R09 셀프 조회들과 fan-out 정책 통일.
- **잔여 카드 위치**: 소속홈 임상데이터 영역의 어느 위계(R03 오브멘트>다음일정>미션>매거진)에 끼울지, 마이페이지 센터 카드 드릴다운과 중복 진입점 방지 — Phase2 소속홈 위계 라운드에서 배치.

## 다음 라운드로 이어받기

T8은 "발견 exclude / 잔여 Phase2 소속홈"으로 분리 종결됐고 R01 잔여 defer 빚을 청산했다. 잔여는 R06/R07/R09의 (center_id,client_id) 종속 JWT 화이트리스트 N-call 머지 패턴에 그대로 얹히는 저비용 확장이나, 진실원이 외부 전자바우처 앱이고 ClientVoucher에 동기화 시각 컬럼(last_synced_at)이 없어 신선도 게이트가 MVP를 막는다 — Phase2 설계는 updated_at 정직 라벨링 vs 신규 컬럼 결정과 만료/소진 표시 정책을 반드시 포함해야 T10을 방어한다. 클라이언트-facing 노출은 remaining_sessions/total_sessions/valid_until/센터명만이고 subsidy_amount·unit_price·remaining_amount·usage 차감내역은 정산 도메인이라 영구 비노출이다. 후속 라운드(R13 알림/FCM, R14 오브/콘텐츠)는 이 잔여 화이트리스트·신선도 게이트·다음일정 카드 LOCK·집계 제외 경계를 건드리지 말고, 잔여는 Phase2 소속홈 별도 카드로만 존재함을 전제한다.
