# Chat Service

智能聊天后端服务 - 基于 Cloudflare Workers，集成 DeepSeek API 和GraphQL

## 功能特性

- 🚀 基于 Cloudflare Workers 的无服务器架构
- 🤖 集成 DeepSeek AI 模型
- 🌐 支持 REST API 和GraphQL API
- 📱 完整的 CORS 支持
- 🔒 TypeScript 类型安全
- 📊 GraphQL Playground 支持

## API 端点

### REST API

- `GET /` - 健康检查和API信息
- `POST /api/chat` - 发送聊天消息
- `GET /api/conversations/:id` - 获取对话历史

### GraphQL API

- `POST /graphql` - GraphQL 端点
- `GET /graphql` - GraphQL Playground（开发环境）

## GraphQL Schema

### 查询 (Queries)

```graphql
# 健康检查
query {
  health {
    status
    version
    timestamp
    service
  }
}

# 获取对话
query {
  conversation(id: "conv_123") {
    id
    title
    messages {
      id
      content
      role
      timestamp
    }
    createdAt
    updatedAt
  }
}

# 获取对话列表
query {
  conversations(limit: 10, offset: 0) {
    nodes {
      id
      title
      createdAt
    }
    totalCount
    hasNextPage
  }
}
```

### 变更 (Mutations)

```graphql
# 发送消息
mutation {
  sendMessage(input: {
    message: "你好，请介绍一下你自己"
    conversationId: "conv_123"
    systemPrompt: "你是一个有帮助的AI助手"
  }) {
    message
    conversationId
    timestamp
    model
    usage {
      promptTokens
      completionTokens
      totalTokens
    }
    conversation {
      id
      title
      messages {
        content
        role
        timestamp
      }
    }
  }
}

# 创建对话
mutation {
  createConversation(input: {
    title: "我的新对话"
    systemPrompt: "你是一个专业的编程助手"
  }) {
    id
    title
    createdAt
  }
}

# 删除对话
mutation {
  deleteConversation(id: "conv_123")
}
```

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Cloudflare Workers 账户
- DeepSeek API 密钥

### 安装依赖

```bash
npm install
```

### 环境配置

在 `wrangler.toml` 中配置环境变量：

```toml
[env.dev.vars]
DEEPSEEK_API_KEY = "your-deepseek-api-key"

[env.production.vars]
DEEPSEEK_API_KEY = "your-deepseek-api-key"
```

或者使用 wrangler secrets：

```bash
wrangler secret put DEEPSEEK_API_KEY
```

### 本地开发

```bash
npm run dev
```

服务将在 `http://localhost:8787` 启动

- REST API: `http://localhost:8787/api/chat`
- GraphQL Playground: `http://localhost:8787/graphql`

### 部署

```bash
npm run deploy
```

## 使用示例

### REST API 示例

```javascript
// 发送聊天消息
const response = await fetch('https://your-worker.your-subdomain.workers.dev/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: '你好，请介绍一下你自己',
    conversationId: 'optional-conversation-id',
    systemPrompt: '你是一个有帮助的AI助手'
  })
});

const result = await response.json();
console.log(result);
```

### GraphQL 示例

```javascript
// 使用 GraphQL 发送消息
const query = `
  mutation SendMessage($input: ChatInput!) {
    sendMessage(input: $input) {
      message
      conversationId
      timestamp
      conversation {
        id
        title
        messages {
          content
          role
          timestamp
        }
      }
    }
  }
`;

const variables = {
  input: {
    message: "你好，请介绍一下你自己",
    systemPrompt: "你是一个有帮助的AI助手"
  }
};

const response = await fetch('https://your-worker.your-subdomain.workers.dev/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables
  })
});

const result = await response.json();
console.log(result.data.sendMessage);
```

## 前端集成示例

### React with Apollo Client

```javascript
import { ApolloClient, InMemoryCache, gql, useMutation } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://your-worker.your-subdomain.workers.dev/graphql',
  cache: new InMemoryCache(),
});

const SEND_MESSAGE = gql`
  mutation SendMessage($input: ChatInput!) {
    sendMessage(input: $input) {
      message
      conversationId
      conversation {
        messages {
          content
          role
        }
      }
    }
  }
