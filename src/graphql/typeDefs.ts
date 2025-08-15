export const typeDefs = `
  type Query {
    "获取健康检查信息"
    health: HealthStatus!
    
    "根据ID获取对话"
    conversation(id: ID!): Conversation
    
    "获取对话列表"
    conversations(limit: Int = 10, offset: Int = 0): ConversationConnection!
  }
  
  type Mutation {
    "发送聊天消息"
    sendMessage(input: ChatInput!): ChatResult!
    
    "创建新对话"
    createConversation(input: CreateConversationInput!): Conversation!
    
    "删除对话"
    deleteConversation(id: ID!): Boolean!
  }
  
  "聊天输入"
  input ChatInput {
    "用户消息内容"
    message: String!
    
    "对话ID，如果不提供则创建新对话"
    conversationId: ID
    
    "系统提示词"
    systemPrompt: String
    
    "AI模型名称"
    model: String = "deepseek-chat"
  }
  
  "创建对话输入"
  input CreateConversationInput {
    "对话标题"
    title: String
    
    "系统提示词"
    systemPrompt: String
  }
  
  "聊天结果"
  type ChatResult {
    "AI回复消息"
    message: String!
    
    "对话ID"
    conversationId: ID!
    
    "时间戳"
    timestamp: String!
    
    "使用的模型"
    model: String!
    
    "token使用统计"
    usage: TokenUsage
    
    "完整的对话信息"
    conversation: Conversation!
  }
  
  "对话"
  type Conversation {
    "对话ID"
    id: ID!
    
    "对话标题"
    title: String
    
    "消息列表"
    messages: [Message!]!
    
    "创建时间"
    createdAt: String!
    
    "更新时间"
    updatedAt: String!
    
    "系统提示词"
    systemPrompt: String
  }
  
  "消息"
  type Message {
    "消息ID"
    id: ID!
    
    "消息内容"
    content: String!
    
    "消息角色（user/assistant/system）"
    role: MessageRole!
    
    "时间戳"
    timestamp: String!
    
    "token使用统计（仅AI消息）"
    usage: TokenUsage
  }
  
  "消息角色枚举"
  enum MessageRole {
    USER
    ASSISTANT
    SYSTEM
  }
  
  "Token使用统计"
  type TokenUsage {
    "输入token数"
    promptTokens: Int!
    
    "输出token数"
    completionTokens: Int!
    
    "总token数"
    totalTokens: Int!
  }
  
  "健康状态"
  type HealthStatus {
    "服务状态"
    status: String!
    
    "版本号"
    version: String!
    
    "时间戳"
    timestamp: String!
    
    "服务名称"
    service: String!
  }
  
  "对话连接"
  type ConversationConnection {
    "对话列表"
    nodes: [Conversation!]!
    
    "总数"
    totalCount: Int!
    
    "是否有下一页"
    hasNextPage: Boolean!
    
    "分页信息"
    pageInfo: PageInfo!
  }
  
  "分页信息"
  type PageInfo {
    "是否有下一页"
    hasNextPage: Boolean!
    
    "是否有上一页"
    hasPreviousPage: Boolean!
    
    "开始游标"
    startCursor: String
    
    "结束游标"
    endCursor: String
  }
`;
