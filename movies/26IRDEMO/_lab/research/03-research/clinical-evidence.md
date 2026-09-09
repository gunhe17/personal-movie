# 마인드스코프/MOEUM — Evidence & Reference Research

Date of research: 2026-09-09. Everything below was verified by fetching the source unless explicitly marked otherwise. Nothing is fabricated; where I could only partially confirm something, it says so.

---

## TRACK 1 — Documentation burden: hard numbers

### 1A. The foundational time-and-motion studies (safe to put on screen)

| Figure | Detail | Citation |
|---|---|---|
| **27.0% vs 49.2%** | Physicians spent 27.0% of office-day time on direct clinical face time with patients, and **49.2% on EHR and desk work**. 57 physicians, 430 hours observed, 4 specialties. | Sinsky C, et al. "Allocation of Physician Time in Ambulatory Practice: A Time and Motion Study in 4 Specialties." *Ann Intern Med.* 2016;165:753-60. https://www.acpjournals.org/doi/10.7326/M16-0961 |
| **2 hours EHR per 1 hour patient care** | Same study, the popularized framing. | https://pnhp.org/news/physicians-spend-two-hours-on-ehrs-and-desk-work-for-every-hour-of-direct-patient-care/ |
| **5.9 hrs of an 11.4-hr day in the EHR** | 355 min/day total: 269 min (4.5 h) during clinic + **86 min (1.4 h) after hours** ("pajama time"). 44% of EHR time was clerical; 84 min/day (24%) on the inbox. | Arndt BG, et al. "Tethered to the EHR." *Ann Fam Med.* 2017;15(5):419-426. doi:10.1370/afm.2121 https://www.annfammed.org/content/15/5/419.short |
| **16 min 14 sec of EHR time per patient visit** | ~100 million visits, ~155,000 US physicians. Chart review 33%, documentation 24%, ordering 17%. | Overhage JM, McCallie D. *Ann Intern Med.* 2020;172(3):169-174. doi:10.7326/M18-3684 https://www.acpjournals.org/doi/10.7326/M18-3684 |
| **SUS score 45.9 = grade "F"** | Physician-rated EHR usability scored 45.9±21.9 on the System Usability Scale — bottom 9% of all products ever scored. Each 1-point better SUS = **3% lower odds of burnout** (OR 0.97, 95% CI 0.97–0.98, p<.001). Strong dose-response. | Melnick ER, Shanafelt TD, et al. *Mayo Clin Proc.* 2020. https://www.mayoclinicproceedings.org/article/S0025-6196(19)30836-5/fulltext |

### 1B. Mental-health-specific

| Figure | Detail | Citation / caveat |
|---|---|---|
| **Psychiatrists: 20.3% of work hours on administration — highest of any specialty** | Nationally representative survey, n=4,720 US physicians. Average across all physicians: 8.7 hrs/week = 16.6% (one-sixth). More admin time → lower career satisfaction, controlling for income. | Woolhandler S, Himmelstein DU. *Int J Health Serv.* 2014;44(4):635-42. doi:10.2190/HS.44.4.a https://pubmed.ncbi.nlm.nih.gov/25626223/ — **peer-reviewed, but 2014 data.** |
| **62% cite administrative issues as a top-3 reason they left/never joined insurance panels** | Of 374 psychologists not participating in insurance: 82% insufficient reimbursement, **62% administrative issues (pre-authorization, audits)**, 52% payment-reliability concerns. | APA, *2024 Practitioner Pulse Survey* (Dec 2024). https://www.apa.org/pubs/reports/practitioner/2024/practitioner-pulse-2024-full-report.pdf |
| **32% of psychologists burned out; 51% of early-career (≤10 yrs post-doctorate)** | vs 18% of advanced-career. Lowest overall in 5 years but still high. | Same APA 2024 report. |
| **11% of psychologists already use AI monthly for note-taking / reducing admin burden; 71% never used AI** | Of those who used AI at all (n=247): 29% for summarization of clinical notes, 27% for note-taking/dictation. **33% named "reduces administrative burden" as AI's biggest benefit** — the single highest-rated benefit. | Same APA 2024 report. **Directly useful for positioning.** |
| **13 hrs/week and 39 prior-auth requests per physician per week** | 43-question survey, n=1,000 practicing physicians, Dec 2024. 89% said prior auth somewhat/significantly increases burnout; 40% have staff working exclusively on prior auth. | AMA, *2025 Prior Authorization Physician Survey*. https://www.ama-assn.org/system/files/prior-authorization-survey.pdf — US insurance-specific; weak analogue to Korean 바우처. |
| **AMIA "25x5": a formal national goal to cut US clinician documentation burden to 25% of current state within 5 years** | NLM-funded, AMIA + Columbia + Vanderbilt. Useful as "this is a recognized institutional problem, not a complaint." | https://amia.org/about-amia/amia-25x5 |