`;

function ChatComponent() {
  const [sendMessage, { data, loading, error }] = useMutation(SEND_MESSAGE);

  const handleSendMessage = (message) => {
    sendMessage({
      variables: {
        input: {
          message,
          systemPrompt: "你是一个有帮助的AI助手"
        }
      }
    });
  };

  // 渲染组件...
}
```

### Vue.js with Vue Apollo

```javascript
import { useMutation } from '@vue/apollo-composable';
import gql from 'graphql-tag';

const SEND_MESSAGE = gql`
  mutation SendMessage($input: ChatInput!) {
    sendMessage(input: $input) {
      message
      conversationId
    }
  }
`;

export default {
  setup() {
    const { mutate: sendMessage, loading, error } = useMutation(SEND_MESSAGE);
    
    const handleSendMessage = async (message) => {
      try {
        const result = await sendMessage({
          input: {
            message,
            systemPrompt: "你是一个有帮助的AI助手"
          }
        });
        console.log(result.data.sendMessage);
      } catch (err) {
        console.error('发送消息失败:', err);
      }
    };
    
    return {
      sendMessage: handleSendMessage,
      loading,
      error
    };
  }
};
```

### 使用 fetch 直接调用

```javascript
class ChatService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  
  async sendMessage(message, options = {}) {
    const query = `
      mutation SendMessage($input: ChatInput!) {
        sendMessage(input: $input) {
          message
          conversationId
          timestamp
          usage {
            totalTokens
          }
          conversation {
            id
            messages {
              content
              role
              timestamp
            }
          }
        }
      }
    `;
    
    const variables = {
      input: {
        message,
        conversationId: options.conversationId,
        systemPrompt: options.systemPrompt,
        model: options.model || 'deepseek-chat'
      }
    };
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data.sendMessage;
  }
  
  async createConversation(title, systemPrompt) {
    const query = `
      mutation CreateConversation($input: CreateConversationInput!) {
        createConversation(input: $input) {
          id
          title
          createdAt
          systemPrompt
        }
      }
    `;
    
    const variables = {
      input: { title, systemPrompt }
    };
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    return result.data.createConversation;
  }
  
  async getConversation(id) {
    const query = `
      query GetConversation($id: ID!) {
        conversation(id: $id) {
          id
          title
          messages {
            id
            content
            role
            timestamp
            usage {
              totalTokens
            }
          }
          createdAt
          updatedAt
          systemPrompt
        }
      }
    `;
    
    const variables = { id };
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    return result.data.conversation;
  }
}

// 使用示例
const chatService = new ChatService('https://your-worker.your-subdomain.workers.dev');

// 发送消息
const response = await chatService.sendMessage('你好，请介绍一下你自己', {
  systemPrompt: '你是一个有帮助的AI助手'
});
console.log('AI回复:', response.message);

// 创建新对话
const conversation = await chatService.createConversation('技术讨论', '你是一个专业的技术顾问');
console.log('新对话ID:', conversation.id);
```

## 错误处理

### GraphQL 错误处理

```javascript
try {
  const result = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  
  const data = await result.json();
  
  if (data.errors) {
    // 处理 GraphQL 错误
    data.errors.forEach(error => {
      console.error('GraphQL Error:', error.message);
      console.error('Error Code:', error.extensions?.code);
    });
    return;
  }
  
  // 处理成功响应
  console.log(data.data);
} catch (error) {
  // 处理网络错误
  console.error('Network Error:', error);
}
```

## 项目结构

```
src/
├── index.ts              # 主入口文件
├── middleware/
│   └── cors.ts          # CORS 中间件
├── services/
│   └── deepseek.ts      # DeepSeek API 服务
├── types/
│   ├── index.ts         # 基础类型定义
│   └── graphql.ts       # GraphQL 类型定义
├── graphql/
│   ├── schema.ts        # GraphQL Schema
│   ├── typeDefs.ts      # GraphQL 类型定义
│   ├── resolvers.ts     # GraphQL 解析器
│   └── context.ts       # GraphQL 上下文
package.json
wrangler.toml
tsconfig.json
```

## 许可证

MIT License
