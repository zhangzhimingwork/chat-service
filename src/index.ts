import { corsHeaders, handleCORS } from './middleware/cors';
import { DeepSeekService } from './services/deepseek';
import { ChatRequest, ChatResponse, ErrorResponse } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { method } = request;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    try {
      // 健康检查
      if (method === 'GET' && pathname === '/') {
        return new Response(JSON.stringify({
          message: 'Chat Service API is running',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // 聊天接口
      if (method === 'POST' && pathname === '/api/chat') {
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

      // 获取对话历史
      const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
      if (method === 'GET' && conversationMatch) {
        const conversationId = conversationMatch[1];
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

      // 404
      return jsonError('Route not found', 'NOT_FOUND', 404);

    } catch (error) {
      console.error('API Error:', error);
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
