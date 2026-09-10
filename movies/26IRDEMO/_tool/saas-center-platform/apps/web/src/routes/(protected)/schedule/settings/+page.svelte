<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'

  import Slider from '$root/src/lib/components/Slider.svelte'
  import Switch from '$root/src/lib/components/Switch.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CountStepper from '$root/src/lib/components/CountStepper.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import RefundPolicy from '$root/src/lib/components/RefundPolicy.svelte'
  import { useScheduleSettings } from '$lib/features/schedule/settings/hooks.svelte'
  import {
    formatDepositExpireText,
    getDepositUnit
  } from '$lib/features/schedule/settings/view-model'

  const settings = useScheduleSettings()
</script>

<div in:fade>
  <PageTitleSection title="예약 설정" className="mb-4" />
  <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <section class="space-y-7">
      <div class="space-y-4 max-w-148">
        <h2 class="text-lg text-gray-900 font-semibold">예약 승인 유형</h2>
        <Slider
          class="h-13 rounded-lg"
          bind:value={settings.reservationConfirmType}
          options={settings.RESERVATION_CONFIRM_OPTIONS}
        />
      </div>
      <div class="space-y-4 max-w-148">
        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <h2 class="text-lg text-gray-900 font-semibold">
              예약 변경 횟수를 제한할까요?
            </h2>
            <Switch
              checked={settings.showReservationConfirmType}
              onclick={() => {
                settings.showReservationConfirmType =
                  !settings.showReservationConfirmType
              }}
            />
          </div>
          <Typography
            variant="body-02-reading"
            color="text-gray-600"
            className="mb-4"
          >
            고객이 예약을 변경할 수 있는 횟수를 제한할 수 있어요
          </Typography>
          {#if settings.showReservationConfirmType}
            <div transition:fade>
              <CountStepper
                bind:value={settings.maxReservationCount}
                max={10}
              />
            </div>
          {/if}
        </div>
      </div>
      <div class="space-y-4 max-w-148">
        <div class="flex justify-between items-center mb-2">
          <h2 class="text-lg text-gray-900 font-semibold">
            예약금을 사용할까요?
          </h2>
          <Switch
            checked={settings.showDepositType}
            onclick={() => {
              settings.showDepositType = !settings.showDepositType
            }}
          />
        </div>
        {#if settings.showDepositType}
          <div transition:fade class="space-y-2">
            <Slider
              class="h-13 rounded-lg"
              bind:value={settings.depositType}
              options={settings.DEPOSIT_TYPE_OPTIONS}
            />
            <div class="flex gap-3 items-center">
              <input
                type="number"
                class={twMerge(
                  'field-input font-semibold',
                  'appearance-none',
                  '[&::-webkit-outer-spin-button]:appearance-none',
                  '[&::-webkit-inner-spin-button]:appearance-none',
                  '[&::-webkit-inner-spin-button]:m-0',
                  '[appearance:textfield]'
                )}
                bind:value={settings.depositAmount}
              />
              <Typography variant="title-01-semibold" color="text-gray-700">
                {getDepositUnit(settings.depositType)}
              </Typography>
            </div>
          </div>
        {/if}
      </div>
      <div class="space-y-4 max-w-148">
        <h2 class="text-lg text-gray-900 font-semibold mb-2">센터 계좌번호</h2>
        <div
          class="flex justify-between p-4 h-12 items-center border border-gray-200 bg-gray-50 rounded-lg"
        >
          <Typography variant="title-02-reading" color="text-gray-500">
            {'신한은행 111-111-11111'}
          </Typography>
          <!-- svelte-ignore a11y_consider_explicit_label -->
          <button class="flex-center rounded-lg gap-2 overflow-hidden">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.7214 7.40917C18.7233 7.66101 18.6725 7.91067 18.572 8.1435C18.4716 8.37633 18.3235 8.58763 18.1364 8.76502L16.7691 10.0719L10.1737 16.3759C9.89306 16.642 9.53732 16.8242 9.15004 16.9001L6.78097 17.3544C6.69644 17.3683 6.61082 17.3753 6.52505 17.3753C6.33626 17.3749 6.14991 17.3345 5.9794 17.257C5.8089 17.1795 5.65846 17.0669 5.53891 16.9273C5.41936 16.7876 5.33367 16.6244 5.28798 16.4493C5.2423 16.2742 5.23776 16.0916 5.2747 15.9146L5.74998 13.6502C5.82324 13.278 6.01472 12.9363 6.29838 12.6718L12.7548 6.50062L14.2611 5.06091C14.6376 4.70173 15.1477 4.5 15.6796 4.5C16.2115 4.5 16.7217 4.70173 17.0981 5.06091L18.1364 6.05333C18.3241 6.23031 18.4725 6.44154 18.573 6.67446C18.6735 6.90738 18.724 7.15724 18.7214 7.40917Z"
                fill="#B1B8BE"
              />
              <path
                d="M18.2019 18.4517H7.23394C7.0885 18.4517 6.94901 18.5069 6.84617 18.6052C6.74332 18.7035 6.68555 18.8368 6.68555 18.9758C6.68555 19.1148 6.74332 19.2482 6.84617 19.3465C6.94901 19.4448 7.0885 19.5 7.23394 19.5H18.2019C18.3473 19.5 18.4868 19.4448 18.5897 19.3465C18.6925 19.2482 18.7503 19.1148 18.7503 18.9758C18.7503 18.8368 18.6925 18.7035 18.5897 18.6052C18.4868 18.5069 18.3473 18.4517 18.2019 18.4517Z"
                fill="#E4E4E8"
              />
              <path
                d="M18.721 7.40917C18.7228 7.66101 18.672 7.91067 18.5716 8.1435C18.4711 8.37633 18.323 8.58763 18.136 8.76502L16.7687 10.0719L12.7544 6.50062L14.2607 5.06091C14.6371 4.70173 15.1473 4.5 15.6792 4.5C16.2111 4.5 16.7213 4.70173 17.0977 5.06091L18.136 6.05333C18.3236 6.23031 18.4721 6.44154 18.5726 6.67446C18.6731 6.90738 18.7235 7.15724 18.721 7.40917Z"
                fill="#6D7882"
              />
            </svg>
            <Typography variant="body-02-reading" color="text-gray-700">
              변경
            </Typography>
          </button>
        </div>
      </div>
      <div class="space-y-4 max-w-148">
        <h2 class="text-lg text-gray-900 font-semibold mb-2">예금주</h2>
        <div
          class="flex justify-between p-4 h-12 items-center border border-gray-200 bg-gray-50 rounded-lg"
        >
          <Typography variant="title-02-reading" color="text-gray-500">
            {'인사이터아동발달센터'}
          </Typography>
          <!-- svelte-ignore a11y_consider_explicit_label -->
          <button class="flex-center rounded-lg gap-2 overflow-hidden">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.7214 7.40917C18.7233 7.66101 18.6725 7.91067 18.572 8.1435C18.4716 8.37633 18.3235 8.58763 18.1364 8.76502L16.7691 10.0719L10.1737 16.3759C9.89306 16.642 9.53732 16.8242 9.15004 16.9001L6.78097 17.3544C6.69644 17.3683 6.61082 17.3753 6.52505 17.3753C6.33626 17.3749 6.14991 17.3345 5.9794 17.257C5.8089 17.1795 5.65846 17.0669 5.53891 16.9273C5.41936 16.7876 5.33367 16.6244 5.28798 16.4493C5.2423 16.2742 5.23776 16.0916 5.2747 15.9146L5.74998 13.6502C5.82324 13.278 6.01472 12.9363 6.29838 12.6718L12.7548 6.50062L14.2611 5.06091C14.6376 4.70173 15.1477 4.5 15.6796 4.5C16.2115 4.5 16.7217 4.70173 17.0981 5.06091L18.1364 6.05333C18.3241 6.23031 18.4725 6.44154 18.573 6.67446C18.6735 6.90738 18.724 7.15724 18.7214 7.40917Z"
                fill="#B1B8BE"
              />
              <path
                d="M18.2019 18.4517H7.23394C7.0885 18.4517 6.94901 18.5069 6.84617 18.6052C6.74332 18.7035 6.68555 18.8368 6.68555 18.9758C6.68555 19.1148 6.74332 19.2482 6.84617 19.3465C6.94901 19.4448 7.0885 19.5 7.23394 19.5H18.2019C18.3473 19.5 18.4868 19.4448 18.5897 19.3465C18.6925 19.2482 18.7503 19.1148 18.7503 18.9758C18.7503 18.8368 18.6925 18.7035 18.5897 18.6052C18.4868 18.5069 18.3473 18.4517 18.2019 18.4517Z"
                fill="#E4E4E8"
              />
              <path
                d="M18.721 7.40917C18.7228 7.66101 18.672 7.91067 18.5716 8.1435C18.4711 8.37633 18.323 8.58763 18.136 8.76502L16.7687 10.0719L12.7544 6.50062L14.2607 5.06091C14.6371 4.70173 15.1473 4.5 15.6792 4.5C16.2111 4.5 16.7213 4.70173 17.0977 5.06091L18.136 6.05333C18.3236 6.23031 18.4721 6.44154 18.5726 6.67446C18.6731 6.90738 18.7235 7.15724 18.721 7.40917Z"
                fill="#6D7882"
              />
            </svg>
            <Typography variant="body-02-reading" color="text-gray-700">
              변경
            </Typography>
          </button>
        </div>
      </div>
      <div class="space-y-4 max-w-148">
        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <h2 class="text-lg text-gray-900 font-semibold">
              예약금 입금 마감
            </h2>
            <Switch
              checked={settings.showDepositExpireType}
              onclick={() => {
                settings.showDepositExpireType = !settings.showDepositExpireType
              }}
            />
          </div>
          <Typography
            variant="body-02-reading"
            color="text-gray-600"
            className="mb-4"
          >
            예약금 입금 마감 시간을 설정할 수 있어요
          </Typography>
          {#if settings.showDepositExpireType}
            <div transition:fade class="space-y-2">
              <Slider
                class="h-13 rounded-lg"
                bind:value={settings.depositExpireType}
                options={settings.DEPOSIT_EXPIRE_OPTIONS}
              />
              <Typography
                variant="body-02-reading"
                color="text-gray-600"
                className="text-right"
              >
                일정 등록 후 +{formatDepositExpireText(
                  settings.depositExpireType
                )}까지 예약금 마감
              </Typography>
            </div>
          {/if}
        </div>
      </div>
      <div class="space-y-4 max-w-148">
        <div class="flex justify-between items-center mb-2">
          <h2 class="text-lg text-gray-900 font-semibold">환불 규정</h2>
          <Switch
            checked={settings.showWithdrawalRules}
            onclick={() => {
              settings.showWithdrawalRules = !settings.showWithdrawalRules
            }}
          />
        </div>
        {#if settings.showWithdrawalRules}
          <div transition:fade class="space-y-4">
            <button
              class="w-full h-11 rounded-lg bg-[#F4F8FF] hover:bg-primary-100 duration-200 flex-center"
            >
              <Typography variant="body-01-normal-medium" color="text-primary">
                환불 규정 문구 설정
              </Typography>
            </button>
            <RefundPolicy />
          </div>
        {/if}
      </div>
    </section>
    <div class="max-w-148 mt-10 flex justify-end">
      <button
        class="w-full h-11 flex-center bg-primary hover:bg-primary-400 duration-200 rounded-norm"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          저장
        </Typography>
      </button>
    </div>
  </div>
</div>
