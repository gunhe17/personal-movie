#!/usr/bin/env python3
"""내담자 앱 기획 문서들을 단일 가독성 HTML 검토본으로 합친다.

docs/client-app/ 의 마크다운(CORE/README/principles/features/*)을 읽어
사이드바 네비 + 다크 테마 + 클라이언트 사이드 마크다운 렌더링이 포함된
자체완결형 HTML(기획-검토.html)을 생성한다.

재생성:  python3 docs/client-app/build_review.py
"""
from __future__ import annotations
import html
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "기획-검토.html"

# (파일경로(ROOT 기준), 사이드바 표시명, 그룹, phase 뱃지)
DOCS = [
    ("CORE.md",        "핵심 정의 (SSOT)",   "0. 핵심",            "SSOT"),
    ("principles.md",  "설계 원칙",          "0. 핵심",            None),
    ("README.md",      "기능 명세 인덱스",   "0. 핵심",            None),
    ("features/F01-auth-onboarding.md",    "F01 · 인증 & 온보딩",   "1. 기능 명세 — MVP", "MVP"),
    ("features/F02-home.md",               "F02 · 홈 화면",          "1. 기능 명세 — MVP", "MVP"),
    ("features/F03-schedule-timeline.md",  "F03 · 일정 & 타임라인",  "1. 기능 명세 — MVP", "MVP"),
    ("features/F04-assessment.md",         "F04 · 검사 결과",        "1. 기능 명세 — MVP", "MVP"),
    ("features/F05-self-test.md",          "F05 · 자가진단",         "1. 기능 명세 — MVP", "MVP"),
    ("features/F06-content.md",            "F06 · 콘텐츠",           "1. 기능 명세 — MVP", "MVP"),
    ("features/F07-notification.md",       "F07 · 알림",             "1. 기능 명세 — MVP", "MVP"),
    ("features/F08-my-page.md",            "F08 · 마이페이지",       "1. 기능 명세 — MVP", "MVP"),
    ("features/F09-orb-character.md",      "F09 · 오브 캐릭터",      "1. 기능 명세 — MVP", "MVP"),
    ("features/F10-mission-record.md",     "F10 · 미션 & 기록",      "2. 확장 — Phase 2~3", "P2"),
    ("features/F11-expert-note.md",        "F11 · 전문가 노트",      "2. 확장 — Phase 2~3", "P2"),
    ("features/F12-ai-growth-guide.md",    "F12 · AI 성장 가이드",   "2. 확장 — Phase 2~3", "P3"),
    ("features/S01-screen-map.md",         "S01 · 화면 맵 / 흐름",   "3. 화면 흐름",        None),
]

BADGE_CLASS = {"SSOT": "b-ssot", "MVP": "b-mvp", "P2": "b-p2", "P3": "b-p3"}


def read(rel: str) -> str | None:
    p = ROOT / rel
    if not p.exists():
        return None
    return p.read_text(encoding="utf-8")


def build() -> str:
    nav_groups: dict[str, list[tuple[str, str, str | None]]] = {}
    sections = []
    missing = []

    for rel, title, group, badge in DOCS:
        content = read(rel)
        if content is None:
            missing.append(rel)
            continue
        anchor = "doc-" + rel.replace("/", "-").replace(".md", "")
        nav_groups.setdefault(group, []).append((anchor, title, badge))

        # </script 만 안전 처리 (나머지는 원문 그대로 보존)
        safe = content.replace("</script", "<\\/script")
        badge_html = ""
        if badge:
            badge_html = f'<span class="badge {BADGE_CLASS.get(badge, "")}">{badge}</span>'
        sections.append(
            f'<section id="{anchor}" class="doc">'
            f'<div class="doc-head"><span class="doc-kicker">{html.escape(group)}</span>'
            f'<h2 class="doc-title">{html.escape(title)} {badge_html}</h2>'
            f'<div class="doc-src">{html.escape(rel)}</div></div>'
            f'<script type="text/markdown" data-target="md-{anchor}">{safe}</script>'
            f'<div class="md" id="md-{anchor}"></div>'
            f'</section>'
        )

    # 사이드바 HTML
    nav_html = []
    for group, items in nav_groups.items():
        nav_html.append(f'<div class="nav-group">{html.escape(group)}</div>')
        for anchor, title, badge in items:
            b = ""
            if badge:
                b = f'<span class="badge sm {BADGE_CLASS.get(badge, "")}">{badge}</span>'
            nav_html.append(f'<a href="#{anchor}" data-anchor="{anchor}">{html.escape(title)}{b}</a>')
    nav_html = "\n".join(nav_html)

    sections_html = "\n".join(sections)
    warn = ""
    if missing:
        warn = '<!-- 누락된 문서: ' + ", ".join(missing) + ' -->'

    return TEMPLATE.format(nav=nav_html, sections=sections_html, warn=warn)


