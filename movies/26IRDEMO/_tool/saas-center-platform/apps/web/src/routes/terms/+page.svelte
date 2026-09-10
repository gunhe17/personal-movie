<script lang="ts">
  const EFFECTIVE_DATE = '2026년 2월 25일'
  const COMPANY_NAME = '주식회사 인사이터'
  const SERVICE_NAME = 'mindscope'
  const SUPPORT_EMAIL = 'support@insighter.co.kr'
</script>

<svelte:head>
  <title>이용약관 | {SERVICE_NAME}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header
    class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm"
  >
    <div class="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
      <h1 class="text-lg font-semibold text-gray-900">이용약관</h1>
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
    <div
      class="rounded-lg border border-gray-200 bg-white px-8 py-10 shadow-sm sm:px-12"
    >
      <p class="mb-10 text-sm text-gray-400">시행일: {EFFECTIVE_DATE}</p>

      <div class="space-y-12 text-[15px] leading-relaxed text-gray-700">
        <!-- 제1조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제1조 (목적)</h2>
          <p>
            이 약관은 {COMPANY_NAME}(이하 "회사")이 제공하는 상담센터 운영 SaaS
            서비스 "{SERVICE_NAME}"(이하 "서비스")의 이용과 관련하여 회사와
            이용자 간의 권리, 의무 및 책임사항, 그 밖에 필요한 사항을 규정함을
            목적으로 합니다.
          </p>
        </section>

        <!-- 제2조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제2조 (용어의 정의)
          </h2>
          <p class="mb-3">
            이 약관에서 사용하는 용어의 정의는 다음과 같습니다.
          </p>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              <strong>"서비스"</strong>란 회사가 제공하는 상담센터 운영 관리
              클라우드 소프트웨어로서, 내담자 관리, 심리검사 관리, 상담 일정
              관리, 예약 시스템 등을 포함하는 온라인 서비스를 말합니다.
            </li>
            <li>
              <strong>"이용자"</strong>란 본 약관에 따라 회사와 서비스 이용
              계약을 체결하고 서비스를 이용하는 자를 말합니다.
            </li>
            <li>
              <strong>"센터"</strong>란 이용자가 서비스를 통해 등록·운영하는
              상담센터 단위를 말합니다.
            </li>
            <li>
              <strong>"센터 관리자"</strong>란 센터를 등록하고 해당 센터의
              전반적인 관리 권한을 가진 이용자를 말합니다.
            </li>
            <li>
              <strong>"구성원"</strong>이란 센터 관리자의 초대를 통해 해당
              센터에 소속되어 서비스를 이용하는 상담사, 직원 등을 말합니다.
            </li>
            <li>
              <strong>"내담자"</strong>란 센터에서 상담 서비스를 받는
              고객으로서, 이용자가 서비스에 등록·관리하는 대상을 말합니다.
            </li>
            <li>
              <strong>"내담자 데이터"</strong>란 이용자가 서비스를 통해
              입력·저장·관리하는 내담자의 개인정보, 상담 기록, 심리검사 결과 등
              일체의 데이터를 말합니다.
            </li>
            <li>
              <strong>"계정"</strong>이란 이용자가 서비스에 접속하기 위해 설정한
              이메일 주소와 비밀번호의 조합을 말합니다.
            </li>
          </ol>
        </section>

        <!-- 제3조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제3조 (약관의 효력 및 변경)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게
              공지함으로써 효력이 발생합니다.
            </li>
            <li>
              회사는 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며,
              약관을 개정할 경우 적용일 및 개정 사유를 명시하여 적용일 <strong
                >7일 전</strong
              >(이용자에게 불리하거나 중대한 변경의 경우
              <strong>30일 전</strong>)에 서비스 내 공지 또는 이메일을 통해
              고지합니다.
            </li>
            <li>
              이용자가 변경된 약관의 적용에 동의하지 않는 경우 서비스 이용을
              중단하고 이용 계약을 해지할 수 있습니다. 적용일 이후에도 서비스를
              계속 이용하는 경우 변경된 약관에 동의한 것으로 봅니다.
            </li>
          </ol>
        </section>

        <!-- 제4조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제4조 (이용 계약의 체결)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              이용 계약은 이용자가 회원가입 시 본 약관 및 개인정보처리방침에
              동의하고, 회사가 이를 승낙함으로써 성립합니다.
            </li>
            <li>
              센터 등록은 이용자가 센터 정보를 입력하여 신청하고, 회사가 이를
              심사·승인함으로써 완료됩니다.
            </li>
            <li>
              회사는 다음 각 호에 해당하는 경우 이용 신청을 거절하거나 사후에
              이용 계약을 해지할 수 있습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>실명이 아니거나 타인의 정보를 이용한 경우</li>
                <li>허위 정보를 기재하거나 필수 정보를 누락한 경우</li>
                <li>
                  관련 법령에 위반되거나 사회의 안녕과 질서, 미풍양속을 저해할
                  우려가 있는 경우
                </li>
                <li>기타 회사가 정한 이용 요건에 부합하지 않는 경우</li>
              </ul>
            </li>
          </ol>
        </section>

        <!-- 제5조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제5조 (서비스의 제공)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사는 다음의 서비스를 제공합니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>내담자 등록 및 관리 (개인정보, 보호자 관계, 상태 관리)</li>
                <li>심리검사 관리 (검사 접수, 배정, 결과 조회)</li>
                <li>상담 일정 관리 (예약, 반복 일정, 충돌 감지)</li>
                <li>상담 기록 관리 (상담 일지 작성, 회기 관리)</li>
                <li>센터 구성원 관리 (초대, 역할·권한 설정)</li>
                <li>그 밖에 회사가 추가 개발하여 제공하는 일체의 서비스</li>
              </ul>
            </li>
            <li>
              서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 다만,
              시스템 정기점검, 증설, 교체 및 고장, 통신 두절, 천재지변 등의
              사유가 발생한 경우 일시적으로 서비스를 중단할 수 있습니다.
            </li>
            <li>
              회사는 서비스의 내용, 운영상·기술상 사항을 변경할 수 있으며, 변경
              시 사전에 서비스 내 공지사항을 통해 고지합니다. 다만, 긴급한 보안
              패치나 장애 복구 등 불가피한 사유가 있는 경우 사후에 고지할 수
              있습니다.
            </li>
          </ol>
        </section>

        <!-- 제6조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제6조 (회사의 의무)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사는 관련 법령과 본 약관이 정하는 바에 따라 지속적이고
              안정적으로 서비스를 제공하기 위해 최선을 다합니다.
            </li>
            <li>
              회사는 이용자의 개인정보 및 내담자 데이터를 안전하게 관리하기 위한
              기술적·관리적 보호 조치를 시행합니다.
            </li>
            <li>
              회사는 서비스 장애 발생 시 지체 없이 이를 복구하기 위해 노력하며,
              계획된 점검의 경우 <strong>24시간 전</strong>까지 서비스 내 공지
              또는 이메일을 통해 고지합니다.
            </li>
            <li>
              회사는 이용자의 의견이나 불만이 정당하다고 인정되는 경우 이를
              적극적으로 처리하며, 처리가 지연될 경우 그 사유와 일정을
              안내합니다.
            </li>
            <li>
              회사는 서비스의 가용성을 월 <strong>99.5%</strong> 이상 유지하는
              것을 목표로 합니다. 다만, 다음의 경우는 가용성 산정에서
              제외합니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>사전 고지된 정기 점검 시간</li>
                <li>제12조에 해당하는 불가항력 사유</li>
                <li>이용자의 귀책사유로 인한 장애</li>
              </ul>
            </li>
          </ol>
        </section>

        <!-- 제7조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제7조 (이용자의 의무)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              이용자는 다음 행위를 하여서는 안 됩니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>회원가입 또는 변경 시 허위 정보를 등록하는 행위</li>
                <li>타인의 정보를 도용하거나 부정하게 사용하는 행위</li>
                <li>
                  서비스를 이용하여 얻은 정보를 회사의 사전 승인 없이 복제,
                  배포, 상업적으로 이용하는 행위
                </li>
                <li>
                  서비스의 안정적 운영을 방해하거나 서버에 과도한 부하를
                  유발하는 행위
                </li>
                <li>서비스의 보안 기능을 무력화하거나 우회하려는 시도</li>
                <li>관련 법령, 본 약관, 이용안내 등에서 금지하는 행위</li>
              </ul>
            </li>
            <li>
              이용자는 자신의 계정 정보(이메일, 비밀번호)를 직접 관리하여야
              하며, 관리 소홀로 인한 손해에 대하여 회사는 책임을 지지 않습니다.
              이용자는 계정의 무단 사용을 인지한 경우 즉시 회사에 통보하여야
              합니다.
            </li>
            <li>
              <strong
                >센터 관리자 및 구성원은 내담자 데이터를 서비스에 입력·관리함에
                있어 「개인정보 보호법」 등 관련 법령을 준수하여야 하며,
                내담자로부터 적법한 동의를 획득할 책임이 있습니다.</strong
              >
            </li>
            <li>
              이용자는 센터에 소속된 구성원의 서비스 이용 행위에 대하여
              관리·감독할 의무가 있으며, 구성원의 위반 행위에 대한 책임은 해당
              센터 관리자에게 있습니다.
            </li>
          </ol>
        </section>

        <!-- 제8조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제8조 (데이터의 소유권 및 관리)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              <strong
                >이용자가 서비스를 통해 입력·저장한 내담자 데이터(상담 기록,
                심리검사 결과, 내담자 개인정보 등)의 소유권은 해당 센터에
                귀속됩니다.</strong
              >
            </li>
            <li>
              회사는 내담자 데이터에 대하여 서비스 제공 목적 외의 용도로
              사용하지 않으며, 이용자의 동의 없이 제3자에게 제공하지 않습니다.
            </li>
            <li>
              회사는 「개인정보 보호법」상 <strong>개인정보 처리 수탁자</strong
              >로서, 이용자(센터)로부터 위탁받은 범위 내에서만 내담자 데이터를
              처리합니다.
            </li>
            <li>
              회사는 서비스 운영, 장애 대응, 보안 목적으로 데이터를 암호화하여
              보관하며, 정기적으로 백업을 수행합니다.
            </li>
            <li>
              이용자는 서비스 내 기능을 통해 자신의 데이터를 열람·수정·삭제할 수
              있으며, 기계 판독이 가능한 형태(JSON, CSV 등)로 데이터의
              내보내기(다운로드)를 요청할 수 있습니다.
            </li>
            <li>
              회사는 통계 분석, 서비스 개선 등의 목적으로 데이터를 이용하는
              경우, 특정 개인이나 센터를 식별할 수 없도록 비식별 처리한 후에만
              이용합니다.
            </li>
          </ol>
        </section>

        <!-- 제9조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제9조 (비밀유지)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사와 이용자는 서비스 이용 과정에서 상대방으로부터 제공받거나
              알게 된 비밀 정보를 서비스 이용 목적 이외의 용도로 사용하거나
              제3자에게 공개하여서는 안 됩니다.
            </li>
            <li>
              전항의 의무는 다음의 경우에는 적용되지 않습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>공지된 정보이거나 이미 공개적으로 알려진 정보</li>
                <li>
                  관련 법령 또는 정부 기관의 요청에 따라 공개가 요구되는 경우
                </li>
                <li>상대방의 사전 서면 동의를 받은 경우</li>
              </ul>
            </li>
            <li>
              본 조의 비밀유지 의무는 이용 계약이 종료된 후에도 <strong
                >3년간</strong
              > 유효합니다.
            </li>
          </ol>
        </section>

        <!-- 제10조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제10조 (서비스 이용 제한 및 계약 해지)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사는 이용자가 본 약관의 의무를 위반하거나 서비스의 정상적인
              운영을 방해한 경우 경고, 일시 정지, 영구 정지 등으로 서비스 이용을
              단계적으로 제한할 수 있습니다.
            </li>
            <li>
              회사는 이용 제한 조치 시 그 사유, 제한 유형, 이의 신청 방법을
              이메일 또는 서비스 내 알림으로 고지합니다.
            </li>
            <li>
              이용자는 언제든지 서비스 내 설정 또는 이메일({SUPPORT_EMAIL})을
              통해 이용 계약의 해지를 신청할 수 있습니다.
            </li>
            <li>
              계약 해지 시 처리 절차는 다음과 같습니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>
                  해지 신청 후 센터에 저장된 데이터는 <strong
                    >30일간 보관</strong
                  >된 후 완전 삭제됩니다.
                </li>
                <li>
                  이용자는 30일의 보관 기간 내에 데이터 내보내기(다운로드)를
                  요청할 수 있으며, 회사는 이에 협조합니다.
                </li>
                <li>
                  법령에 따라 보존이 필요한 정보는 관련 법률이 정한 기간 동안
                  별도 보관합니다.
                </li>
                <li>
                  보관 기간이 경과하여 삭제된 데이터는 복구할 수 없습니다.
                </li>
              </ul>
            </li>
          </ol>
        </section>

        <!-- 제11조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제11조 (서비스의 종료)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사가 서비스의 전부 또는 일부를 종료하고자 하는 경우,
              종료일로부터 <strong>90일 전</strong>까지 서비스 내 공지 및
              이메일을 통해 이용자에게 고지합니다.
            </li>
            <li>
              서비스 종료 시 회사는 이용자에게 데이터 내보내기(다운로드) 기간을
              충분히 제공하며, 이용자가 자신의 데이터를 안전하게 이전할 수
              있도록 기술적 지원을 합니다.
            </li>
            <li>
              고지된 종료일 이후에는 이용자의 데이터가 완전히 삭제되며, 삭제된
              데이터는 복구할 수 없습니다.
            </li>
          </ol>
        </section>

        <!-- 제12조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제12조 (지식재산권)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              서비스의 소프트웨어, 디자인, 상표, 로고 등에 관한 저작권 및
              지식재산권은 회사에 귀속됩니다.
            </li>
            <li>
              이용자는 서비스를 이용하여 얻은 정보 중 회사에게 지식재산권이 있는
              정보를 회사의 사전 승인 없이 복제, 전송, 출판, 배포, 방송 등의
              방법에 의하여 영리 목적으로 이용하거나 제3자에게 이용하게 하여서는
              안 됩니다.
            </li>
            <li>
              이용자가 서비스 내에 작성·입력한 콘텐츠(상담 기록, 검사 결과 등)에
              대한 권리는 제8조에 따릅니다.
            </li>
            <li>
              회사는 이용자에게 서비스 이용 기간 동안 본 약관에 따른 범위 내에서
              서비스를 이용할 수 있는 비독점적, 양도 불가능한 이용권을
              부여합니다.
            </li>
          </ol>
        </section>

        <!-- 제13조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제13조 (면책 조항)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사는 제14조에 해당하는 불가항력적 사유로 인한 서비스 중단에
              대하여 책임을 지지 않습니다.
            </li>
            <li>
              회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을
              지지 않습니다.
            </li>
            <li>
              <strong
                >회사는 이용자가 서비스를 통해 수행하는 상담 행위, 심리검사
                해석, 진단 등 전문적 판단에 대하여 어떠한 책임도 지지 않습니다.</strong
              > 서비스는 상담센터 운영 관리를 위한 도구이며, 상담 결과 및 전문적
              판단의 적정성은 이용자의 책임 하에 수행됩니다.
            </li>
            <li>
              회사는 이용자가 서비스 내에 저장한 정보의 정확성, 신뢰성에 대하여
              보증하지 않으며, 이용자 간 또는 이용자와 내담자 간 분쟁에 대하여
              개입하지 않습니다.
            </li>
            <li>
              회사는 무료로 제공하는 서비스에 대해서는 관련 법령에 특별한 규정이
              없는 한 별도의 보증이나 책임을 부담하지 않습니다.
            </li>
          </ol>
        </section>

        <!-- 제14조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제14조 (불가항력)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사 또는 이용자는 다음 각 호에 해당하는 불가항력적 사유로 인하여
              의무를 이행할 수 없는 경우 그 책임을 면합니다.
              <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-600">
                <li>천재지변(지진, 홍수, 태풍 등), 전쟁, 내란, 폭동</li>
                <li>정부의 법적 조치, 명령 또는 규제</li>
                <li>기간통신사업자의 서비스 중지 또는 장애</li>
                <li>클라우드 인프라 제공자(AWS 등)의 서비스 장애</li>
                <li>대규모 사이버 공격(DDoS 등)</li>
                <li>전염병, 감염병에 의한 사업 중단</li>
                <li>기타 당사자의 합리적인 통제를 벗어난 사유</li>
              </ul>
            </li>
            <li>
              불가항력 사유가 발생한 당사자는 상대방에게 해당 사실을 지체 없이
              통보하고, 사유가 해소되는 즉시 의무 이행을 재개하여야 합니다.
            </li>
          </ol>
        </section>

        <!-- 제15조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제15조 (손해배상)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사 또는 이용자가 본 약관의 규정을 위반하여 상대방에게 손해를
              입힌 경우, 귀책사유가 있는 당사자는 상대방에게 발생한 <strong
                >직접적이고 통상적인 손해</strong
              >를 배상하여야 합니다.
            </li>
            <li>
              관련 법령이 허용하는 범위 내에서, 회사는 간접 손해, 특별 손해,
              결과적 손해(영업 손실, 데이터 손실, 기대 이익의 상실 등)에 대하여
              예견 가능 여부와 관계없이 책임을 지지 않습니다.
            </li>
            <li>
              회사의 고의 또는 중대한 과실에 의한 손해, 「개인정보 보호법」 등
              법령 위반에 의한 손해에 대해서는 전항의 제한이 적용되지 않습니다.
            </li>
          </ol>
        </section>

        <!-- 제16조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제16조 (개인정보 보호)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사는 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에
              관한 법률」 등 관련 법령이 정하는 바에 따라 이용자의 개인정보를
              보호하기 위해 노력합니다.
            </li>
            <li>
              개인정보의 수집·이용·처리에 관한 사항은 별도의 「<a
                href="/privacy"
                class="text-blue-600 hover:underline">개인정보처리방침</a
              >」에 따릅니다.
            </li>
            <li>
              회사는 이용자(센터)가 내담자 데이터를 적법하게 수집·처리할 수
              있도록 기술적·관리적 보호 조치를 제공하며, 이용자는 관련 법령에
              따른 개인정보 처리자로서의 의무를 성실히 이행하여야 합니다.
            </li>
            <li>
              회사가 내담자 데이터를 처리하기 위해 제3자(클라우드 서비스 제공자,
              이메일 발송 대행사 등)에게 재위탁하는 경우, 이용자는 본 약관에
              동의함으로써 해당 재위탁에 대하여 사전 승낙한 것으로 봅니다.
              재위탁 업체의 변경 사항은 개인정보처리방침을 통해 공개합니다.
            </li>
          </ol>
        </section>

        <!-- 제17조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">제17조 (통지)</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              회사가 이용자에 대한 통지를 하는 경우, 이용자가 등록한 이메일 주소
              또는 서비스 내 알림을 통해 할 수 있습니다.
            </li>
            <li>
              회사는 불특정 다수 이용자에 대한 통지의 경우 서비스 내 공지사항에
              게시함으로써 개별 통지에 갈음할 수 있습니다.
            </li>
            <li>
              이용자는 회사에 등록한 연락처(이메일 등)를 최신 상태로 유지할
              의무가 있으며, 연락처 미갱신으로 인하여 통지를 수신하지 못한 경우
              회사는 그로 인한 불이익에 대하여 책임을 지지 않습니다.
            </li>
          </ol>
        </section>

        <!-- 제18조 -->
        <section>
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            제18조 (분쟁 해결)
          </h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>
              본 약관과 관련하여 분쟁이 발생한 경우 회사와 이용자는 상호
              협의하여 해결하도록 노력합니다.
            </li>
            <li>
              협의가 이루어지지 않는 경우 대한민국 법령을 준거법으로 하며,
              「민사소송법」상의 관할 법원을 제1심 관할 법원으로 합니다.
            </li>
          </ol>
        </section>

        <!-- 부칙 -->
        <section class="border-t border-gray-200 pt-8">
          <h2 class="mb-4 text-lg font-bold text-gray-900">부칙</h2>
          <ol class="list-decimal space-y-2 pl-6">
            <li>이 약관은 {EFFECTIVE_DATE}부터 시행합니다.</li>
          </ol>
        </section>

        <!-- 문의 -->
        <section class="rounded-lg bg-gray-50 p-6">
          <h3 class="mb-2 text-sm font-semibold text-gray-900">
            서비스 이용 관련 문의
          </h3>
          <ul class="space-y-1 text-sm text-gray-500">
            <li>회사명: {COMPANY_NAME}</li>
            <li>
              이메일: <a
                href="mailto:{SUPPORT_EMAIL}"
                class="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a
              >
            </li>
          </ul>
        </section>
      </div>
    </div>
  </main>
</div>
