<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BarolinkProcessImg from '$lib/assets/BarolinkProcessImg.png'
  import BarolinkProcessStrokeIcon from '$lib/assets/BarolinkProcessStrokeIcon.svelte'
  import BaroLinkTextWithIcon from '../../assets/BaroLinkTextWithIcon.svelte'
  import { t } from '$lib/ontology/terms'

  interface Props {
    modalId?: string
    closeModal?: () => void
  }

  let { modalId = '', closeModal = () => {} }: Props = $props()
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
  containerClass="w-full max-w-[640px] max-h-[90dvh] overflow-auto rounded-lg bg-white"
>
  {#snippet body()}
    <div class="p-5 flex h-full flex-col items-center">
      <!-- 헤더: 바로링크 로고 + 텍스트 -->
      <div class="mb-2 flex items-center gap-2">
        <BaroLinkTextWithIcon />
        <Typography variant="headline-01-normal-semibold" color="text-gray-800">
          로 검사 안내를 확인해요!
        </Typography>
      </div>

      <!-- 서브 텍스트 -->
      <div class="mb-4 text-center flex flex-col gap-1">
        <Typography
          variant="body-03-reading-regular"
          color="text-gray-500"
          className="whitespace-pre-line text-center"
        >
          {`온라인 지원 검사를 선택해 바로링크를 보내면\n${t('subject')}가 받은 링크에서 인증 후 검사를 진행할 수 있어요.`}
        </Typography>
      </div>

      <!-- 바로링크 가능 검사 목록 -->
      <div
        class="mb-6 bg-white flex justify-center items-center w-full h-[38px] rounded-[8px]"
      >
        <Typography variant="body-03-medium" color="text-primary-500">
          전송 화면에는 온라인 지원이 확인된 검사만 표시됩니다.
        </Typography>
      </div>

      <!-- 이미지 영역 -->
      <div class="mb-6 flex flex-1 items-center justify-center">
        <div class="relative">
          <!-- 스트로크 (뒤에 배치, 오른쪽으로 삐죽 튀어나옴) -->
          <div
            class="absolute inset-0 flex items-center justify-end pointer-events-none translate-x-8"
          >
            <BarolinkProcessStrokeIcon />
          </div>
          <!-- 이미지 (앞에 배치) -->
          <img
            src={BarolinkProcessImg}
            alt="바로링크 프로세스 안내"
            class="relative z-10 max-h-[240px] object-contain"
          />
        </div>
      </div>

      <!-- 확인 버튼 -->
      <p class="mb-4 text-center text-body-03-normal-regular text-gray-600">
        현재 바로링크에서는 온라인 검사를 진행할 수 있습니다. 결과보고서 통합
        조회는 아직 연결되지 않았으며, 지금은 별도로 받은 결과 링크에서 확인합니다.
        새 링크를 전송하면 기존 링크는 사용할 수 없습니다.
      </p>
      <Button
        onclick={closeModal}
        class="h-11 w-full rounded-lg bg-gradient-to-r from-[#5b8cff] to-[#3f6cf5] px-8 duration-200 hover:from-[#6b99ff] hover:to-[#5580f7]"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          확인했어요
        </Typography>
      </Button>
    </div>
  {/snippet}
</BaseModal>