**⚠️ Numbers to treat with caution — vendor-sourced, not peer-reviewed:**
- "Therapists spend **35%** of work hours on documentation / ~16 min per session" — this is **Eleos Health's own internal platform data**, and the "35%" they cite to an unspecified NCBI source. Their stated product outcome is "12–15 min per note → 6–7 min per note." Vendor claim. https://eleos.health/blog-posts/drowning-under-a-pile-of-paperwork-behavioral-health-clinician-burnout/
- "**77%** of therapists report mental fatigue, highest of any specialty; documentation/charting the #1 burnout driver at 23%" — Tebra *2025 Physician Burnout Survey*, but **n = 219 across 6 specialties**. Sample too small to headline. https://www.tebra.com/theintake/healthcare-reports/inside-the-physician-burnout-crisis
- "Survey of 500 therapists: ~7 min/note × 20 clients = 2h20m/week" — **could not locate the primary source.** Do not use.

### 1C. AI scribes / ambient documentation — the real outcome numbers, including the bad ones

This is the most important section for your credibility, because the honest numbers are smaller than the marketing.

**The large multi-site study (the one that constrains what you can claim):**
- **13.4 fewer minutes of total EHR time and 16.0 fewer minutes of documentation time per 8 hours of patient care**; +0.49 visits/week. 8,581 ambulatory clinicians (1,809 adopters vs 6,772 non-adopters), 5 academic systems (Mass General Brigham, Emory, UCSF, Yale New Haven, UC Davis), June 2023–Aug 2025, using Ambience / Nuance DAX Copilot / Abridge on Epic. Published in *JAMA*, April 1, 2026.
- **Critical findings in the same study:** no significant effect on after-hours EHR time; benefits concentrated in primary care and among female clinicians; inconsistent use. STAT's prior analysis of published work had found savings of **under one minute per note**.
- https://www.statnews.com/2026/04/01/ai-ambient-scribes-modest-time-savings-clinical-documentation/

**The burnout study (the number vendors quote):**
- Burnout fell **51.9% → 38.8%** after 30 days of ambient AI scribe use. n=263 physicians and APPs across 6 health systems, pre/post survey. Also significant improvements in cognitive task load, after-hours documentation, focused attention on patients. *JAMA Network Open*, Oct 2025 (Olson K, Meeker D, Schwamm L, et al.). https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2839542
- **The paradox to be honest about:** time savings are modest, well-being gains are large. Documentation time savings do not reliably translate into burnout reduction, and vice versa.

