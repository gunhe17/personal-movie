#!/bin/bash
#
# generate-changelog.sh
#
# 마지막 태그 이후의 git 커밋을 수집하여 changelog.ts에 추가할
# 릴리스 노트 초안을 생성합니다.
#
# 사용법:
#   pnpm changelog                    # 대화형 (버전 입력 프롬프트)
#   pnpm changelog 1.2.0              # 버전 지정
#   pnpm changelog 1.2.0 --apply      # 버전 지정 + changelog.ts에 자동 삽입
#
# 커밋 메시지 규칙 (한글):
#   feat:    새 기능 추가
#   fix:     버그 수정
#   modify:  기존 기능 수정
#   style:   스타일 변경
#   publish: 배포
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHANGELOG_FILE="$SCRIPT_DIR/../src/lib/constants/changelog.ts"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ─── 1. 마지막 태그 찾기 ─────────────────────────────────────────

cd "$PROJECT_ROOT"

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
  echo -e "${YELLOW}태그가 없습니다. 전체 커밋을 수집합니다.${NC}"
  COMMIT_RANGE="HEAD"
  SINCE_LABEL="처음부터"
else
  echo -e "${BLUE}마지막 태그: ${BOLD}$LAST_TAG${NC}"
  COMMIT_RANGE="${LAST_TAG}..HEAD"
  SINCE_LABEL="$LAST_TAG 이후"
fi

# ─── 2. 커밋 수집 ────────────────────────────────────────────────

# merge 커밋 제외, 한 줄씩 수집
if [ "$COMMIT_RANGE" = "HEAD" ]; then
  COMMITS=$(git log --no-merges --pretty=format:"%s" 2>/dev/null || echo "")
else
  COMMITS=$(git log "$COMMIT_RANGE" --no-merges --pretty=format:"%s" 2>/dev/null || echo "")
fi

if [ -z "$COMMITS" ]; then
  echo -e "${YELLOW}${SINCE_LABEL} 새 커밋이 없습니다.${NC}"
  exit 0
fi

COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
echo -e "${GREEN}${SINCE_LABEL} ${BOLD}${COMMIT_COUNT}개${NC}${GREEN} 커밋 발견${NC}"
echo ""

# ─── 3. 카테고리별 분류 ──────────────────────────────────────────

FEAT_COMMITS=$(echo "$COMMITS" | grep -i "^feat:" | sed 's/^[Ff]eat: *//' || true)
FIX_COMMITS=$(echo "$COMMITS" | grep -i "^fix:" | sed 's/^[Ff]ix: *//' || true)
MODIFY_COMMITS=$(echo "$COMMITS" | grep -i "^modify:" | sed 's/^[Mm]odify: *//' || true)
STYLE_COMMITS=$(echo "$COMMITS" | grep -i "^style:" | sed 's/^[Ss]tyle: *//' || true)
OTHER_COMMITS=$(echo "$COMMITS" | grep -iv "^feat:\|^fix:\|^modify:\|^style:\|^publish:" || true)

# ─── 4. 버전 결정 ────────────────────────────────────────────────

NEW_VERSION="${1:-}"
AUTO_APPLY=false

# --apply 플래그 체크
for arg in "$@"; do
  if [ "$arg" = "--apply" ]; then
    AUTO_APPLY=true
  fi
done

if [ -z "$NEW_VERSION" ] || [ "$NEW_VERSION" = "--apply" ]; then
  # 현재 package.json 버전 읽기
  CURRENT_VERSION=$(node -p "require('$SCRIPT_DIR/../package.json').version" 2>/dev/null || echo "0.0.0")
  echo -e "${CYAN}현재 버전: ${BOLD}$CURRENT_VERSION${NC}"
  echo -n "새 버전을 입력하세요 (예: 1.0.0): "
  read -r NEW_VERSION
  if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}버전이 입력되지 않았습니다.${NC}"
    exit 1
  fi
fi

# v 접두사 제거
NEW_VERSION="${NEW_VERSION#v}"

TODAY=$(date +%Y-%m-%d)

# ─── 5. 릴리스 노트 생성 ─────────────────────────────────────────

echo ""
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}  릴리스 노트 초안 (v${NEW_VERSION})${NC}"
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo ""

# changes 배열 항목 수집
CHANGES=""

if [ -n "$FEAT_COMMITS" ] && [ "$FEAT_COMMITS" != "" ]; then
  echo -e "${GREEN}[새 기능]${NC}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "  + $line"
    CHANGES="${CHANGES}      '${line}',\n"
  done <<< "$FEAT_COMMITS"
  echo ""
fi

if [ -n "$MODIFY_COMMITS" ] && [ "$MODIFY_COMMITS" != "" ]; then
  echo -e "${BLUE}[개선]${NC}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "  ~ $line"
    CHANGES="${CHANGES}      '${line}',\n"
  done <<< "$MODIFY_COMMITS"
  echo ""
fi

if [ -n "$FIX_COMMITS" ] && [ "$FIX_COMMITS" != "" ]; then
  echo -e "${RED}[버그 수정]${NC}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "  * $line"
    CHANGES="${CHANGES}      '${line}',\n"
  done <<< "$FIX_COMMITS"
  echo ""
fi

if [ -n "$STYLE_COMMITS" ] && [ "$STYLE_COMMITS" != "" ]; then
  echo -e "${CYAN}[스타일]${NC}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "  - $line"
    CHANGES="${CHANGES}      '${line}',\n"
  done <<< "$STYLE_COMMITS"
  echo ""
fi

if [ -n "$OTHER_COMMITS" ] && [ "$OTHER_COMMITS" != "" ]; then
  echo -e "${YELLOW}[기타]${NC}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "  ? $line"
    CHANGES="${CHANGES}      '${line}',\n"
  done <<< "$OTHER_COMMITS"
  echo ""
fi

# ─── 6. changelog.ts 엔트리 생성 ─────────────────────────────────

# 마지막 쉼표+줄바꿈 제거
CHANGES=$(echo -e "$CHANGES" | sed '$ s/,$//')

ENTRY="  {
    version: '${NEW_VERSION}',
    date: '${TODAY}',
    summary: '', // TODO: 한 줄 요약을 작성하세요
    changes: [
${CHANGES}    ]
  }"

echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo ""

# ─── 7. changelog.ts에 삽입 ───────────────────────────────────────

if [ "$AUTO_APPLY" = true ]; then
  APPLY="y"
else
  echo -n "changelog.ts에 추가하시겠습니까? (y/N): "
  read -r APPLY
fi

if [[ "$APPLY" =~ ^[Yy]$ ]]; then
  # "export const changelog: ChangelogEntry[] = [" 다음 줄에 삽입
  # macOS/Linux sed 호환성을 위해 perl 사용
  perl -i -0pe "s/(export const changelog: ChangelogEntry\[\] = \[\n)/\$1${ENTRY},\n/" "$CHANGELOG_FILE"

  echo -e "${GREEN}changelog.ts에 v${NEW_VERSION} 엔트리가 추가되었습니다.${NC}"
  echo -e "${YELLOW}TODO: summary 필드를 작성하고, changes 항목을 사용자 친화적으로 다듬어주세요.${NC}"
  echo ""
  echo -e "팁: Claude Code에서 다음과 같이 요청하면 자동으로 다듬어줍니다:"
  echo -e "  ${CYAN}\"changelog.ts의 최신 엔트리를 사용자 친화적으로 다듬어줘\"${NC}"
else
  echo ""
  echo "아래 엔트리를 changelog.ts의 배열 첫 번째에 추가하세요:"
  echo ""
  echo "$ENTRY"
fi
