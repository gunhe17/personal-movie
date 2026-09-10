<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { changelog } from '$lib/constants/changelog'

  interface Props {
    closeModal?: () => void
  }

  let { closeModal = () => {} }: Props = $props()
</script>

<BaseModal
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  title="업데이트 내역"
  bodyClass="p-5 pb-7"
>
  {#snippet body()}
    <div class="relative ml-2">
      {#each changelog as entry, i (entry.version)}
        <div
          class="relative pl-7 border-l-2 border-primary-100 {i ===
          changelog.length - 1
            ? 'pb-0'
            : 'pb-8'}"
        >
          <!-- 타임라인 노드 -->
          <div
            class="absolute -left-[7px] top-1 h-3 w-3 rounded-full {i === 0
              ? 'bg-primary-500 ring-4 ring-primary-50'
              : 'border-2 border-primary-300 bg-white'}"
          ></div>

          <!-- 버전 + 날짜 -->
          <div class="flex items-center gap-2.5 mb-2">
            <span
              class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold {i ===
              0
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-500'}"
            >
              v{entry.version}
            </span>
            <span class="text-xs text-gray-400">{entry.date}</span>
          </div>

          <!-- 요약 -->
          {#if entry.summary}
            <p class="text-[15px] font-semibold text-gray-900 mb-2.5">
              {entry.summary}
            </p>
          {/if}

          <!-- 변경 사항 -->
          <ul class="space-y-1.5">
            {#each entry.changes as change}
              <li class="flex items-start gap-2 text-sm text-gray-600">
                <svg
                  class="mt-0.5 h-4 w-4 shrink-0 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m9 5 7 7-7 7"
                  />
                </svg>
                <span>{change}</span>
              </li>
            {/each}
          </ul>
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
