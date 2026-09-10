from __future__ import annotations


from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.config import settings

router = APIRouter()
schema_map_router = APIRouter()


@router.get("/")
async def root():
    return {
        "status": "ok",
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@router.get("/health")
async def health_check(request: Request):
    from app.infrastructure.cache.common.base import CacheClient

    cache_client: CacheClient | None = getattr(request.app.state, "cache_client", None)
    if cache_client is None:
        redis_status = "not_initialized"
    elif not settings.REDIS_ENABLED:
        redis_status = "disabled"
    else:
        redis_status = "connected" if await cache_client.ping() else "disconnected"

    return {
        "status": "healthy",
        "redis": redis_status,
        "worker_mode": settings.AI_WORKER_MODE,
    }


@schema_map_router.get("/schema-canvas", response_class=HTMLResponse)
async def schema_canvas():
    from app.server import pages

    return pages.SCHEMA_CANVAS.read_text(encoding="utf-8")


# explorer는 tools/ontology-explorer(Vite) 하나로 합쳤다 — 여기 있던 HTML 콘솔은 그쪽
# ConsoleView가 흡수했다(/api-map으로 개념·파라미터 자동 열거 + 봉투를 그래프로).
# 라우트는 기존 주소를 쓰던 사람을 위해 남긴다.
ONTOLOGY_EXPLORER_URL = "http://localhost:3510"


@schema_map_router.get("/ontology-explorer")
async def ontology_explorer():
    return RedirectResponse(ONTOLOGY_EXPLORER_URL)


@schema_map_router.get("/api-map")
async def api_map(request: Request):
    from app.server import route_map

    return route_map.build(request.app)


@schema_map_router.get("/schema-data")
async def schema_data():
    from app.infrastructure.persistence import schema_doc

    schema_doc.import_all_models()
    models = schema_doc.registered_models()
    return {
        "markdown": schema_doc.build_markdown(models),
        "domains": schema_doc.build_domain_colors(models),
    }