**Quality / error findings (the counter-evidence):**
- Prospective pilot, 31 physicians, 7,545 AI-generated notes, 356 (4.7%) evaluated: **omissions 18%, hallucinations 11.5%, accidental inclusions 9.3%**. 83.8% of errors mild-to-moderate; **5.3% of notes with errors rated serious/imminent risk**; 94.7% of notes free of significant errors. *JMIR Medical Informatics*, pragmatic prospective pilot. https://pmc.ncbi.nlm.nih.gov/articles/PMC13089619/
- Qualitative netnographic analysis of 2,267 incident segments from 952 Reddit posts (2023–2025) on AI scribe failures: misattribution, hallucination, omission, integration friction, workflow disruption. Authors explicitly note these are *perceived risks*, not confirmed harms. Atiku S, Owolanke K, Olakotan O. *J Eval Clin Pract.* 2026;32(5):e70554. doi:10.1111/jep.70554
- Cost critique: health plans and providers privately agree AI scribes increase coding intensity. https://www.statnews.com/2026/04/08/insurers-providers-agree-ai-scribes-raise-health-care-costs/

### 1D. Korea-specific — thinner than the US material, but real

**What I found (verified):**

| Figure | Detail | Source |
|---|---|---|
| **10 minutes between sessions, absorbed entirely by non-treatment work** | Therapists testifying to Gyeonggi Provincial Council: after a 50-minute session, the 10-minute gap is consumed by 바우처 결제, 부모 본인부담금 결제, 주차 등록, 부모 응대, 보강 일정 조율, 모니터링 조사 대응, 바우처 계약서 작성 안내. | 경기도의회 최순자 의원 면담, Aug 2026. Reported across ≥6 outlets. Primary: http://urisuwon.com/258993 (2026-08-15), https://www.newssunday.co.kr/news/view.php?no=251841 |
| **1,816 institutions, 29 indicators, 5 domains** | 2024 사회서비스 품질평가 (발달재활서비스 1,786곳 + 언어발달지원 30곳). First-ever quality evaluation for these services. Avg scores 82.97 / 85.20. **The evaluation is largely a document review** — this is the structural source of the paperwork regime. | 보건복지부 보도자료, 2024-12-31. https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1484167&mid=a10503000000 |
| **87.9% of school counselors carry the 정서행동특성검사 총괄 업무 alone** | Incheon 전문상담교사 union survey, Jan 2025, n=279. Also 62.6% crisis-management committee, 52.9% 학업중단숙려제. Manuals say these duties are shared; in practice one person carries them. | 경인일보, 2025-03-23. https://www.kyeongin.com/article/1733443 |

**⚠️ What I could NOT find, despite extensive Korean searching:**
- No KIHASA (한국보건사회연구원) or 보건복지부 연구용역 report quantifying **hours or % of time** that 바우처 제공기관 종사자 spend on 행정업무. The 사회복지사 통계연감 (한국사회복지사협회, annual) exists and may contain this, but I could not access a version with an admin-time breakdown.
- No Korean equivalent of Sinsky/Arndt. **If you want a Korean on-screen number, the 10-minute gap and the 29-indicator evaluation are the strongest verified ones you have.** Do not invent a Korean percentage.

---

## TRACK 2 — Practitioner voice (real, quotable, with sources)

### The single best quote for the film (Korean, peer-reviewed, verbatim)

> **"서류가 너무 많아요, 서류를 해야 되는 것 때문에 정말 치료를 못하는 상황?"**

> **"1년차 때는.. 거의 2-3시간씩 많이 쓰는 거에요"**

> **"일정표, 기록지 뭐 세 장씩 있잖아요. 한 달에 달달이. 굳이 한 장에다 하면 되는데 그걸 왜 세 장에다"**

> **"바우처 카드를 결제하는 방식두 변화가 필요할 거에요"**

Source: 정경희, 김태우, 김재옥, 이초영. "언어치료를 위한 발달재활서비스 이용 현황 및 지원금의 적정성에 대한 언어치료사 인식에 대한 질적 연구: 포커스 그룹 인터뷰를 중심으로." *언어치료연구* 2019;28(2):167-182. doi:10.15724/jslhd.2019.28.2.167 — FGI, n=10 (기관장 5 + 언어재활사 5). https://jslhd.org/_PR/view/?aidx=19744&bidx=1561

