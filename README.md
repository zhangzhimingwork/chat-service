# Chat Service

智能聊天后端服务 - 基于 Cloudflare Workers 和 DeepSeek API

## 功能特性

- 🚀 基于 Cloudflare Workers 的无服务器架构
- 🤖 集成 DeepSeek AI 模型
- 🔒 CORS 跨域支持
- 📝 TypeScript 类型安全
- ⚡ 快速响应和全球分发
- 🛡️ 错误处理和输入验证

## API 接口

### 1. 健康检查
```
GET /
```

### 2. 聊天接口
```
POST /api/chat
Content-Type: application/json

{
  "message": "你好",
  "conversationId": "optional-conversation-id",
  "systemPrompt": "可选的系统提示词"
}
```

响应：
```json
{
  "message": "你好！有什么我可以帮助你的吗？",
  "conversationId": "conv_1234567890_abc123",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "model": "deepseek-chat",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### 3. 获取对话历史
```
GET /api/conversations/{conversationId}
```

## 开发环境设置

### 前提条件
- Node.js 18+
- Cloudflare Workers 账户
- DeepSeek API Key

### 安装依赖
```bash
npm install
```

### 本地开发
```bash
# 启动本地开发服务器
npm run dev
```

### 环境变量设置

1. 设置 DeepSeek API Key：
```bash
wrangler secret put DEEPSEEK_API_KEY
```

2. 设置允许的跨域来源（可选）：
```bash
wrangler secret put ALLOWED_ORIGINS
# 例如: https://your-frontend.com,http://localhost:3000
```

### 部署

```bash
# 部署到生产环境
npm run deploy

# 或者部署到开发环境
wrangler deploy --env development
```

## 项目结构

```
src/
├── index.ts              # 主入口文件和路由
├── types/
│   └── index.ts          # TypeScript 类型定义
├── services/
│   └── deepseek.ts       # DeepSeek API 服务
├── middleware/
│   └── cors.ts           # CORS 中间件
└── env.d.ts              # 环境变量类型定义
```

## 技术栈

- **运行环境**: Cloudflare Workers
- **语言**: TypeScript
- **路由**: @cloudflare/itty-router
- **AI模型**: DeepSeek API
- **构建工具**: Wrangler

## 错误处理

所有错误响应都遵循统一格式：
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

常见错误代码：
- `INVALID_CONTENT_TYPE`: 请求内容类型无效
- `INVALID_MESSAGE`: 消息参数无效
- `MISSING_CONVERSATION_ID`: 缺少对话ID
- `INTERNAL_ERROR`: 服务器内部错误
- `NOT_FOUND`: 路由未找到

## 监控和日志

```bash
# 查看实时日志
npm run tail

# 或者
wrangler tail
```

## 安全注意事项

1. 在生产环境中，请设置具体的 `ALLOWED_ORIGINS` 而不是使用 `*`
2. 定期轮换 API 密钥
3. 监控 API 使用量和成本
4. 考虑添加请求频率限制

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License