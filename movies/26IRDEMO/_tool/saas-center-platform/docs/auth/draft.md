질문 1-1: Auth 모듈이 담당해야 하는 범위는? 옵션 B
질문 2-1: Account가 Person 없이 존재할 수 있나요? 존재하지 않을수도 있음 (시스템 관리자 처럼)
질문 2-2: 로그인 시 반환되는 정보는? 옵션 B: Account + Person
질문 3-1: 인증 방식은? 옵션 C: Hybrid (JWT + Refresh Token in DB)
질문 3-2: Refresh Token을 DB에 저장하나요?  옵션 A: Refresh Token DB 저장
질문 4-1: 한 Account가 여러 센터에 접근할 때? 옵션 B: 로그인 후 센터 전환 API
질문 4-2: JWT Payload에 무엇을 포함할까? 옵션 C: Account + Person + Center + Role
질문 5-1: Password 저장 방식은? bcrypt (FastAPI 표준)
질문 5-2: Password 정책은? 옵션 B: 강력한 정책 (보안 중심)
질문 6-1: 소셜 로그인 지원 여부? 옵션 A: 지원 (Phase 2)
질문 6-2: 소셜 로그인 시 Account-Person 연결? Person 자동 생성
질문 7-1: 로그인 시도 제한? 옵션 A: IP 기반 제한
