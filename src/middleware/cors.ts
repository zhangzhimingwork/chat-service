// CORS 中间件

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 在生产环境中应该设置为具体的域名
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export function handleCORS(request: Request): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

// 生产环境下的 CORS 设置函数
export function getProductionCorsHeaders(allowedOrigins: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Origin': allowedOrigins.join(', ')
  };
}

// 检查请求来源是否被允许
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return true; // 允许没有 origin 的请求（如 Postman）
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}