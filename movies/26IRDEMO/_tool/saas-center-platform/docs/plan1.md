## 도메인
상담센터 관리용 SaaS 서비스
그 중 상담 관리에 집중 (아래 UI/UX 에서 핵심 도메일 추출해야함)
나머지 기타 도메인은 최대한 간단하게(예를들어 상담사나 내담자 등 기능 구현에 필요하나 최소 정보만)

## UI/UX
counseling-detail.png
counseling-list.png
counseling-edit.png

화면 참고해서 핵심 도메인 및 디자인 스타일, 핵심 컴포넌트 추출해서, 모듈화 해야함.
전체적인 스타일 한눈에 볼 수 있게 playbook 페이지 하나생성


## 방향성
1. 인터페이스 중심.
frontend는 어떤 페이지가 있고 각페이지에 어떤 이벤트가 발생하는지 중요하고,
라우터 관점에서 각페이지가 어떤 라우터가 있는지 정의하는게 중요.

2. 모듈형 + 확장
API 핸들러도, 선언형으로 조함하는 파일이 있고 각 핸들러가 별도파일로 존재하여 구조적으로 확장하기 유리해야함.
DB도 인터페이스를 정의하고 어댑터 형태로 구현해야함.


## 기술 스택
frontend는 sveltekit  사용하고, 단순 조회 부분은 svelte-query 를 쓰고, form 같이 수정이 일어나는 경우에만  svelte 자체 스토어 활용
backend는 fastapi 사용
database는 postgresql 사용
authentication은 jwt 사용





