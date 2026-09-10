<script lang="ts">
  /**
   * 시크릿 모드 활성화 모달 — saas-center-platform 의 SecretModeActivateModal 이식.
   * mindbom 컨벤션에 맞춰 BaseModal/Typography 를 utility class 로 대체.
   *
   * resolve 결과: 선택한 모드 ('masking' | 'lockscreen') 또는 null (취소).
   */

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: 'masking' | 'lockscreen' | null) => void
  }

  let {
    closeModal = () => {},
    _modalResolve = () => {}
  }: Props = $props()

  let selected = $state<'masking' | 'lockscreen' | null>(null)

  function handleConfirm() {
    if (!selected) return
    _modalResolve(selected)
    closeModal()
  }

  function handleCancel() {
    _modalResolve(null)
    closeModal()
  }
</script>

<div class="px-6 pt-8 pb-6">
  <div class="flex flex-col items-center text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
      <span class="material-icons-round text-2xl text-orange-500">visibility_off</span>
    </div>

    <h3 class="mb-3 text-lg font-semibold text-gray-800">시크릿 모드를 활성화할게요</h3>
    <p class="mb-5 text-sm text-gray-600">상황에 맞게 원하는 모드를 사용해보세요</p>

    <div class="flex w-full gap-3">
      <button
        type="button"
        onclick={() => (selected = 'masking')}
        class="flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-5 transition-all
          {selected === 'masking'
            ? 'border-orange-400 bg-orange-50 shadow-sm'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}"
      >
        <span class="material-icons-round text-2xl {selected === 'masking' ? 'text-orange-600' : 'text-gray-500'}">visibility_off</span>
        <span class="text-sm font-medium {selected === 'masking' ? 'text-orange-700' : 'text-gray-800'}">마스킹</span>
        <span class="text-xs leading-snug {selected === 'masking' ? 'text-orange-600' : 'text-gray-500'}">
          이름, 연락처 등<br />개인정보를 *** 처리
        </span>
      </button>

      <button
        type="button"
        onclick={() => (selected = 'lockscreen')}
        class="flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-5 transition-all
          {selected === 'lockscreen'
            ? 'border-orange-400 bg-orange-50 shadow-sm'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}"
      >
        <span class="material-icons-round text-2xl {selected === 'lockscreen' ? 'text-orange-600' : 'text-gray-500'}">lock</span>
        <span class="text-sm font-medium {selected === 'lockscreen' ? 'text-orange-700' : 'text-gray-800'}">화면 잠금</span>
        <span class="text-xs leading-snug {selected === 'lockscreen' ? 'text-orange-600' : 'text-gray-500'}">
          화면 전체를 잠금 처리하여<br />접근을 차단해요
        </span>
      </button>
    </div>
  </div>

  <div class="mt-6 grid grid-cols-2 gap-3">
    <button
      type="button"
      onclick={handleCancel}
      class="h-12 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300"
    >
      취소
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!selected}
      class="h-12 rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
    >
      활성화
    </button>
  </div>
</div>
