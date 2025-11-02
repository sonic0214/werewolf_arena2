"""
LLM提供商工厂
LLM Provider Factory
"""

from typing import Dict, Type

from .base import LLMProvider
from .providers import SiliconFlowProvider


class LLMFactory:
    """LLM提供商工厂类

    根据提供商名称创建对应的提供商实例
    """

    # 注册的提供商映射
    _providers: Dict[str, Type[LLMProvider]] = {
        "siliconflow": SiliconFlowProvider,
    }

    @classmethod
    def create(cls, provider_name: str, config: Dict) -> LLMProvider:
        """
        创建LLM提供商实例

        Args:
            provider_name: 提供商名称（openai, glm, openrouter）
            config: 配置字典

        Returns:
            LLM提供商实例

        Raises:
            ValueError: 未知的提供商名称
        """
        provider_class = cls._providers.get(provider_name.lower())
        if not provider_class:
            raise ValueError(
                f"Unknown provider: {provider_name}. "
                f"Available providers: {', '.join(cls._providers.keys())}"
            )

        return provider_class(config)

    @classmethod
    def register_provider(cls, name: str, provider_class: Type[LLMProvider]):
        """
        注册新的提供商

        Args:
            name: 提供商名称
            provider_class: 提供商类
        """
        cls._providers[name.lower()] = provider_class

    @classmethod
    def list_providers(cls) -> list[str]:
        """获取所有注册的提供商名称"""
        return list(cls._providers.keys())
