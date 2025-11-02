import { Card, Badge, ScrollArea } from "@/components/ui";
import { Clock, MessageSquare, Users } from "lucide-react";

interface GameInfoProps {
  currentRound: number;
  currentPhase: string;
  currentSpeaker: {
    name: string;
    content: string;
  };
  historySpeeches: Array<{
    name: string;
    content: string;
  }>;
  eliminatedPlayers: string[];
}

const GameInfo = ({
  currentRound,
  currentPhase,
  currentSpeaker,
  historySpeeches,
  eliminatedPlayers,
}: GameInfoProps) => {
  return (
    <Card className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-slate-100">游戏进度</h3>
            </div>
            <div className="space-y-1">
              <Badge className="bg-amber-500 text-amber-950">
                第 {currentRound} 局
              </Badge>
              <p className="text-sm text-slate-400">{currentPhase}</p>
            </div>
          </div>

          {eliminatedPlayers.length > 0 && (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-red-400" />
                <h3 className="font-bold text-sm text-slate-100">已出局</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {eliminatedPlayers.map((player, index) => (
                  <Badge key={index} variant="outline" className="text-xs text-red-400 border-red-400/30">
                    {player}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-400 animate-pulse" />
              <h3 className="font-bold text-slate-100">本轮发言</h3>
            </div>

            <Card className="p-3 bg-amber-500/10 border-amber-500/30">
              <div className="mb-2">
                <Badge className="text-xs bg-amber-500 text-amber-950">
                  {currentSpeaker.name}
                </Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-650px)]">
                <p className="text-sm text-slate-200 leading-relaxed">
                  {currentSpeaker.content}
                </p>
              </ScrollArea>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-300">历史发言</h3>
            </div>

            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {historySpeeches.map((speech, index) => (
                  <Card key={index} className="p-3 bg-slate-800/50 border-slate-700">
                    <div className="mb-2">
                      <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
                        {speech.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {speech.content}
                    </p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-slate-100">当前票数统计</h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">LLaMA</span>
              <Badge variant="outline" className="text-slate-300 border-slate-600">3票</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">GPT-4</span>
              <Badge variant="outline" className="text-slate-300 border-slate-600">2票</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Claude</span>
              <Badge variant="outline" className="text-slate-300 border-slate-600">1票</Badge>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GameInfo;