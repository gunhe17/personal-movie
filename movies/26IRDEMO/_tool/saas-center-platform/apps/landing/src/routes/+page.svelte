<script lang="ts">
	import {
		Header,
		Hero,
		PainPoints,
		Answer,
		Features,
		Platform,
		Trust,
		Cta,
		Footer
	} from '$lib/sections';
</script>

<svelte:head>
	<title>마인드스코프 - 심리상담 센터 통합 관리 플랫폼</title>
	<meta
		name="description"
		content="상담, 심리검사, 일정, 결제까지. 심리상담 센터 운영에 필요한 모든 것을 하나의 플랫폼에서."
	/>
</svelte:head>

<div class="min-h-screen bg-white">
	<Header />

	<main>
		<Hero />
		<PainPoints />
		<Answer />
		<Features />
		<Platform />
		<Trust />
		<Cta />
	</main>

	<Footer />
</div>
