# Artlist MCP가 지원하는 이미지·영상 모델 (조회 2026-09-12)

`list_models`를 기능별로 전부 돌려 받은 것. **SKU가 300개가 넘어 계열(`modelGroupId`)로 묶었다.**
같은 계열 안의 여러 modelId는 대개 해상도·오디오 유무 차이다.

| 기능 | SKU 수 |
|---|---|
| 이미지 text-to-image | 78 |
| 이미지 image-to-image | 64 |
| 영상 text-to-video | 100 |
| 영상 image-to-video | 120 |
| 영상 multi-to-video (참조→영상 · 시작/끝 프레임) | 45 |
| 영상 video-to-video (편집 · 확장 · 립싱크 · 더빙) | 20 |
| 영상 reference-to-video | **0** — 이 이름으로는 안 잡힌다. `multi-to-video`에 들어 있다 |

---

## 1. 이미지 모델 계열

`grp`는 `modelGroupId`. **`modelGroupId`만 주면 참조 유무를 보고 T2I/I2I로 자동 분기한다.**

| grp | 계열 | T2I | I2I | 최대 해상도 |
|---|---|---|---|---|
| 100 | Flux Pro Ultra | 2151 | — | |
| 101 | Flux 2.0 Dev | 1001 · 2066 | 1002 · 2068 | 2K |
| 102 | Flux 2.0 Pro | 1003 · 2065 | 1004 · 2063 | 2K |
| **117** | **Nano Banana Pro** | 1042 · **2071** | 2004 · 2073 | **4K** |
| 312 | GPT Image 1 Mini | 2064 | 2067 | |
| **313** | Seedream 4.5 | 2200 · 2204 | 2202 · 2203 | 4K |
| 318 | Wan 2.6 | — | 2081 | |
| 319 | Nano Banana (gemini-2.5) | 2082 | 2083 | |
| 320 | Hunyuan V3 | 2084 | — | |
| 322 | GPT Image 1.5 | 1216 · 2087 · 2090~2100 | 1217 · 2088~2099 | |
| 323 | Flux 2.0 Turbo | 2102 · 2129 | 2101 · 2128 | 2K |
| 324 | Flux 2.0 Flash | 2106 · 2131 | 2105 · 2130 | 2K |
| **326** | **Artlist Original 1.0** (LoRA 4종: Professional · Cinematic · Indie · Commercial) | 2109 · 2115 · 2116 · 2120 · 2122~2125 | — | 2K |
| 327 | ImagineArt 1.5 / Pro | 2110 · 2150 | — | |
| 329 | z-Image Turbo | 2113 · 2114 | — | 2K |
| 345 | Grok | 2153 | 2152 | |
| **354** | **Kling o3** (= Image 3.0 Omni) | **2189**(1K·2K) · 2195(4K) | 2191 · 2194 | **4K** · 참조 10장 |
| 355 | Kling v3 [Kling direct] | 3139 | 3140 | 2K · 참조 1장 |
| **360** | **Seedream 5.0** | **2216**(2K) · 2218(3K) · **2354**(4K) | 2217 · 2219 · 2355 | **4K** |
| **363** | **Nano Banana 2** | **2250**(1K*) · 2251 · **2252**(4K) · 2253(512px) | 2245 · 2247 · 2248 · 2249 | **4K** · 21:9 |
| 380 | GPT Image 2.0 | 2338 · 2340 · 2341 | 2339 · 2342 · 2343 | |
| 383 | Wan 2.7 Pro | 2357 | 2356 | |
| 387 | ImagineArt 2.0 | 2362 · 2363 | — | 2K |
| 398 | Krea v2 (Medium · Large · Turbo) | — | 2387 · 2389 · 2421 · 2422 | |
| 401 | Ideogram V4 (Turbo · Balanced · Quality) | 2418 · 2419 · **2420** | — | **참조 1장** |
| 414 | Nano Banana 2 **LITE** | 2455 | 2453 | |
| **513** | **Seedream 5.0 Pro** | 2615 · **2616** | 2613 · 2614 | 2K |
| 517 | **Reve 2.1** | 2627 | 2628 | ⚠ **Artlist에서 견적 실패** |
| 521 | Qwen Image 3 | 2633 | 2641 | |
| 522 | Luma Uni-1 Max | 2636 | 2637 | 4K |
| 582 | Grok Imagine 2.0 | 3093 · 3094 | 3095 · 3096 | 2K · **21:9** |
| 595 | Recraft 4.1 (Normal · Pro) | 3194 · **3192** | — | 2K(Pro) · **스타일 참조 10장** |
| **602** | **GPT Image 2.5** (Flare · Sunburst × Low~Max) | 3211~3215 · 3222~3226 | 3216~3221 · 3227~3231 | **3840×2160** · 참조 16장 |

\* `Nano Banana 2 - T2I - 1K`(2250)는 실제로 `resolution: 2k`로 해석된다. **§4 참조.**

