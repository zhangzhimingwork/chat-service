import { DeepSeekService } from '../services/deepseek';
import { OpenAIService } from '../services/openAi'
import { ChatRequest } from '../types';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from './context';

export const resolvers = {
  Query: {
    health: () => ({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      service: 'Chat Service with GraphQL Yoga (Enterprise Features)'
    }),
    
    conversation: async (
      _: any, 
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      console.log(`📂 Fetching conversation: ${id}, RequestID: ${context.requestId}`);
      
      // 这里应该从数据库或存储中获取对话
      // 目前返回模拟数据
      return {
        id,
        title: `对话 ${id}`,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        systemPrompt: null
      };
    },
    
    conversations: async (
      _: any, 
      { limit, offset }: { limit: number; offset: number },
      context: GraphQLContext
    ) => {
      console.log(`📂 Fetching conversations with limit: ${limit}, offset: ${offset}, RequestID: ${context.requestId}`);
      
      // 这里应该从数据库获取对话列表
      // 目前返回模拟数据
      return {
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null
        }
      };
    }
  },
  
  Mutation: {
    sendMessage: async (
      _: any, 
      { input }: { input: ChatRequest }, 
      context: GraphQLContext
    ) => {
      const startTime = Date.now();
      
      try {
        // 输入验证 - 企业级错误处理
        if (!input.message || typeof input.message !== 'string' || input.message.trim().length === 0) {
          throw new GraphQLError('Message is required and must be a non-empty string', {
            extensions: { 
              code: 'INVALID_MESSAGE',
              field: 'message',
              requestId: context.requestId,
              timestamp: new Date().toISOString()
            }
          });
        }

        // 检查消息长度限制
        if (input.message.length > 10000) {
          throw new GraphQLError('Message is too long', {
            extensions: {
              code: 'INVALID_INPUT',
              field: 'message',
              maxLength: 10000,
              currentLength: input.message.length,
              requestId: context.requestId
            }
          });
        }

        // 检查 DeepSeek API Key 配置
        if (!context.env.DEEPSEEK_API_KEY) {
          throw new GraphQLError('DeepSeek API key is not configured', {
            extensions: { 
              code: 'CONFIGURATION_ERROR',
              field: 'apiKey',
              requestId: context.requestId
            }
          });
        }

        // 记录处理开始
        const messagePreview = input.message.substring(0, 50) + (input.message.length > 50 ? '...' : '');
        console.log(`💬 Processing message: "${messagePreview}" (RequestID: ${context.requestId})`);

        // 调用 DeepSeek 服务
        // const deepSeekService = new DeepSeekService(context.env.DEEPSEEK_API_KEY);
        // const response = await deepSeekService.chat({
        //   message: input.message.trim(),
        //   conversationId: input.conversationId,
        //   systemPrompt: input.systemPrompt
        // });

        // 调用 openai 服务
        const openAIService = new OpenAIService(context.env.OPENAI_API_KEY);
        const response = await openAIService.chat({
          message: input.message.trim(),
          conversationId: input.conversationId,
          systemPrompt: input.systemPrompt
        });

        const conversationId = response.conversationId || generateConversationId();
        const timestamp = new Date().toISOString();
        
        // 构建完整的对话对象
        const conversation = {
          id: conversationId,
          title: input.conversationId ? `对话 ${conversationId}` : '新对话',
          messages: [
            {
              id: generateMessageId(),
              content: input.message,
              role: 'USER' as const,
              timestamp,
              usage: null
            },
            {
              id: generateMessageId(),
              content: response.message,
              role: 'ASSISTANT' as const,
              timestamp,
              usage: response.usage
            }
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
          systemPrompt: input.systemPrompt || null
        };

        const processingTime = Date.now() - startTime;
        
        // 记录成功的交互 - 企业级监控
        console.log('🎉 Successful chat interaction:', {
          requestId: context.requestId,
          conversationId,
          messageLength: input.message.length,
          responseLength: response.message.length,
          tokensUsed: response.usage?.totalTokens || 0,
          processingTime: `${processingTime}ms`,
          model: input.model || 'deepseek-chat',
          hasSystemPrompt: !!input.systemPrompt,
          ip: context.ip,
          userAgent: context.userAgent?.substring(0, 50) + '...',
          timestamp
        });

        // 性能监控 - 慢查询告警
        if (processingTime > 3000) {
          console.warn(`⚠️ Slow GraphQL operation detected: sendMessage took ${processingTime}ms (RequestID: ${context.requestId})`);
        }

        return {
          message: response.message,
          conversationId,
          timestamp,
          model: input.model || 'deepseek-chat',
          usage: response.usage,
          conversation
        };
      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        // 记录错误信息 - 企业级错误处理
        console.error('❌ GraphQL sendMessage error:', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          processingTime: `${processingTime}ms`,
          ip: context.ip,
          messageLength: input?.message?.length || 0,
          timestamp: new Date().toISOString()
        });
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        // 将其他错误包装为 GraphQLError
        throw new GraphQLError(
          error instanceof Error ? error.message : 'Internal server error',
          { 
            extensions: { 
              code: 'INTERNAL_ERROR',
              originalError: error instanceof Error ? error.constructor.name : 'Unknown',
              requestId: context.requestId,
              timestamp: new Date().toISOString()
            } 
          }
        );
      }
    },
    
    createConversation: async (
      _: any, 
      { input }: { input: { title?: string; systemPrompt?: string } },
      context: GraphQLContext
    ) => {
      try {
        const conversationId = generateConversationId();
        const timestamp = new Date().toISOString();
        
        const conversation = {
          id: conversationId,
          title: input.title || '新对话',
          messages: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          systemPrompt: input.systemPrompt || null
        };

        // 记录创建操作
        console.log(`🆕 Created new conversation:`, {
          requestId: context.requestId,
          conversationId,
          title: conversation.title,
          hasSystemPrompt: !!input.systemPrompt,
          ip: context.ip,
          timestamp
        });
        
        return conversation;
      } catch (error) {
        console.error('❌ Error creating conversation:', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: context.ip,
          timestamp: new Date().toISOString()
        });
        
        throw new GraphQLError(
          'Failed to create conversation',
          { 
            extensions: { 
              code: 'CREATION_ERROR',
              requestId: context.requestId,
              timestamp: new Date().toISOString()
            } 
          }
        );
      }
    },
    
    deleteConversation: async (
      _: any, 
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      try {
        // 记录删除操作
        console.log(`🗑️ Deleting conversation:`, {
          requestId: context.requestId,
          conversationId: id,
          ip: context.ip,
          timestamp: new Date().toISOString()
        });
        
        // 这里应该实现真正的删除逻辑
        // 目前只是模拟成功
        // 在实际应用中，这里应该从数据库中删除对应的记录
        
        return true;
      } catch (error) {
        console.error('❌ Error deleting conversation:', {
          requestId: context.requestId,
          conversationId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: context.ip,
          timestamp: new Date().toISOString()
        });
        
        throw new GraphQLError(
          'Failed to delete conversation',
          { 
            extensions: { 
              code: 'DELETION_ERROR',
              conversationId: id,
              requestId: context.requestId,
              timestamp: new Date().toISOString()
            } 
          }
        );
      }
    }
  }
};

// 生成对话ID的辅助函数
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 生成消息ID的辅助函数
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
