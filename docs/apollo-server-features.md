# Apollo Server 高级特性指南

## 概述

本指南详细介绍了 Apollo Server 在我们的 Cloudflare Workers 项目中提供的高级特性和最佳实践。

## 核心特性

### 1. 高级错误处理

#### 错误分类
```typescript
// 定义错误代码枚举
enum ErrorCodes {
  INVALID_INPUT = 'INVALID_INPUT',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// 创建结构化错误
const createGraphQLError = (message: string, code: ErrorCodes, extensions = {}) => {
  return new GraphQLError(message, {
    extensions: {
      code,
      timestamp: new Date().toISOString(),
      ...extensions
    }
  });
};
```

#### 错误处理中间件
```typescript
// 在 Apollo Server 配置中
formatError: (err) => {
  // 记录错误
  console.error('GraphQL Error:', {
    message: err.message,
    code: err.extensions?.code,
    path: err.path,
    locations: err.locations,
    source: err.source
  });

  // 生产环境中隐藏敏感信息
  if (process.env.NODE_ENV === 'production' && err.extensions?.code === 'INTERNAL_ERROR') {
    return {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    };
  }

  return {
    message: err.message,
    code: err.extensions?.code || 'INTERNAL_ERROR',
    path: err.path,
    locations: err.locations
  };
}
```

### 2. 性能监控和指标

#### 请求生命周期监控
```typescript
const performancePlugin = {
  requestDidStart() {
    const startTime = Date.now();
    let operationName = '';
    
    return {
      didResolveOperation(requestContext) {
        operationName = requestContext.request.operationName || 'Anonymous';
        console.log(`🚀 Starting operation: ${operationName}`);
      },
      
      didEncounterErrors(requestContext) {
        const errors = requestContext.errors;
        console.error(`❌ Operation ${operationName} failed:`, {
          errorCount: errors.length,
          errors: errors.map(err => ({
            message: err.message,
            code: err.extensions?.code
          }))
        });
      },
      
      willSendResponse(requestContext) {
        const duration = Date.now() - startTime;
        const success = !requestContext.errors || requestContext.errors.length === 0;
        
        console.log(`✅ Operation ${operationName} completed:`, {
          duration: `${duration}ms`,
          success,
          cacheHit: requestContext.response.http?.headers.get('cache-control')
        });
        
        // 记录性能指标
        if (duration > 1000) {
          console.warn(`⚠️ Slow operation detected: ${operationName} took ${duration}ms`);
        }
      }
    };
  }
};
```

#### 自定义指标收集
```typescript
const metricsPlugin = {
  requestDidStart() {
    return {
      willSendResponse(requestContext) {
        const operation = requestContext.request.operationName;
        const variables = requestContext.request.variables;
        
        // 收集聊天相关指标
        if (operation === 'SendMessage') {
          const messageLength = variables?.input?.message?.length || 0;
          console.log('📊 Chat Metrics:', {
            operation,
            messageLength,
            hasConversationId: !!variables?.input?.conversationId,
            hasSystemPrompt: !!variables?.input?.systemPrompt,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }
};
```

### 3. 查询复杂度分析

#### 实现查询深度限制
```typescript
import { depthLimit } from 'graphql-depth-limit';

const server = new ApolloServer({
  schema,
  validationRules: [depthLimit(10)], // 限制查询深度
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation(requestContext) {
            const query = requestContext.request.query;
            const complexity = calculateQueryComplexity(query);
            
            if (complexity > 1000) {
              throw new GraphQLError('Query is too complex', {
                extensions: {
                  code: 'QUERY_TOO_COMPLEX',
                  complexity,
                  maxComplexity: 1000
                }
              });
            }
          }
        };
      }
    }
  ]
});
```

### 4. 缓存策略

#### 字段级缓存
```typescript
const resolvers = {
  Query: {
    conversation: async (_, { id }, context) => {
      // 实现简单的内存缓存
      const cacheKey = `conversation:${id}`;
      const cached = context.cache?.get(cacheKey);
      
      if (cached) {
        console.log(`💾 Cache hit for conversation ${id}`);
        return cached;
      }
      
      const conversation = await fetchConversation(id);
      
      // 缓存5分钟
      context.cache?.set(cacheKey, conversation, { ttl: 300 });
      
      return conversation;
    }
  }
};
```

#### HTTP缓存头
```typescript
const cacheControlPlugin = {
  requestDidStart() {
    return {
      willSendResponse(requestContext) {
        const operation = requestContext.request.operationName;
        
        // 为查询操作设置缓存头
        if (operation?.startsWith('Get') || operation === 'health') {
          requestContext.response.http.headers.set(
            'Cache-Control',
            'public, max-age=300, stale-while-revalidate=600'
          );
        }
      }
    };
  }
};
```

