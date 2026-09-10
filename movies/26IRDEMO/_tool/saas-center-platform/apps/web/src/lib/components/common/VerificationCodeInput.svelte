<script lang="ts">
  let {
    disabled = false,
    invalid = false,
    describedBy,
    onChange,
    onComplete,
    onSubmit
  }: {
    disabled?: boolean
    invalid?: boolean
    describedBy?: string
    onChange: (code: string) => void
    onComplete: () => void
    onSubmit: () => void
  } = $props()
  let digits = $state(['', '', '', ''])
  let inputs = $state<HTMLInputElement[]>([])
  function enter(index: number, value: string) {
    const numbers = value.replace(/\D/g, '').slice(0, 4)
    const start = numbers.length === 4 ? 0 : index
    digits = digits.map((digit, position) =>
      position >= start && position < start + numbers.length
        ? numbers[position - start]
        : position === index && !numbers
          ? ''
          : digit
    )
    onChange(digits.join(''))
    inputs[Math.min(start + numbers.length, 3)]?.focus()
    inputs[Math.min(start + numbers.length, 3)]?.select()
    if (digits.every(Boolean)) onComplete()
  }
</script>

<div
  class="grid w-full grid-cols-4 gap-3"
  role="group"
  aria-label="인증번호 4자리"
>
  {#each digits as digit, index}
    <input
      bind:this={inputs[index]}
      value={digit}
      type="text"
      inputmode="numeric"
      autocomplete={index === 0 ? 'one-time-code' : 'off'}
      maxlength="4"
      aria-label={`인증번호 ${index + 1}번째 자리`}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      {disabled}
      class="field-input min-w-0 w-full h-16 px-0 text-center text-headline-01-normal-semibold"
      class:is-error={invalid}
      onfocus={() => inputs[index]?.select()}
      oninput={(event) => enter(index, event.currentTarget.value)}
      onpaste={(event) => {
        event.preventDefault()
        enter(index, event.clipboardData?.getData('text') ?? '')
      }}
      onkeydown={(event) => {
        if (event.key === 'Backspace' && !digits[index] && index > 0) {
          event.preventDefault()
          digits[index - 1] = ''
          onChange(digits.join(''))
          inputs[index - 1]?.focus()
        }
        if (event.key === 'ArrowLeft' && index > 0) inputs[index - 1]?.focus()
        if (event.key === 'ArrowRight' && index < 3) inputs[index + 1]?.focus()
        if (event.key === 'Enter') {
          event.preventDefault()
          onSubmit()
        }
      }}
    />
  {/each}
</div>