TEMPLATE = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>내담자 앱 — 기획 통합 검토본</title>
{warn}
<style>
  :root{{
    --bg:#0f1115; --panel:#161922; --panel2:#1b1f2a; --code:#11141b;
    --line:#262b36; --line2:#323845;
    --txt:#e9ebef; --muted:#a3acbd; --dim:#727b8c;
    --accent:#7c9cff; --core:#5b8cff; --acq:#3ec98a; --no:#ff6b6b; --warn:#f5b14c;
    --radius:14px;
  }}
  *{{box-sizing:border-box}}
  html{{scroll-behavior:smooth}}
  body{{
    margin:0;background:var(--bg);color:var(--txt);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
    line-height:1.72;font-size:15px;
  }}
  a{{color:var(--accent);text-decoration:none}}
  .wrap{{display:grid;grid-template-columns:268px 1fr;max-width:1280px;margin:0 auto}}

  /* nav */
  nav{{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;
       padding:30px 18px 60px;border-right:1px solid var(--line)}}
  nav .brand{{font-weight:800;font-size:15px;letter-spacing:.2px}}
  nav .sub{{color:var(--dim);font-size:12px;margin:4px 0 22px}}
  .nav-group{{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:1.2px;
              margin:20px 0 6px;padding-left:10px;font-weight:700}}
  nav a{{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;
         padding:6px 10px;border-radius:8px;margin-bottom:1px;line-height:1.35}}
  nav a:hover{{background:var(--panel2);color:var(--txt)}}
  nav a.active{{background:var(--panel2);color:#fff;box-shadow:inset 2px 0 0 var(--accent)}}

  /* main */
  main{{padding:46px 60px 140px;min-width:0}}
  .hero{{background:linear-gradient(135deg,#1a2233,#13161f);border:1px solid var(--line);
         border-radius:var(--radius);padding:38px 40px;margin-bottom:18px}}
  .hero .kick{{font-size:11.5px;color:var(--accent);letter-spacing:2px;text-transform:uppercase;font-weight:700}}
  .hero .id{{font-size:27px;font-weight:800;line-height:1.4;margin:12px 0 14px;letter-spacing:-.4px}}
  .hero .id em{{color:var(--core);font-style:normal}}
  .hero p{{color:var(--muted);margin:0;font-size:14.5px}}
  .hero .meta{{display:flex;gap:16px;flex-wrap:wrap;margin-top:20px;font-size:12.5px;color:var(--dim)}}
  .hero .meta b{{color:var(--muted)}}

  section.doc{{margin-top:54px;scroll-margin-top:18px;border-top:1px solid var(--line);padding-top:30px}}
  section.doc:first-of-type{{border-top:none}}
  .doc-head{{margin-bottom:14px}}
  .doc-kicker{{font-size:11px;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase;font-weight:700}}
  .doc-title{{font-size:23px;font-weight:800;margin:6px 0 2px;letter-spacing:-.3px}}
  .doc-src{{font-size:11.5px;color:var(--dim);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}}

  /* markdown */
  .md h1{{font-size:21px;font-weight:800;margin:26px 0 12px;letter-spacing:-.3px}}
  .md h2{{font-size:18px;font-weight:700;margin:30px 0 10px;padding-top:6px;border-top:1px dashed var(--line)}}
  .md h3{{font-size:15.5px;font-weight:700;margin:22px 0 8px;color:#d3d9e6}}
  .md h4{{font-size:14px;font-weight:700;margin:18px 0 6px;color:var(--muted)}}
  .md p{{margin:10px 0;color:#dce0e8}}
  .md ul,.md ol{{margin:10px 0;padding-left:22px}}
  .md li{{margin:4px 0;color:#dce0e8}}
  .md strong{{color:#fff;font-weight:700}}
  .md em{{color:var(--warn);font-style:normal}}
  .md a{{border-bottom:1px solid rgba(124,156,255,.35)}}
  .md hr{{border:none;border-top:1px solid var(--line);margin:26px 0}}
  .md blockquote{{margin:14px 0;padding:10px 16px;border-left:3px solid var(--accent);
                  background:var(--panel);border-radius:0 8px 8px 0;color:var(--muted)}}
  .md blockquote p{{margin:4px 0;color:var(--muted)}}

  .md code{{background:#222734;color:#ffd9a0;padding:1.5px 6px;border-radius:5px;font-size:12.5px;
            font-family:ui-monospace,SFMono-Regular,Menlo,monospace}}
  .md pre{{background:var(--code);border:1px solid var(--line2);border-radius:10px;
           padding:16px 18px;overflow-x:auto;margin:14px 0;line-height:1.5}}
  .md pre code{{background:none;color:#c7d0e0;padding:0;font-size:12.5px;white-space:pre}}

  .md table{{border-collapse:collapse;width:100%;margin:16px 0;font-size:13.5px;
             border:1px solid var(--line2);border-radius:10px;overflow:hidden}}
  .md th{{background:var(--panel2);color:#fff;text-align:left;padding:9px 13px;
          font-weight:700;border-bottom:1px solid var(--line2);font-size:12.5px}}
  .md td{{padding:9px 13px;border-bottom:1px solid var(--line);color:#dce0e8;vertical-align:top}}
  .md tr:last-child td{{border-bottom:none}}
  .md tbody tr:nth-child(even){{background:rgba(255,255,255,.014)}}
  .md td code{{font-size:12px}}

  .badge{{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.4px;
          padding:2px 8px;border-radius:999px;vertical-align:middle;margin-left:4px}}
  .badge.sm{{font-size:9px;padding:1px 6px;margin-left:auto}}
  .b-ssot{{background:rgba(124,156,255,.16);color:#9db4ff;border:1px solid rgba(124,156,255,.4)}}
  .b-mvp {{background:rgba(62,201,138,.14);color:#5fd6a0;border:1px solid rgba(62,201,138,.38)}}
  .b-p2  {{background:rgba(245,177,76,.14);color:#f5c074;border:1px solid rgba(245,177,76,.36)}}
  .b-p3  {{background:rgba(255,107,107,.13);color:#ff9292;border:1px solid rgba(255,107,107,.34)}}

  .topbtn{{position:fixed;right:26px;bottom:26px;background:var(--panel2);border:1px solid var(--line2);
           color:var(--muted);width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:18px;
           display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s;z-index:20}}
  .topbtn.show{{opacity:1}}

  @media (max-width:880px){{
    .wrap{{grid-template-columns:1fr}}
    nav{{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line)}}
    main{{padding:28px 20px 100px}}
  }}
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <div class="brand">내담자 앱 · 기획 검토본</div>
    <div class="sub">마인드엔서 (B2C) · 통합 뷰</div>
    <a href="#hero" data-anchor="hero">▲ 개요</a>
    {nav}
  </nav>
  <main>
    <div id="hero" class="hero">
      <div class="kick">CLIENT APP · PLANNING REVIEW</div>
      <div class="id">"연동된 상담의 <em>동반자</em>" —<br>동반자 코어는 양보 불가, 획득은 센터에 위협 안 되는 선까지.</div>
      <p>상담은 비싸고, 느리고, 중간이 안 보인다. 이 앱은 그 불투명함을 메워 <b style="color:#fff">'진전 감각'</b>을 만든다. 마음건강 슈퍼앱이 <b style="color:#fff">아니다</b> — B2B 고객(상담센터)과 이해충돌하는 모든 것을 배제한다.</p>
      <div class="meta">
        <span><b>SSOT</b> CORE.md</span>
        <span><b>프레임</b> 2탭(홈/마이) · 읽기 투영</span>
        <span><b>스택</b> React Native Expo</span>
        <span><b>확정일</b> 2026-06-23 (백지 재정의)</span>
      </div>
    </div>
    {sections}
  </main>
</div>
<button class="topbtn" id="top" title="맨 위로">↑</button>

<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script>
(function(){{
  function renderAll(){{
    var blocks = document.querySelectorAll('script[type="text/markdown"]');
    var hasMarked = (typeof window.marked !== 'undefined');
    if (hasMarked && marked.setOptions) marked.setOptions({{ gfm:true, breaks:false }});
    blocks.forEach(function(b){{
      var target = document.getElementById(b.dataset.target);
      if (!target) return;
      var raw = b.textContent;
      if (hasMarked) {{
        try {{ target.innerHTML = marked.parse(raw); return; }} catch(e) {{}}
      }}
      var pre = document.createElement('pre');
      pre.textContent = raw; target.appendChild(pre);
    }});
  }}
  renderAll();

  // 스크롤 위치 → 사이드바 active
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('nav a[data-anchor]'));
  var map = {{}}; navLinks.forEach(function(a){{ map[a.dataset.anchor] = a; }});
  var io = new IntersectionObserver(function(entries){{
    entries.forEach(function(en){{
      if (en.isIntersecting) {{
        navLinks.forEach(function(a){{ a.classList.remove('active'); }});
        var a = map[en.target.id]; if (a) a.classList.add('active');
      }}
    }});
  }}, {{ rootMargin:'-10% 0px -80% 0px', threshold:0 }});
  document.querySelectorAll('section.doc, #hero').forEach(function(s){{ io.observe(s); }});

  // 맨 위로
  var top = document.getElementById('top');
  top.addEventListener('click', function(){{ window.scrollTo({{top:0,behavior:'smooth'}}); }});
  window.addEventListener('scroll', function(){{
    if (window.scrollY > 600) top.classList.add('show'); else top.classList.remove('show');
  }});
}})();
</script>
</body>
</html>"""


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"생성됨: {OUT}")
