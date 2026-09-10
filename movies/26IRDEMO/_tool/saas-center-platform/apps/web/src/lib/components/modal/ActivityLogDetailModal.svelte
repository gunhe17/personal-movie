<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { ActivityLogVM } from '$lib/features/activity-log/view-model'

  interface Props {
    modalId?: string
    closeModal?: () => void
    item: ActivityLogVM
  }

  let { modalId, closeModal, item }: Props = $props()

  const infoFields = $derived([
    { label: '일시', value: `${item.date} ${item.time}` },
    { label: '행위자', value: item.actorName },
    { label: '카테고리', value: item.categoryLabel },
    { label: '액션', value: item.actionLabel },
    { label: '내용', value: item.summary }
  ])
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  bodyClass="p-5 pb-10"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="flex items-center gap-2.5">
      <Typography variant="title-01-semibold" tag="span" color="text-gray-900">
        활동 상세
      </Typography>
      <span
        class="inline-flex rounded-full px-2 py-0.5 text-body-03-normal-medium {item
          .actionColor.bg} {item.actionColor.text}"
      >
        {item.actionLabel}
      </span>
    </div>
  {/snippet}

  {#snippet body()}
    <!-- 기본 정보 -->
    <div class="space-y-2.5">
      {#each infoFields as { label, value }}
        <div class="flex items-baseline gap-2">
          <Typography
            variant="body-01-regular"
            tag="span"
            color="text-gray-500"
            className="w-24 shrink-0"
          >
            {label}
          </Typography>
          <Typography
            variant="body-01-regular"
            tag="span"
            color="text-gray-800"
          >
            {value || '-'}
          </Typography>
        </div>
      {/each}
    </div>

    <!-- event에 포함된 atomic 변경 상세 -->
    {#if item.changes.length > 0}
      <div class="mt-5 border-t border-gray-100 pt-4">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          변경 내용
        </Typography>
        <div class="space-y-4">
          {#each item.changes as change}
            <div>
              <Typography variant="body-01-medium" color="text-gray-800">
                {change.summary}
              </Typography>
              {#each change.extraSummary as field}
                <div class="mt-1 flex items-baseline gap-2">
                  <Typography
                    variant="body-01-regular"
                    tag="span"
                    color="text-gray-500"
                    className="w-24 shrink-0"
                  >
                    {field.label}
                  </Typography>
                  <Typography
                    variant="body-01-regular"
                    tag="span"
                    color="text-gray-800"
                  >
                    {field.value}
                  </Typography>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}
</BaseModal>
