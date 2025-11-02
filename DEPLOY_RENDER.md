# Werewolf Arena Render部署指南

## 概述
本指南将帮助您将Werewolf Arena作为统一的前后端服务部署到Render平台。

## 前置条件
- Render账号（https://render.com）
- GitHub账号和代码仓库
- 至少一个LLM API密钥（OpenAI、Anthropic、SiliconFlow等）

## 部署步骤

### 1. 准备GitHub仓库
确保您的代码已推送到GitHub仓库：
```bash
git add .
git commit -m "Add Render-specific deployment configuration"
git push origin main
```

### 重要说明：Render与Fly.io的区别
- **Render单端口**：只支持一个端口（3000），前端通过FastAPI提供
- **Fly.io多端口**：支持多个端口，前后端独立运行
- 本配置使用专门的`Dockerfile.render`和`start_render.sh`适配Render

### 2. 在Render中创建服务
1. 登录到Render控制台
2. 点击"New+" → "Web Service"
3. 连接您的GitHub仓库
4. 选择要部署的分支（通常是main）

### 3. 配置部署设置
#### 基础配置
- **Name**: werewolf-arena
- **Region**: 选择离您最近的区域
- **Branch**: main
- **Runtime**: Docker
- **Instance Type**: Free（或根据需要选择付费类型）

#### 环境变量设置
在Environment section中添加以下环境变量：

**必须设置的变量：**
```
NODE_ENV=production
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
BACKEND_PORT=8000
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=/api
DEFAULT_LLM_PROVIDER=siliconflow
```

**LLM API密钥（至少设置一个）：**
```
SILICONFLOW_API_KEY=your-siliconflow-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**游戏配置：**
```
GAME_TIMEOUT_SECONDS=300
MAX_PLAYERS=20
MIN_PLAYERS=4
DEBUG=false
```

### 4. 高级配置
#### Health Check
- **Path**: `/health`
- **Check interval**: 30s
- **Timeout**: 10s
- **Failure threshold**: 3

#### Auto-Deploy
- 启用"Auto-Deploy"以便在推送代码时自动重新部署

### 5. 部署
点击"Create Web Service"开始部署。Render会：
1. 克隆您的代码
2. 构建Docker镜像
3. 启动容器

## 部署后配置

### 1. 更新URL配置
部署完成后，您需要更新一些URL配置：

1. 从Render控制台获取您的服务URL（例如：https://werewolf-arena.onrender.com）
2. 在Environment variables中更新：
   ```
   BACKEND_URL=https://your-service-name.onrender.com
   NEXT_PUBLIC_WS_URL=wss://your-service-name.onrender.com
   CORS__ALLOW_ORIGINS=["https://your-service-name.onrender.com"]
   ```
3. 重新部署服务

### 2. 验证部署
访问以下URL验证服务是否正常运行：
- 主页: `https://your-service-name.onrender.com`
- API文档: `https://your-service-name.onrender.com/docs`
- 健康检查: `https://your-service-name.onrender.com/health`

### 3. 测试游戏
通过Web界面测试游戏功能，确保：
- 可以创建游戏房间
- WebSocket连接正常
- AI玩家能够响应

## 故障排除

### 常见问题

**1. 构建失败**
- 检查Dockerfile语法
- 确保所有依赖都在requirements.txt中
- 查看构建日志获取详细错误信息

**2. 健康检查失败**
- 确保/health端点返回200状态码
- 检查服务是否在正确端口启动
- 验证环境变量配置

**3. LLM API调用失败**
- 确认API密钥正确设置
- 检查API提供商的访问权限
- 查看服务日志获取详细错误

**4. WebSocket连接问题**
- 确保WS_URL配置正确（使用wss://）
- 检查CORS设置
- 验证Render的Web Socket支持

### 日志查看
在Render控制台中，您可以查看：
- **构建日志**: Docker构建过程
- **服务日志**: 运行时日志
- **事件日志**: 部署和重启事件

## 监控和维护

### 性能监控
- 使用Render的监控面板查看服务性能
- 监控CPU、内存和网络使用情况
- 设置告警通知

### 更新部署
当您需要更新应用时：
1. 推送代码到GitHub
2. Render会自动重新部署（如果启用了Auto-Deploy）
3. 或手动触发部署

### 扩展
如果需要处理更多用户：
- 升升实例类型（从Free到Starter或更高）
- 增加实例数量（启用负载均衡）
- 考虑添加Redis或PostgreSQL数据库

## 成本估算

### Free计划
- 750小时/月免费时间
- 100GB带宽
- 适合开发和测试

### Starter计划 ($7/月)
- 无限运行时间
- 更好的性能
- 适合小型生产应用

### 生产建议
对于生产环境，建议：
- 使用Starter或更高级别计划
- 配置自定义域名
- 设置监控和告警
- 定期备份数据

## 总结

通过以上步骤，您应该能够成功将Werewolf Arena部署到Render平台作为统一的前后端服务。如果遇到问题，请参考故障排除部分或查看Render的官方文档。