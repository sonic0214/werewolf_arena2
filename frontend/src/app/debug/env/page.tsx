'use client';

import { useEffect } from 'react';

export default function EnvDebugPage() {
  useEffect(() => {
    console.log('🌍 客户端环境变量调试:');
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('NEXT_PUBLIC_WS_URL:', process.env.NEXT_PUBLIC_WS_URL);
    console.log('NODE_ENV:', process.env.NODE_ENV);

    // 显示所有NEXT_PUBLIC_开头的环境变量
    const publicEnvVars = Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_'));
    console.log('所有NEXT_PUBLIC_变量:');
    publicEnvVars.forEach(key => {
      console.log(`${key}:`, process.env[key]);
    });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔍 环境变量调试页面</h1>

      <h2>客户端环境变量</h2>
      <ul>
        <li><strong>NEXT_PUBLIC_API_URL:</strong> {process.env.NEXT_PUBLIC_API_URL || '未设置'}</li>
        <li><strong>NEXT_PUBLIC_WS_URL:</strong> {process.env.NEXT_PUBLIC_WS_URL || '未设置'}</li>
        <li><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</li>
      </ul>

      <h2>所有NEXT_PUBLIC_变量</h2>
      <ul>
        {Object.keys(process.env)
          .filter(key => key.startsWith('NEXT_PUBLIC_'))
          .map(key => (
            <li key={key}>
              <strong>{key}:</strong> {process.env[key] || '未设置'}
            </li>
          ))}
      </ul>

      <h2>当前URL</h2>
      <p>WebSocket URL: {process.env.NEXT_PUBLIC_WS_URL || 'wss://werewolf-arena-backend.fly.dev'}</p>
      <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'https://werewolf-arena-backend.fly.dev'}</p>

      <h2>使用说明</h2>
      <p>1. 打开浏览器开发者工具的控制台查看详细日志</p>
      <p>2. 检查这里的值是否符合预期</p>
      <p>3. 如果值不正确，说明Vercel环境变量没有正确设置</p>
    </div>
  );
}