Study's own finding: **"제공기관의 기관장과 언어재활사 모두 지자체의 감독체계와 행정업무의 부담을 크게 느끼고 있었다."**

This is peer-reviewed, verbatim, Korean, and about exactly your buyer. It is the most defensible thing you can put on screen.

### Therapist testimony to Gyeonggi Provincial Council (Aug 2026)

> **"대부분의 상담치료 기관에서는 50분간 치료를 진행한 뒤 10분 동안 바우처 결제와 부모 본인부담금 결제(매월 1번), 주차 등록, 부모 배웅 및 응대, 보강 일정 조율, 모니터링 조사(1년에 2번), 바우처 계약서 작성 관련 응대 등 다양한 업무를 처리하고 있다"**

> **"회기 사이 10분은 행정기록 작성과 치료교구 정리, 치료실 정돈, 다음 아동의 치료 준비는 물론 화장실 이용과 개인적인 휴식에도 필요한 시간이다. 하지만 실제로는 각종 행정과 보호자 응대 업무를 처리하느라 다음 치료를 충분히 준비할 시간이 부족한 경우가 많고, 이는 결국 치료의 질 저하로 이어질 우려가 있다"**

And the councilor: **"치료와 행정 업무 분리가 필요하며, 치료사에게 주어진 회기 사이의 10분을 보장해야 한다"**

Source: 수원시민신문 2026-08-15, http://urisuwon.com/258993 · also 뉴스선데이 2026-08-03 (신민정 기자) https://www.newssunday.co.kr/news/view.php?no=251841 · corroborated by 모닝투데이, 경인통신, 김포시민신문, 뉴스저널1, 다선뉴스.

**Note:** this is therapists speaking on the record to an elected official — high credibility, and the enumerated task list ("바우처 결제 / 주차 등록 / 보강 일정 조율 / 모니터링 조사 대응") is a ready-made on-screen list.

### School counselor (전문상담교사), named in press

> **"정서행동특성검사 등 각종 업무 매뉴얼에는 상담, 학생관리, 행정시스템 등록 업무 등을 여러 교사가 분담하도록 돼 있지만 상담 외 다른 업무까지 총괄하고 있다"**

> **"학교생활 부적응 학생들이 마지막에 찾는 곳이 'Wee클래스'(교내 상담실)인데, 행정 업무를 하느라 정작 상담을 제대로 하지 못할까 봐 걱정될 때가 많다"**

Source: 경인일보 2025-03-23, 백효은 기자. https://www.kyeongin.com/article/1733443 — quote attributed to 김OO, 인천 소재 고등학교 전문상담교사.

### Social-work sector (columnist, not a practitioner — attribute accordingly)

> **"사람을 마주하고 상담하며 온기를 나누어야 할 시간에 평가 대비용 서류를 작성하느라 밤을 지새우는 기형적인 구조는 복지사들에게 극심한 번아웃과 자괴감을 안겨준다."**

Source: 김춘봉 칼럼, 유교신문, 2026-09-05. https://www.cfnews.kr/news/article.html?no=111736 — **this is a columnist's framing, not a quoted practitioner.** Powerful phrasing ("밤을 지새우는 기형적인 구조"), but label it correctly if used.

### Korean clinical-psychology practice blog (industry voice, not peer-reviewed)

> **"당신이 만나는 시간은 1시간이지만, 저는 당신을 위해 3시간 이상을 준비했습니다"**

Describes the invisible labor: 수동 채점, 코딩, 내담자의 언어적 반응을 전사, clinical integration across tests, official report writing. Source: 마음토스 blog, 2026-04-10. https://www.mindthos.com/blog/justifying-psychological-test-interpretation-fees — **note: 마음토스 appears to be a commercial counseling-sector content site, possibly a competitor. It gives you no independent numbers, only phrasing.**

