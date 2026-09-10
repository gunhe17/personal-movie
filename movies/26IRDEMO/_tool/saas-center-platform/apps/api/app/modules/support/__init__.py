# 루트 소비처 없음(main.py가 .router 직접 import) → 빈 패키지([package-init.md] §2).
# router를 여기서 re-export하면 application↔module 순환 import 발생.
