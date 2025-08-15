import { corsHeaders, handleCORS } from './middleware/cors';
import { DeepSeekService } from './services/deepseek';
import { ChatRequest, ChatResponse, ErrorResponse } from './types';
import { graphqlHandler } from './graphql/server';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { method } = request;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    try {
      // Apollo Server GraphQL 端点
      if (pathname === '/graphql' || pathname.startsWith('/graphql')) {
        console.log(`🔧 Handling GraphQL request: ${method} ${pathname}`);
        
        // 使用 Apollo Server 处理 GraphQL 请求
        const response = await graphqlHandler(request, env);
        
        // 添加 CORS 头部到 Apollo Server 响应
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      // 健康检查
      if (method === 'GET' && pathname === '/') {
        return new Response(JSON.stringify({
          message: 'Chat Service API is running with Apollo Server GraphQL support',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            rest: {
              chat: '/api/chat',
              conversations: '/api/conversations/:id'
            },
            graphql: {
              endpoint: '/graphql',
              playground: '/graphql (开发环境)',
              description: 'Apollo Server GraphQL API'
            }
          },
          features: [
            'Apollo Server GraphQL',
            'DeepSeek AI Integration',
            'TypeScript Support',
            'CORS Enabled',
            'Advanced Error Handling',
            'Performance Monitoring',
            'Request Tracking'
          ]
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // REST API: 聊天接口（保持向后兼容）
      if (method === 'POST' && pathname === '/api/chat') {
        console.log('📡 Handling REST API chat request');
        
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return jsonError('Invalid Content-Type. Expected application/json', 'INVALID_CONTENT_TYPE', 400);
        }

        const body: ChatRequest = await request.json();
        if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
          return jsonError('Message is required and must be a non-empty string', 'INVALID_MESSAGE', 400);
        }

        const deepSeekService = new DeepSeekService(env.DEEPSEEK_API_KEY);
        const response = await deepSeekService.chat({
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

      // REST API: 获取对话历史（保持向后兼容）
      const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
      if (method === 'GET' && conversationMatch) {
        const conversationId = conversationMatch[1];
        console.log(`📂 Fetching conversation: ${conversationId}`);
        
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

      // 404 - Route not found
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

// 统一错误响应
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
