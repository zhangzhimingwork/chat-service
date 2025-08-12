import { DeepSeekRequest, DeepSeekResponse, DeepSeekMessage } from '../types';

export interface ChatServiceRequest {
  message: string;
  conversationId?: string;
  systemPrompt?: string;
}

export interface ChatServiceResponse {
  message: string;
  conversationId: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekService {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';
  private model = 'deepseek-chat';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('DeepSeek API key is required');
    }
    this.apiKey = apiKey;
  }

  async chat(request: ChatServiceRequest): Promise<ChatServiceResponse> {
    const messages: DeepSeekMessage[] = [];

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

    const deepSeekRequest: DeepSeekRequest = {
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(deepSeekRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: DeepSeekResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from DeepSeek API');
      }

      const assistantMessage = data.choices[0].message.content;
      const conversationId = request.conversationId || this.generateConversationId();

      return {
        message: assistantMessage,
        conversationId,
        usage: data.usage
      };

    } catch (error) {
      console.error('DeepSeek Service Error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to communicate with DeepSeek API');
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 验证API密钥是否有效
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('API Key validation error:', error);
      return false;
    }
  }
}