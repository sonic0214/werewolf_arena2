"""
LLM统一客户端
Unified LLM Client
"""

from typing import Dict, Optional, Any

from .base import LLMProvider
from .factory import LLMFactory


class LLMClient:
    """LLM统一客户端

    管理多个LLM提供商，根据模型名称自动路由到对应的提供商
    """

    def __init__(self, providers: Dict[str, LLMProvider]):
        """
        初始化LLM客户端

        Args:
            providers: 提供商字典 {provider_name: provider_instance}
        """
        self.providers = providers

    def call(
        self,
        model: str,
        prompt: str,
        temperature: float = 0.7,
        json_mode: bool = True,
        response_schema: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> str:
        """
        调用LLM生成文本

        Args:
            model: 模型ID，格式如 "glm/GLM-Z1-Flash" 或 "gpt-4o"
            prompt: 提示词
            temperature: 温度参数
            json_mode: 是否使用JSON模式
            response_schema: 响应schema
            **kwargs: 其他参数

        Returns:
            生成的文本

        Raises:
            ValueError: 找不到对应的提供商
        """
        provider = self._get_provider_for_model(model)

        # 仅当模型ID明确以提供商名前缀（如 siliconflow/）开头时才去掉前缀
        if "/" in model:
            prefix, suffix = model.split("/", 1)
            if prefix.lower() in {"siliconflow"}:
                model = suffix

        return provider.generate(
            model=model,
            prompt=prompt,
            temperature=temperature,
            json_mode=json_mode,
            response_schema=response_schema,
            **kwargs
        )

    def _get_provider_for_model(self, model: str) -> LLMProvider:
        """
        根据模型名称获取对应的提供商

        Args:
            model: 模型ID

        Returns:
            LLM提供商实例

        Raises:
            ValueError: 找不到对应的提供商
        """
        # 所有模型都使用硅基流动
        return self._get_provider("siliconflow")

    def _get_provider(self, provider_name: str) -> LLMProvider:
        """
        获取指定的提供商

        Args:
            provider_name: 提供商名称

        Returns:
            LLM提供商实例

        Raises:
            ValueError: 提供商未配置
        """
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(
                f"Provider '{provider_name}' not configured. "
                f"Available providers: {', '.join(self.providers.keys())}"
            )
        return provider

    def health_check(self) -> Dict[str, bool]:
        """
        检查所有提供商的健康状态

        Returns:
            {provider_name: is_healthy}
        """
        return {
            name: provider.health_check()
            for name, provider in self.providers.items()
        }

    @classmethod
    def from_settings(cls, settings):
        """
        从配置创建LLM客户端

        Args:
            settings: Settings对象

        Returns:
            LLMClient实例
        """
        providers = {}

        # 只配置SiliconFlow
        if settings.llm.siliconflow_api_key:
            providers["siliconflow"] = LLMFactory.create("siliconflow", {
                "api_key": settings.llm.siliconflow_api_key,
            })

        if not providers:
            raise RuntimeError(
                "No LLM providers configured. "
                "Please set SiliconFlow API key in configuration."
            )

        return cls(providers)
