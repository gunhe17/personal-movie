<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'

  // 사이드바에 노출되지 않는 실험(랩) 페이지 모음.
  // 새 랩을 추가하면 이 배열에만 등록하면 된다.
  const labs: { title: string; description: string; href: string }[] = [
    {
      title: '상담일지 — 입력 · 본문 · 출력 Lab',
      description:
        '고정 3층→2층(칩 레일이 상단바 흡수). 문서 맨 위=녹음·초안, 하단=저장 시각+전달문 모달',
      href: '/lab/journal-attach'
    },
    {
      title: '바우처 현황 — 바우처 기준 Lab',
      description:
        '내담자 기준 → 바우처(사업) 기준 재편. 좌 사업 레일 + 우 내담자 테이블, 선택 후 서류 일괄 발급',
      href: '/lab/voucher-first'
    },
    {
      title: '케어보드 — Lab',
      description:
        '우측 도크 + 채팅형 스트림. 상담·검사·메모·기록을 한 줄기 시간축으로',
      href: '/lab/care-board'
    },
    {
      title: '기관 온톨로지 — Lab',
      description:
        '기관 칩(심리센터/학교/군대/병원) 전환에 따라 같은 데이터가 다른 목록·상세로 렌더되는 프로토타입',
      href: '/lab/ontology'
    },
    {
      title: '상담 상세 좌측 패널 — Lab',
      description: '상단 내담자 헤더 제거 → 상담 정보 우선 + 카드 프로필 추가',
      href: '/lab/counseling-detail'
    },
    {
      title: 'AI 상담 경과 분석 — 진입 구조 Lab',
      description:
        '리포트를 어디서 어떻게 여는가 — A 우측 탭 vs B 여닫는 리포트. 전환을 직접 눌러 비교',
      href: '/lab/case-analysis-report'
    },
    {
      title: 'AI 상담 경과 분석 범위 — Lab',
      description: '회기 범위 선택 + 회기 수에 비례한 예상 크레딧 표시 시안',
      href: '/lab/case-analysis-range'
    },
    {
      title: '센터 첫 세팅 카드 — Lab',
      description:
        '대시보드 톤에 맞춘 세팅 체크리스트 3안 (진행 링 / 세그먼트 / 한 줄 제안)',
      href: '/lab/setup-checklist'
    },
    {
      title: '리스트 상단 툴바 — Lab',
      description: '검색 + 총N건 + 리스트/카드 토글을 한 행으로 정리한 시안',
      href: '/lab/list-toolbar'
    },
    {
      title: '권한 설정 — Lab',
      description: '역할·권한 화면 실험안',
      href: '/center/authorization/lab'
    },
    {
      title: 'AI 사용량 — Lab',
      description: '크레딧·사용량 대시보드 실험안',
      href: '/settings/ai-usage/lab'
    },
    {
      title: '구독 관리 — Lab v3',
      description: '구독/플랜 관리 화면 실험안',
      href: '/settings/subscription/lab'
    },
    {
      title: '결제 내역 — 디자인 Lab',
      description: '결제 내역·KPI 표현 실험안',
      href: '/subscription/billing/lab'
    }
  ]
</script>

<div in:fade class="flex h-full w-full flex-col bg-gray-50">
  <!-- 헤더 -->
  <div class="mb-4 shrink-0">
    <Typography variant="headline-01-normal-semibold" color="text-gray-900">
      디자인 Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-2 block"
    >
      사이드바에 노출되지 않는 실험용 화면 모음이에요. 정식 반영 전 시안을
      확인하는 용도입니다.
    </Typography>
  </div>

  <!-- 랩 카드 그리드 -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each labs as lab}
      <a
        href={lab.href}
        class="group flex flex-col gap-2 rounded-2xl bg-white p-5 ring-1 ring-inset ring-gray-200 transition-all hover:shadow-md hover:ring-primary-400"
      >
        <div class="flex items-center justify-between gap-2">
          <Typography variant="title-02-semibold" color="text-gray-900">
            {lab.title}
          </Typography>
          <span
            class="text-gray-300 transition-colors group-hover:text-primary-500"
            aria-hidden="true">›</span
          >
        </div>
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          {lab.description}
        </Typography>
        <Typography
          variant="label-02-normal-regular"
          color="text-gray-400"
          className="mt-1 block truncate-safe"
        >
          {lab.href}
        </Typography>
      </a>
    {/each}
  </div>
</div>
