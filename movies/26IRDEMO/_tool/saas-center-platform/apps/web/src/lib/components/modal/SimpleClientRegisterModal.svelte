<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { useQueryClient } from '@tanstack/svelte-query'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '../Select.svelte'
  import Switch from '../Switch.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { extractErrorMessage } from '$lib/utils/errorHandler'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    postCreateClient,
    createGuardianRelation,
    type ClientRole
  } from '$lib/hooks/actions/client.action'
  import {
    GUARDIAN_RELATION_OPTIONS,
    RELATION_DETAIL_MAP
  } from '$lib/features/clients/register/constants'

  export interface RegisteredClientData {
    id: string
    name: string
    gender: 'male' | 'female'
    birthDate: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    onRegistered?: (client: RegisteredClientData) => void
  }

  let { modalId = '', closeModal = () => {}, onRegistered }: Props = $props()

  const queryClient = useQueryClient()

  // ── 내담자 ──
  let name = $state('')
  let gender = $state<'male' | 'female'>('male')
  let birthDate = $state('')
  let email = $state('')
  let phone = $state('')

  // ── 주소 ──
  let zipCode = $state('')
  let address = $state('')
  let addressDetail = $state('')
  let isAddressSearching = $state(false)

  // ── 보호자 카드 ──
  type GuardianCard = {
    id: string
    name: string
    birthDate: string
    gender: 'male' | 'female'
    phone: string
    relation: string
  }

  function emptyGuardianCard(): GuardianCard {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: '',
      birthDate: '',
      gender: 'male',
      phone: '',
      relation: ''
    }
  }

  let guardianCards = $state<GuardianCard[]>([emptyGuardianCard()])

  /** 보호자는 선택 입력 — 등록 페이지와 같이 타이틀 우측 토글로 켠다(기본 꺼짐). */
  let guardianOn = $state(false)

  // 끄면 입력값을 버린다 — 접힌 채 남은 값이 조용히 함께 등록되면 안 된다
  // (등록 페이지 resetOptionalSection과 같은 계약).
  function applyGuardianToggle() {
    guardianCards = [emptyGuardianCard()]
  }

  let isSubmitting = $state(false)

  function handleNameInput(e: Event) {
    const input = e.target as HTMLInputElement
    name = input.value.slice(0, 20)
  }

  function formatBirthInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 4) return digits
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
  }

  function formatPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  function addGuardianCard() {
    guardianCards = [...guardianCards, emptyGuardianCard()]
  }

  function removeGuardianCard(id: string) {
    guardianCards = guardianCards.filter((g) => g.id !== id)
    if (guardianCards.length === 0) guardianCards = [emptyGuardianCard()]
  }

  function parseBirthDate(value: string): Date | null {
    const clean = value.replace(/-/g, '')
    if (clean.length !== 8) return null
    const y = Number(clean.slice(0, 4))
    const m = Number(clean.slice(4, 6))
    const d = Number(clean.slice(6))
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    if (y < 1900 || y > new Date().getFullYear()) return null
    const parsed = new Date(y, m - 1, d)
    if (
      parsed.getFullYear() !== y ||
      parsed.getMonth() !== m - 1 ||
      parsed.getDate() !== d
    )
      return null
    return parsed
  }

  const isValidBirthDate = $derived(parseBirthDate(birthDate) !== null)
  const birthDateComplete = $derived(birthDate.replace(/-/g, '').length === 8)
  const showBirthDateError = $derived(birthDateComplete && !isValidBirthDate)
  // 입력이 하나라도 있는 보호자 카드 = 등록 대상. 토글이 꺼져 있으면 대상 없음.
  const touchedGuardianCards = $derived(
    guardianOn
      ? guardianCards.filter(
          (g) =>
            g.name.trim() || g.phone.trim() || g.relation || g.birthDate.trim()
        )
      : []
  )
  const isGuardianCardsComplete = $derived(
    touchedGuardianCards.every(
      (g) => g.name.trim() && g.phone.trim() && g.relation
    )
  )
  const canSubmit = $derived(
    name.trim() !== '' && isValidBirthDate && !isSubmitting
  )

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

  function extractResponseId(response: unknown): string | undefined {
    const anyResponse = response as { id?: string; data?: { id?: string } }
    return anyResponse?.data?.id ?? anyResponse?.id
  }

  async function handleSubmit() {
    if (!canSubmit) return

    const birth = parseBirthDate(birthDate)
    if (!birth) {
      snackbarStore.error('생년월일을 YYYY-MM-DD 형식으로 입력해주세요.')
      return
    }
    if (!isGuardianCardsComplete) {
      snackbarStore.error('보호자 이름·연락처·관계를 모두 입력해주세요.')
      return
    }

    isSubmitting = true
    try {
      const centerId = requireCenterId()
      const createClientAction = postCreateClient()

      const fullAddress = [zipCode, address, addressDetail]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ')

      const clientResponse = await createClientAction.request({
        centerId,
        payload: {
          role: 'client' as ClientRole,
          name: name.trim(),
          birth_date: birthDate,
          gender,
          phone: phone || null,
          email: email || null,
          address: fullAddress || null
        }
      })

      const clientId = extractResponseId(clientResponse)
      if (!clientId) {
        throw new Error('내담자 생성 결과를 확인할 수 없습니다.')
      }

      for (let idx = 0; idx < touchedGuardianCards.length; idx++) {
        const card = touchedGuardianCards[idx]
        const guardianResponse = await createClientAction.request({
          centerId,
          payload: {
            role: 'guardian' as ClientRole,
            name: card.name.trim(),
            gender: card.gender,
            birth_date: card.birthDate || null,
            phone: card.phone || null
          }
        })

        const guardianId = extractResponseId(guardianResponse)
        if (guardianId) {
          await createGuardianRelation().request({
            centerId,
            client_id: clientId,
            related_client_id: guardianId,
            relation_type: 'guardian',
            relation_detail: RELATION_DETAIL_MAP[card.relation] ?? 'caregiver',
            is_primary: idx === 0
          })
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ['getClientList'],
        exact: false
      })

      snackbarStore.success('내담자가 등록되었어요.')
      onRegistered?.({ id: clientId, name: name.trim(), gender, birthDate })
      closeModal()
    } catch (error) {
      snackbarStore.error(extractErrorMessage(error))
    } finally {
      isSubmitting = false
    }
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
  title="새로운 내담자를 추가할게요"
>
  {#snippet body()}
    <!-- 내담자 블록 ↔ 보호자 블록 32(등록 페이지 섹션 간격과 동일).
         블록 안 필드 그룹 사이는 24 — '구분 > 그룹 내부' 부등식 유지. -->
    <div class="flex flex-col gap-8">
      <div class="space-y-6">
        <!-- Row 1: 이름 | 성별 (2-col) -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="simple-client-name" class="field-label mb-2">
              이름 <span class="field-required">*</span>
            </label>
            <input
              id="simple-client-name"
              type="text"
              value={name}
              oninput={handleNameInput}
              maxlength={20}
              placeholder="이름을 입력해주세요"
              class="field-input w-full"
            />
          </div>
          <div>
            <p class="field-label mb-2">
              성별 <span class="field-required">*</span>
            </p>
            <div class="flex h-12 items-center gap-6">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="simpleRegGender"
                  value="male"
                  checked={gender === 'male'}
                  onchange={() => (gender = 'male')}
                  class="h-5 w-5 cursor-pointer accent-primary-500"
                />
                <Typography
                  variant="body-01-normal-medium"
                  color="text-body-default">남자</Typography
                >
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="simpleRegGender"
                  value="female"
                  checked={gender === 'female'}
                  onchange={() => (gender = 'female')}
                  class="h-5 w-5 cursor-pointer accent-primary-500"
                />
                <Typography
                  variant="body-01-normal-medium"
                  color="text-body-default">여자</Typography
                >
              </label>
            </div>
          </div>
        </div>

        <!-- Row 2: 생년월일 | 이메일 (2-col) -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="simple-client-birth" class="field-label mb-2">
              생년월일 <span class="field-required">*</span>
            </label>
            <input
              id="simple-client-birth"
              type="text"
              inputmode="numeric"
              value={birthDate}
              oninput={(e) => {
                birthDate = formatBirthInput(
                  (e.target as HTMLInputElement).value
                )
              }}
              maxlength={10}
              placeholder="YYYY-MM-DD"
              class={twMerge(
                'field-input w-full',
                showBirthDateError ? 'is-error' : ''
              )}
            />
            {#if showBirthDateError}
              <p class="mt-1 field-help is-error">
                올바른 생년월일을 입력해주세요
              </p>
            {/if}
          </div>
          <div>
            <label for="simple-client-email" class="field-label mb-2">
              이메일
            </label>
            <input
              id="simple-client-email"
              type="email"
              bind:value={email}
              placeholder="example@email.com"
              class="field-input w-full"
            />
          </div>
        </div>

        <!-- Row 3: 연락처 (full width) -->
        <div>
          <label for="simple-client-phone" class="field-label mb-2">
            연락처
          </label>
          <input
            id="simple-client-phone"
            type="tel"
            inputmode="numeric"
            value={phone}
            oninput={(e) => {
              phone = formatPhoneInput((e.target as HTMLInputElement).value)
            }}
            maxlength={13}
            placeholder="연락처를 입력해주세요"
            class="field-input w-full"
          />
        </div>

        <!-- Row 4: 주소 — 등록 페이지(ClientInfoSection)와 같은 3분할 + 검색 버튼 -->
        <div>
          <p class="field-label mb-2">주소</p>
          <div class="flex gap-2">
            <input
              type="text"
              value={zipCode}
              placeholder="우편번호"
              readonly
              class="field-input w-1/3 min-w-0"
            />
            <input
              type="text"
              value={address}
              placeholder="주소"
              readonly
              class="field-input min-w-0 flex-1"
            />
            <button
              type="button"
              onclick={openAddressSearch}
              class="h-12 w-17 shrink-0 rounded-xl bg-gray-100 text-body-01-normal-medium text-gray-600 hover:bg-gray-200"
            >
              검색
            </button>
          </div>
          <input
            type="text"
            bind:value={addressDetail}
            maxlength={100}
            placeholder="상세주소를 입력해주세요"
            class="field-input mt-2 w-full"
          />
        </div>
      </div>

      <!-- ── 보호자 (선택) — 등록 페이지와 같이 타이틀 우측 토글로 연다 ── -->
      <div class="flex flex-col gap-2">
        <div class="flex min-h-6 items-center justify-between gap-4">
          <Typography variant="title-01-semibold" color="text-gray-700">
            보호자<span
              class="ml-1 whitespace-nowrap text-body-subtle text-body-03-normal-regular"
              >(선택)</span
            >
          </Typography>
          <Switch
            bind:checked={guardianOn}
            ariaLabel="보호자 정보 입력"
            onclick={applyGuardianToggle}
          />
        </div>

        {#if guardianOn}
          <!-- 펼침/접힘은 높이 트랜지션 — 모달이 한 프레임에 튀지 않도록
               콘텐츠 높이를 애니메이션하고 모달 높이가 그걸 따라가게 한다.
               overflow-hidden은 줄어드는 동안 안쪽 카드가 밖으로 삐져나오지 않게. -->
          <div
            class="flex flex-col gap-2 overflow-hidden"
            transition:slide={{ duration: 250, easing: quintOut }}
          >
            <Typography variant="body-02-normal-regular" color="text-gray-500">
              입력한 보호자는 별도의 내담자로 함께 등록돼요
            </Typography>

            <div class="mt-2 space-y-3">
              {#each guardianCards as card, idx (card.id)}
                <!-- 카드 radius는 바깥(12) > 안쪽 입력(8) — §Rounded 중첩 규칙 -->
                <div class="rounded-xl bg-gray-50 p-5 space-y-4">
                  <!-- 카드 Row 1: 이름 (full width) -->
                  <div>
                    <label
                      for="guardian-name-{card.id}"
                      class="field-label mb-2"
                    >
                      이름 <span class="field-required">*</span>
                    </label>
                    <input
                      id="guardian-name-{card.id}"
                      type="text"
                      bind:value={card.name}
                      maxlength={20}
                      placeholder="보호자 이름을 입력해주세요"
                      class="field-input w-full"
                    />
                  </div>

                  <!-- 카드 Row 2: 생년월일 | 성별 (2-col) -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        for="guardian-birth-{card.id}"
                        class="field-label mb-2"
                      >
                        생년월일
                      </label>
                      <input
                        id="guardian-birth-{card.id}"
                        type="text"
                        inputmode="numeric"
                        value={card.birthDate}
                        oninput={(e) => {
                          card.birthDate = formatBirthInput(
                            (e.target as HTMLInputElement).value
                          )
                        }}
                        maxlength={10}
                        placeholder="YYYY-MM-DD"
                        class="field-input w-full"
                      />
                    </div>
                    <div>
                      <p class="field-label mb-2">
                        성별 <span class="field-required">*</span>
                      </p>
                      <div class="flex h-12 items-center gap-6">
                        <label class="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="guardianCardGender-{card.id}"
                            value="male"
                            checked={card.gender === 'male'}
                            onchange={() => (card.gender = 'male')}
                            class="h-5 w-5 cursor-pointer accent-primary-500"
                          />
                          <Typography
                            variant="body-01-normal-medium"
                            color="text-body-default">남자</Typography
                          >
                        </label>
                        <label class="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="guardianCardGender-{card.id}"
                            value="female"
                            checked={card.gender === 'female'}
                            onchange={() => (card.gender = 'female')}
                            class="h-5 w-5 cursor-pointer accent-primary-500"
                          />
                          <Typography
                            variant="body-01-normal-medium"
                            color="text-body-default">여자</Typography
                          >
                        </label>
                      </div>
                    </div>
                  </div>

                  <!-- 카드 Row 3: 연락처 | 관계 (2-col) -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        for="guardian-phone-{card.id}"
                        class="field-label mb-2"
                      >
                        연락처 <span class="field-required">*</span>
                      </label>
                      <input
                        id="guardian-phone-{card.id}"
                        type="tel"
                        inputmode="numeric"
                        value={card.phone}
                        oninput={(e) => {
                          card.phone = formatPhoneInput(
                            (e.target as HTMLInputElement).value
                          )
                        }}
                        maxlength={13}
                        placeholder="010-0000-0000"
                        class="field-input w-full"
                      />
                    </div>
                    <div>
                      <p class="field-label mb-2">
                        관계 <span class="field-required">*</span>
                      </p>
                      <Select
                        class="h-12 w-full bg-white"
                        textClass="text-body-01-normal-regular"
                        placeholder="내담자와의 관계"
                        options={[...GUARDIAN_RELATION_OPTIONS]}
                        selected={card.relation}
                        on:change={(e) => (card.relation = e.detail ?? '')}
                      />
                    </div>
                  </div>

                  <!-- 삭제는 '추가'로 늘린 카드에만 — 처음 열리는 카드는 지울 대상이 아니다
                     (등록 페이지 GuardianSection과 동일 계약) -->
                  {#if idx > 0}
                    <div class="flex justify-end">
                      <button
                        type="button"
                        onclick={() => removeGuardianCard(card.id)}
                        class="flex items-center gap-2 text-gray-500 hover:text-gray-700"
                      >
                        <TrashIcon24
                          size={24}
                          color="var(--color-icon-primary)"
                        />
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-500">삭제</Typography
                        >
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}

              <div class="flex justify-center">
                <button
                  type="button"
                  onclick={addGuardianCard}
                  class="flex items-center gap-2 py-2 text-primary-500 hover:text-primary-600"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" class="fill-primary-100" />
                    <path
                      d="M7 12L17 12"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <path
                      d="M12 7L12 17"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-primary-500">보호자 추가</Typography
                  >
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- Primary CTA — 높이 44(§button Title 토큰) · 레이블 16 Medium ·
         비활성은 시맨틱 토큰 두 개만(§button-primary).
         폭 160은 정본에 없는 값이지만 모달 확정 버튼의 다수파 규격이다(§현실 보정). -->
    <button
      type="button"
      onclick={handleSubmit}
      disabled={!canSubmit}
      class="flex h-11 w-40 items-center justify-center rounded-lg bg-action-primary text-body-01-normal-medium text-white transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
    >
      추가
    </button>
  {/snippet}
</BaseModal>
