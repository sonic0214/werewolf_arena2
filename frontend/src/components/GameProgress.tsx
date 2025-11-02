import { Badge } from "@/components/ui";

interface GameProgressProps {
  currentRound: number;
  gamePhase: string;
  gamePhaseType: string;
  gamePhaseIcon: string;
  currentSpeakerName: string;
  totalPlayers?: number;
  alivePlayers?: number;
}

const GameProgress = ({
  currentRound,
  gamePhase,
  gamePhaseType,
  gamePhaseIcon,
  currentSpeakerName,
  totalPlayers = 6,
  alivePlayers = 6
}: GameProgressProps) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-xl p-3 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：局数和阶段 */}
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className="px-4 py-1.5 bg-slate-800/80 border-amber-600/50 text-amber-400 font-medium whitespace-nowrap"
          >
            第{currentRound}局 · {gamePhase}
          </Badge>
          <Badge 
            className="px-3 py-1.5 bg-red-500/90 border-red-600 text-white font-semibold shadow-lg shadow-red-500/30 whitespace-nowrap"
          >
            <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
            直播中
          </Badge>
        </div>

        {/* 中间：南瓜头图标 */}
        <div className="flex items-center justify-center">
          <div className="text-5xl animate-pulse drop-shadow-2xl">
            🎃
          </div>
        </div>

        {/* 右侧：当前发言提示 */}
        <div className="flex items-center gap-3">
          {gamePhaseType === "讨论" && currentSpeakerName && currentSpeakerName !== "等待发言" ? (
            <div className="px-4 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-lg whitespace-nowrap">
              <span className="text-amber-300 font-medium">
                下面请 {currentSpeakerName} 发言
              </span>
            </div>
          ) : gamePhaseType === "投票" ? (
            <div className="px-4 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg whitespace-nowrap">
              <span className="text-red-300 font-medium">
                投票环节进行中
              </span>
            </div>
          ) : gamePhaseType === "夜晚" ? (
            <div className="px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/40 rounded-lg whitespace-nowrap">
              <span className="text-indigo-300 font-medium">
                {gamePhase}
              </span>
            </div>
          ) : (
            <div className="px-4 py-1.5 bg-slate-700/50 border border-slate-600/40 rounded-lg whitespace-nowrap">
              <span className="text-slate-300 font-medium">
                {currentSpeakerName || "游戏进行中"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameProgress;