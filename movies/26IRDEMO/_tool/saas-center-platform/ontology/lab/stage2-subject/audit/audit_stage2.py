# 감사 스케치 — audit_query_filters.py와 동일한 문화
# 1) 무결성: generated/* 헤더의 source-hash ↔ 현재 온톨로지 해시 비교
#    불일치 = 손 편집 또는 재생성 누락 → 실패
# 2) 커버리지: ontology actions 선언 vs generated/ 파일 존재 — 갭 0
# 3) 승격 추적: services/에 같은 이름 수제 파일이 있으면 generated/에 잔재 금지
