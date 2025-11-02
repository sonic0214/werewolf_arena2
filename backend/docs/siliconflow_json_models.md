# SiliconFlow JSON-Compatible Models

验证时间：使用 `python3` 和仓库中的 SiliconFlow API key 逐个调用 `chat.completions.create`，请求参数与游戏服务一致（包含中文系统消息与 `response_format={"type": "json_object"}`）。以下模型在 2025-11-02 测试时均成功返回 JSON 响应，可安全用于 Werewolf Arena 中的 LLM 玩家。

- deepseek-ai/DeepSeek-V3
- deepseek-ai/DeepSeek-V3.1-Terminus
- deepseek-ai/DeepSeek-V3.2-Exp
- deepseek-ai/DeepSeek-R1
- MiniMaxAI/MiniMax-M2
- inclusionAI/Ring-1T
- Qwen/Qwen3-32B
- Qwen/Qwen3-30B-A3B
- Qwen/Qwen3-30B-A3B-Thinking-2507
- Qwen/Qwen3-VL-32B-Instruct
- Qwen/Qwen2.5-72B-Instruct
- moonshotai/Kimi-K2-Instruct-0905
- moonshotai/Kimi-Dev-72B
- zai-org/GLM-4.6
- THUDM/glm-4-9b-chat
- Kwaipilot/KAT-Dev

不可用或受限模型示例：
- Pro/deepseek-ai/DeepSeek-R1（需要付费余额）
- inclusionAI/Ring-flash-2.0（不支持 JSON 模式）
- Qwen/Qwen3-Omni-30B-A3B-Instruct（偶发 50507 服务端错误）

如需扩展名单，可参考 `backend/test_models.py` 中的探测脚本或复用上述命令重新验证。
