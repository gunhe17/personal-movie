<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (data: { name: string; address: string; phone: string }) => void
  }

  let { modalId = '', closeModal = () => {}, onConfirm }: Props = $props()

  let name = $state('')
  let zipCode = $state('')
  let address = $state('')
  let addressDetail = $state('')
  let phone = $state('')
  let isAddressSearching = $state(false)

  function openAddressSearch() {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        zipCode = data.zonecode || ''
        address = data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  function handleSubmit() {
    if (!name.trim()) return
    const fullAddress = [zipCode, address, addressDetail]
      .filter(Boolean)
      .join(' ')
    onConfirm?.({
      name: name.trim(),
      address: fullAddress,
      phone: phone.trim()
    })
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="fit"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="기관/단체 등록"
>
  {#snippet body()}
    <div class="flex w-120 flex-col gap-5">
      <!-- 기관명 + 연락처 (2열) -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            기관명 <span class="field-required">*</span>
          </Typography>
          <input
            type="text"
            bind:value={name}
            placeholder="기관명을 입력해주세요"
            class="field-input w-full"
          />
        </div>
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            연락처
          </Typography>
          <input
            type="tel"
            bind:value={phone}
            placeholder="02-0000-0000"
            class="field-input w-full"
          />
        </div>
      </div>

      <!-- 주소 (한 줄) -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          주소
        </Typography>
        <div class="flex gap-2">
          <input
            type="text"
            value={zipCode}
            placeholder="우편번호"
            readonly
            class="field-input w-36"
          />
          <input
            type="text"
            value={address}
            placeholder="주소"
            readonly
            class="field-input flex-1"
          />
          <button
            type="button"
            onclick={openAddressSearch}
            class="h-11 shrink-0 rounded-lg border border-gray-200 bg-white px-4 text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
          >
            검색
          </button>
        </div>
        <input
          type="text"
          bind:value={addressDetail}
          placeholder="상세주소를 입력해주세요"
          class="field-input mt-2 w-full"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        type="button"
        onclick={handleSubmit}
        disabled={!name.trim()}
        class="h-11 rounded-lg bg-primary-500 px-6 text-white transition-colors hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        <Typography
          variant="body-01-normal-medium"
          color={name.trim() ? 'text-white' : 'text-gray-400'}
        >
          등록
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
