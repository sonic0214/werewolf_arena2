"""
FastAPI主应用
FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os

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


@app.get("/")
async def root():
    """根路径"""
    index_path = os.path.join(frontend_build_path, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {
        "message": "Werewolf Arena API",
        "version": settings.version,
        "docs": "/docs",
        "status": "running"
    }


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

    @app.get("/{path:path}")
    async def catch_all(path: str):
        """Catch all route for SPA - serve frontend index.html"""
        # 如果是API请求，返回404
        if path.startswith("api/") or path.startswith("docs") or path.startswith("openapi.json"):
            return {"error": "Not found"}, 404

        # 尝试提供静态文件
        file_path = os.path.join(frontend_build_path, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        # 默认返回index.html
        index_path = os.path.join(frontend_build_path, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)

        return {"error": "Frontend not found"}, 404