---

## 2. 영상 모델 계열

| grp | 계열 | T2V | I2V | R2V/FLF | V2V |
|---|---|---|---|---|---|
| 104 | Kling 1.6 | 1009 · 1010 | 1007 · 2062 | | |
| 105 | Kling 2.1 Std/Pro | | 1011 · 1012 | | |
| 108 | Kling O1 Pro | | 1017 | | |
| **114** | **Veo 3.1** | 1034 · 1036 · 2132 · 2133 | 1033 · 1035 · 2126 · 2127 | **2299 · 2307 · 2308 · 2317** | |
| 115 | Veo 3.1 Fast | 1038 · 1040 · 2140 · 2141 | 1037 · 1039 · 2137 · 2138 | | |
| 302 | Kling 2.6 Pro | 1212 · 2005 | 1213 · 2006 | | |
| 303 | Wan 2.6 | 2009 · 2060 | 2012 · 2056 | | |
| 304 | Seedance 1.5 | 2278~2281 | 2208 · 2275~2277 | | |
| 305 | Kling 2.5 Turbo Pro | 2016 | 2017 | | |
| 306 | Kling 2.1 Master | 2021 | 2023 | | |
| 307 · 308 | Hailuo 2.3 Standard / Fast Std | 2032 | 2027 · 2034 · 2107 | | |
| 309 | Seedance 1.0 (Pro Fast) | 2407~2409 | 2399 · 2405 · 2406 | | |
| 310 | LTX 2.0 Pro | 2049 · 2052 · 2054 | 2042 · 2053 · 2055 | | |
| 334 · 335 | Hailuo 2.3 Pro / Fast Pro | 2031 | 2028 · 2033 | | |
| 346 | Grok 비디오 | 2154 · 2400 | 2155 · 2403 | | |
| **347** | **Kling O3** (Pro · Standard · 4K) | 2170 · 2171 · 2175 · 2176 · 2346 | **2173 · 2174** · 2177 · 2178 · 2347 | | |
| **349** | Kling v3 [Kling direct] | 3131 · 3148~3152 | 3130 · 3143~3147 | | |
| **358** | **Seedance 2.0** | 2488 · 2523~2525 | 2484 · 2519~2521 | 2482 · 2516~2518 | |
| **368** | **Kling 3.0 Motion Control** | | | | **2292 · 2293** |
| **369** | **Kling O3 V2V Edit** | | | | **2290 · 2291** |
| 370 | Fabric 1.0 | | 2294 · 2295 · 2374 · 2375 | | |
| 371 | Heygen Avatar4 | | 2296 | | |
| **372** | **Veo 3.1 Extend** | | | | 2370~2373 |
| 376 | Veo 3.1 Lite | 2393~2396 | 2388 · 2390~2392 | | |
| 377 · 405 | Seedance 2.0 FAST | 2322 · 2323 · 2429 · 2434 | 2320 · 2321 · 2431 · 2433 | 2318 · 2319 · 2435 · 2437 | |
| 381 · 415 | Happy Horse 1.0 / 1.1 | 2348 · 2349 · 2456 · 2457 | 2350 · 2351 · 2458~2461 | | |
| 386 | Wan 2.7 | 2358 · 2359 | | 2360 · 2361 | |
| 388 | LTX 2.3 Pro | 2367~2369 | 2364~2366 | | |
| 389 | Omnihuman v1.5 | | 2377 | | |
| 393 | Creatify Aurora (아바타) | | 2378 · 2379 | | |
| **394 · 395 · 396** | **Elevenlabs Dubbing · Sync Lipsync v2 Pro · Heygen Translate** | | | | 2384 · 2380 · 2385 · 2386 |
| 399 | Grok Imagine Video 1.5 | 3038~3040 | 2410 · 2411 · 2682 | | |
| **400 · 413** | **Gemini Omni** | | 2602(Start Frame) | 2413 · 2454 · 2603 | |
| 402 | Kling v3 Turbo | 2427 · 2430 | 2428 · 2432 | | |
| 416 | Seedance 2.0 Mini | 2465 · 2468 | 2466 · 2467 | 2462 · 2469 | |
| **515** | **Seedance 2.5** | 2625 · 3009 · 3106 | 2624 · 3010 · 3105 | 2673 · 2674 · 3002 · 3011~3013 · 3090 · 3091 · 3107~3110 | |
| **523** | **Luma Ray 3.2** (HDR 포함) | 2638 · 2642 · 2645 · 2646 | 2639 · 2643 · 2647 · 2648 | | 2640 · 2644 · 2649 · 2650 |
| **537 · 599 · 605** | **MiniMax H3 / Max / Max Turbo** | 2679 · 3201 · 3204 · 3236 · 3239 · 3241 | 2680 · 3202 · 3205 · 3242~3244 | 2681 · 3203 · 3206 | |
| **550** | **Flux 3 (영상)** | 2757 · 2764 | 2758 · 2763 | **2759 · 2762 (FLF)** | |
| **581** | **Wan 3.0 / 3.0 Prime** | 3079 · 3083 · 3125 · 3237 · 3238 | 3080 · 3084 · 3126 · 3240 · 3245 | 3081 · 3082 · 3124 · 3247 · 3248 | |
| 583 · 584 | LTX 2.5 Fast / Pro | 3097~3100 · 3114 · 3120 | 3101~3105 · 3115 · 3121 | | |
| **592 · 593** | **Omni 1.1** (Interpolation · Start Frame · Image ref · Extend) | 3157 · 3169~3171 | 3158 · 3159 · 3166~3168 · 3172~3174 · 3184~3187 | 3160 · 3163~3165 | 3161 · 3175~3177 |

