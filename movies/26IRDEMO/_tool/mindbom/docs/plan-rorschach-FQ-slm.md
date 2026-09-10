로샤(Rorschach) FQ 자동 채점 시스템 기획 명세서
시스템 개요: Vector DB (유사도 검색) + Context-Aware SLM (지각적 타당성 심사) + Active Learning (자승 학습 피드백 루프)

1. 시스템 아키텍처 개요 (Architecture Overview)
   본 시스템은 Vector DB를 통한 고속 후보 검색(Recall)과 Context-Aware SLM을 통한 형태 지각적 정밀 심사(Precision)를 결합한 3-Tier 하이브리드 파이프라인입니다.

임상가의 피드백이 누적될수록 Exact Match 및 High-Confidence Vector Search 비율이 높아져, 시스템 전체의 처리 속도와 정확도가 지속적으로 상승합니다.

[전체 파이프라인 흐름]
입력 데이터: 카드 번호, 위치 코드, 반응, 질문-응답(Inquiry), 결정인, 내용

Tier 1 (Exact Match Lookup): In-Memory Hash 기반 즉시 매칭 (매칭 실패 시 Tier 2로 이동)

Tier 2 (Vector Search Engine): ChromaDB에서 유사도 높은 상위 K개 FQ 후보 추출 (k=3~5)

Tier 3 (SLM Perceptual Evaluator):

결정인 내 형태(Form) 성분 포함 여부 검증 (Pure Non-Form 시 FQ_none 처리)

Inquiry 텍스트 기반 형태 지각적 적합성 심사

Human-in-the-Loop Review UI: 임상가 최종 검수 및 확정

Active Learning Engine (자승 학습): JSON DB 오토 업데이트, Vector DB 재인덱싱, 원자적 파일 쓰기(Atomic Write) 및 백업

2. 3-Tier FQ 처리 알고리즘 기획
   Tier 1: Exact Match (즉시 매칭)
   목적: 1ms 미만의 초고속 처리 및 기존 확정 데이터에 대한 환각(Hallucination) 0% 보장.

로직: 내담자의 반응 키워드가 JSON DB의 해당 카드/위치 데이터 내 content_keyword와 100% 일치하면 즉시 해당 FQ를 확정.

Tier 2: Vector Similarity Search (의미/지각 유사도 검색)
목적: 내담자의 비유적 표현, 오탈자, 단어 변형(예: "나비" ↔ "호랑나비") 대처 및 SLM 연산 부하 절감.

로직:

내담자 반응 및 Inquiry 텍스트를 고차원 임베딩 벡터로 변환.

Vector DB에서 동일 카드/위치 내 상위 3~5개 FQ 후보를 추출.

Fast-Track: 최상위 후보의 코사인 유사도가 기준치(예: 0.92 이상)를 넘으면 SLM 호출 없이 FQ 확정.

Tier 3: SLM Perceptual Evaluator (지각적 정밀 심사)
목적: 희귀 반응(FQ_u)의 보존 및 Vector DB의 노이즈(오답) 걸러내기.

로직:

Rule-Based Guardrail: 결정인에 형태 성분(Form, F)이 전무하면 무조건 FQ_none 처리.

Context Combination: [내담자의 위치 설명 + Inquiry 묘사]와 [Vector DB 후보 3개의 FQ 지각 근거]를 결합하여 SLM 프롬프트에 주입.

SLM이 형태 지각적 타당성을 심사하여 최종 FQ와 확신도(Confidence Score)를 출력.

3. 데이터 스키마 명세 (JSON Schema)
   각 카드별(Card_1.json ~ Card_10.json) 메인 레포지토리 저장 구조입니다.

card_number: 카드 번호 (1~10)

locations: 카드 내 위치 구역별 객체 (W, D1, D2 등)

id: 항목 고유 식별자 (예: "card1_W_001")

content_keyword: 반응 내용 키워드 (예: "나비")

fq: 형태질 코드 ("o", "u", "-", "none")

determinant_hint: 권장 결정인 리스트 (예: ["F", "FC"])

perceptual_rationale: 형태 지각적 타당성 사유/근거 텍스트

source: 데이터 출처 ("pre_built", "clinician_verified", "pending_review")

confirmed_count: 임상가 확정 누적 횟수

created_at: 생성 및 업데이트 일자

4. SLM 프롬프트 템플릿 (Prompt Templates)
   4.1. System Prompt
   [SYSTEM PROMPT]

당신은 로샤(Rorschach) 성격검사의 형태질(Form Quality, FQ)을 정밀하게 판정하는 20년 경력의 최고급 임상심리 전문가입니다.

당신의 역할은 내담자의 반응(Response), 질문-응답(Inquiry), 위치(Location), 결정인(Determinant) 맥락을 분석하고, 1차 검색 시스템(Vector DB)이 찾아낸 [FQ 후보 목록] 중 지각적으로 가장 타당한 최종 FQ를 엄격하게 선택하거나 교정하는 것입니다.

