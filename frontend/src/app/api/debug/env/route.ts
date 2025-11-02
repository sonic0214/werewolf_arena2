import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    // 客户端可用的环境变量
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,

    // 服务端环境变量
    BACKEND_URL: process.env.BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,

    // 所有NEXT_PUBLIC_变量
    publicEnvVars: Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>),

    // 构建时的环境变量信息
    buildTime: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '默认值: https://werewolf-arena-backend.fly.dev',
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '默认值: wss://werewolf-arena-backend.fly.dev',
    }
  };

  return NextResponse.json(envVars);
}