---

## 3. 첫 프레임 스킬에 실제로 걸리는 것

### 시작·끝 프레임을 받는 곳

| 계열 | 어떻게 |
|---|---|
| **Kling O3 (347)** | `image_url` + **`end_frame`** — `get_model_config`로 확인한 정본 |
| **Flux 3 (550)** | 이름 자체가 **FLF**(First-Last-Frame) — 2759(720p) · 2762(1080p) |
| **Omni 1.1 (592)** | **Interpolation** 계열이 그것이다 — 360p/720p/1080p/**4k** |
| Gemini Omni (400) | **2602 "Start Frame"** — 시작 프레임만 |

> **끝 프레임이 Kling O3 전용이 아니다.** 09번 문서에서 "Artlist에서 여기만"이라고 적었는데
> **Flux 3 FLF와 Omni 1.1 Interpolation도 같은 일을 한다.** 그리고 **Omni 1.1은 4K까지 된다.**
> 이건 Kling O3를 영상에 쓸 마지막 근거였으므로 **비교 테스트 대상에 이 둘을 반드시 넣는다.**

### i2v 아레나 상위권이 전부 여기 있다

06·09번 문서의 i2v 순위(MiniMax H3 1위 · Seedance 2.0 2위 · Wan 3.0 6위)가
**Artlist에 전부 올라와 있다** — 537/599/605 · 358/515 · 581.
**Kling O3(347)를 쓸 이유가 더 줄어든다.**

### 영상 편집·확장 계열 (본편에 쓸 수 있다)

- **Kling 3.0 Motion Control (368)** — 모션만 옮기는 V2V
- **Kling O3 V2V Edit (369)**
- **Veo 3.1 Extend (372)** · **Omni 1.1 Extend (593)** — 클립 늘리기
- **Luma Ray 3.2 Video Edit (523)** — HDR 변형 있음
- **Sync Lipsync v2 Pro (395)** · **Elevenlabs Dubbing (394)** · **Heygen Translate (396)** — 립싱크·더빙

---

## 4. ⚠ 카탈로그 자체의 데이터 품질 문제

**SKU 이름을 믿으면 안 된다.** 실제로 어긋난 것들을 발견했다.

### 해상도 라벨이 틀린다 (실측)
- `Nano Banana 2 - T2I - **1K**`(2250) → `resolvedSettings.resolution: **2k**`
- `Seedream 5.0 Pro - T2I - **1.5K**`(2616) → `quality: **1k**`

### 내부 이름과 표시 이름이 다른 모델을 가리킨다
| modelId | `name` | `displayName` |
|---|---|---|
| 2052 | `wan-v2.6-reference-to-video` | **LTX 2.0 Pro 2K T2V** |
| 2054 | `fal-ai-veo3.1-fast-image-to-video` | **LTX 2.0 Pro 4K T2V** |
| 2055 | `fal-ai-veo2-image-to-video` | **LTX 2.0 Pro 4K I2V** |
| 2056 | `fal-ai-veo2` | **Wan 2.6 I2V 720p** |
| 2115 | `fal-ai-flux-2-lora` | Artlist Original **Cinematic** LoRA |
| 2116 | Artlist Original **Dramatic** LoRA | Artlist Original **Indie** LoRA |
| 2125 | Artlist Original **Cinematic** LoRA 720p | Artlist Original **Commercial** LoRA 720p |

### 기능 분류가 어긋난다
- `2027` 이름은 `...hailuo-2.3-standard-**image**-to-video`인데 **text-to-video 목록에 있다**
- `Wan 2.7 - **I2V**`(2360 · 2361)가 **multi-to-video 목록에 있다**
- `reference-to-video` 필터는 **0건**을 반환한다 — R2V 모델은 전부 `multi-to-video`에 있다

### 프로덕션에 테스트 모델이 남아 있다
- `2118` — **"Yaniv Daye - Google - Model for Load testing"** (image-to-image · ON_AIR)

> **→ 스킬 규칙: 모델을 고를 때 이름을 읽지 말고 `get_model_config`와 `get_generation_cost`의
> `resolvedSettings`를 본다. 이름은 참고일 뿐 계약이 아니다.**
