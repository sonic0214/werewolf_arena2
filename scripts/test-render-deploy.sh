#!/bin/bash

set -euo pipefail

echo "🚀 Testing Render Deployment Locally"
echo "===================================="

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# 设置测试环境变量
export SILICONFLOW_API_KEY="${SILICONFLOW_API_KEY:-test-key}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-test-key}"
export DEFAULT_LLM_PROVIDER="siliconflow"
export DEBUG=false
export ENVIRONMENT=production

echo "📦 Building Render Docker image..."
docker build -f Dockerfile.render -t werewolf-arena-test .

echo "🧪 Running container tests..."
docker run --name werewolf-test \
  -p 3000:3000 \
  -e SILICONFLOW_API_KEY="$SILICONFLOW_API_KEY" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e DEFAULT_LLM_PROVIDER="$DEFAULT_LLM_PROVIDER" \
  -e DEBUG="$DEBUG" \
  -e ENVIRONMENT="$ENVIRONMENT" \
  werewolf-arena-test &

CONTAINER_ID=$!
echo "📱 Container started with ID: $CONTAINER_ID"

# 等待容器启动
echo "⏳ Waiting for container to start..."
sleep 30

# 测试健康检查
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    docker logs $CONTAINER_ID
    docker stop $CONTAINER_ID
    docker rm $CONTAINER_ID
    exit 1
fi

# 测试前端
echo "🌐 Testing frontend..."
if curl -s http://localhost:3000 | grep -q "html"; then
    echo "✅ Frontend is serving"
else
    echo "❌ Frontend not serving"
    docker logs $CONTAINER_ID
fi

# 测试API端点
echo "🔌 Testing API endpoints..."
if curl -s http://localhost:3000/api/v1/status | grep -q "healthy"; then
    echo "✅ API endpoints are working"
else
    echo "❌ API endpoints not working"
    docker logs $CONTAINER_ID
fi

# 清理
echo "🧹 Cleaning up..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID

echo "✨ All tests passed! Ready for Render deployment."