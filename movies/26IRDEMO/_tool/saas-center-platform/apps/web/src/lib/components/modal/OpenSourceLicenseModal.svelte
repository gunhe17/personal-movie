<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { openSourceLicenses } from '$lib/constants/changelog'

  interface Props {
    closeModal?: () => void
  }

  let { closeModal = () => {} }: Props = $props()
</script>

<BaseModal
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  title="오픈소스 라이선스"
  bodyClass="p-5 pb-7"
>
  {#snippet body()}
    <p class="mb-4 text-xs text-gray-400">
      본 소프트웨어는 아래 오픈소스 라이브러리를 사용합니다.
    </p>
    <div class="divide-y divide-gray-100">
      {#each openSourceLicenses as lib (lib.name)}
        <div class="flex items-center justify-between py-3">
          <a
            href={lib.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-medium text-gray-700 transition-colors hover:text-primary-600"
          >
            {lib.name}
          </a>
          <span
            class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
          >
            {lib.license}
          </span>
        </div>
      {/each}
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      닫기
    </button>
  {/snippet}
</BaseModal>
