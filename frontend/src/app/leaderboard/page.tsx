'use client';

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Trophy, TrendingUp, ArrowLeft, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Leaderboard() {
  const router = useRouter();

  const userRankings = [
    { rank: 1, name: "玩家_8492", winnings: 12540, trend: "+1,256", winRate: 72, games: 234 },
    { rank: 2, name: "AI猎手", winnings: 9813, trend: "+892", winRate: 68, games: 189 },
    { rank: 3, name: "推理大师", winnings: 8598, trend: "+534", winRate: 65, games: 156 },
    { rank: 4, name: "狼人克星", winnings: 7254, trend: "-123", winRate: 61, games: 145 },
    { rank: 5, name: "逻辑王者", winnings: 6432, trend: "+678", winRate: 59, games: 132 },
    { rank: 6, name: "预言先知", winnings: 5801, trend: "+445", winRate: 57, games: 128 },
    { rank: 7, name: "神算子", winnings: 5234, trend: "+321", winRate: 55, games: 115 },
    { rank: 8, name: "狼人杀手", winnings: 4987, trend: "-89", winRate: 54, games: 108 },
    { rank: 9, name: "推理狂人", winnings: 4654, trend: "+234", winRate: 52, games: 102 },
    { rank: 10, name: "智者", winnings: 4321, trend: "+178", winRate: 51, games: 95 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* 顶部导航栏 */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="gap-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <div className="h-6 w-px bg-slate-700" />
              <h1 className="text-2xl font-bold text-amber-400">排行榜</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2 text-slate-100">用户胜注排行</h2>
            <p className="text-slate-400">实时更新的玩家收益排行榜</p>
          </div>

          <div className="space-y-3">
            {userRankings.map((user, index) => (
              <Card
                key={user.rank}
                className={`
                  p-4 bg-slate-800/50 border transition-all
                  ${index < 3 ? "border-amber-500 shadow-lg shadow-amber-500/20" : "border-slate-700 hover:border-amber-500/50"}
                `}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0
                      ${user.rank === 1 ? "bg-amber-500 text-black" : ""}
                      ${user.rank === 2 ? "bg-amber-600 text-black" : ""}
                      ${user.rank === 3 ? "bg-amber-700 text-black" : ""}
                      ${user.rank > 3 ? "bg-slate-600 text-slate-300" : ""}
                    `}
                  >
                    {user.rank}
                  </div>

                  <div className="flex-1">
                    <div className="font-bold text-lg mb-1 text-slate-100">{user.name}</div>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span>参与 {user.games} 局</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-slate-400 mb-1">胜率</div>
                      <div className="font-bold text-lg text-slate-100">{user.winRate}%</div>
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-slate-400 mb-1">总收益</div>
                      <div className="font-bold text-lg text-amber-400">
                        ¥{user.winnings.toLocaleString()}
                      </div>
                    </div>

                    <Badge
                      variant={user.trend.startsWith("+") ? "default" : "destructive"}
                      className="text-sm px-2 py-1"
                    >
                      {user.trend}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
