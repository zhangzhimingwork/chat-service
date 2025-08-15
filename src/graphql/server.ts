import { createYoga } from 'graphql-yoga';
import { schema } from './schema';
import { createContext } from './context';

// 创建 GraphQL Yoga 服务器（更适合 Cloudflare Workers）
export function createGraphQLServer(env: Env) {
  const yoga = createYoga({
    schema,
    context: ({ request }) => createContext(request, env),
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    graphqlEndpoint: '/graphql',
    landingPage: true,
    // 错误处理
    maskedErrors: false,
    // 日志插件
    plugins: [
      {
        onRequest: ({ request, url }) => {
          console.log(`🚀 GraphQL Request: ${request.method} ${url.pathname}`);
        },
        onResponse: ({ response }) => {
          console.log(`✅ GraphQL Response: ${response.status}`);
        },
        onError: ({ error }) => {
          console.error(`❌ GraphQL Error:`, error);
        }
      }
    ]
  });

  return yoga;
}

// 导出处理函数
export async function handleGraphQLRequest(request: Request, env: Env): Promise<Response> {
  const yoga = createGraphQLServer(env);
  return yoga.fetch(request, env);
}