[FQ 판정 규칙 및 평가 원칙]

FQ 코드 정의:

FQ_o (Ordinary): 해당 카드 구역에서 대중적으로 관찰되는 보편적이고 형태적으로 우수한 지각.

FQ_u (Unusual): 대중적이지는 않으나(희귀하지만), 내담자가 설명한 윤곽선과 형태적 특성이 명확히 부합하는 지각.

FQ\_- (Minus): 형태 지각이 심하게 왜곡되었거나, 카드 구역의 실제 윤곽선과 부합하지 않는 비현실적 지각.

FQ_none (None): 결정인에 형태(Form, F) 성분이 전혀 포함되지 않은 pure 반응(예: Pure C, Pure Y, Pure m 등).

FQ_none 예외 규칙 (최우선 적용):

결정인(Determinant)에 형태 요소(F, FC, CF, FM 등)가 전혀 없는 경우, Vector DB의 후보와 무관하게 무조건 "FQ_none"으로 판정하십시오.

지각적 적합성 평가 기준:

내담자의 Inquiry 텍스트에서 언급한 형태적 특징(윤곽선, 세부 구조, 기하학적 모양)이 후보 항목의 형태와 부합하는지 정밀 검증하십시오.

단어 자체의 유사성보다 "내담자가 시각적으로 어느 부분을 어떻게 보았는지"의 지각적 일치성을 최우선으로 평가하십시오.

출력 형식:

반드시 지정된 JSON 구조로만 결과를 출력하십시오.

4.2. User Prompt Template
[USER PROMPT]

다음 내담자의 로샤 반응 정보와 Vector DB 검색 결과를 바탕으로 최종 FQ를 정밀 판정하십시오.

내담자 반응 프로필 (Context)

카드 번호 (Card): {card_number}

위치 코드 (Location Code): {location_code}

위치 구역 설명 (Location Detail): {location_detail}

내담자 반응 (Response): "{response_text}"

질문-응답 (Inquiry): "{inquiry_text}"

사전 분류된 결정인 (Determinant): {determinant}

사전 분류된 내용 (Content): {content}

Vector DB 추천 FQ 후보 목록 (Top-K Candidates)

{vector_db_candidates}

[지시 사항]

위 제공된 정보를 바탕으로 다음 단계에 따라 사고(Chain-of-Thought)한 뒤 최종 결과를 출력하십시오.

Determinant 검증: 결정인({determinant})에 형태(Form) 성분이 존재하는지 확인하십시오.

지각적 타당성 검증: 내담자의 Inquiry("{inquiry_text}")에서 묘사된 윤곽선/특징이 Candidate 후보들의 FQ 기준과 지각적으로 일치하는지 심사하십시오.

희귀 반응 및 DB 오염 평가:

후보 중 유사도가 높더라도 내담자가 묘사한 형태와 부합하지 않으면 노이즈(오답)로 판단하고 배제하십시오.

DB 후보에 똑같은 단어가 없더라도, 내담자의 지각적 설명이 명확하다면 FQ_u로 승격 판단할 수 있습니다.

[출력 Format]

반드시 아래 키 항목을 포함하는 JSON 형식으로만 답변을 작성하십시오.

chain_of_thought: 판단 이유 간략히 작성

final_fq: o | u | - | none 중 택 1

confidence_score: 0.0 ~ 1.0 실수

selected_candidate_id: 선택된 candidate id 또는 null

is_rare_response: true | false

flag_for_human_review: true | false

5. 자승 학습(Active Learning) 및 DB 오염 방지 기획
   5.1. 피드백 수집 및 데이터 승격 프로세스
   임상가 검수 UI (Human-in-the-Loop): SLM 판정 결과와 확신도를 임상가에게 제시.

권한별 인덱싱 분기:

수석/전문 임상가 승인: 단 1회 확정만으로 source: clinician_verified 상태로 정식 DB 인덱싱 (희귀 명답 보존).

수련/일반 임상가 승인: source: pending_review 상태로 저장 후 2회 이상 동일 FQ 누적 시 정식 인덱싱.

충돌 처리(Conflict Resolution): 동일 단어에 서로 다른 FQ 피드백이 들어올 경우 충돌 경고 플래그를 세우고 임상가 승인 대기열(Review Queue)로 이관.

5.2. 안정성 및 데이터 보호 기획
Atomic File Write: JSON 파일 업데이트 시 백업 파일(.bak) 생성 후 임시 파일(.tmp) 기록 및 교체 방식을 적용해 파워 오프/오류 시 데이터 깨짐 방지.

1-Click Undo: 실수로 입력된 피드백을 즉시 취소/삭제할 수 있는 UI 이력 관리 기능 포함.
