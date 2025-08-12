import { Router } from '@cloudflare/itty-router';
import { corsHeaders, handleCORS } from './middleware/cors';
import { DeepSeekService } from './services/deepseek';
import { ChatRequest, ChatResponse, ErrorResponse } from './types';

const router = Router();

// CORS 预检请求
router.options('*', handleCORS);

// 健康检查
router.get('/', () => {
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
});

// 聊天接口
router.post('/api/chat', async (request: Request, env: Env) => {
  try {
    // 验证请求内容类型
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorResponse: ErrorResponse = {
        error: 'Invalid Content-Type. Expected application/json',
        code: 'INVALID_CONTENT_TYPE'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const body: ChatRequest = await request.json();
    
    // 验证请求参数
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      const errorResponse: ErrorResponse = {
        error: 'Message is required and must be a non-empty string',
        code: 'INVALID_MESSAGE'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 调用 DeepSeek 服务
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

  } catch (error) {
    console.error('Chat API Error:', error);
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// 获取对话历史
router.get('/api/conversations/:id', async (request: Request, env: Env) => {
  try {
    const { params } = request;
    const conversationId = params?.id;

    if (!conversationId) {
      const errorResponse: ErrorResponse = {
        error: 'Conversation ID is required',
        code: 'MISSING_CONVERSATION_ID'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 这里可以从数据库或存储中获取对话历史
    // 目前返回模拟数据
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

  } catch (error) {
    console.error('Get Conversation Error:', error);
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// 404 处理
router.all('*', () => {
  const errorResponse: ErrorResponse = {
    error: 'Route not found',
    code: 'NOT_FOUND'
  };
  return new Response(JSON.stringify(errorResponse), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  },
};