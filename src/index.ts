// 修正后的代码
import { corsHeaders, handleCORS } from './middleware/cors';
// import { DeepSeekService } from './services/deepseek';
import { OpenAIService } from './services/openAi'
import { ChatRequest, ChatResponse, ErrorResponse } from './types';

// Apollo Server 相关
import { ApolloServer } from '@apollo/server';
// 🔧 修正：正确的导入路径
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { gql } from 'graphql-tag';

// 🔧 确保使用 Cloudflare Workers 官方类型
/// <reference types="@cloudflare/workers-types" />

// ------------------- 接口定义 -------------------
// 🔧 添加：缺失的 Env 接口定义
interface Env {
  DEEPSEEK_API_KEY: string;
  OPENAI_API_KEY: string;
  // 添加其他环境变量
  NODE_ENV?: string;
}

// 🔧 移除自定义 ExecutionContext，使用 @cloudflare/workers-types 提供的类型

// 🔧 添加：Apollo Server Context 类型定义
interface GraphQLContext {
  env: Env;
  request: Request;
  user?: { id: string } | null;
}

// ------------------- Apollo Server 核心 -------------------

// 1. GraphQL Schema
const typeDefs = gql`
  type Query {
    hello(name: String = "World"): String!
    now: String!
    # 🔧 添加：聊天查询 - 直接调用 DeepSeek
    chat(message: String!, conversationId: String, systemPrompt: String): ChatResult!
    # 🔧 添加：对话历史查询
    conversation(id: String!): Conversation
  }

  type Mutation {
    echo(text: String!): String!
    # 🔧 保留：聊天变更操作（可选）
    createChat(input: ChatInput!): ChatResult!
  }

  # 🔧 聊天相关类型定义
  type Conversation {
    id: String!
    messages: [Message!]!
    createdAt: String!
    updatedAt: String!
  }

  type Message {
    role: String!
    content: String!
    timestamp: String!
  }

  type ChatResult {
    message: String!
    conversationId: String!
    timestamp: String!
    model: String!
    usage: Usage
  }

  type Usage {
    promptTokens: Int
    completionTokens: Int
    totalTokens: Int
  }

  input ChatInput {
    message: String!
    conversationId: String
    systemPrompt: String
  }
`;

