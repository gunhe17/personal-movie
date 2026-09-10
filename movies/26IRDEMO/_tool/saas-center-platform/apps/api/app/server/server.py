from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, FastAPI


# #
# lifecycle

Hook = Callable[[FastAPI], Awaitable[None]]


# #
# router

class Router:
    def __init__(self, *, router: APIRouter, prefix: str = ""):
        self._router = router
        self._prefix = prefix

    def register(self, app: FastAPI) -> None:
        app.include_router(self._router, prefix=self._prefix)


# #
# middleware

class Middleware:
    """클래스형(`add_middleware`) 또는 함수형(`@app.middleware("http")`) 미들웨어."""

    def __init__(
        self,
        *,
        cls: type | None = None,
        func: Callable | None = None,
        **options: Any,
    ):
        self._cls = cls
        self._func = func
        self._options = options

    def register(self, app: FastAPI) -> None:
        if self._cls is not None:
            app.add_middleware(self._cls, **self._options)
        elif self._func is not None:
            app.middleware("http")(self._func)


# #
# exception handler

class ExceptionHandler:
    def __init__(
        self,
        *,
        exception_class: type[Exception],
        handler: Callable[..., Any],
    ):
        self._exception_class = exception_class
        self._handler = handler

    def register(self, app: FastAPI) -> None:
        app.add_exception_handler(self._exception_class, self._handler)


# #
# server

class Server:
    def __init__(
        self,
        *,
        title: str,
        version: str,
        description: str = "",
        debug: bool = False,
    ):
        self._title = title
        self._version = version
        self._description = description
        self._debug = debug

        self._startup_hooks: list[Hook] = []
        self._shutdown_hooks: list[Hook] = []
        self._middlewares: list[Middleware] = []
        self._routers: list[Router] = []
        self._exception_handlers: list[ExceptionHandler] = []

    def startup(self, hook: Hook) -> None:
        self._startup_hooks.append(hook)

    def shutdown(self, hook: Hook) -> None:
        self._shutdown_hooks.append(hook)

    def middleware(self, middleware: Middleware) -> None:
        self._middlewares.append(middleware)

    def router(self, router: Router) -> None:
        self._routers.append(router)

    def exception_handler(self, exception_handler: ExceptionHandler) -> None:
        self._exception_handlers.append(exception_handler)

    def _lifespan(self) -> Callable:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            for hook in self._startup_hooks:
                await hook(app)
            yield
            for hook in self._shutdown_hooks:
                await hook(app)

        return lifespan

    def app(self) -> FastAPI:
        app = FastAPI(
            title=self._title,
            description=self._description,
            version=self._version,
            lifespan=self._lifespan(),
            debug=self._debug,
        )
        # starlette add_middleware 는 insert(0) — 뒤집어야 선언 순 = 요청 통과 순(바깥→안)
        for middleware in reversed(self._middlewares):
            middleware.register(app)
        for router in self._routers:
            router.register(app)
        for exception_handler in self._exception_handlers:
            exception_handler.register(app)
        return app


# #
# factory

def saas_center_api() -> Server:
    from app.core.config import settings

    return Server(
        title=settings.APP_NAME,
        description="상담센터 SaaS 플랫폼 API",
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )
