'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, TrendingUp, Zap, Users, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGameActions, useGameLoading, useGameError, useCurrentGame } from '@/lib/store/gameStore';

export default function Home() {
  const router = useRouter();
  const { startGame } = useGameActions();
  const gameLoading = useGameLoading();
  const gameError = useGameError();
  const currentGame = useCurrentGame();
  const [isStarting, setIsStarting] = useState(false);

  // Auto-redirect to live game page when game starts successfully
  // But only if we came from the home page initially (not from returning)
  useEffect(() => {
    if (currentGame && currentGame.session_id && gameLoading === 'success') {
      // Check if we should auto-redirect (only when user just started a game)
      const shouldRedirect = sessionStorage.getItem('shouldRedirectToGame') === 'true';
      if (shouldRedirect) {
        console.log('Game started successfully, redirecting to live game page:', currentGame.session_id);
        // Clear the flag
        sessionStorage.removeItem('shouldRedirectToGame');
        router.push(`/live-game/${currentGame.session_id}`);
      }
    }
  }, [currentGame, gameLoading, router]);

  const handleEnterLivestream = async () => {
    try {
      setIsStarting(true);

      // Set flag to indicate we should redirect after game starts
      sessionStorage.setItem('shouldRedirectToGame', 'true');

      // 使用默认参数启动游戏
      await startGame({
        villager_model: 'minimax/MiniMax-M2',
        werewolf_model: 'minimax/MiniMax-M2',
        discussion_time_minutes: 5,
        max_rounds: 10,
      });

    } catch (error) {
      console.error('Failed to start game:', error);
      setIsStarting(false);
      // Clear flag on error
      sessionStorage.removeItem('shouldRedirectToGame');
    }
  };

  const userRankings = [
    { rank: 1, name: "玩家_8492", winnings: 12540, trend: "+1,256", winRate: 72 },
    { rank: 2, name: "AI猎手", winnings: 9813, trend: "+892", winRate: 68 },
    { rank: 3, name: "推理大师", winnings: 8598, trend: "+534", winRate: 65 },
    { rank: 4, name: "狼人克星", winnings: 7254, trend: "-123", winRate: 61 },
    { rank: 5, name: "逻辑王者", winnings: 6432, trend: "+678", winRate: 59 },
    { rank: 6, name: "预言先知", winnings: 5801, trend: "+445", winRate: 57 },
  ];

  const modelPerformanceData = [
    { round: "1", "GPT-4": 75, "Claude": 68, "LLaMA": 62, "Gemini": 70 },
    { round: "2", "GPT-4": 80, "Claude": 72, "LLaMA": 65, "Gemini": 68 },
    { round: "3", "GPT-4": 78, "Claude": 75, "LLaMA": 70, "Gemini": 65 },
    { round: "4", "GPT-4": 85, "Claude": 78, "LLaMA": 72, "Gemini": 70 },
    { round: "5", "GPT-4": 82, "Claude": 80, "LLaMA": 75, "Gemini": 72 },
    { round: "6", "GPT-4": 88, "Claude": 82, "LLaMA": 78, "Gemini": 75 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* 顶部导航栏 */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-amber-400 cursor-pointer" onClick={() => router.push('/')}>
                AI Arena
              </h1>
              <div className="hidden md:flex items-center gap-6 text-sm">
                <button
                  onClick={handleEnterLivestream}
                  className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
                >
                  LIVE
                </button>
                <button
                  onClick={() => router.push('/leaderboard')}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  LEADERBOARD
                </button>
                <button
                  onClick={() => router.push('/models')}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  MODELS
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-500/20 border-red-500 text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
                直播中
              </Badge>
            </div>
          </div>
        </div>
      </nav>

      {/* 实时数据滚动栏 */}
      <div className="border-b border-slate-800 bg-slate-800/50 overflow-hidden">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-8 text-sm overflow-x-auto">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-400">当前在线:</span>
              <span className="font-bold text-amber-400">1,234</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-400">今日对局:</span>
              <span className="font-bold">42</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-400">总下注额:</span>
              <span className="font-bold text-amber-400">¥234,567</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：图表区域 */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* 直播入口卡片 */}
            <Card className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-center">
              <div className="max-w-2xl mx-auto">
                <Badge className="mb-6 text-sm px-4 py-2 bg-amber-500/20 border-amber-500 text-amber-400">
                  <Users className="w-4 h-4 mr-2" />
                  第 3 局 - 发言阶段
                </Badge>
                <h2 className="text-4xl font-bold mb-4 text-slate-100">
                  猜猜哪个是狼，赢取你的荣耀值！
                </h2>
                <p className="text-lg text-slate-400 mb-8">
                  实时竞猜，见证推理的艺术
                </p>

                {/* Error Display */}
                {gameError && (
                  <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md">
                    <p className="text-red-400">{gameError}</p>
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={handleEnterLivestream}
                  disabled={isStarting || gameLoading === 'loading'}
                  className="shadow-2xl text-lg px-8 py-6 h-auto bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  {isStarting || gameLoading === 'loading' ? '启动游戏中...' : '进入直播间'}
                </Button>
              </div>
            </Card>

            {/* 模型表现图表 */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-100">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                模型表现趋势
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={modelPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="round"
                      label={{ value: '局数', position: 'insideBottom', offset: -5 }}
                      className="text-slate-400"
                      tick={{ fill: '#94a3b8' }}
                    />
                    <YAxis
                      label={{ value: '胜率 (%)', angle: -90, position: 'insideLeft' }}
                      className="text-slate-400"
                      tick={{ fill: '#94a3b8' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        color: '#f1f5f9'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="GPT-4"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Claude"
                      stroke="#eab308"
                      strokeWidth={2}
                      dot={{ fill: '#eab308' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="LLaMA"
                      stroke="#71717a"
                      strokeWidth={2}
                      dot={{ fill: '#71717a' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Gemini"
                      stroke="#a1a1aa"
                      strokeWidth={2}
                      dot={{ fill: '#a1a1aa' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 右侧：用户胜注排行榜 */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="p-4 bg-slate-800/50 border-slate-700 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-slate-100">用户胜注排行</h3>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {userRankings.map((user, index) => (
                  <Card
                    key={user.rank}
                    className={`
                      p-3 bg-slate-700/50 border transition-all cursor-pointer
                      ${index === 0 ? "border-amber-500 shadow-lg shadow-amber-500/20" : "border-slate-600 hover:border-amber-500/50"}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                          ${user.rank === 1 ? "bg-amber-500 text-black" : ""}
                          ${user.rank === 2 ? "bg-amber-600 text-black" : ""}
                          ${user.rank === 3 ? "bg-amber-700 text-black" : ""}
                          ${user.rank > 3 ? "bg-slate-600 text-slate-300" : ""}
                        `}
                      >
                        {user.rank}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm mb-1 text-slate-100">{user.name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-amber-400 font-semibold">
                            ¥{user.winnings.toLocaleString()}
                          </span>
                          <Badge
                            variant={user.trend.startsWith("+") ? "default" : "destructive"}
                            className="text-xs px-1 py-0"
                          >
                            {user.trend}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400">胜率</div>
                        <div className="font-bold text-sm text-slate-100">{user.winRate}%</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* 底部模型快速导航 */}
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-4 text-slate-100">参赛模型</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {["GPT-4", "Claude", "LLaMA", "Gemini", "Mistral", "Qwen"].map((model, index) => (
              <Card
                key={model}
                className="p-4 bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer text-center"
              >
                <div className="text-lg font-bold mb-1 text-slate-100">{model}</div>
                <div className="text-sm text-slate-400">
                  胜率 {85 - index * 3}%
                </div>
                <Badge
                  variant="outline"
                  className="text-xs mt-2 border-amber-500 text-amber-400"
                >
                  +{120 - index * 15}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
