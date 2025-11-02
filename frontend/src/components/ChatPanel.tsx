import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X } from "lucide-react";

interface Message {
  id: number;
  user: string;
  content: string;
  bet: "wolf" | "villager" | "none";
  timestamp: Date;
}

interface ChatPanelProps {
  onClose?: () => void;
}

const ChatPanel = ({ onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, user: "观众A", content: "这局好精彩！", bet: "villager", timestamp: new Date() },
    { id: 2, user: "观众B", content: "狼人藏得好深", bet: "wolf", timestamp: new Date() },
    { id: 3, user: "观众C", content: "还在观望中", bet: "none", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMessage: Message = {
      id: messages.length + 1,
      user: "我",
      content: input,
      bet: "none",
      timestamp: new Date(),
    };
    
    setMessages([...messages, newMessage]);
    setInput("");
  };

  const getBetBadge = (bet: Message["bet"]) => {
    if (bet === "wolf") {
      return <Badge className="text-xs bg-red-600 hover:bg-red-700">狼人</Badge>;
    }
    if (bet === "villager") {
      return <Badge className="text-xs bg-green-600 hover:bg-green-700">平民</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-slate-600">观望</Badge>;
  };

  return (
    <Card className="flex flex-col h-full bg-slate-900/95 border-amber-500/30 backdrop-blur-md">
      <div className="p-4 border-b border-amber-500/20 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-amber-400">观众互动</h3>
          <p className="text-xs text-slate-400">当前在线：1,234人</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-amber-500/20"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in duration-300">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200">
                      {msg.user}
                    </span>
                    {getBetBadge(msg.bet)}
                  </div>
                  <p className="text-sm text-slate-400 break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-amber-500/20">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="发送消息..."
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            size="sm" 
            className="bg-amber-500 hover:bg-amber-600 text-amber-950 px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ChatPanel;

