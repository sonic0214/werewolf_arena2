import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp } from "lucide-react";

interface BettingPanelProps {
  onClose: () => void;
  wolvesOdds?: number;
  villagersOdds?: number;
}

const BettingPanel = ({
  onClose,
  wolvesOdds = 1.8,
  villagersOdds = 2.1,
}: BettingPanelProps) => {
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<"wolf" | "villager" | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleBet = () => {
    if (!selected || !amount) return;
    
    const teamName = selected === "wolf" ? "狼人" : "平民";
    const odds = selected === "wolf" ? wolvesOdds : villagersOdds;
    
    setToastMessage(`已下注 ${amount} 金币在 ${teamName}胜 (${odds}倍赔率)`);
    setShowToast(true);
    
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-end p-6">
      <Card className="w-96 bg-slate-900/95 border-amber-500/30 shadow-2xl shadow-amber-500/20 animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b border-amber-500/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-amber-400">竞猜下注</h3>
            <p className="text-xs text-slate-400">选择阵营并下注</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-amber-500/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={`
                p-4 cursor-pointer transition-all border-2
                ${selected === "wolf"
                  ? "border-red-500 bg-red-500/20 shadow-lg shadow-red-500/30"
                  : "border-slate-600 hover:border-red-500/50 bg-slate-800/50"
                }
              `}
              onClick={() => setSelected("wolf")}
            >
              <div className="text-center space-y-2">
                <div className="text-3xl">🐺</div>
                <div className="font-bold text-base text-slate-200">狼人阵营</div>
                <Badge className="text-sm font-bold px-3 py-1 bg-red-600 hover:bg-red-700">
                  {wolvesOdds}x赔率
                </Badge>
              </div>
            </Card>

            <Card
              className={`
                p-4 cursor-pointer transition-all border-2
                ${selected === "villager"
                  ? "border-green-500 bg-green-500/20 shadow-lg shadow-green-500/30"
                  : "border-slate-600 hover:border-green-500/50 bg-slate-800/50"
                }
              `}
              onClick={() => setSelected("villager")}
            >
              <div className="text-center space-y-2">
                <div className="text-3xl">👥</div>
                <div className="font-bold text-base text-slate-200">平民阵营</div>
                <Badge className="text-sm font-bold px-3 py-1 bg-green-600 hover:bg-green-700">
                  {villagersOdds}x赔率
                </Badge>
              </div>
            </Card>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-slate-300">
              下注金额
            </label>
            <Input
              type="number"
              placeholder="输入金额"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-300">当前下注情况</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">狼人总注</span>
                <span className="font-mono text-slate-200">12,580</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">平民总注</span>
                <span className="font-mono text-slate-200">18,340</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleBet}
            disabled={!selected || !amount}
            className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            确认下注
          </Button>
        </div>
      </Card>

      {/* 简单的 Toast 提示 */}
      {showToast && (
        <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top duration-300">
          <Card className="bg-green-600 border-green-500 text-white p-4 shadow-lg">
            <div className="font-bold mb-1">下注成功！</div>
            <div className="text-sm">{toastMessage}</div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BettingPanel;

