#!/usr/bin/env python3
"""
测试硅基流动API支持的模型
Test SiliconFlow API supported models
"""

import os
from openai import OpenAI

# 从环境变量读取API密钥
API_KEY = "sk-sxkkhitfrbmyjtmmuithkjzqptlrdeqmvchgakjyavwjsnvn"
BASE_URL = "https://api.siliconflow.cn/v1"

# 创建客户端
client = OpenAI(
    api_key=API_KEY,
    base_url=BASE_URL
)

# 要测试的模型列表
test_models = [
    # DeepSeek 系列
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-V3.1",
    "Pro/deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-V3.2-Exp",

    # Qwen 系列
    "Qwen/Qwen2.5-7B-Instruct",
    "Qwen/Qwen2.5-14B-Instruct",
    "Qwen/Qwen2.5-32B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "Qwen/Qwen3-8B",
    "Qwen/Qwen3-14B",
    "Qwen/Qwen3-32B",
    "Qwen/Qwen3-30B-A3B",
    "Qwen/Qwen3-30B-A3B-Thinking-2507",

    # GLM 系列
    "THUDM/glm-4-9b-chat",
    "THUDM/GLM-4",
    "THUDM/GLM-4.5",
    "THUDM/GLM-4.6",
    "THUDM/GLM-Z1-9B-0414",
    "zai-org/GLM-4.5",

    # MiniMax 系列
    "MiniMaxAI/MiniMax-M1-80k",
    "MiniMaxAI/MiniMax-M2",

    # Kimi 系列
    "moonshotai/Kimi-Dev-72B",
    "moonshot-v1-8k",

    # 腾讯混元系列
    "tencent/Hunyuan-A13B-Instruct",
    "tencent/Hunyuan-Large",

    # 其他
    "inclusionAI/Ling-mini-2.0",
]

print("=" * 80)
print("开始测试硅基流动API支持的模型")
print("=" * 80)
print()

successful_models = []
failed_models = []

for model_id in test_models:
    try:
        print(f"测试模型: {model_id} ... ", end="", flush=True)

        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "user", "content": "你好"}
            ],
            max_tokens=10,
            temperature=0.7
        )

        content = response.choices[0].message.content
        print(f"✅ 成功! 响应: {content[:30]}...")
        successful_models.append(model_id)

    except Exception as e:
        error_msg = str(e)
        if "Model does not exist" in error_msg or "20012" in error_msg:
            print(f"❌ 模型不存在")
        elif "rate limit" in error_msg.lower():
            print(f"⚠️  速率限制")
        else:
            print(f"❌ 错误: {error_msg[:50]}")
        failed_models.append(model_id)

print()
print("=" * 80)
print("测试结果汇总")
print("=" * 80)
print()
print(f"✅ 成功的模型 ({len(successful_models)}个):")
for model in successful_models:
    print(f"  - {model}")

print()
print(f"❌ 失败的模型 ({len(failed_models)}个):")
for model in failed_models:
    print(f"  - {model}")

print()
print("=" * 80)
print("建议使用以下模型配置:")
print("=" * 80)
if len(successful_models) >= 6:
    print("PLAYER_MODEL_MAPPING = {")
    for i, player_name in enumerate(["MiniMax", "GLM", "Qwen", "DeepSeek", "Kimi", "Inclusion"]):
        if i < len(successful_models):
            print(f'    "{player_name}": "{successful_models[i]}",')
    print("}")
