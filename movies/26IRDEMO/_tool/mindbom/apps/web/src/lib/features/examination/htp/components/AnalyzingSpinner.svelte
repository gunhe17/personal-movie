<!--
  분석 중 오버레이 — 형태는 SCT의 SCTAnalyzingSpinner와 같다.

  예전에는 스피너 가운데에 `<span>psychology</span>`가 있었다. 아이콘 폰트
  클래스가 없어 리거처가 적용되지 않았고, 화면에는 'psychology'라는 글자가
  그대로 찍혔다. 아이콘을 되살리는 대신 SCT와 같은 스피너만 남긴다 —
  두 검사가 같은 일(AI 분석 대기)에 다른 모양을 쓸 이유가 없다.

  오버레이인 것은 유지한다. SCT는 목록 자리를 대체하지만 여기서는 뒤에
  그림이 있고, 임상가가 어떤 그림을 분석 중인지 계속 보여야 한다.
-->
<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
  <div class="flex flex-col items-center justify-center gap-4">
    <div class="relative h-16 w-16">
      <div
        class="absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
      ></div>
    </div>
    <div class="text-center">
      <p class="text-base font-semibold text-gray-900">
        AI가 그림을 분석하는 중입니다
      </p>
      <p class="mt-1 text-sm text-gray-500">그림 요소를 탐지하고 있어요</p>
    </div>
  </div>
</div>
