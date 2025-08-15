# GraphQL API 使用示例

## 基础查询示例

### 健康检查

```graphql
query HealthCheck {
  health {
    status
    version
    timestamp
    service
  }
}
```

响应：
```json
{
  "data": {
    "health": {
      "status": "healthy",
      "version": "1.0.0",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "service": "Chat Service with GraphQL"
    }
  }
}
```

### 获取对话信息

```graphql
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
        promptTokens
        completionTokens
        totalTokens
      }
    }
    createdAt
    updatedAt
    systemPrompt
  }
}
```

变量：
```json
{
  "id": "conv_1705312200000_abc123"
}
```

### 获取对话列表

```graphql
query GetConversations($limit: Int, $offset: Int) {
  conversations(limit: $limit, offset: $offset) {
    nodes {
      id
      title
      createdAt
      updatedAt
    }
    totalCount
    hasNextPage
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

变量：
```json
{
  "limit": 10,
  "offset": 0
}
```

## 变更操作示例

### 发送聊天消息

```graphql
mutation SendMessage($input: ChatInput!) {
  sendMessage(input: $input) {
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
        id
        content
        role
        timestamp
      }
    }
  }
}
```

变量：
```json
{
  "input": {
    "message": "你好，请介绍一下你自己",
    "systemPrompt": "你是一个有帮助的AI助手",
    "model": "deepseek-chat"
  }
}
```

响应：
```json
{
  "data": {
    "sendMessage": {
      "message": "你好！我是一个AI助手，基于深度学习技术开发。我可以帮助你回答问题、提供信息、协助思考问题等。有什么我可以帮助你的吗？",
      "conversationId": "conv_1705312200000_abc123",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "model": "deepseek-chat",
      "usage": {
        "promptTokens": 25,
        "completionTokens": 48,
        "totalTokens": 73
      },
      "conversation": {
        "id": "conv_1705312200000_abc123",
        "title": "新对话",
        "messages": [
          {
            "id": "msg_1705312200001_def456",
            "content": "你好，请介绍一下你自己",
            "role": "USER",
            "timestamp": "2024-01-15T10:30:00.000Z"
          },
          {
            "id": "msg_1705312200002_ghi789",
            "content": "你好！我是一个AI助手，基于深度学习技术开发。我可以帮助你回答问题、提供信息、协助思考问题等。有什么我可以帮助你的吗？",
            "role": "ASSISTANT",
            "timestamp": "2024-01-15T10:30:00.000Z"
          }
        ]
      }
    }
  }
}
```

### 继续对话

```graphql
mutation ContinueConversation($input: ChatInput!) {
  sendMessage(input: $input) {
    message
    conversationId
    usage {
      totalTokens
    }
  }
}
```

变量：
```json
{
  "input": {
    "message": "能帮我写一个Python的Hello World程序吗？",
    "conversationId": "conv_1705312200000_abc123"
  }
}
```

### 创建新对话

```graphql
mutation CreateConversation($input: CreateConversationInput!) {
  createConversation(input: $input) {
    id
    title
    createdAt
    updatedAt
    systemPrompt
  }
}
```

变量：
```json
{
  "input": {
    "title": "编程学习讨论",
    "systemPrompt": "你是一个专业的编程导师，擅长解释编程概念和提供代码示例。请用简单易懂的语言回答问题。"
  }
}
```

### 删除对话

```graphql
mutation DeleteConversation($id: ID!) {
  deleteConversation(id: $id)
}
```

变量：
```json
{
  "id": "conv_1705312200000_abc123"
}
```

## 复杂查询示例

### 获取对话及其完整消息历史

```graphql
query GetFullConversation($id: ID!) {
  conversation(id: $id) {
    id
    title
    systemPrompt
    createdAt
    updatedAt
    messages {
      id
      content
      role
      timestamp
      usage {
        promptTokens
        completionTokens
        totalTokens
      }
    }
  }
}
```

### 批量操作示例

```graphql
mutation BatchOperations($messageInput: ChatInput!, $conversationInput: CreateConversationInput!) {
  # 发送消息
  chat: sendMessage(input: $messageInput) {
    message
    conversationId
  }
  
  # 创建新对话
  newConversation: createConversation(input: $conversationInput) {
    id
    title
  }
}
```

## 错误处理示例

### 处理无效输入

```graphql
mutation SendInvalidMessage($input: ChatInput!) {
  sendMessage(input: $input) {
    message
    conversationId
  }
}
```

变量（错误示例）：
```json
{
  "input": {
    "message": ""
  }
}
```

错误响应：
```json
{
  "errors": [
    {
      "message": "Message is required and must be a non-empty string",
      "extensions": {
        "code": "INVALID_MESSAGE"
      },
      "path": ["sendMessage"]
    }
  ],
  "data": null
}
```

## 分页查询示例

### 使用分页获取对话列表

```graphql
query PaginatedConversations($limit: Int!, $offset: Int!) {
  conversations(limit: $limit, offset: $offset) {
    nodes {
      id
      title
      createdAt
      messages {
        id
        role
        timestamp
      }
    }
    totalCount
    hasNextPage
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

### 获取第一页

变量：
```json
{
  "limit": 5,
  "offset": 0
}
```

### 获取下一页

变量：
```json
{
  "limit": 5,
  "offset": 5
}
```

## 使用片段（Fragments）

### 定义消息片段

```graphql
fragment MessageFields on Message {
  id
  content
  role
  timestamp
  usage {
    promptTokens
    completionTokens
    totalTokens
  }
}

fragment ConversationFields on Conversation {
  id
  title
  createdAt
  updatedAt
  systemPrompt
  messages {
    ...MessageFields
  }
}

query GetConversationWithFragments($id: ID!) {
  conversation(id: $id) {
    ...ConversationFields
  }
}

mutation SendMessageWithFragments($input: ChatInput!) {
  sendMessage(input: $input) {
    message
    conversationId
    timestamp
    model
    usage {
      totalTokens
    }
    conversation {
      ...ConversationFields
    }
  }
}
```

## 内省查询

### 获取Schema信息

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      description
      kind
    }
  }
}
```

### 获取特定类型信息

```graphql
query TypeInfo {
  __type(name: "ChatInput") {
    name
    description
    inputFields {
      name
      description
      type {
        name
        kind
      }
    }
  }
}
```

## 性能优化建议

### 1. 只请求需要的字段

❌ 不好的做法：
```graphql
query {
  conversations {
    nodes {
      id
      title
      messages {
        id
        content
        role
        timestamp
        usage {
          promptTokens
          completionTokens
          totalTokens
        }
      }
      createdAt
      updatedAt
      systemPrompt
    }
  }
}
```

✅ 好的做法：
```graphql
query {
  conversations {
    nodes {
      id
      title
      createdAt
    }
  }
}
```

### 2. 使用变量而不是内联值

❌ 不好的做法：
```graphql
mutation {
  sendMessage(input: {
    message: "Hello World"
    systemPrompt: "You are a helpful assistant"
  }) {
    message
  }
}
```

✅ 好的做法：
```graphql
mutation SendMessage($input: ChatInput!) {
  sendMessage(input: $input) {
    message
  }
}
```

### 3. 合理使用分页

```graphql
query PaginatedData($first: Int!, $after: String) {
  conversations(limit: $first, offset: $after) {
    nodes {
      id
      title
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```
