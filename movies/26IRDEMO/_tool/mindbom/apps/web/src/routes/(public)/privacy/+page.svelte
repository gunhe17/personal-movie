<script lang="ts">
  const EFFECTIVE_DATE = '2026년 7월 1일'
  const COMPANY_NAME = '주식회사 인사이터'
  const SERVICE_NAME = '마인드봄'
  const SERVICE_NAME_EN = 'MindBom'
  const SUPPORT_EMAIL = 'support@insighter.co.kr'
  const CPO_NAME = '장호준'
  const CPO_EMAIL = 'privacy@insighter.co.kr'
</script>

<svelte:head>
  <title>개인정보처리방침 | {SERVICE_NAME}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
    <div class="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
      <h1 class="text-lg font-semibold text-gray-900">개인정보처리방침</h1>
      <a
        href="/login"
        class="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        돌아가기
      </a>
    </div>
  </header>

  <!-- Content -->
  <main class="mx-auto max-w-4xl px-6 py-10">
    <div class="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm sm:px-12">
      <p class="mb-4 text-sm text-gray-400">시행일: {EFFECTIVE_DATE}</p>
      <p class="mb-8 text-[15px] leading-relaxed text-gray-600">
        {COMPANY_NAME}(이하 "회사")은 「개인정보 보호법」, 「의료법」, 「의료기기법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등
        관련 법령에 따라 이용자 및 내담자(피검자)의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록
        다음과 같이 개인정보처리방침을 수립·공개합니다. 본 방침은 SaMD 2등급 의료기기 소프트웨어 "{SERVICE_NAME}({SERVICE_NAME_EN})"의 운영에 적용됩니다.
      </p>

      <!-- 핵심 요약 라벨링 -->
      <section class="mb-10 rounded-xl border border-blue-200 bg-blue-50/50 p-6">
        <h2 class="mb-4 text-base font-bold text-blue-900">개인정보처리방침 핵심 요약</h2>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-blue-200">
                <th class="px-4 py-2.5 text-left font-semibold text-blue-800">항목</th>
                <th class="px-4 py-2.5 text-left font-semibold text-blue-800">처리 내용</th>
                <th class="px-4 py-2.5 text-left font-semibold text-blue-800">관련 조항</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-blue-100">
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">수집 및 이용</td>
                <td class="px-4 py-2.5 text-gray-600">검사자 계정, 기관 정보, 검사 데이터(그림·음성·문장 응답, 위탁 저장)</td>
                <td class="px-4 py-2.5 text-gray-500">제1조, 제2조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">민감정보 처리</td>
                <td class="px-4 py-2.5 text-gray-600">정신건강 진단 보조 데이터(건강정보) — 이용자(기관)가 별도 동의 획득</td>
                <td class="px-4 py-2.5 text-gray-500">제1조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">보유 기간</td>
                <td class="px-4 py-2.5 text-gray-600">탈퇴 후 30일 내 파기. 의료기록은 법정 5~10년 별도 보존</td>
                <td class="px-4 py-2.5 text-gray-500">제3조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">AI 처리</td>
                <td class="px-4 py-2.5 text-gray-600"><strong>폐쇄형 sLLM 자체 운영 — 외부 범용 AI API 미사용</strong></td>
                <td class="px-4 py-2.5 text-gray-500">제5조, 제8조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">위탁 업체</td>
                <td class="px-4 py-2.5 text-gray-600">클라우드 인프라(국내 리전), 메일 발송 대행</td>
                <td class="px-4 py-2.5 text-gray-500">제5조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">보안 조치</td>
                <td class="px-4 py-2.5 text-gray-600">암호화, HTTPS, RBAC, 감사추적, 접속 기록 2년 보관, GMP</td>
                <td class="px-4 py-2.5 text-gray-500">제8조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">이용자 권리</td>
                <td class="px-4 py-2.5 text-gray-600">열람·정정·삭제·처리정지·데이터 전송 요구</td>
                <td class="px-4 py-2.5 text-gray-500">제6조</td>
              </tr>
              <tr>
                <td class="px-4 py-2.5 font-medium text-gray-800">고충 처리</td>
                <td class="px-4 py-2.5 text-gray-600">개인정보 보호책임자 ({CPO_EMAIL})</td>
                <td class="px-4 py-2.5 text-gray-500">제10조</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="space-y-12 text-[15px] leading-relaxed text-gray-700">

        <!-- 제1조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제1조 (개인정보의 수집 항목 및 수집 방법)</h2>

          <h3 class="mb-3 mt-4 text-base font-semibold text-gray-800">1. 수집 항목</h3>

          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">구분</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">수집 항목</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">수집 시점</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">회원가입 (필수)</td>
                  <td class="px-4 py-3 text-gray-600">이메일 주소, 비밀번호(암호화 저장), 이름</td>
                  <td class="px-4 py-3 text-gray-600">회원가입 시</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">자격 검증 (필수)</td>
                  <td class="px-4 py-3 text-gray-600">임상심리사·정신건강의학과 전문의 등 면허·자격 번호</td>
                  <td class="px-4 py-3 text-gray-600">기관 멤버 등록 시</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">기관 등록 (필수)</td>
                  <td class="px-4 py-3 text-gray-600">기관명, 종별(의료기관/심리검사센터/연구기관), 사업자등록번호 또는 의료기관 개설 신고번호, 기관 연락처, 주소</td>
                  <td class="px-4 py-3 text-gray-600">기관 등록 신청 시</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">자동 수집</td>
                  <td class="px-4 py-3 text-gray-600">접속 IP, 접속 일시, 브라우저 정보, 서비스 이용 기록, 감사추적 로그, 쿠키</td>
                  <td class="px-4 py-3 text-gray-600">서비스 이용 시 자동 생성</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h4 class="mb-2 text-sm font-bold text-orange-800">내담자(피검자) 검사 데이터에 관한 특별 안내</h4>
            <p class="text-sm text-orange-700">
              서비스를 통해 이용자(기관)가 입력·관리하는 내담자 검사 데이터(이름, 생년월일, 성별, HTP 그림 이미지, 로르샤하 음성 녹취·전사,
              SCT 문장 응답, 사후 인터뷰(PDI), AI 분석 초안의 임상심리사 확정본, 통합 보고서 등)는
              <strong>이용자(기관)가 개인정보처리자로서 직접 수집</strong>하는 정보입니다. 회사는 이용자(기관)로부터 해당 데이터의 처리를
              위탁받아 기술적으로 저장·관리·분석하는 <strong>수탁자</strong>의 지위에 있으며, 이용자(기관)는 내담자 또는 그 법정대리인으로부터
              적법한 동의를 획득할 책임이 있습니다.
            </p>
            <p class="mt-2 text-sm text-orange-700">
              <strong>투사적 심리검사 결과는 「개인정보 보호법」상 민감정보(건강에 관한 정보)에 해당합니다.</strong>
              이용자(기관)는 내담자로부터 별도의 민감정보 수집·이용 동의를 받아야 하며, 회사는 수탁자로서 해당 민감정보에 대해
              암호화 저장, 접근 통제, 감사추적, 폐쇄망 AI 처리 등 강화된 기술적·관리적 보호 조치를 적용하고 있습니다.
            </p>
          </div>

          <div class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <h4 class="mb-2 text-sm font-bold text-indigo-800">아동 내담자에 관한 안내</h4>
            <p class="text-sm text-indigo-700">
              본 서비스는 아동·청소년 대상 투사적 심리검사를 주된 활용 영역으로 합니다. 이용자(기관)는
              <strong>만 14세 미만 아동</strong>의 개인정보를 처리하는 경우 「개인정보 보호법」 제22조에 따라
              <strong>법정대리인의 동의</strong>를 반드시 받아야 합니다. 회사는 이를 지원하기 위한 동의서 양식 및 가이드라인을
              기관 관리자 페이지를 통해 제공합니다.
            </p>
            <p class="mt-2 text-sm text-indigo-700">
              회사가 진행하는 임상시험(예: 만 6~12세 아동 대상 탐색임상시험)에 참여하는 내담자의 데이터는 별도의 임상시험
              심사위원회(IRB) 승인을 받은 동의서에 따라 처리되며, 본 방침과는 별개로 임상시험 동의서·연구 계획서가 우선합니다.
            </p>
          </div>

          <h3 class="mb-3 mt-6 text-base font-semibold text-gray-800">2. 수집 방법</h3>
          <ul class="list-disc space-y-1 pl-6 text-gray-600">
            <li>회원가입 및 서비스 이용 과정에서 이용자가 직접 입력</li>
            <li>기관 멤버 초대 과정에서 기관 관리자가 입력</li>
            <li>검사 진행 시 임상심리사가 입력하거나 기기(카메라·마이크)를 통해 수집</li>
            <li>서비스 이용 과정에서 자동 생성·수집 (접속 로그, 감사추적, 쿠키 등)</li>
          </ul>
        </section>

        <!-- 제2조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제2조 (개인정보의 수집·이용 목적)</h2>
          <p class="mb-3">회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">이용 목적</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">상세 내용</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">서비스 제공·운영</td>
                  <td class="px-4 py-3 text-gray-600">회원 인증, 기관 관리, HTP/로르샤하/SCT 검사 진행 및 결과 관리, AI 분석 초안 생성, 임상심리사 검토·확정 워크플로 지원</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">회원 관리</td>
                  <td class="px-4 py-3 text-gray-600">본인 확인, 자격 검증, 부정 이용 방지, 고지사항 전달, 민원 처리</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">의료기기 사후관리</td>
                  <td class="px-4 py-3 text-gray-600">「의료기기법」에 따른 시판 후 안전성·유효성 모니터링, 이상사례 보고, V&amp;V 활동, GMP 이행</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">서비스·AI 모델 개선</td>
                  <td class="px-4 py-3 text-gray-600">서비스 이용 통계 분석, 오류 개선, 신규 기능 개발 (개인 식별이 불가하도록 비식별 처리한 데이터에 한함)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">학술 연구</td>
                  <td class="px-4 py-3 text-gray-600">IRB 승인 및 별도 동의를 전제로, 비식별화된 임상 데이터의 학술 논문 게재·발표</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 font-medium text-gray-800">안전한 이용 환경 구축</td>
                  <td class="px-4 py-3 text-gray-600">보안 위협 탐지, 비정상 접근 차단, 감사추적 보관</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 제3조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제3조 (개인정보의 보유 및 이용 기간)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>회사는 이용자의 개인정보를 수집·이용 목적이 달성된 때까지 보유·이용합니다.</li>
            <li>이용자가 회원 탈퇴를 요청한 경우, 해당 개인정보는 탈퇴 처리 후 <strong>30일 이내</strong>에 지체 없이 파기합니다. 다만, 다음의 사유에 해당하는 경우 명시한 기간 동안 보존합니다.</li>
          </ol>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">보존 사유</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">보존 항목</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">보존 기간</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">근거 법령</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 text-gray-600">의료기록 (검사 결과)</td>
                  <td class="px-4 py-3 text-gray-600">투사적 심리검사 결과, 임상심리사 확정 보고서</td>
                  <td class="px-4 py-3 font-medium text-gray-800">5년 (진료기록부 관련 자료는 10년)</td>
                  <td class="px-4 py-3 text-gray-500">의료법 시행규칙 제15조</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">의료기기 사후관리 자료</td>
                  <td class="px-4 py-3 text-gray-600">시판 후 안전성·유효성 모니터링, 이상사례 보고</td>
                  <td class="px-4 py-3 font-medium text-gray-800">관계 법령이 정한 기간</td>
                  <td class="px-4 py-3 text-gray-500">의료기기법</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">계약 또는 청약 철회 기록</td>
                  <td class="px-4 py-3 text-gray-600">계약·결제 관련 기록</td>
                  <td class="px-4 py-3 font-medium text-gray-800">5년</td>
                  <td class="px-4 py-3 text-gray-500">전자상거래법</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">대금 결제 및 재화 공급 기록</td>
                  <td class="px-4 py-3 text-gray-600">결제 기록</td>
                  <td class="px-4 py-3 font-medium text-gray-800">5년</td>
                  <td class="px-4 py-3 text-gray-500">전자상거래법</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">소비자 불만 또는 분쟁 처리 기록</td>
                  <td class="px-4 py-3 text-gray-600">민원·분쟁 기록</td>
                  <td class="px-4 py-3 font-medium text-gray-800">3년</td>
                  <td class="px-4 py-3 text-gray-500">전자상거래법</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">서비스 이용 기록, 접속 로그</td>
                  <td class="px-4 py-3 text-gray-600">접속 IP, 접속 일시</td>
                  <td class="px-4 py-3 font-medium text-gray-800">3개월</td>
                  <td class="px-4 py-3 text-gray-500">통신비밀보호법</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">개인정보 처리 시스템 접속 기록 / 감사추적</td>
                  <td class="px-4 py-3 text-gray-600">관리자·임상심리사 접속 및 데이터 변경 기록</td>
                  <td class="px-4 py-3 font-medium text-gray-800">2년 이상 (민감정보 처리 시스템 기준)</td>
                  <td class="px-4 py-3 text-gray-500">개인정보의 안전성 확보조치 기준</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">거래에 관한 장부 및 증빙 서류</td>
                  <td class="px-4 py-3 text-gray-600">세금계산서, 정산 기록</td>
                  <td class="px-4 py-3 font-medium text-gray-800">5년</td>
                  <td class="px-4 py-3 text-gray-500">국세기본법, 법인세법</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ol class="mt-4 list-decimal space-y-2 pl-6" start={3}>
            <li>기관 해지 시, 해당 기관에 저장된 검사 데이터 중 의료기록에 해당하지 않는 정보는 해지 후 <strong>30일간 보관</strong>된 뒤 완전 삭제됩니다. 보관 기간 동안 데이터는 논리적으로 격리(소프트 삭제)되어 일반적인 경로로 접근할 수 없으며, 이용자는 보관 기간 내 데이터 반환(내보내기)을 요청할 수 있습니다.</li>
            <li>의료기록에 해당하는 검사 결과는 「의료법」 시행규칙에서 정한 보존 기간이 경과할 때까지 별도 격리 보관됩니다.</li>
          </ol>
        </section>

        <!-- 제4조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제4조 (개인정보의 제3자 제공)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.</li>
            <li>다만, 다음의 경우에는 예외로 합니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                <li>식약처 등 의료기기 규제기관이 「의료기기법」에 따른 시판 후 안전성 보고, 회수·시정 조치 등을 위해 자료 제출을 요구하는 경우</li>
                <li>통계 작성, 학술 연구 또는 시장 조사를 위하여 필요한 경우로서 특정 개인을 알아볼 수 없는 형태로 가공하여 제공하는 경우</li>
              </ul>
            </li>
          </ol>
        </section>

        <!-- 제5조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제5조 (개인정보 처리의 위탁)</h2>
          <p class="mb-3">회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">수탁 업체</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">위탁 업무</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">데이터 보관 위치</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">재위탁 여부</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 text-gray-800">클라우드 인프라 제공자<br /><span class="text-xs text-gray-500">(서비스 출시 시점에 본 방침에 구체 기재 예정 — 국내 리전 우선)</span></td>
                  <td class="px-4 py-3 text-gray-600">클라우드 서버 및 데이터 스토리지 운영, 데이터 저장·백업</td>
                  <td class="px-4 py-3 text-gray-600">대한민국 (국내 리전)</td>
                  <td class="px-4 py-3 text-gray-600">재위탁 가능성 상존</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-800">메일 발송 대행<br /><span class="text-xs text-gray-500">(서비스 출시 시점에 구체 업체 기재 예정)</span></td>
                  <td class="px-4 py-3 text-gray-600">서비스 알림 및 인증 메일 발송 (SMTP)</td>
                  <td class="px-4 py-3 text-gray-600">대한민국</td>
                  <td class="px-4 py-3 text-gray-600">해당 없음</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <h4 class="mb-2 text-sm font-bold text-green-800">AI 분석은 외부 위탁 처리 없음</h4>
            <p class="text-sm text-green-700">
              본 서비스의 인공지능 분석(HTP 객체 탐지, 로르샤하 STT·채점, SCT 채점, 통합 해석 초안)은 회사가
              <strong>자체 운영하는 폐쇄형 sLLM 환경에서만 수행</strong>되며, OpenAI 등 외부 범용 AI API로 검사 데이터가 전송되지 않습니다.
              이는 환자의 민감정보가 외부 네트워크로 유출되는 위험을 원천 차단하기 위한 설계 원칙입니다.
            </p>
          </div>

          <ul class="mt-3 list-disc space-y-1 pl-6 text-sm text-gray-500">
            <li>위탁 계약 시 「개인정보 보호법」 제26조에 따라 개인정보의 안전한 관리를 위한 필요 사항을 규정하고 있으며, 수탁자가 개인정보를 안전하게 처리하는지 감독하고 있습니다.</li>
            <li>위탁 업무의 내용이나 수탁자가 변경될 경우 본 방침을 통해 지체 없이 공개합니다.</li>
            <li>회사는 의료기기 SaaS 플랫폼 운영 과정에서 이용자(기관)로부터 위탁받은 검사 데이터를 다시 위 인프라 제공자에게 재위탁하는 구조이며, 이용 약관을 통해 이용자(기관)로부터 재위탁에 대한 승낙을 받고 있습니다.</li>
            <li>본 서비스는 「서울형 바이오·의료 기술사업화 지원사업」의 일환으로 ㈜엘에스엠인증교육원(GMP·QMS 컨설팅), 서울대학교병원(임상시험)과 컨소시엄을 구성하여 개발되며, 이들 공동기관은 자체 업무 범위 내에서만 비식별화된 데이터에 접근하고 별도 데이터 처리 위탁 계약을 체결합니다.</li>
          </ul>
        </section>

        <!-- 제6조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제6조 (정보주체의 권리·의무 및 행사 방법)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>이용자(정보주체)는 회사에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>개인정보 열람 요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리 정지 요구</li>
                <li><strong>개인정보 전송 요구</strong> (데이터 이동권): 회사가 보유한 본인의 개인정보를 기계 판독이 가능한 형태(JSON, CSV, PDF 등)로 제공받거나 다른 개인정보 처리자에게 전송하도록 요구할 수 있습니다.</li>
              </ul>
            </li>
            <li>권리 행사는 서비스 내 설정 기능을 통하거나, 이메일(<a href="mailto:{CPO_EMAIL}" class="text-blue-600 hover:underline">{CPO_EMAIL}</a>)로 요청할 수 있으며, 회사는 지체 없이(10일 이내) 조치합니다.</li>
            <li>이용자가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우 회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다. 다만, 「의료법」상 의료기록에 해당하여 보존 의무가 있는 데이터는 삭제가 제한될 수 있습니다.</li>
            <li>만 14세 미만 아동의 개인정보를 처리하는 경우 법정대리인의 동의를 얻어야 하며, 법정대리인은 해당 아동의 개인정보에 대한 열람, 정정·삭제, 처리 정지를 요구할 수 있습니다.</li>
            <li>권리 행사는 이용자의 법정대리인이나 위임을 받은 자 등 대리인을 통해서도 할 수 있으며, 이 경우 「개인정보 처리 방법에 관한 고시」 별지 제11호 서식에 따른 위임장을 제출하여야 합니다.</li>
          </ol>
        </section>

        <!-- 제7조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제7조 (개인정보의 파기 절차 및 방법)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li><strong>파기 절차</strong>: 이용자가 입력한 정보는 목적 달성 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 의한 보유 사유에 따라 일정 기간 저장된 후 파기됩니다. 별도 DB로 옮겨진 개인정보는 법률에 의한 경우가 아니고서는 다른 목적으로 이용되지 않습니다.</li>
            <li><strong>파기 방법</strong>
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>전자적 파일 형태: 기록을 재생할 수 없는 기술적 방법(데이터 덮어쓰기 등)을 사용하여 완전 삭제</li>
                <li>그림 이미지·음성 녹취 등 미디어 파일: 스토리지 객체의 안전 삭제(secure delete) 적용</li>
                <li>종이에 기록된 정보: 분쇄기로 분쇄하거나 소각하여 파기</li>
              </ul>
            </li>
            <li>소프트 삭제(논리 삭제)된 데이터는 보관 기간 경과 후 배치 프로세스를 통해 물리적으로 완전 삭제하며, 파기 일시와 방법을 감사추적 로그에 기록·관리합니다.</li>
          </ol>
        </section>

        <!-- 제8조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제8조 (개인정보의 안전성 확보 조치)</h2>
          <p class="mb-3">회사는 개인정보의 안전성 확보를 위해 다음과 같은 기술적·관리적·물리적 조치를 취하고 있으며, 의료기기 GMP에 따른 품질관리 시스템과 연계하여 운영합니다.</p>
          <div class="space-y-4">
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="mb-2 font-semibold text-gray-800">기술적 조치</h4>
              <ul class="list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>비밀번호 단방향 암호화 (bcrypt 해싱) 저장</li>
                <li>데이터 전송 시 암호화 통신(HTTPS/TLS 1.2 이상) 적용</li>
                <li>데이터베이스 저장 암호화(Data-at-Rest Encryption) 적용으로 검사 데이터, 내담자 인구통계, 그림·음성 미디어 등 민감정보 보호</li>
                <li>JWT 기반 인증·인가 토큰 관리 및 자동 갱신</li>
                <li>역할 기반 접근 제어(RBAC: admin/clinician/researcher) 시스템으로 권한별 데이터 접근 통제</li>
                <li><strong>폐쇄망 sLLM 운영</strong>: AI 분석 시 검사 데이터가 외부 네트워크로 전송되지 않도록 자체 추론 환경 구축</li>
                <li>SQL Injection, XSS 등 주요 보안 위협에 대한 입력값 검증 및 방어</li>
                <li>데이터베이스 접근 권한 분리 및 보안 패치 적용</li>
                <li>개인정보 처리 시스템에 대한 접근 인증 강화 및 다중 인증(MFA) 도입 검토</li>
                <li>시크릿 모드(masking/lockscreen) 등 화면 노출 보호 기능 제공</li>
              </ul>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="mb-2 font-semibold text-gray-800">관리적 조치</h4>
              <ul class="list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>개인정보 취급 직원의 최소화 및 정기 교육 실시</li>
                <li>의료기기 GMP에 부합하는 내부 관리 계획의 수립·시행 (소프트웨어 라이프사이클 관리 포함)</li>
                <li>개인정보 접근 권한의 제한 및 정기적 권한 적정성 검토 (권한 부여·변경·말소 기록 보관)</li>
                <li>모든 검사 데이터 변경에 대한 감사추적(audit trail) 기록 — SaMD 필수 요구사항</li>
                <li>개인정보 처리 시스템 접속 기록의 <strong>최소 2년 이상</strong> 보관 및 월 1회 이상 점검</li>
                <li>비정상적인 접근이나 데이터 유출 징후에 대한 탐지 및 대응 체계 운영</li>
                <li>의료기기 시판 후 안전성·유효성 모니터링 절차 운영</li>
              </ul>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="mb-2 font-semibold text-gray-800">물리적 조치</h4>
              <ul class="list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>국내 리전 클라우드 서버 내 데이터 보관으로 국내 저장 보장</li>
                <li>정기적 데이터 백업 수행 및 재해 복구 계획 운영</li>
                <li>물리적 보안 통제(데이터센터 출입 통제 등)는 위탁 인프라 제공자의 보안 표준에 따름</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 제9조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제9조 (쿠키의 설치·운영 및 거부)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>회사는 이용자에게 맞춤형 서비스를 제공하기 위해 이용자 정보를 저장하고 수시로 불러오는 '쿠키(Cookie)'를 사용합니다.</li>
            <li>쿠키는 서버가 이용자의 브라우저에 전송하는 소량의 텍스트 파일로, 이용자의 기기에 저장됩니다.</li>
            <li>회사는 서비스 운영에 필수적인 <strong>First-party Cookie</strong>만을 사용하며, 광고성 추적을 위한 Third-party Cookie는 사용하지 않습니다. 쿠키의 사용 목적은 다음과 같습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>로그인 인증 상태 유지 (httpOnly 쿠키 기반 토큰 관리)</li>
                <li>기관 컨텍스트 유지 (현재 선택된 기관 ID)</li>
                <li>서비스 이용 편의 제공 (이용자 설정 저장)</li>
              </ul>
            </li>
            <li>이용자는 웹 브라우저 설정을 통해 쿠키 설치를 거부할 수 있으나, 이 경우 <strong>로그인이 필요한 서비스 이용이 제한</strong>될 수 있습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>Chrome: 설정 → 개인 정보 보호 및 보안 → 쿠키 및 기타 사이트 데이터</li>
                <li>Firefox: 설정 → 개인 정보 및 보안 → 쿠키 및 사이트 데이터</li>
                <li>Safari: 환경설정 → 개인정보 보호 → 쿠키 및 웹사이트 데이터</li>
                <li>Edge: 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터</li>
              </ul>
            </li>
            <li>회사가 향후 서비스 분석 도구(예: Google Analytics 등)를 도입하는 경우, 본 방침 또는 제5조(위탁)에 명시하고 이용자의 거부권(Opt-out) 행사 방법을 안내합니다.</li>
          </ol>
        </section>

        <!-- 제10조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제10조 (개인정보 보호책임자 및 고충 처리)</h2>
          <p class="mb-3">회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제를 위해 개인정보 보호책임자를 지정하고 있습니다.</p>
          <div class="space-y-4">
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="mb-2 text-sm font-semibold text-gray-800">개인정보 보호책임자</h4>
              <ul class="space-y-2 text-sm text-gray-600">
                <li><span class="inline-block w-28 font-medium text-gray-800">성명</span>{CPO_NAME}</li>
                <li><span class="inline-block w-28 font-medium text-gray-800">직위</span>팀장</li>
                <li><span class="inline-block w-28 font-medium text-gray-800">이메일</span><a href="mailto:{CPO_EMAIL}" class="text-blue-600 hover:underline">{CPO_EMAIL}</a></li>
              </ul>
            </div>
          </div>
          <p class="mt-3 text-sm text-gray-500">이용자는 서비스 이용 중 발생한 모든 개인정보 관련 문의, 불만 처리, 피해 구제 등에 관한 사항을 위 연락처로 문의할 수 있으며, 회사는 지체 없이 답변 및 처리해 드리겠습니다.</p>
        </section>

        <!-- 제11조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제11조 (개인정보의 국외 이전)</h2>
          <p class="mb-3">회사는 이용자 및 내담자의 개인정보를 국내에 위치한 서버에 보관하는 것을 원칙으로 합니다.</p>
          <ul class="list-disc space-y-2 pl-6 text-gray-600">
            <li>모든 데이터는 <strong>국내 클라우드 리전</strong>에 저장·처리되고 있으며, AI 분석 또한 회사가 자체 운영하는 국내 폐쇄망 환경에서 수행됩니다. <strong>외부 범용 AI API로의 데이터 송출은 발생하지 않습니다.</strong></li>
            <li>향후 서비스 운영, 기술 지원 또는 재해 복구 등의 사유로 개인정보의 국외 이전이 필요한 경우, 이전되는 국가, 이전 일시 및 방법, 이전되는 개인정보 항목, 이전받는 자의 개인정보 이용 목적 및 보유·이용 기간을 본 방침에 사전 고지하고, 「개인정보 보호법」이 정하는 바에 따라 이용자의 동의를 받겠습니다.</li>
          </ul>
        </section>

        <!-- 제12조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제12조 (권익 침해 구제 방법)</h2>
          <p class="mb-3">이용자는 개인정보 침해에 대한 피해 구제, 상담 등이 필요한 경우 아래 기관에 문의할 수 있습니다.</p>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">기관</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">연락처</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">홈페이지</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 text-gray-800">개인정보 침해신고센터 (KISA)</td>
                  <td class="px-4 py-3 text-gray-600">(국번없이) 118</td>
                  <td class="px-4 py-3"><a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener" class="text-blue-600 hover:underline">privacy.kisa.or.kr</a></td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-800">개인정보 분쟁조정위원회</td>
                  <td class="px-4 py-3 text-gray-600">(국번없이) 1833-6972</td>
                  <td class="px-4 py-3"><a href="https://www.kopico.go.kr" target="_blank" rel="noopener" class="text-blue-600 hover:underline">www.kopico.go.kr</a></td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-800">대검찰청 사이버수사과</td>
                  <td class="px-4 py-3 text-gray-600">(국번없이) 1301</td>
                  <td class="px-4 py-3"><a href="https://www.spo.go.kr" target="_blank" rel="noopener" class="text-blue-600 hover:underline">www.spo.go.kr</a></td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-800">경찰청 사이버수사국</td>
                  <td class="px-4 py-3 text-gray-600">(국번없이) 182</td>
                  <td class="px-4 py-3"><a href="https://ecrm.police.go.kr" target="_blank" rel="noopener" class="text-blue-600 hover:underline">ecrm.police.go.kr</a></td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-800">식품의약품안전처 (의료기기 관련)</td>
                  <td class="px-4 py-3 text-gray-600">1577-1255</td>
                  <td class="px-4 py-3"><a href="https://www.mfds.go.kr" target="_blank" rel="noopener" class="text-blue-600 hover:underline">www.mfds.go.kr</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 제13조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제13조 (개인정보처리방침의 변경)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>이 개인정보처리방침은 법령, 정책 또는 보안 기술의 변경에 따라 내용이 추가·삭제 및 수정될 수 있으며, 변경 시 시행일의 <strong>7일 전</strong>부터 서비스 내 공지사항 또는 이메일을 통해 고지합니다. 다만, 이용자 권리의 중대한 변경이 발생하는 경우 <strong>30일 전</strong>에 고지합니다.</li>
            <li>이용자는 변경된 개인정보처리방침을 정기적으로 확인할 의무가 있습니다.</li>
          </ol>
        </section>

        <!-- 부칙 -->
        <section class="border-t border-gray-200 pt-8">
          <h2 class="mb-4 text-lg font-bold text-gray-900">부칙</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>이 개인정보처리방침은 {EFFECTIVE_DATE}부터 시행합니다.</li>
            <li>본 방침은 「서울형 바이오·의료 기술사업화 지원사업(BT260016)」의 일환으로 {COMPANY_NAME}(주관기관)가 개발·운영하는 의료기기 소프트웨어 "{SERVICE_NAME}"에 적용됩니다.</li>
          </ol>
        </section>

        <!-- 문의 -->
        <section class="rounded-xl bg-gray-50 p-6">
          <h3 class="mb-2 text-sm font-semibold text-gray-900">개인정보 관련 문의</h3>
          <ul class="space-y-1 text-sm text-gray-500">
            <li>회사명: {COMPANY_NAME}</li>
            <li>개인정보 보호책임자: {CPO_NAME}</li>
            <li>이메일: <a href="mailto:{CPO_EMAIL}" class="text-blue-600 hover:underline">{CPO_EMAIL}</a></li>
            <li>일반 문의: <a href="mailto:{SUPPORT_EMAIL}" class="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a></li>
          </ul>
        </section>

      </div>
    </div>
  </main>
</div>