### English-language practitioner phrasing (for reference / tonal calibration)

- "Almost every therapist has either been behind, or is currently super behind on their notes." — Authentic Therapist's Guide, https://authentictherapistsguide.substack.com/p/how-do-i-do-all-these-notes
- Therapists "face too many competing tasks in the brief time between sessions and then feel too burned out to write notes at the end of the day." — Montana Mental Health Training, https://montanamentalhealthtraining.substack.com/p/build-ease-and-efficiency-in-completing

**⚠️ Searched and did not find:** usable verbatim complaints on 네이버 카페 / 브런치 / 티스토리 / 클리앙 about 상담일지 backlog. Community platforms are largely invisible to this search index. If you want raw practitioner phrasing from those, someone will have to browse 네이버 카페 (e.g. 치료사·상담사 카페) manually — I flagged this rather than paraphrase something into existence.

---

## TRACK 3 — Comparable product films

Verified via YouTube oEmbed (proves the video is live and who owns it), iSpot.tv spot pages, and trade-press/awards records with credits. **Craft notes are inferred from documented structure, shot descriptions and transcripts — none of these were watched.**

### Healthcare / clinical

**1. athenahealth — "What They Don't Teach You in Medical School"** (2015)
https://www.ispot.tv/ad/AIiX/athenahealth-what-they-dont-teach-you-in-medical-school
Credits: CD Ari Merkin · Production m ss ng p eces · Dir. Patrick Sherman · **consulting physicians Jordan Ditcheck MD, Patrick Amar MD**.
Surgeon says he's "isolated the problem," then pulls an endless length of literal red tape out of the patient. Tag: *Let Doctors Be Doctors.*
**Why it works:** the pain is a *physical object inside the patient*. No voiceover explains the metaphor; the surgeon plays it dead straight, which makes it read as anger, not whimsy. Note the two MDs in the credits — the campaign bought its authenticity rather than faking it.

**2. athenahealth — "When I Grow Up"** (2015) — *the best one in the set*
https://www.ispot.tv/ad/AIsM/athenahealth-when-i-grow-up
A small boy plays doctor. Playing doctor means typing seriously on a laptop, toys untouched. Dad asks how it's going; the boy holds up one finger — *not now.*
**Why it works:** no dialogue, no product, **no relief shown at all** — relief is implied entirely by absence. A child's imitation is an unfalsifiable audit of what a job looks like from outside.

**3. athenahealth — "Talk"** (2015)
https://www.ispot.tv/ad/AI0S/athenahealth-talk — telephone-game metaphor for interoperability. Weakest of the trio; useful as a control case for why the other two land (borrowed metaphor vs. found one).

**4. Heidi — "Side Effects May Include…" / platform *Relief, on Repeat*** (July 2026)
https://www.youtube.com/watch?v=VOpKNCSvWL4 (channel: Heidi AI)
Agency Cocogun · Dir. Alex Roberts · Prod. FINCH.
Inverts the DTC-pharma ad form — a CMO character fronts a "side effects" crawl where the side effects of Heidi are clearer heads and calmer days. One execution shows brain scans of hospital executives filled with stressful imagery.
**Why it works:** it doesn't dramatize the pain, it borrows *a form the audience already resents* and runs it backwards. The parody does the pain-staging for free. Brand quote: *"We wanted to make something that treated clinicians like the whole, complex, occasionally exhausted humans they actually are."* Also: it bets on being **funny** to clinicians rather than reverent — the safer bet, per the failure modes below.
Coverage: https://campaignbrief.com/leading-ai-health-platform-heidi-collaborates-with-cocogun-on-new-global-brand-campaign/

