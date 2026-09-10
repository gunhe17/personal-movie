<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import DocumentPreview from '$lib/components/DocumentPreview.svelte'
  import PreAdmissionPreviewModal from '$lib/components/clients/detail/PreAdmissionPreviewModal.svelte'
  import ProfileSection from '$lib/components/clients/detail/ProfileSection.svelte'
  import ProfileSectionPanel from '$lib/components/clients/detail/ProfileSectionPanel.svelte'
  import ContentPanel from '$lib/components/clients/detail/ContentPanel.svelte'
  import {
    getClientVoucherList,
    type ClientVoucherResponse
  } from '$lib/hooks/actions/clientVoucher.action'
  import {
    buildClientVoucherListInput,
    mapToClientVoucherCardVM,
    createVoucherService
  } from '$lib/features/clients/detail/voucher'
  import { browser } from '$app/environment'
  import { centerId } from '$lib/stores/center.store'
  import { responsive, BREAKPOINTS } from '$lib/stores/responsive.svelte'
  import CareBoardDock from '$lib/components/care-board/CareBoardDock.svelte'
  import { panelStore } from '$lib/stores/sidePanel'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getClientDetail,
    getClientDocuments
  } from '$lib/hooks/actions/client.action'
  import {
    getFormTemplates,
    getFormTemplate,
    getFormInstance,
    getClientFormInstances
  } from '$lib/hooks/actions/form.action'
  import {
    buildClientDetailInput,
    buildClientDocsInput,
    buildTemplatesInput,
    buildInstancesInput,
    buildFormInstanceInput,
    buildFormTemplateInput,
    mapToClientDetailVM,
    mapToPreAdmissionDocument,
    mapToDocumentList,
    createDetailService,
    type DetailTab,
    type RelationInfo
  } from '$lib/features/clients/detail'
  import { DETAIL_TABS } from '$lib/features/clients/detail/constants'
  import { page } from '$app/state'
  import { afterNavigate } from '$app/navigation'
  import type { ClientDocumentItem } from '$lib/types/client'

  // ── Props ──
  interface Props {
    params: { clientId: string }
  }
  let { params }: Props = $props()
  const clientId = $derived(params.clientId)

  // ── 로컬 상태 ──
  // 진입 시 ?tab= 쿼리로 초기 탭 지정 가능 (없거나 유효하지 않으면 사전기록지)
  const initialTab = ((): DetailTab => {
    const t = page.url.searchParams.get('tab')
    return DETAIL_TABS.some((tab) => tab.value === t)
      ? (t as DetailTab)
      : 'history'
  })()
  // 사전기록지는 탭이 아닌 프리뷰 모달로 진입 (?tab=preAdmission 진입 시 모달 오픈)
  let activeTab = $state<DetailTab>(
    initialTab === 'preAdmission' ? 'history' : initialTab
  )
  let showPreAdmission = $state(initialTab === 'preAdmission')
  let previewDocument = $state<ClientDocumentItem | null>(null)
  let fileCache = $state<Record<string, File>>({})
  let preAdmissionFileLoading = $state(false)
  let selectedVoucherId = $state<string | null>(null)

  // ── 쿼리 선언 ──
  const clientDetailQuery = $derived(
    queryBuilder(
      getClientDetail,
      () => ($centerId ? buildClientDetailInput($centerId, clientId) : null),
      { enabled: !!$centerId }
    )
  )

  const clientVouchersQuery = $derived(
    queryBuilder(
      getClientVoucherList,
      () => buildClientVoucherListInput($centerId, clientId),
      { enabled: browser && !!$centerId }
    )
  )
  const voucherCards = $derived(
    ((clientVouchersQuery.data?.items as ClientVoucherResponse[]) ?? []).map(
      mapToClientVoucherCardVM
    )
  )
  const selectedVoucher = $derived(
    voucherCards.find((v) => v.id === selectedVoucherId) ?? null
  )

  // 바우처 탭을 벗어나면 상세 선택 초기화 → 재진입 시 항상 목록부터
  $effect(() => {
    if (activeTab !== 'vouchers') selectedVoucherId = null
  })

  const clientDocsQuery = $derived(
    queryBuilder(
      getClientDocuments,
      () => ($centerId ? buildClientDocsInput($centerId, clientId) : null),
      { enabled: !!$centerId }
    )
  )

  const templatesQuery = $derived(
    queryBuilder(
      getFormTemplates,
      () => ($centerId ? buildTemplatesInput($centerId) : null),
      { enabled: !!$centerId }
    )
  )

  let preAdmissionTemplate = $derived.by(() => {
    const items = templatesQuery.data?.items
    return items?.find((t) => t.name === '사전기록지' && t.is_active) ?? null
  })

  const instancesQuery = $derived(
    queryBuilder(
      getClientFormInstances,
      () => {
        if (!$centerId || !preAdmissionTemplate) return null
        return buildInstancesInput($centerId, clientId, preAdmissionTemplate.id)
      },
      { enabled: !!$centerId && !!preAdmissionTemplate }
    )
  )

  let preAdmissionState = $derived.by(() => {
    const items = instancesQuery.data?.items
    if (!items?.length) return 'empty'
    return items[0].instance.status
  })

  let latestInstanceId = $derived.by(() => {
    const items = instancesQuery.data?.items
    return items?.[0]?.instance.id ?? null
  })

  const submittedInstanceQuery = $derived(
    queryBuilder(
      getFormInstance,
      () => {
        if (
          preAdmissionState !== 'submitted' ||
          !latestInstanceId ||
          !$centerId
        )
          return null
        return buildFormInstanceInput($centerId, latestInstanceId)
      },
      { enabled: !!$centerId && preAdmissionState === 'submitted' }
    )
  )

  const templateSchemaQuery = $derived(
    queryBuilder(
      getFormTemplate,
      () => {
        if (
          preAdmissionState !== 'submitted' ||
          !preAdmissionTemplate ||
          !$centerId
        )
          return null
        return buildFormTemplateInput($centerId, preAdmissionTemplate.id)
      },
      { enabled: !!$centerId && !!preAdmissionTemplate }
    )
  )

  // ── 파생 상태 (ViewModel) ──
  const client = $derived(mapToClientDetailVM(clientDetailQuery.data))
  const documentData = $derived(clientDocsQuery.data?.items || [])
  const preAdmissionDocument = $derived(mapToPreAdmissionDocument(documentData))
  const documents = $derived(mapToDocumentList(documentData))
  const submittedInstance = $derived(submittedInstanceQuery.data ?? null)
  const templateSchema = $derived(templateSchemaQuery.data?.schema ?? null)

  const preAdmissionPdfDocument = $derived.by(() => {
    if (!preAdmissionDocument) return null
    if (!preAdmissionDocument.fileType?.includes('pdf')) return null
    return preAdmissionDocument
  })

  const preAdmissionImageDocument = $derived.by(() => {
    if (!preAdmissionDocument) return null
    if (preAdmissionDocument.fileType?.startsWith('image/'))
      return preAdmissionDocument
    return null
  })

  // ── 관계 정보 ──
  let relationList = $state<RelationInfo[]>([])

  $effect(() => {
    const cid = $centerId
    if (!cid || !clientId) return

    service.fetchRelations(cid).then((list) => {
      relationList = list
    })
  })

  // ── 사전기록지 파일 캐시 (PDF / 이미지 모두) ──
  $effect(() => {
    const doc = preAdmissionPdfDocument ?? preAdmissionImageDocument
    if (!doc || fileCache[doc.id]) return

    const run = async () => {
      const file = await service.fetchDocumentFile(doc)
      fileCache = { ...fileCache, [doc.id]: file }
    }
    run()
  })

  // ── 서비스 ── (clientId 변경 시 재생성되어 클로저에 최신 id 바인딩)
  const service = $derived.by(() =>
    createDetailService({
      clientId,
      refetchInstances: () => instancesQuery.refetch(),
      refetchDocs: () => clientDocsQuery.refetch(),
      refetchDetail: () => clientDetailQuery.refetch()
    })
  )

  const queryClient = useQueryClient()
  const voucherService = $derived.by(() =>
    createVoucherService({ queryClient, clientId })
  )

  // ── 반응형 ──
  // ── 케어보드 도크 ──
  // 도크는 페이지 위에 뜨는 게 아니라 **같은 층에서 폭을 나눠 갖는다** — 덮으면
  // 탭 우측에 붙은 CTA(문서 `파일 추가`·바우처 등록)가 가려져 클릭은 되는데
  // 보이지 않는 상태가 된다.
  let careBoardOpen = $state(false)
  // 인트로(접힘→펼침)는 이 상세에 **새로 들어올 때만** 한다.
  // 정보 수정 폼처럼 이 화면의 부속 화면에서 되돌아온 경우엔 직전 상태를 그대로 복원한다
  // — 매번 다시 펼쳐지면 접어둔 사용자의 선택이 무시된다.
  let careBoardIntro = $state(true)
  const CARE_BOARD_KEY = $derived(`careBoard:${clientId}`)
  /** 이 상세의 부속 화면 — 여기서 돌아온 건 "재진입"이 아니다 */
  const isSubScreen = (path: string) => path.startsWith('/clients/register')

  // 복원 판정이 끝나기 전에는 저장하지 않는다 — 마운트 직후 초기값(false)이 먼저
  // 기록되면 직전에 저장해둔 '펼침'을 덮어써 항상 접힌 채로 돌아온다(실측 버그)
  let careBoardRestored = $state(false)

  afterNavigate((nav) => {
    const from = nav.from?.url.pathname ?? ''
    const saved = browser ? sessionStorage.getItem(CARE_BOARD_KEY) : null
    if (from && isSubScreen(from) && saved !== null) {
      careBoardIntro = false
      careBoardOpen = saved === '1'
    } else {
      careBoardIntro = true
      careBoardOpen = false
    }
    careBoardRestored = true
  })

  $effect(() => {
    const isOpen = careBoardOpen
    if (!browser || !careBoardRestored) return
    sessionStorage.setItem(CARE_BOARD_KEY, isOpen ? '1' : '0')
  })

  // ── 반응형 ──
  // 도크가 먹은 폭(400)을 뺀 **유효 폭**으로 판정한다 — 창 크기만 보면 도크가 열려
  // 좁아진 걸 페이지가 모르고 좌측 패널 폭을 유지하다 우측이 짜부라진다.
  const isOverlayMode = $derived(
    !responsive.isDesktop ||
      responsive.width - (careBoardOpen ? 400 : 0) < BREAKPOINTS.xl
  )

  function openProfilePanel() {
    panelStore.open({
      component: ProfileSectionPanel as any,
      props: {
        client,
        clientId,
        relationList,
        onEditClick: service.openChangeClientInfoModal,
        onRelationClick: service.openRelationInfoModal
      },
      options: { width: 'w-[min(90vw,400px)]' }
    })
  }

  // ── 이벤트 핸들러 ──
  const handleDocumentPreview = async (doc: ClientDocumentItem) => {
    const result = await service.openDocumentPreview(doc, fileCache)
    if (!result) return
    fileCache = { ...fileCache, [doc.id]: result.file }
    previewDocument = result.document
  }
