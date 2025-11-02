"""
FastAPI主应用
FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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
