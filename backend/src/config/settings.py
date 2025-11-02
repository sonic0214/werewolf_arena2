"""
统一配置管理系统
Unified Configuration System using Pydantic Settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from pathlib import Path
import random
from .timing_loader import get_timing_config, TimingConfig


class GameSettings(BaseSettings):
    """游戏配置"""
    num_players: int = 6
    max_debate_turns: int = 1  # 增加辩论轮数到5轮
    default_threads: int = 4
    debate_concurrent: int = 3  # 发言阶段并发数
    retries: int = 2
    run_synthetic_votes: bool = True

    @property
    def timing(self) -> TimingConfig:
        """获取延迟配置"""
        return get_timing_config()

    # 为了向后兼容，保留这些属性但会从timing配置中读取
    @property
    def frontend_refresh_interval(self) -> int:
        return self.timing.frontend_refresh_interval

    @property
    def action_delay(self) -> float:
        return self.timing.action_delay

    @property
    def debate_delay(self) -> float:
        return self.timing.debate_delay

    @property
    def night_action_delay(self) -> float:
        return self.timing.night_action_delay

    @property
    def summary_delay(self) -> float:
        return self.timing.summary_delay


class LLMSettings(BaseSettings):
    """LLM API配置"""
    # SiliconFlow (硅基流动)
    siliconflow_api_key: Optional[str] = None
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"

    # 默认使用的模型
    default_model: str = "siliconflow/deepseek-ai/DeepSeek-V3"


class ServerSettings(BaseSettings):
    """服务器配置"""
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    log_level: str = "info"
    workers: int = 1


class CORSSettings(BaseSettings):
    """CORS配置"""
    allow_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    allow_credentials: bool = True
    allow_methods: List[str] = ["*"]
    allow_headers: List[str] = ["*"]


class PathSettings(BaseSettings):
    """路径配置"""
    # 项目根目录
    project_root: Path = Path(__file__).parent.parent.parent.parent

    # 日志目录
    logs_dir: Path = project_root / "shared" / "logs"

    # 配置目录
    configs_dir: Path = project_root / "shared" / "configs"

    # 静态文件目录（旧的static目录）
    static_dir: Path = project_root / "static"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 确保目录存在
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.configs_dir.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    """主配置类 - 整合所有配置"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore"
    )

    # 子配置
    game: GameSettings = GameSettings()
    llm: LLMSettings = LLMSettings()
    server: ServerSettings = ServerSettings()
    cors: CORSSettings = CORSSettings()
    paths: PathSettings = PathSettings()

    # 全局设置
    project_name: str = "Werewolf Arena API"
    version: str = "2.0.0"
    debug: bool = False
    environment: str = "development"  # development, staging, production

    def get_log_directory(self) -> Path:
        """获取日志目录（兼容旧代码）"""
        return self.paths.logs_dir


# 全局配置实例
settings = Settings()


# 导出常用配置（向后兼容）
NUM_PLAYERS = settings.game.num_players
MAX_DEBATE_TURNS = settings.game.max_debate_turns
DEFAULT_THREADS = settings.game.default_threads
DEBATE_CONCURRENT = settings.game.debate_concurrent
RETRIES = settings.game.retries
RUN_SYNTHETIC_VOTES = settings.game.run_synthetic_votes


# 玩家名字列表 - 使用模型名作为玩家名
PLAYER_MODEL_NAMES = [
    "MiniMax",      # 使用 MiniMaxAI/MiniMax-M1-80k (替换Hunyuan-A13B)
    "GLM",             # 使用 zai-org/GLM-4.6 (保留)
    "Qwen",           # 使用 Qwen/Qwen3-32B (保留)
    "DeepSeek",       # 使用 deepseek-ai/DeepSeek-V3.2-Exp (保留)
    "Kimi",        # 使用 moonshotai/Kimi-Dev-72B (保留)
    "Inclusion"       # 使用 inclusionAI/Ring-flash-2.0 (替换Hunyuan-MT-7B)
]


def get_player_names():
    """获取所有玩家模型名（6个玩家对应6个不同模型）"""
    return PLAYER_MODEL_NAMES.copy()