</script>

{#if client}
  <!-- 케어보드 도크가 열리면 본문 우측을 그만큼 비운다 — 360 = 도크 400 − 40.
       셸 우측 패딩 80이 이미 있으므로 콘텐츠 ↔ 도크 간격이 40이 된다
       (Web_Design.md §Spacing > 컨테이너 패딩 — 영구 크롬 80 / 열린 도크 40) -->
  <div
    in:fade
    class="xl:h-full xl:min-h-0 flex flex-col bg-gray-50 transition-[padding] duration-200 {careBoardOpen
      ? 'pr-[360px]'
      : ''}"
  >
    <!-- 상단 네비게이션 -->
    <nav
      class="shrink-0 mb-2 h-11 text-sm text-gray-500 flex justify-between items-center"
    >
      <!-- 브레드크럼 (상담·검사 상세와 동일 규격) -->
      <div class="flex items-center gap-2">
        <button
          onclick={() => history.back()}
          aria-label="뒤로가기"
          class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowBackIcon />
        </button>

        <button
          onclick={() => history.back()}
          class="transition-colors hover:text-body-default"
        >
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-subtle"
          >
            내담자
          </Typography>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
        >
          {$isSecretMode ? maskName(client.name) : client.name}
        </Typography>
      </div>
      <div class="flex gap-2 items-center">
        {#if isOverlayMode}
          <button
            onclick={openProfilePanel}
            class="flex-center h-8 px-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Typography variant="body-02-medium" color="text-gray-700">
              내담자 정보
            </Typography>
          </button>
        {/if}
      </div>
    </nav>

    <!-- 데스크탑: 남은 높이를 grid가 정확히 차지하고, 스크롤은 각 컬럼 내부에서만.
         좌측 폭은 컨테이너 대비 비율(--spacing-detail-side) — 케어보드 도크가 열리면
         셸에 pr이 붙어 컨테이너가 줄고, 좌측도 같은 비율로 따라 줄어든다
         (옛 400→360 단계 분기는 이 비율 계산이 대신한다). -->
    <div
      class="grid gap-4 transition-[grid-template-columns] duration-200 xl:flex-1 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)] {isOverlayMode
        ? 'grid-cols-1'
        : 'grid-cols-[var(--spacing-detail-side)_1fr]'}"
    >
      <!-- 좌측 프로필 (바우처 목록 포함) -->
      {#if !isOverlayMode}
        <ProfileSection
          {client}
          {clientId}
          {relationList}
          isSecretMode={$isSecretMode}
          onEditClick={service.openChangeClientInfoModal}
          onRelationClick={service.openRelationInfoModal}
          onPreAdmissionClick={() => (showPreAdmission = true)}
          onAvatarChange={service.changeAvatar}
          vouchers={voucherCards}
          vouchersLoading={clientVouchersQuery.isLoading}
          onVoucherSelect={(id) => {
            selectedVoucherId = id
            activeTab = 'vouchers'
          }}
          onVoucherCreate={voucherService.openCreateModal}
        />
      {/if}

      <!-- 우측 탭 패널 -->
      <ContentPanel
        bind:activeTab
        {clientId}
        {documents}
        onDocumentUpload={service.openUploadDocumentModal}
        onDocumentPreview={handleDocumentPreview}
        onDocumentDownload={(doc) =>
          service.handleDownloadDocument(doc, fileCache)}
        onDocumentDelete={service.handleDeleteDocument}
        vouchers={voucherCards}
        {selectedVoucher}
        hasVouchers={voucherCards.length > 0}
        onVoucherSelect={(id) => (selectedVoucherId = id)}
        onVoucherClear={() => (selectedVoucherId = null)}
        onVoucherCreate={voucherService.openCreateModal}
      />
    </div>
  </div>
{/if}

{#if previewDocument}
  <DocumentPreview
    document={previewDocument}
    onClose={() => (previewDocument = null)}
  />
{/if}

{#if showPreAdmission}
  <PreAdmissionPreviewModal
    onClose={() => (showPreAdmission = false)}
    {preAdmissionState}
    {preAdmissionDocument}
    {preAdmissionPdfDocument}
    {preAdmissionImageDocument}
    {fileCache}
    {submittedInstance}
    {templateSchema}
    {preAdmissionFileLoading}
    onUploadClick={() =>
      service.openSingleUploadDocumentModal(preAdmissionDocument)}
    onResendClick={() => service.handleOnlineRequest(preAdmissionTemplate)}
  />
{/if}

<!-- 케어보드 — 이 내담자의 기록 스트림.
     fixed 요소(진입 버튼 / 도크)만 그리므로 위 레이아웃은 건드리지 않는다.
     기본은 펼침이되 진입 직후 한 박자 접혀 있다가 펼쳐진다(접을 수 있음을 알리는 인트로). -->
{#if client}
  <CareBoardDock
    {clientId}
    clientName={client.name}
    clientBirthDate={client.birth}
    clientGender={client.gender}
    clientProfileImageUrl={client.profileImageUrl}
    bind:open={careBoardOpen}
    defaultOpen={careBoardIntro}
  />
{/if}
