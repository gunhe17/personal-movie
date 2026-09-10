<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import EditUnderlineIcon from '../assets/EditUnderlineIcon.svelte'
  import TrashIcon from '../assets/TrashIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    selectedClient?: any
    isClientEditMode: boolean
    isDropdownOpen: boolean
  }

  let { selectedClient, isClientEditMode, isDropdownOpen }: Props = $props()

  const handleChangeClient = () => {
    isClientEditMode = true
    isDropdownOpen = true
  }

  const handleDeleteClient = () => {
    selectedClient = null
    isDropdownOpen = true
  }
</script>

<div class="mb-6 rounded-lg bg-primary-50 p-4">
  <!-- 헤더: 이름, ID, 성별, 나이, 수정/삭제 버튼 -->
  <div class="flex items-center justify-between pb-2">
    <div class="flex items-center gap-2">
      <!-- 프로필 아이콘 -->
      <Typography variant="body-01-medium" color="text-gray-900">
        {selectedClient.name}
      </Typography>
      <Typography variant="body-03-medium" color="text-gray-700">
        ({selectedClient.uid})
      </Typography>
      <span class="text-sm text-gray-600"
        >{selectedClient.gender === '여자' ? '여' : '남'}</span
      >
    </div>
    <div>
      <!-- 수정 버튼 -->

      <button
        type="button"
        onclick={handleChangeClient}
        class="ml-1 text-gray-400 hover:text-gray-600"
        aria-label="수정"
      >
        <EditUnderlineIcon />
      </button>

      <!-- 삭제 버튼 -->
      <Tooltip text="삭제">
        <button
          type="button"
          onclick={handleDeleteClient}
          class="text-gray-400 hover:text-status-danger"
          aria-label="삭제"
        >
          <TrashIcon size={24} />
        </button>
      </Tooltip>
    </div>
  </div>
  <!-- 상세 정보 그리드 -->
  <div class="grid grid-cols-2 gap-x-12 gap-y-2">
    <!-- Row 1 -->
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        생년월일
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.birth_date
          ? new Date(selectedClient.birth_date).toISOString().split('T')[0]
          : '-'}
      </Typography>
    </div>
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        보호자 성함
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.guardian_name || '-'}
      </Typography>
    </div>
    <!-- Row 2 -->
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        소속기관
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.organization || '-'}
      </Typography>
    </div>
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        보호자 연락처
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.guardian_phone || '-'}
      </Typography>
    </div>
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        주소(서울시-구)
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.address || '-'}
      </Typography>
    </div>
    <div class="flex items-center">
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="w-28 shrink-0"
      >
        보호자 이메일
      </Typography>
      <Typography variant="body-03-regular" color="text-gray-700">
        {selectedClient.guardian_email || '-'}
      </Typography>
    </div>
  </div>
</div>
