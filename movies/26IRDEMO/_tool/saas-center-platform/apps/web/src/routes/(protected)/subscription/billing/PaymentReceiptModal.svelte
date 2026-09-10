<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import InkDivider from '$lib/assets/InkDivider.svelte'

  interface PaymentRow {
    id: string
    date: string
    planLabel: string
    cycle: string
    period: string
    amount: number
    status: string
    statusLabel: string
    method: string
    cardSuffix?: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    payment: PaymentRow
  }

  let { modalId = '', closeModal = () => {}, payment }: Props = $props()

  const receiptNo = $derived(`RCP-${payment.id.padStart(6, '0')}`)
  const methodLabel = $derived(
    payment.cardSuffix
      ? `${payment.method}  ${payment.cardSuffix}`
      : payment.method
  )
  const amountLabel = $derived(
    payment.amount === 0 ? '무료' : `₩${payment.amount.toLocaleString()}`
  )

  function buildReceiptHtml(): string {
    const fields = [
      { label: '영수증 번호', value: receiptNo },
      { label: '결제일', value: payment.date },
      { label: '결제 기간', value: payment.period },
      { label: '플랜', value: `${payment.planLabel} · ${payment.cycle}` },
      { label: '결제 수단', value: methodLabel }
    ]

    const rows = fields
      .map(
        (f) => `
          <div class="row">
            <span class="label">${f.label}</span>
            <span class="value">${f.value}</span>
          </div>`
      )
      .join('')

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>결제 영수증 ${receiptNo} — Mindscope</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Noto Sans KR', -apple-system, 'Apple SD Gothic Neo', sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 16px;
    }

    .receipt {
      background: white;
      width: 420px;
      padding: 40px 36px 32px;
      position: relative;
      /* 지그재그 상단 */
      clip-path: polygon(
        0% 6px, 6px 0%, 12px 6px, 18px 0%, 24px 6px, 30px 0%, 36px 6px,
        42px 0%, 48px 6px, 54px 0%, 60px 6px, 66px 0%, 72px 6px, 78px 0%,
        84px 6px, 90px 0%, 96px 6px, 102px 0%, 108px 6px, 114px 0%,
        120px 6px, 126px 0%, 132px 6px, 138px 0%, 144px 6px, 150px 0%,
        156px 6px, 162px 0%, 168px 6px, 174px 0%, 180px 6px, 186px 0%,
        192px 6px, 198px 0%, 204px 6px, 210px 0%, 216px 6px, 222px 0%,
        228px 6px, 234px 0%, 240px 6px, 246px 0%, 252px 6px, 258px 0%,
        264px 6px, 270px 0%, 276px 6px, 282px 0%, 288px 6px, 294px 0%,
        300px 6px, 306px 0%, 312px 6px, 318px 0%, 324px 6px, 330px 0%,
        336px 6px, 342px 0%, 348px 6px, 354px 0%, 360px 6px, 366px 0%,
        372px 6px, 378px 0%, 384px 6px, 390px 0%, 396px 6px, 402px 0%,
        408px 6px, 414px 0%, 420px 6px,
        100% 6px, 100% calc(100% - 6px),
        414px 100%, 408px calc(100% - 6px), 402px 100%, 396px calc(100% - 6px),
        390px 100%, 384px calc(100% - 6px), 378px 100%, 372px calc(100% - 6px),
        366px 100%, 360px calc(100% - 6px), 354px 100%, 348px calc(100% - 6px),
        342px 100%, 336px calc(100% - 6px), 330px 100%, 324px calc(100% - 6px),
        318px 100%, 312px calc(100% - 6px), 306px 100%, 300px calc(100% - 6px),
        294px 100%, 288px calc(100% - 6px), 282px 100%, 276px calc(100% - 6px),
        270px 100%, 264px calc(100% - 6px), 258px 100%, 252px calc(100% - 6px),
        246px 100%, 240px calc(100% - 6px), 234px 100%, 228px calc(100% - 6px),
        222px 100%, 216px calc(100% - 6px), 210px 100%, 204px calc(100% - 6px),
        198px 100%, 192px calc(100% - 6px), 186px 100%, 180px calc(100% - 6px),
        174px 100%, 168px calc(100% - 6px), 162px 100%, 156px calc(100% - 6px),
        150px 100%, 144px calc(100% - 6px), 138px 100%, 132px calc(100% - 6px),
        126px 100%, 120px calc(100% - 6px), 114px 100%, 108px calc(100% - 6px),
        102px 100%, 96px calc(100% - 6px), 90px 100%, 84px calc(100% - 6px),
        78px 100%, 72px calc(100% - 6px), 66px 100%, 60px calc(100% - 6px),
        54px 100%, 48px calc(100% - 6px), 42px 100%, 36px calc(100% - 6px),
        30px 100%, 24px calc(100% - 6px), 18px 100%, 12px calc(100% - 6px),
        6px 100%, 0% calc(100% - 6px)
      );
    }

    /* 브랜드 헤더 */
    .brand {
      text-align: center;
      margin-bottom: 28px;
      padding-top: 4px;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      background: #e8f4f8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
    }
    .brand-name {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .receipt-title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    /* 구분선 */
    .divider {
      border: none;
      border-top: 1px dashed #e5e7eb;
      margin: 20px 0;
    }

    /* 필드 행 */
    .section-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #9ca3af;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10px;
      gap: 16px;
    }
    .label {
      font-size: 13px;
      color: #6b7280;
      flex-shrink: 0;
    }
    .value {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
      text-align: right;
    }

    /* 금액 박스 */
    .amount-box {
      background: #f9fafb;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-label {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }
    .amount-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
    }
    .vat-note {
      font-size: 11px;
      color: #9ca3af;
      text-align: right;
      margin-top: 4px;
    }

    /* 푸터 */
    .footer {
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      line-height: 1.8;
      margin-top: 20px;
    }

    @media print {
      body { background: white; padding: 0; align-items: flex-start; }
      .receipt { clip-path: none; width: 100%; padding: 32px 28px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      <div class="brand-name">Mindscope</div>
      <div class="receipt-title">결제 영수증</div>
    </div>

    <hr class="divider" />

    <div class="section-title">결제 정보</div>
    ${rows}

    <hr class="divider" />

    <div class="amount-box">
      <div class="amount-row">
        <span class="amount-label">합계</span>
        <span class="amount-value">${amountLabel}</span>
      </div>
      <div class="vat-note">부가세(VAT) 포함</div>
    </div>

    <div class="footer">
      <div>Mindscope · 심리상담 센터 SaaS</div>
      <div>본 영수증은 전자 발행된 문서입니다.</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  <\/script>
</body>
</html>`
  }

  function handleDownload() {
    const win = window.open(
      '',
      '_blank',
      'width=560,height=820,menubar=no,toolbar=no,scrollbars=yes'
    )
    if (!win) return
    win.document.write(buildReceiptHtml())
    win.document.close()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="p-0"
  headerClass="hidden"
  footerClass="hidden"
>
  {#snippet body()}
    <div class="p-5 pb-7">
      <!-- 헤더: 제목 + 완료 뱃지 -->
      <div class="mb-4 flex items-start justify-between">
        <Typography variant="headline-02-normal-semibold"
          >결제 영수증</Typography
        >
        <span
          class="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
        >
          완료
        </span>
      </div>

      <!-- 만년필 구분선 -->
      <InkDivider />

      <!-- 결제 정보 -->
      <div class="mt-4 space-y-2 text-sm">
        <Typography variant="body-01-semibold" color="text-gray-800"
          >결제 정보</Typography
        >
        <div class="flex items-center justify-between py-0.5">
          <span class="text-gray-500">영수증 번호</span>
          <span class="font-medium text-gray-800">{receiptNo}</span>
        </div>
        <div class="flex items-center justify-between py-0.5">
          <span class="text-gray-500">결제일</span>
          <span class="font-medium text-gray-800">{payment.date}</span>
        </div>
        <div class="flex items-center justify-between py-0.5">
          <span class="text-gray-500">결제 기간</span>
          <span class="font-medium text-gray-800">{payment.period}</span>
        </div>
        <div class="flex items-center justify-between py-0.5">
          <span class="text-gray-500">플랜</span>
          <span class="font-medium text-gray-800"
            >{payment.planLabel} · {payment.cycle}</span
          >
        </div>
        <div class="flex items-center justify-between py-0.5">
          <span class="text-gray-500">결제 수단</span>
          <span class="font-medium text-gray-800">{methodLabel}</span>
        </div>
      </div>

      <!-- 점선 구분선 -->
      <div class="mx-0 mt-3 border-t border-dashed border-gray-300"></div>

      <!-- 금액 요약 -->
      <div class="mt-3 space-y-1 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-gray-600">합계</span>
          <span class="font-semibold text-gray-900">
            {payment.amount === 0
              ? '무료'
              : `₩${payment.amount.toLocaleString()}`}
          </span>
        </div>
        <div class="flex justify-end">
          <span class="text-xs text-gray-400">부가세(VAT) 포함</span>
        </div>
      </div>
    </div>

    <!-- 점선 구분선 -->
    <div class="mx-5 mt-6 border-t border-dashed border-gray-300"></div>

    <!-- 하단 버튼 영역 -->
    <div class="px-5 pt-4 pb-5">
      <div class="flex w-full items-center justify-end gap-3">
        <button
          onclick={closeModal}
          class="flex-center h-11 rounded-lg border border-gray-200 px-4 md:px-6 text-body-01-normal-medium text-gray-700 hover:border-gray-300 duration-200"
        >
          닫기
        </button>
        <button
          onclick={handleDownload}
          class="flex-center h-11 gap-2 rounded-lg bg-primary-400 px-4 md:px-6 text-body-01-normal-medium text-white hover:bg-primary-500 duration-200"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF 저장
        </button>
      </div>
    </div>
  {/snippet}
</BaseModal>
