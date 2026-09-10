<script lang="ts">
  import { useAssessmentLoginForm } from '$lib/features/assessment-login'
  import SmartphoneLoginIcon from '$lib/assets/SmartphoneLoginIcon.svelte'
  import AssessmentLogin from '$root/src/lib/assets/AssessmentLogin.svelte'
  import Typography from '@common/components/Typography.svelte'

  const form = useAssessmentLoginForm()
</script>

<svelte:head>
  <title>검사 로그인</title>
</svelte:head>

<div class="h-screen bg-[#F6F6F6]">
  <main
    class="mx-auto max-w-[1160px] px-8 py-24 w-full h-[calc(100vh-44px)] flex justify-center items-center"
  >
    <section
      class="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-[131px] justify-center items-center"
    >
      <div class="flex flex-col items-center lg:items-start">
        <AssessmentLogin />
      </div>

      <div class="w-full max-w-[389px] mx-auto lg:mx-0 lg:ml-auto">
        <h2
          class="text-[28px] font-extrabold text-gray-900 mb-6 tracking-[-0.02em]"
        >
          로그인
        </h2>

        <form
          class="space-y-3.5"
          onsubmit={(e) => {
            e.preventDefault()
            form.handleLogin()
          }}
        >
          <div class="mb-6">
            <Typography variant="body-02-medium" color="text-gray-700">
              아이디
            </Typography>
            <input
              id="id"
              type="text"
              autocomplete="username"
              bind:value={form.id}
              onkeypress={form.handleKeyPress}
              placeholder="아이디를 입력해주세요"
              class="mt-2 h-[48px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-3 outline-none placeholder:text-[#aeb3bb] focus:border-gray-400"
            />
          </div>

          <div>
            <Typography variant="body-02-medium" color="text-gray-700">
              비밀번호
            </Typography>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              bind:value={form.password}
              onkeypress={form.handleKeyPress}
              placeholder="비밀번호를 입력해주세요"
              class="mt-2 h-[48px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-3 outline-none placeholder:text-[#aeb3bb] focus:border-gray-400"
            />
          </div>

          <div
            class="flex items-center justify-between rounded-[6px] bg-[#eeeeee] px-4 py-3.5 text-[15px] text-[#5c6470]"
          >
            <Typography
              variant="body-02-reading-regular"
              className="whitespace-pre-line"
              color="text-gray-500"
            >
              {`계정 정보가 없는 경우\n센터 관리자에게 문의해 주세요.`}
            </Typography>
            <!-- <button
              type="button"
              class="text-[15px] font-medium text-[#5c6470] underline underline-offset-2"
            >
              <Typography
                variant="body-02-regular"
                className="whitespace-pre-line"
                color="text-gray-600"
              >
                문의
              </Typography>
            </button> -->
          </div>

          {#if form.error}
            <p class="text-sm text-red-600 pt-1">{form.error}</p>
          {/if}

          <button
            type="submit"
            disabled={form.loading}
            class="h-[52px] w-full bg-[#FF8C00] rounded-[8px] text-[25px] text-white font-semibold disabled:opacity-60"
          >
            <Typography
              variant="title-01-semibold"
              className="whitespace-pre-line"
              color="text-white"
            >
              {form.loading ? '로그인 중...' : '로그인'}
            </Typography>
          </button>
        </form>
      </div>
    </section>
  </main>
</div>