### 5. 安全特性

#### 请求限流
```typescript
const rateLimitPlugin = {
  requestDidStart() {
    return {
      didResolveOperation(requestContext) {
        const ip = requestContext.contextValue.ip;
        const operation = requestContext.request.operationName;
        
        // 简单的内存限流（生产环境应使用Redis等）
        if (isRateLimited(ip, operation)) {
          throw new GraphQLError('Rate limit exceeded', {
            extensions: {
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter: 60
            }
          });
        }
      }
    };
  }
};

function isRateLimited(ip: string, operation: string): boolean {
  // 实现限流逻辑
  const key = `${ip}:${operation}`;
  const count = getRequestCount(key);
  const limit = operation === 'SendMessage' ? 30 : 100; // 每分钟限制
  
  return count > limit;
}
```

#### 输入验证
```typescript
const validationPlugin = {
  requestDidStart() {
    return {
      didResolveOperation(requestContext) {
        const variables = requestContext.request.variables;
        
        // 验证输入大小
        if (variables?.input?.message && variables.input.message.length > 10000) {
          throw new GraphQLError('Message is too long', {
            extensions: {
              code: 'INVALID_INPUT',
              field: 'message',
              maxLength: 10000
            }
          });
        }
      }
    };
  }
};
```

### 6. 开发工具集成

#### Apollo Studio 集成
```typescript
const server = new ApolloServer({
  schema,
  // Apollo Studio 配置
  apollo: {
    key: process.env.APOLLO_KEY,
    graphRef: process.env.APOLLO_GRAPH_REF
  },
  // 启用内省和playground（仅开发环境）
  introspection: process.env.NODE_ENV !== 'production',
  plugins: [
    // Apollo Studio 插件会自动添加
    process.env.APOLLO_KEY && require('apollo-server-plugin-usage-reporting')({
      sendVariableValues: { all: true },
      sendHeaders: { all: true }
    })
  ].filter(Boolean)
});
```

#### 开发模式增强
```typescript
const developmentPlugin = {
  requestDidStart() {
    if (process.env.NODE_ENV !== 'development') return {};
    
    return {
      didResolveOperation(requestContext) {
        console.log('🔍 Development Mode - Query Details:', {
          operation: requestContext.request.operationName,
          variables: JSON.stringify(requestContext.request.variables, null, 2),
          query: requestContext.request.query
        });
      },
      
      didEncounterErrors(requestContext) {
        console.log('🐛 Development Mode - Full Error Stack:');
        requestContext.errors.forEach(error => {
          console.error(error.stack);
        });
      }
    };
  }
};
```

### 7. 自定义指令

#### 权限检查指令
```typescript
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';

function authDirective(schema: GraphQLSchema) {
  return mapSchema(schema, {
    [MapperKind.FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      
      if (authDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        
        fieldConfig.resolve = async function (source, args, context, info) {
          // 检查权限
          if (!context.user) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'AUTHENTICATION_ERROR' }
            });
          }
          
          return resolve(source, args, context, info);
        };
      }
      
      return fieldConfig;
    }
  });
}
```

### 8. 订阅支持（WebSocket）

虽然 Cloudflare Workers 不直接支持 WebSocket，但可以通过 Durable Objects 实现：

```typescript
// 订阅解析器示例
const resolvers = {
  Subscription: {
    messageAdded: {
      subscribe: () => {
        // 在实际实现中，这里会连接到 Durable Objects
        return pubsub.asyncIterator(['MESSAGE_ADDED']);
      }
    }
  }
};

// 类型定义
const typeDefs = `
  type Subscription {
    messageAdded(conversationId: ID!): Message
  }
`;
```

## 最佳实践总结

### 1. 性能优化
- 使用数据加载器减少N+1查询
- 实现适当的缓存策略
- 监控查询复杂度
- 使用字段级解析器优化

### 2. 安全性
- 实施查询深度和复杂度限制
- 添加请求限流
- 验证所有输入
- 适当的错误消息（不泄露敏感信息）

### 3. 监控
- 记录所有操作和错误
- 收集性能指标
- 设置告警阈值
- 使用分布式追踪

### 4. 开发体验
- 提供清晰的错误消息
- 使用 Apollo Studio 进行调试
- 实现全面的日志记录
- 编写详细的文档

这些高级特性使得我们的 Apollo Server 实现不仅功能强大，而且适合生产环境使用。
