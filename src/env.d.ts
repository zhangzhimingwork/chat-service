// Cloudflare Workers 环境变量类型定义

interface Env {
  // DeepSeek API 密钥
  DEEPSEEK_API_KEY: string;

  OPENAI_API_KEY: string;
  
  // 允许的跨域来源
  ALLOWED_ORIGINS?: string;
  
  // 环境标识
  ENVIRONMENT?: string;
  
  // 可以添加其他环境变量，如数据库连接等
  // DATABASE_URL?: string;
  // REDIS_URL?: string;
}