"""
服务状态API路由
Status API Routes
"""

from fastapi import APIRouter
from typing import Dict, Any
import platform
import os
from datetime import datetime

from src.config.settings import settings
from src.services.game_manager.session_manager import game_manager

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    健康检查
    Health check endpoint
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.version
    }


@router.get("/info")
async def server_info() -> Dict[str, Any]:
    """
    服务器信息
    Get server information
    """
    # 获取游戏会话统计
    sessions = game_manager.get_all_sessions()
    running_games = sum(1 for s in sessions.values() if s.is_running)
    completed_games = sum(1 for s in sessions.values() if s.state.winner)

    # 基本系统信息（不使用psutil）
    import multiprocessing
    cpu_count = multiprocessing.cpu_count()

    return {
        "service": {
            "name": settings.project_name,
            "version": settings.version,
            "environment": settings.environment,
            "debug": settings.debug
        },
        "system": {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "cpu_count": cpu_count,
            "cpu_percent": None,  # psutil依赖项已移除
        },
        "resources": {
            "memory": {
                "total_mb": None,  # psutil依赖项已移除
                "used_mb": None,
                "percent": None
            },
            "disk": {
                "total_gb": None,  # psutil依赖项已移除
                "used_gb": None,
                "percent": None
            }
        },
        "games": {
            "total_sessions": len(sessions),
            "running": running_games,
            "completed": completed_games,
            "stopped": len(sessions) - running_games - completed_games
        },
        "config": {
            "max_debate_turns": settings.game.max_debate_turns,
            "default_threads": settings.game.default_threads,
            "num_players": settings.game.num_players
        }
    }


@router.get("/stats")
async def game_stats() -> Dict[str, Any]:
    """
    游戏统计信息
    Get game statistics
    """
    sessions = game_manager.get_all_sessions()

    if not sessions:
        return {
            "total_games": 0,
            "statistics": None
        }

    # 统计游戏结果
    villagers_wins = 0
    werewolves_wins = 0
    total_rounds = 0
    model_usage = {}

    for session in sessions.values():
        if session.state.winner == "Villagers":
            villagers_wins += 1
        elif session.state.winner == "Werewolves":
            werewolves_wins += 1

        total_rounds += len(session.state.rounds)

        # 统计模型使用
        for player in session.state.players.values():
            model = player.model
            model_usage[model] = model_usage.get(model, 0) + 1

    avg_rounds = total_rounds / len(sessions) if sessions else 0

    return {
        "total_games": len(sessions),
        "statistics": {
            "wins": {
                "villagers": villagers_wins,
                "werewolves": werewolves_wins,
                "in_progress": len(sessions) - villagers_wins - werewolves_wins
            },
            "win_rate": {
                "villagers": round(villagers_wins / len(sessions) * 100, 2) if sessions else 0,
                "werewolves": round(werewolves_wins / len(sessions) * 100, 2) if sessions else 0
            },
            "average_rounds": round(avg_rounds, 2),
            "total_rounds": total_rounds
        },
        "model_usage": model_usage
    }