// 2. Resolvers
const resolvers = {
  Query: {
    hello: (_: unknown, args: { name?: string }) => `Hello, ${args.name}!`,
    now: () => new Date().toISOString(),
    
    // 🔧 修改：通过调用 /api/chat 端点来实现聊天查询
    chat: async (
      _: unknown, 
      args: { message: string; conversationId?: string; systemPrompt?: string }, 
      context: GraphQLContext
    ) => {
      const { message, conversationId, systemPrompt } = args;
      
      // 输入验证
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message is required and must be a non-empty string');
      }

      try {
        // 构建请求体
        const requestBody = {
          message: message.trim(),
          ...(conversationId && { conversationId }),
          ...(systemPrompt && { systemPrompt }),
          "model":"DeepSeek-R1",
          "temperature":1.3,
          "stream": true
        };

        // 🔧 关键：构造内部 API 请求
        // 获取当前请求的 origin
        const url = new URL(context.request.url);
        const apiUrl = `${url.protocol}//${url.host}/api/chat`;
        // 创建内部请求
        const apiRequest = new Request(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 传递原始请求的认证头（如果有）
            ...(context.request.headers.get('authorization') && {
              'authorization': context.request.headers.get('authorization')!
            })
          },
          body: JSON.stringify(requestBody)
        });

        // 🔧 调用内部 /api/chat 端点
        // 这里我们需要直接调用 Worker 的 fetch 方法
        // 由于我们在同一个 Worker 内，我们可以直接重用处理逻辑
        const response = await handleChatAPI(apiRequest, context.env);

        // 检查响应状态
        if (!response.ok) {
          const errorData = await response.json() as ErrorResponse;
          throw new Error(errorData.error || 'Chat API request failed');
        }

        // 解析响应
        const chatResponse = await response.json() as ChatResponse;

        // 返回 GraphQL 格式的结果
        return {
          message: chatResponse.message,
          conversationId: chatResponse.conversationId,
          timestamp: chatResponse.timestamp,
          model: chatResponse.model,
          usage: chatResponse.usage || null
        };

      } catch (error) {
        console.error('Chat API Error in GraphQL resolver:', error);
        throw new Error(`Chat service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    
    // 🔧 修正：对话查询resolver
    conversation: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      try {
        // 🔧 可选：也可以调用 REST API 来获取对话
        const url = new URL(context.request.url);
        const apiUrl = `${url.protocol}//${url.host}/api/conversations/${args.id}`;
        
        const apiRequest = new Request(apiUrl, {
          method: 'GET',
          headers: {
            ...(context.request.headers.get('authorization') && {
              'authorization': context.request.headers.get('authorization')!
            })
          }
        });

        const response = await handleConversationAPI(apiRequest, context.env, args.id);
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversation');
        }

        return await response.json();
      } catch (error) {
        console.error('Conversation API Error in GraphQL resolver:', error);
        // 返回默认值而不是抛出错误
        return {
          id: args.id,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    },
  },
  
  Mutation: {
    echo: (_: unknown, args: { text: string }) => args.text,
    
    // 🔧 修改：也通过调用 /api/chat 实现 mutation
    createChat: async (_: unknown, args: { input: ChatRequest }, context: GraphQLContext) => {
      const { message, conversationId, systemPrompt } = args.input;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message is required and must be a non-empty string');
      }

      try {
        const requestBody = {
          message: message.trim(),
          ...(conversationId && { conversationId }),
          ...(systemPrompt && { systemPrompt })
        };

        const url = new URL(context.request.url);
        const apiUrl = `${url.protocol}//${url.host}/api/chat`;

        const apiRequest = new Request(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(context.request.headers.get('authorization') && {
              'authorization': context.request.headers.get('authorization')!
            })
          },
          body: JSON.stringify(requestBody)
        });

        const response = await handleChatAPI(apiRequest, context.env);

        if (!response.ok) {
          const errorData = await response.json() as ErrorResponse;
          throw new Error(errorData.error || 'Chat API request failed');
        }

        const chatResponse = await response.json() as ChatResponse;

        return {
          message: chatResponse.message,
          conversationId: chatResponse.conversationId,
          timestamp: chatResponse.timestamp,
          model: chatResponse.model,
          usage: chatResponse.usage || null
        };
      } catch (error) {
        console.error('Chat API Error in GraphQL mutation:', error);
        throw new Error(`Chat service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
};

// 🔧 新增：提取的 API 处理函数
async function handleChatAPI(request: Request, env: Env): Promise<Response> {
  console.log('📡 Handling internal REST API chat request');

  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return jsonError('Invalid Content-Type. Expected application/json', 'INVALID_CONTENT_TYPE', 400);
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch (error) {
    return jsonError('Invalid JSON in request body', 'INVALID_JSON', 400);
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return jsonError('Message is required and must be a non-empty string', 'INVALID_MESSAGE', 400);
  }

  if (!env.OPENAI_API_KEY) {
    return jsonError('OpenAI API key not configured', 'MISSING_API_KEY', 500);
  }

  // const deepSeekService = new DeepSeekService(env.DEEPSEEK_API_KEY);
  // const response = await deepSeekService.chat({
  //   message: body.message.trim(),
  //   conversationId: body.conversationId,
  //   systemPrompt: body.systemPrompt
  // });

  const openAIService = new OpenAIService(env.OPENAI_API_KEY);
  const response = await openAIService.chat({
    message: body.message.trim(),
    conversationId: body.conversationId,
    systemPrompt: body.systemPrompt
  });

  const chatResponse: ChatResponse = {
    message: response.message,
    conversationId: response.conversationId,
    timestamp: new Date().toISOString(),
    model: 'deepseek-chat',
    usage: response.usage
  };

  return new Response(JSON.stringify(chatResponse), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// 🔧 新增：提取的对话 API 处理函数
async function handleConversationAPI(request: Request, env: Env, conversationId: string): Promise<Response> {
  console.log(`📂 Fetching conversation: ${conversationId}`);

  if (!conversationId || conversationId.trim().length === 0) {
    return jsonError('Invalid conversation ID', 'INVALID_CONVERSATION_ID', 400);
  }

  const conversation = {
    id: conversationId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return new Response(JSON.stringify(conversation), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// 3. 创建 Apollo Server
const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: true, // 开发期启用 Playground
  // 🔧 添加：错误格式化
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code,
      path: error.path,
    };
  },
});

// 4. 创建 Apollo Server 的 Cloudflare Handler
const apolloHandler = startServerAndCreateCloudflareWorkersHandler(apolloServer, {
  context: async ({ request, env }: { request: Request; env: Env }): Promise<GraphQLContext> => {
    // 🔧 修正：返回明确的 GraphQLContext 类型
    return { 
      env,
      request,
      // 🔧 添加：可以添加认证信息
      user: request.headers.get('authorization') ? 
        { id: 'authenticated-user' } : null
    };
  },
});

// ------------------- Worker fetch 入口 -------------------

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const { method } = request;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS 预检
    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    try {
      // GraphQL 端点 - 使用 Apollo Server
      if (pathname === '/graphql' || pathname.startsWith('/graphql')) {
        console.log(`🔧 Handling GraphQL request: ${method} ${pathname}`);
        
        // 🔧 修正：使用正确的 ExecutionContext
        const response = await apolloHandler(request, env, ctx);
        
        // 添加 CORS 头到 GraphQL 响应
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        headers.set('Access-Control-Max-Age', '86400');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
        });
      }

      // 健康检查
      if (method === 'GET' && pathname === '/') {
        return new Response(JSON.stringify({
          message: 'Chat Service API is running with Apollo Server support',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            rest: {
              chat: '/api/chat',
              conversations: '/api/conversations/:id'
            },
            graphql: {
              endpoint: '/graphql',
              description: 'Apollo Server GraphQL API',
              playground: '/graphql (GET request)'
            }
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // REST API: 聊天接口
      if (method === 'POST' && pathname === '/api/chat') {
        return await handleChatAPI(request, env);
      }

      // REST API: 获取对话历史
      const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
      if (method === 'GET' && conversationMatch) {
        const conversationId = conversationMatch[1];
        return await handleConversationAPI(request, env, conversationId);
      }

      // 404
      return jsonError('Route not found', 'NOT_FOUND', 404);

    } catch (error) {
      console.error('🚨 API Error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        pathname,
        method,
        timestamp: new Date().toISOString()
      });

      return jsonError(
        error instanceof Error ? error.message : 'Internal server error',
        'INTERNAL_ERROR',
        500
      );
    }
  },
};

// ------------------- 工具方法 -------------------
function jsonError(message: string, code: string, status = 400): Response {
  const errorResponse: ErrorResponse = { error: message, code };
  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}