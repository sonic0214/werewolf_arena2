"""
玩家相关的Pydantic Schemas
Player-related Pydantic Schemas for API request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class PlayerBase(BaseModel):
    """玩家基础信息"""
    name: str = Field(..., description="玩家名字")
    role: str = Field(..., description="角色: Villager, Werewolf, Seer, Doctor")
    model: str = Field(..., description="使用的LLM模型ID")
    avatar: Optional[str] = Field(None, description="玩家头像URL")


class PlayerDetail(PlayerBase):
    """玩家详细信息"""
    alive: bool = Field(True, description="是否存活")
    observations: List[str] = Field(default_factory=list, description="观察记录")
    reasoning: Optional[str] = Field(None, description="玩家推理信息")


class PlayerAction(BaseModel):
    """玩家行动记录"""
    round_number: int = Field(..., description="回合编号")
    action_type: str = Field(..., description="行动类型: debate, vote, eliminate, protect, unmask")
    content: str = Field(..., description="行动内容")
    timestamp: Optional[str] = Field(None, description="时间戳")

    class Config:
        json_schema_extra = {
            "example": {
                "round_number": 1,
                "action_type": "debate",
                "content": "I think we should be careful about Alice's behavior.",
                "timestamp": "2025-10-31T12:35:20"
            }
        }


class PlayerResponse(BaseModel):
    """玩家信息响应"""
    player: PlayerDetail
    actions: List[PlayerAction] = Field(default_factory=list, description="行动历史")

    class Config:
        json_schema_extra = {
            "example": {
                "player": {
                    "name": "Alice",
                    "role": "Seer",
                    "model": "glm/GLM-Z1-Flash",
                    "alive": True,
                    "observations": ["Round 1: Bob is a Werewolf"],
                    "avatar": "https://example.com/avatars/alice.png",
                    "reasoning": "I think Bob might be suspicious based on his behavior."
                },
                "actions": []
            }
        }
