import { OpenAIRequest, OpenAIResponse, OpenAIMessage } from '../types';

export interface ChatServiceRequest {
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatServiceResponse {
  message: string;
  conversationId: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  finishReason?: string;
}

export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private defaultModel = 'gpt-4o';
  private organization?: string;

  constructor(apiKey: string, options?: { organization?: string; baseUrl?: string }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    this.organization = options?.organization;
    
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
  }

  async chat(request: ChatServiceRequest): Promise<ChatServiceResponse> {
    const messages: OpenAIMessage[] = [];

    // 添加系统提示词
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // 添加用户消息
    messages.push({
      role: 'user',
      content: request.message
    });

    const openAIRequest: OpenAIRequest = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      stream: false,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // 如果有组织ID，添加到请求头
      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `${response.status} ${response.statusText}`;
        
        // 处理特定的OpenAI错误
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (response.status === 503) {
          throw new Error('OpenAI API is temporarily unavailable. Please try again later.');
        }
        
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data: OpenAIResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      const choice = data.choices[0];
      const assistantMessage = choice.message.content;
      const conversationId = request.conversationId || this.generateConversationId();

      return {
        message: assistantMessage,
        conversationId,
        usage: data.usage,
        model: data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      console.error('OpenAI Service Error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to communicate with OpenAI API');
    }
  }

  // 支持对话历史的聊天
  async chatWithHistory(
    request: ChatServiceRequest & { 
      history?: Array<{ role: 'user' | 'assistant'; content: string }> 
    }
  ): Promise<ChatServiceResponse> {
    const messages: OpenAIMessage[] = [];

    // 添加系统提示词
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // 添加历史对话
    if (request.history && request.history.length > 0) {
      request.history.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: request.message
    });

    const openAIRequest: OpenAIRequest = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      stream: false
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data: OpenAIResponse = await response.json();
      const choice = data.choices[0];
      const conversationId = request.conversationId || this.generateConversationId();

      return {
        message: choice.message.content,
        conversationId,
        usage: data.usage,
        model: data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw error instanceof Error ? error : new Error('Failed to communicate with OpenAI API');
    }
  }

  // 流式响应支持
  async *chatStream(request: ChatServiceRequest): AsyncGenerator<string, void, unknown> {
    const messages: OpenAIMessage[] = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: request.message
    });

    const openAIRequest = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      stream: true
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                yield delta;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming response:', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('OpenAI Stream Error:', error);
      throw error instanceof Error ? error : new Error('Failed to stream from OpenAI API');
    }
  }

  // 生成embedding
  async createEmbedding(
    text: string | string[], 
    model: string = 'text-embedding-3-small'
  ): Promise<{ data: Array<{ embedding: number[]; index: number }>; usage: any }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`OpenAI Embeddings API error: ${errorMessage}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenAI Embeddings Error:', error);
      throw error instanceof Error ? error : new Error('Failed to create embeddings');
    }
  }

  // 生成图片
  async createImage(
    prompt: string,
    options?: {
      model?: 'dall-e-2' | 'dall-e-3';
      size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
      quality?: 'standard' | 'hd';
      n?: number;
    }
  ): Promise<{ data: Array<{ url: string; revised_prompt?: string }> }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: options?.model || 'dall-e-3',
          prompt,
          size: options?.size || '1024x1024',
          quality: options?.quality || 'standard',
          n: options?.n || 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`OpenAI Images API error: ${errorMessage}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenAI Images Error:', error);
      throw error instanceof Error ? error : new Error('Failed to generate image');
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 验证API密钥是否有效
  async validateApiKey(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });
      
      return response.ok;
    } catch (error) {
      console.error('API Key validation error:', error);
      return false;
    }
  }

  // 获取可用模型列表
  async getModels(): Promise<{ data: Array<{ id: string; object: string; created: number; owned_by: string }> }> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get Models Error:', error);
      throw error instanceof Error ? error : new Error('Failed to get models');
    }
  }

  // 设置默认模型
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  // 获取当前默认模型
  getDefaultModel(): string {
    return this.defaultModel;
  }

  // 计算token数量（估算）
  estimateTokens(text: string): number {
    // 简单估算：平均4个字符 = 1个token
    return Math.ceil(text.length / 4);
  }
}