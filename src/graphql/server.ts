import { ApolloServer } from '@apollo/server';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { schema } from './schema';
import { GraphQLContext, createContext } from './context';

// 创建 Apollo Server 实例
const server = new ApolloServer<GraphQLContext>({
  schema,
  // 在生产环境中可以禁用 introspection
  introspection: true,
  // 错误处理
  formatError: (err) => {
    console.error('GraphQL Error:', {
      message: err.message,
      code: err.extensions?.code,
      path: err.path,
      locations: err.locations
    });
    
    return {
      message: err.message,
      code: err.extensions?.code || 'INTERNAL_ERROR',
      path: err.path,
      locations: err.locations,
    };
  },
  // 性能监控和日志
  plugins: [
    {
      requestDidStart() {
        const startTime = Date.now();
        let operationName = '';
        
        return {
          didResolveOperation(requestContext) {
            operationName = requestContext.request.operationName || 'Anonymous';
            console.log(`🚀 Starting GraphQL operation: ${operationName}`);
          },
          
          didEncounterErrors(requestContext) {
            console.error(`❌ GraphQL operation ${operationName} failed:`, {
              errorCount: requestContext.errors?.length || 0,
              errors: requestContext.errors?.map(err => ({
                message: err.message,
                code: err.extensions?.code
              }))
            });
          },
          
          willSendResponse(requestContext) {
            const duration = Date.now() - startTime;
            const success = !requestContext.errors || requestContext.errors.length === 0;
            
            console.log(`✅ GraphQL operation ${operationName} completed:`, {
              duration: `${duration}ms`,
              success,
              requestId: requestContext.contextValue?.requestId
            });
            
            // 记录慢查询
            if (duration > 1000) {
              console.warn(`⚠️ Slow GraphQL operation: ${operationName} took ${duration}ms`);
            }
          }
        };
      }
    },
    // 收集聊天相关指标
    {
      requestDidStart() {
        return {
          willSendResponse(requestContext) {
            const operation = requestContext.request.operationName;
            const variables = requestContext.request.variables;
            
            if (operation === 'SendMessage') {
              const messageLength = variables?.input?.message?.length || 0;
              console.log('📊 Chat Metrics:', {
                operation,
                messageLength,
                hasConversationId: !!variables?.input?.conversationId,
                hasSystemPrompt: !!variables?.input?.systemPrompt,
                timestamp: new Date().toISOString(),
                requestId: requestContext.contextValue?.requestId
              });
            }
          }
        };
      }
    }
  ],
});

// 创建 Cloudflare Workers 处理程序
export const graphqlHandler = startServerAndCreateCloudflareWorkersHandler(
  server,
  {
    context: async ({ request, env }) => {
      return createContext(request, env);
    },
  }
);
