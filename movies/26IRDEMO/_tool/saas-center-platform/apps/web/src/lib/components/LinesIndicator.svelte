<script lang="ts">
  import Svg from './Svg.svelte'
  import { twMerge } from 'tailwind-merge'

  export let aniDur = '750ms'
  export let disableScreen = false
</script>

{#if disableScreen}
  <style>
    body {
      pointer-events: none;
    }
  </style>
{/if}

<Svg
  width={64}
  height={64}
  {...$$restProps}
  class={twMerge(
    'w-16 stroke-slate-900',
    $$props['className'],
    $$props['class']
  )}
>
  <g stroke-width="4" stroke-linecap="round"
    ><line y1="12" y2="20" transform="translate(32,32) rotate(180)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values="1;.85;.7;.65;.55;.45;.35;.25;.15;.1;0;1"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(210)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values="0;1;.85;.7;.65;.55;.45;.35;.25;.15;.1;0"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(240)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".1;0;1;.85;.7;.65;.55;.45;.35;.25;.15;.1"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(270)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".15;.1;0;1;.85;.7;.65;.55;.45;.35;.25;.15"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(300)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".25;.15;.1;0;1;.85;.7;.65;.55;.45;.35;.25"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(330)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".35;.25;.15;.1;0;1;.85;.7;.65;.55;.45;.35"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(0)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".45;.35;.25;.15;.1;0;1;.85;.7;.65;.55;.45"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(30)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".55;.45;.35;.25;.15;.1;0;1;.85;.7;.65;.55"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(60)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".65;.55;.45;.35;.25;.15;.1;0;1;.85;.7;.65"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(90)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".7;.65;.55;.45;.35;.25;.15;.1;0;1;.85;.7"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(120)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values=".85;.7;.65;.55;.45;.35;.25;.15;.1;0;1;.85"
        repeatCount="indefinite"
      /></line
    ><line y1="12" y2="20" transform="translate(32,32) rotate(150)"
      ><animate
        attributeName="stroke-opacity"
        dur={aniDur}
        values="1;.85;.7;.65;.55;.45;.35;.25;.15;.1;0;1"
        repeatCount="indefinite"
      /></line
    ></g
  >
</Svg>