**5. Suki — "From Burnout to Balance"** (Nov 2022) — **⚠️ dead link**
Existence verified (BusinessWire 2022-11-15; HIT Consultant https://hitconsultant.net/2022/11/16/suki-releases-mini-doc-on-physician-burnout-challenges/). The documented URLs at `resources.suki.ai` now 301 to the homepage. **No playable URL found — do not cite one without re-finding it.**
Mini-doc, one real subject: Dr. Elizabeth Goff, family physician, Lynchburg VA, two young children, on the verge of going part-time. **Why it works:** named real practitioner, specific town, specific stakes, and *she* narrates — not a case study read over B-roll. That distinction is what keeps it out of the exploitation trap.

**6. Microsoft/Nuance — DAX Copilot overview** (Feb 2024)
https://www.youtube.com/watch?v=dyetGauE3yE (channel: Microsoft for Healthcare)
**⚠️ This is a product overview, not a brand film. I found no evidence that a Nuance DAX or Dragon Copilot narrative brand film exists.** The Dragon Copilot launch (HIMSS, March 2025) was blog/press-led. Microsoft's Super Bowl Copilot spots are general-purpose, not clinical.

### Adjacent professional software — same narrative machine

**7. Clio — "The Law Firm Lifesaver"** (June 2024) — closest structural analogue to a therapy-practice-software film that exists at scale
https://www.youtube.com/watch?v=f6qaxXGFhbc · Agency Rethink · Dir. Leigh Marling.
Fictional "Waverly Law," actors drowning in simultaneous demands. **Why it works:** the pain is staged as **simultaneity**, not volume — many small things at once, which is exactly how your audience experiences it. Weakness: actors in a fictional firm is a lower-authenticity bet than athenahealth's or Suki's.

**8. Rippling — "Dear HR… You Deserve Better"** (Feb 2025)
https://www.youtube.com/watch?v=ScbWzJcjC-w · Agency SLMBR PRTY · Dir. Abby Horton.
The turn is explicitly a *realization*, not a demo. **Why it works:** the title is an apology letter to the audience — the brand takes the practitioner's side against the whole category before selling.

**9. Vanta — "Don't SOC-block Your Best Engineer"** (Sept 2025) — **⚠️ no YouTube/Vimeo URL confirmed**
Only confirmed video location: https://www.facebook.com/TrustVanta/videos/dont-soc-block-your-best-engineer/1275891204272675/ · credits at https://www.adsoftheworld.com/campaigns/don-t-soc-block-your-best-engineer
45s. Engineer in flow inside a glass cube; CEO approaches to interrupt; a colleague intervenes. **Why it works:** the pain is *an interruption that hasn't happened yet* — all tension is in the approach, and the relief is the interruption never landing. A genuinely different structure from the before/after cut, and cheaper to shoot.

**10. Slack — "So Yeah, We Tried Slack…"** (2014) — **the one to steal from**
https://www.youtube.com/watch?v=B6zVzWU95Sw · Sandwich Video (Adam Lisagor).
Documented origin: Butterfield emailed Lisagor in June 2013; Sandwich **declined**, saying "products like that never work"; six months later they were using it; a month after that they shot the film. https://www.fastcompany.com/3034277/slack-wins-over-another-doubter-scoring-a-sandwich-video-in-the-deal
**Why it works:** the structure *is* the production history. The before-state is the studio's own on-record skepticism, spoken by the people who held it. Relief isn't demonstrated, it's **conceded** — a retraction, which is the most credible form of praise. The analogue for you is not "here's a happy 치료사," it's "here's a 치료사 who publicly said this stuff was useless, on camera, saying what changed."

**11. Grow Therapy — "Key Change"** (Aug 2026, 4 films: *The Bait, The Other Room, Sports Dad, Hot Dog*)
Credits verified at https://www.adsoftheworld.com/campaigns/key-change · Agency KDSP · **Dir. John Hillcoat** · Prod. Skunk. **No direct video URLs confirmed.**
**⚠️ Consumer-facing, not practitioner-facing.** Included for one stealable device: **each film carries an original song that changes register as the character's internal state shifts.** That's a sound-design solution to the pain→relief turn that doesn't require a cut — and it would work as well on a therapist's arc as a client's.

### Could NOT verify — do not use

- **Abridge brand films** — channel exists, a "Taking Back Pajama Time: Sutter Health" asset exists (https://www.abridge.com/blog/pajama-time-sutter), but **no narrative brand film found.** The best-matching YouTube result is owned by Reid Health, a customer.
- **Ambience Healthcare brand film** — the "cognitive burden" nurses video found is on Nurse Fern®'s channel, not Ambience's.
- **Nabla, Freed AI, Doximity, Elation Health, SimplePractice, Headway, Alma, Tebra/Kareo, Phreesia, Epic, Oracle Health/Cerner** — **no narrative brand films found. Product demos only.** Do not assume these exist.
- **Sandwich Video healthcare clients / Giant Ant / Code for America films** — nothing confirmed.

---

## The failure mode — what gets a clinician film destroyed

**There is no documented case of a clinical-software brand film being publicly savaged for exploiting clinician suffering.** That specific event hasn't happened yet. What follows is the surrounding blast radius, all verified.

**A. FIGS — "Dr. Wilson" (Oct 2020) — the canonical clinician-brand backlash.** A woman in pink scrubs holding *Medical Terminology for Dummies* **upside down**, camera pushing in on a badge reading **DO**. AACOM: *"We are outraged that in 2020, women physicians… are still attacked in thoughtless and ignorant marketing."* #boycottFIGS trended; two apologies (Oct 13, Oct 15), $100,000 to the AOA, a pledge to involve healthcare professionals in future content. Many clinicians rejected the apology.
https://abcnews.com/US/scrubs-brand-figs-fire-insensitive-ad-featuring-female/story?id=73599673 · https://kevinmd.com/2020/10/a-dos-take-on-the-figs-faux-pas.html
**Lesson:** the failure wasn't a bad joke, it was a brand proving it had never had a clinician in the room. The remedy FIGS itself named is what athenahealth had already built in — MDs in the credits.

**B. Manitoba nurse recruitment ads (Mar 2019) — the relief that insults. This is the most directly transferable warning for you.** Government ads showed nurses hiking, at galleries, doing yoga — one used a **stock photo of women getting spa facials with a stethoscope photoshopped on**. Manitoba Nurses Union: *"This is tone deaf and demeaning to women and Manitoba's nurses, who are dealing with 16 hour workdays, record (overtime), and crushing workloads."* Health Minister: *"Yeah, this is … odd."* Pulled within a day.
https://globalnews.ca/news/5109245/province-under-fire-after-demeaning-nurse-ads-on-social-media/
**Lesson: this is a pain→relief film that only shot the relief.** Skipping the before-state doesn't spare the audience — it tells them you don't know what the before-state is. Every "reclaim your evenings / be present with your family" frame is one photoshopped spa facial away from this.

**C. "Healthcare heroes" — the hollow tribute.** Academic critique names it precisely: hero rhetoric is *"a potentially damaging and morally vacuous evaluation"* that makes refusal-to-endure look like cowardice. https://pmc.ncbi.nlm.nih.gov/articles/PMC7316119/ · https://theconversation.com/nurses-dont-want-to-be-hailed-as-heroes-during-a-pandemic-they-want-more-resources-and-support-167763
**Lesson:** praise directed at a suffering practitioner, unaccompanied by material change, reads as a request that they keep suffering quietly. Opening on exhaustion and closing on "heroes deserve better tools" is inside this trap.

**D. The "pizza party" genre — and clinicians already have a visual for it.** Nurses circulate satirical images of *a nurse drowning in workload being thrown a slice of pizza instead of a life raft.* Becker's ran a feature framed as "Beyond the pizza party"; Medscape: *"This Nurse Wants Change, Not a Pizza Party."*
https://www.beckershospitalreview.com/workforce/beyond-the-pizza-party-how-9-systems-are-making-meaningful-efforts-to-boost-provider-well-being/ · https://www.medscape.com/viewarticle/974389
**Lesson:** the audience has a shared satirical vocabulary for insufficient relief. **If your film's relief is smaller than the pain you staged, you've made the pizza.**

**E. "Moral injury, not burnout" — the frame that makes all of this load-bearing.** Dean & Talbot, STAT, July 26, 2018 — still one of STAT's most-read pieces ever. *"Burnout"* implies a personal failure of resilience; what's happening is **moral injury**, damage from being repeatedly forced to act against your own moral code.
https://www.statnews.com/2018/07/26/physicians-not-burning-out-they-are-suffering-moral-injury/
**Lesson:** a large, articulate chunk of your audience **rejects the word "burnout" as victim-blaming.** A film whose premise is "you are burned out, here is your cure" is arguing with them in its first frame. Heidi sidesteps this by never diagnosing the clinician — it satirizes the *system's* language instead.

**F. Hims & Hers — "Sick of the System" (Super Bowl LIX, Feb 2025).** https://www.youtube.com/watch?v=mFtKnRPq8sE — indicted the "$160 billion weight loss industry," then sold compounded semaglutide with **zero side-effect or risk disclosure.** Sens. Durbin and Marshall to FDA: it *"risks misleading patients by omitting any safety or side effect information."* Condemned by The Obesity Society and PhRMA. https://www.cnbc.com/2025/02/07/hims-hers-faces-lawmaker-scrutiny-over-misleading-super-bowl-ad-.html
**Lesson:** "the system is broken and we're on your side" is the exact rhetorical position your film occupies. Take the moral authority of critiquing the system, then behave in a way the system's own rules would forbid, and every credentialed person in the audience turns on you at once.

**G–J, briefly:** **Cerebral** ADHD ads pulled by Meta and TikTok after NBC inquiries (2022) — clinician pushback routes through platforms and press, and it removes the asset. **Olive AI** — city-wide "go save healthcare" campaign, later described in trade press as *"mightily overpromised and vastly under-delivered"*; $4B valuation 2021 → shutdown 2023 (⚠️ this one rests on search-indexed summaries, not primary fetches — verify before quoting). **Babylon Health** — RCGP rebuked its "on par with doctors" claims as *"dubious"*; UK regulator forced removal of a "100% safe" claim. **IBM Watson for Oncology** — STAT found internal documents showing *"multiple examples of unsafe and incorrect treatment recommendations."*
**Common lesson across all four:** marketing that positions AI as equal or superior to the *practitioner* recruits the whole profession as adversarial fact-checkers. Every film that works here has the software absorbing the **bureaucracy**, never the **judgment**.

**K. The specific tripwire for MOEUM, stated plainly.** Published RCT evidence now caps ambient documentation savings at roughly **16 minutes per 8 hours of patient care**. A film promising "두 시간을 돌려드립니다" is contradicted by the literature and will be fact-checked. **The defensible claim is about how the work feels, not how many minutes it takes** — and that is a craft problem, not a copy problem.

---

## Compressed pattern

Every film that works stages the pain as a **specific physical or temporal object**: red tape pulled out of a body, a child's raised finger, an interruption walking toward a glass cube, ten minutes between sessions. Every failure either **skipped the before-state** (Manitoba), **priced the relief above what the product delivers** (Olive, Babylon, Watson, and now the 16-minute problem), or **spoke about clinicians without one in the room** (FIGS).

The two most credible devices in the entire survey are both about *who is talking*: Slack's on-record skeptics recanting their own published doubt, and athenahealth putting two consulting physicians in the credits of a comedy about surgery. For Korea, your equivalent already exists in the transcript — the 언어재활사 in the 2019 FGI who said **"서류가 너무 많아요… 정말 치료를 못하는 상황?"** was speaking to researchers, not to a camera, which is exactly why it will land.