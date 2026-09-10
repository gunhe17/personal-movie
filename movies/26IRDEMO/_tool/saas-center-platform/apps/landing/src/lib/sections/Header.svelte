<script lang="ts">
	import MindScopeLogoIcon from '$lib/assets/MindScopeLogoIcon.svelte'
</script>

<header class="sticky top-0 z-50 h-15 border-b border-gray-100 bg-white">
	<nav class="mx-auto flex h-full max-w-480 items-center justify-between px-50">
		<!-- 왼쪽: 로고 + 네비게이션 -->
		<div class="flex items-center">
			<a href="/" class="shrink-0">
				<MindScopeLogoIcon />
			</a>
			<div class="ml-20 flex items-center gap-8">
				<a href="#features" class="text-sm font-medium text-gray-600 transition hover:text-gray-900">
					기능 소개
				</a>
				<a href="#pricing" class="text-sm font-medium text-gray-600 transition hover:text-gray-900">
					요금 안내
				</a>
			</div>
		</div>

		<!-- 오른쪽: 도입 문의 버튼 -->
		<a
			href="#contact"
			class="rounded-lg bg-[#4C87F6] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#3A6FD8]"
		>
			도입 문의
		</a>
	</nav>
</header>
