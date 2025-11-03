"""
FastAPI主应用
FastAPI Main Application
"""

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import asyncio
import os
import httpx

from src.config import settings
from src.services.llm.client import LLMClient
from src.services.llm.generator import set_global_llm_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 Starting Werewolf Arena API...")
    print(f"📝 Environment: {settings.environment}")
    print(f"🔧 Debug mode: {settings.debug}")

    # 初始化全局LLM客户端
    next_client = httpx.AsyncClient(
        base_url=os.getenv("NEXT_SERVER_URL", "http://127.0.0.1:3100"),
        follow_redirects=True,
    )
    app.state.next_client = next_client
    print(f"🌐 Frontend proxy target: {next_client.base_url}")

    llm_client = None
    try:
        try:
            llm_client = LLMClient.from_settings(settings)
            set_global_llm_client(llm_client)

            # 检查LLM提供商健康状态
            health_status = llm_client.health_check()
            print(f"🤖 LLM Providers Health: {health_status}")

            print("✅ Global LLM client initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize LLM client: {e}")
            print("⚠️  Game functionality will be limited")

        print("🎮 Ready to start games!")

        yield
    finally:
        if llm_client and hasattr(llm_client, "close"):
            close_method = getattr(llm_client, "close")
            if callable(close_method):
                result = close_method()
                if asyncio.iscoroutine(result):
                    await result
        await next_client.aclose()
        print("⚠️ Frontend proxy client closed")

    # 关闭时
    print("🛑 Shutting down Werewolf Arena API...")


# 创建FastAPI应用
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="LLM-based Werewolf Game Framework API",
    lifespan=lifespan,
    debug=settings.debug,
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.allow_origins,
    allow_credentials=settings.cors.allow_credentials,
    allow_methods=settings.cors.allow_methods,
    allow_headers=settings.cors.allow_headers,
)


async def proxy_frontend(request: Request, path: str) -> Response:
    """将请求代理到 Next.js 前端服务"""
    client: httpx.AsyncClient = getattr(request.app.state, "next_client", None)
    if not client:
        raise HTTPException(status_code=503, detail="Frontend service unavailable")

    if request.method not in {"GET", "HEAD"}:
        raise HTTPException(status_code=405, detail="Method not allowed")

    target_path = f"/{path}" if path else "/"
    query = request.url.query
    if query:
        target_path = f"{target_path}?{query}"

    # 过滤不必要的请求头，避免与上游冲突
    filtered_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "content-type", "accept-encoding", "connection"}
    }

    try:
        upstream_response = await client.request(
            method=request.method,
            url=target_path,
            headers=filtered_headers,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Frontend proxy error: {exc}") from exc

    # 仅传递与前端资源相关的响应头
    allowed_response_headers = {
        "content-type",
        "cache-control",
        "etag",
        "last-modified",
        "set-cookie",
        "content-language",
        "vary",
        "expires",
    }
    response_headers = {
        key: value
        for key, value in upstream_response.headers.items()
        if key.lower() in allowed_response_headers
    }

    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=response_headers,
    )


@app.api_route("/", methods=["GET", "HEAD"])
async def root(request: Request):
    """根路径 - 代理到前端"""
    return await proxy_frontend(request, "")


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "version": settings.version
    }


# 注册API路由
from src.api.v1.routes import games, status, models, timing, websocket, logs

app.include_router(games.router, prefix="/api/v1/games", tags=["Games"])
app.include_router(status.router, prefix="/api/v1/status", tags=["Status"])
app.include_router(models.router, prefix="/api/v1/models", tags=["Models"])
app.include_router(timing.router, prefix="/api/v1/config", tags=["Timing Configuration"])
app.include_router(logs.router, prefix="/api/v1/games", tags=["Logs"])
app.include_router(websocket.router, tags=["WebSocket"])

# 添加静态文件服务 (用于Render部署)
frontend_build_path = os.getenv("FRONTEND_BUILD_PATH", "/app/frontend/.next/standalone")
frontend_static_path = os.getenv("FRONTEND_STATIC_PATH", "/app/frontend/.next/static")

if os.path.exists(frontend_build_path):
    # 静态文件
    if os.path.exists(frontend_static_path):
        app.mount("/_next/static", StaticFiles(directory=frontend_static_path), name="static")

    # 静态资源
    public_path = os.path.join(frontend_build_path, "public")
    if os.path.exists(public_path):
        app.mount("/public", StaticFiles(directory=public_path), name="public")

    # 静态文件
    static_path = os.path.join(frontend_build_path, "static")
    if os.path.exists(static_path):
        app.mount("/static", StaticFiles(directory=static_path), name="static")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"])
    async def catch_all(path: str, request: Request):
        """Catch all route for SPA - Proxy to Next.js frontend"""
        # 如果是API或文档请求，返回404以避免与FastAPI路由冲突
        if path.startswith(("api/", "docs", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not found")

        # 如果构建目录中存在对应静态文件，直接返回
        file_path = os.path.join(frontend_build_path, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        return await proxy_frontend(request, path)
