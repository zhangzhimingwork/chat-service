export interface GraphQLContext {
  env: Env;
  request: Request;
  // 请求追踪信息
  requestId: string;
  userAgent: string;
  ip: string;
  // 请求时间
  startTime: number;
}

export function createContext(request: Request, env: Env): GraphQLContext {
  // 生成请求ID用于日志追踪
  const requestId = generateRequestId();
  
  // 获取用户代理和IP地址
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('cf-connecting-ip') || 
           request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown';
  
  const startTime = Date.now();

  console.log('🌐 GraphQL Request Context:', {
    requestId,
    method: request.method,
    url: new URL(request.url).pathname,
    userAgent: userAgent.substring(0, 100), // 截取前100个字符
    ip,
    timestamp: new Date().toISOString()
  });

  return {
    env,
    request,
    requestId,
    userAgent,
    ip,
    startTime
  };
}

// 生成请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
