import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ModelAvatar from "@/components/ModelAvatar";
import GameInfo from "@/components/GameInfo";
import { ArrowLeft } from "lucide-react";

const Livestream = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [godMode] = useState<"inside" | "outside">(
    (location.state?.godMode as "inside" | "outside") || "outside"
  );
  const [currentSpeaker, setCurrentSpeaker] = useState(0);

  // 模拟轮流发言
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSpeaker((prev) => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const models: Array<{
    id: number;
    name: string;
    role: string;
    status: "alive" | "eliminated";
    votes: number;
  }> = [
    { id: 1, name: "GPT-4", role: "狼人", status: "alive", votes: 2 },
    { id: 2, name: "Claude", role: "平民", status: "alive", votes: 1 },
    { id: 3, name: "Gemini", role: "预言家", status: "eliminated", votes: 0 },
    { id: 4, name: "LLaMA", role: "平民", status: "alive", votes: 3 },
    { id: 5, name: "Mistral", role: "狼人", status: "alive", votes: 0 },
    { id: 6, name: "Qwen", role: "平民", status: "alive", votes: 1 },
  ];

  const speeches = [
    "我认为3号玩家的发言逻辑不太对，可能是狼人在伪装。我建议大家注意观察他后续的表现。",
    "根据我的分析，1号玩家在白天的投票行为很可疑，他一直在引导节奏，这不符合一个平民的正常操作。",
    "昨晚我验证了4号玩家，他的身份是好人。我们应该相信他的发言，并团结起来找出真正的狼人。",
    "我觉得现在最重要的是保持冷静，不要被狼人的节奏带偏。让我们逐一分析每个人的发言和行为。",
    "从投票情况来看，5号玩家一直在避重就轻，没有给出实质性的信息，我怀疑他可能在隐藏身份。",
    "我同意2号的观点，我们需要更多的信息才能做出准确判断。建议预言家在合适的时机站出来引导大家。",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部控制栏 */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <div className="h-6 w-px bg-border" />
            <span className="text-xl font-bold text-primary">
              AI狼人杀直播
            </span>
            <Badge variant="outline" className="bg-destructive/20 border-destructive">
              <div className="w-2 h-2 rounded-full bg-destructive mr-2 animate-pulse" />
              直播中
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {godMode === "outside" ? "🔍 场外上帝" : "👁️ 场内上帝"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              退出可重新选择
            </span>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
          {/* 中间：圆桌布局 */}
          <div className="col-span-8">
            <Card className="h-full bg-gradient-card border-border p-6">
              <div className="relative w-full h-full flex items-center justify-center">
                {/* 圆桌玩家 - 围成一圈 */}
                <div className="relative w-[600px] h-[600px]">
                  {models.map((model, index) => {
                    const angle = (index * 360) / models.length - 90; // -90 to start from top
                    const radius = 240;
                    const x = Math.cos((angle * Math.PI) / 180) * radius;
                    const y = Math.sin((angle * Math.PI) / 180) * radius;

                    return (
                      <div
                        key={model.id}
                        className="absolute top-1/2 left-1/2"
                        style={{
                          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                        }}
                      >
                        <ModelAvatar
                          model={model}
                          isActive={currentSpeaker === index}
                          godMode={godMode}
                          votes={model.votes}
                        />
                      </div>
                    );
                  })}

                  {/* 中间法官 - 南瓜头 */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                    <div className="text-8xl animate-pulse">🎃</div>
                    <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-6 py-3 max-w-[300px]">
                      <p className="text-center text-sm font-medium text-primary">
                        下面请{models[currentSpeaker].name}发言
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 右侧：游戏信息 */}
          <div className="col-span-4">
            <GameInfo
              currentRound={3}
              currentPhase="发言阶段"
              currentSpeaker={{
                name: models[currentSpeaker].name,
                content: speeches[currentSpeaker],
              }}
              historySpeeches={[
                {
                  name: models[(currentSpeaker - 1 + 6) % 6].name,
                  content: speeches[(currentSpeaker - 1 + 6) % 6],
                },
                {
                  name: models[(currentSpeaker - 2 + 6) % 6].name,
                  content: speeches[(currentSpeaker - 2 + 6) % 6],
                },
                {
                  name: models[(currentSpeaker - 3 + 6) % 6].name,
                  content: speeches[(currentSpeaker - 3 + 6) % 6],
                },
                {
                  name: models[(currentSpeaker - 4 + 6) % 6].name,
                  content: speeches[(currentSpeaker - 4 + 6) % 6],
                },
              ]}
              eliminatedPlayers={models
                .filter((m) => m.status === "eliminated")
                .map((m) => m.name)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Livestream;