import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, ScrollArea } from "@/components/ui";
import ModelAvatar from "@/components/ModelAvatar";
import ChatPanel from "@/components/ChatPanel";
import BettingPanel from "@/components/BettingPanel";
import GameInfo from "@/components/GameInfo";
import GameProgress from "@/components/GameProgress";
import { WebSocketMessageFormatter, FormattedMessage } from "@/lib/websocket-formatter";
import { ArrowLeft, MessageCircle, Zap, Moon, Sun, Users, Skull, Volume2, DollarSign } from "lucide-react";

interface Player {
  id: number;
  name: string;
  role: string;
  status: "alive" | "eliminated";
  votes: number;
}

const LiveGamePage = () => {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [godMode] = useState<"inside" | "outside">("outside");
  const [currentSpeaker, setCurrentSpeaker] = useState<number>(-1); // 初始状态为-1，表示没有活跃发言者
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string>("等待发言");
  const [gamePhase, setGamePhase] = useState<string>("准备中");
  const [gamePhaseType, setGamePhaseType] = useState<string>("等待");
  const [gamePhaseIcon, setGamePhaseIcon] = useState<string>("⏳");
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<string>("");
  const [historySpeeches, setHistorySpeeches] = useState<Array<{name: string, content: string}>>([]);
  const [wsMessages, setWsMessages] = useState<FormattedMessage[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [nightActions, setNightActions] = useState<Array<{player: string, action: string, target?: string}>>([]);
  const [voteRecords, setVoteRecords] = useState<Array<{voter: string, target: string}>>([]);
  const [exiledPlayer, setExiledPlayer] = useState<string>("");
  const [playerSummaries, setPlayerSummaries] = useState<Array<{player: string, summary: string}>>([]);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerName, setWinnerName] = useState<string>("");
  const [showChat, setShowChat] = useState<boolean>(false);
  const [showBetting, setShowBetting] = useState<boolean>(false);

  // 初始化WebSocket连接
  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = `ws://localhost:8000/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket连接已建立");
      setWsConnection(ws);
      const connectionMessage = WebSocketMessageFormatter.formatConnectionMessage("WebSocket连接已建立");
      setWsMessages(prev => [...prev, connectionMessage]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("解析WebSocket消息失败:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket错误:", error);
      const errorMessage = WebSocketMessageFormatter.formatErrorMessage("连接错误");
      setWsMessages(prev => [...prev, errorMessage]);
    };

    ws.onclose = () => {
      console.log("WebSocket连接已关闭");
      setWsConnection(null);
      const closeMessage = WebSocketMessageFormatter.formatCloseMessage();
      setWsMessages(prev => [...prev, closeMessage]);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId]);

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    console.log(`[WebSocket] 收到消息类型: ${data.type}`, data);
    console.log(`[WebSocket] 完整消息数据:`, JSON.stringify(data, null, 2));

    // 使用消息格式化器格式化消息
    const formattedMessage = WebSocketMessageFormatter.formatMessage(data);

    if (formattedMessage) {
      // 添加消息到历史（去重逻辑：检查是否已存在相同内容和时间戳的消息）
      setWsMessages(prev => {
        // 检查最近10条消息中是否有重复（避免遍历所有历史消息）
        const recentMessages = prev.slice(-10);
        const isDuplicate = recentMessages.some(msg => 
          msg.content === formattedMessage.content && 
          msg.type === formattedMessage.type &&
          msg.playerName === formattedMessage.playerName
        );
        
        if (isDuplicate) {
          console.warn(`[消息去重] 检测到重复消息，已过滤:`, formattedMessage.content);
          return prev;
        }
        
        return [...prev, formattedMessage];
      });

      // 同时处理游戏状态更新逻辑
      const { type, data: messageData } = data;

      switch (type) {
        case "phase_change":
          console.log(`[WebSocket] 处理阶段变更:`, messageData);
          handlePhaseChange(messageData);
          break;
        case "debate_turn":
          console.log(`[WebSocket] ✅ 收到发言消息，开始处理:`, messageData);
          console.log(`[WebSocket] player_name: ${messageData?.player_name}, dialogue: ${messageData?.dialogue}`);
          handleDebateTurn(messageData);
          break;
        case "vote_cast":
          console.log(`[WebSocket] 处理投票:`, messageData);
          handleVoteCast(messageData);
          break;
        case "night_action":
          console.log(`[WebSocket] 处理夜晚行动:`, messageData);
          handleNightAction(messageData);
          break;
        case "player_exile":
          console.log(`[WebSocket] 处理玩家放逐:`, messageData);
          handlePlayerExile(messageData);
          break;
        case "player_summary":
          console.log(`[WebSocket] 处理玩家总结:`, messageData);
          handlePlayerSummary(messageData);
          break;
        case "game_update":
          console.log(`[WebSocket] 处理游戏更新:`, messageData);
          handleGameUpdate(messageData);
          break;
        case "game_complete":
          console.log(`[WebSocket] 处理游戏结束:`, messageData);
          handleGameComplete(messageData);
          break;
        default:
          console.log(`[WebSocket] 未处理的消息类型: ${type}`);
      }
    } else {
      console.warn(`[WebSocket] 消息格式化失败:`, data);
    }
  };

  // 处理阶段变更
  const handlePhaseChange = (data: any) => {
    // 如果游戏已结束，忽略阶段变更，保持结束画面不变
    if (gameEnded) {
      console.log(`[阶段变更] 🚫 游戏已结束，忽略阶段变更以保持结束画面`);
      return;
    }

    const { phase, round_number } = data;
    console.log(`[阶段变更] 阶段: ${phase}, 轮数: ${round_number}`);
    setCurrentRound(round_number);

    // 重置发言者状态
    if (phase !== "debate") {
      console.log(`[阶段变更] 重置发言者状态，因为不是发言阶段`);
      setCurrentSpeaker(-1); // 设置为-1表示没有活跃发言者
      setCurrentSpeakerName("");
      setCurrentSpeech("");
    } else {
      console.log(`[阶段变更] 进入发言阶段，清空发言状态等待新发言`);
      setCurrentSpeaker(-1);
      setCurrentSpeakerName("");
      setCurrentSpeech("");
    }

    // 如果从夜晚阶段切换到白天/发言阶段，清空夜晚行动和投票记录
    if (phase === "day" || phase === "debate") {
      console.log(`[阶段变更] 进入白天/发言阶段，清空夜晚行动和旧的投票记录`);
      setNightActions([]);
      setVoteRecords([]);
    }
    
    // 如果进入投票阶段，清空之前的投票记录和票数
    if (phase === "voting") {
      console.log(`[阶段变更] 进入投票阶段，清空投票记录和票数`);
      setVoteRecords([]);
      setPlayers(prev => prev.map(player => ({ ...player, votes: 0 })));
    }

    let phaseText = "";
    let phaseType = "";
    let phaseIcon = "";

    switch (phase) {
      case "night":
        phaseText = "天黑了，请闭眼";
        phaseType = "夜晚";
        phaseIcon = "🌙";
        break;
      case "day":
        phaseText = "天亮了，请睁眼";
        phaseType = "白天";
        phaseIcon = "☀️";
        break;
      case "debate":
        phaseText = "发言阶段";
        phaseType = "讨论";
        phaseIcon = "💬";
        break;
      case "voting":
        phaseText = "投票环节";
        phaseType = "投票";
        phaseIcon = "🗳️";
        break;
      default:
        phaseText = `阶段: ${phase}`;
        phaseType = "未知";
        phaseIcon = "❓";
    }

    console.log(`[阶段变更] 设置状态: gamePhase="${phaseText}", gamePhaseType="${phaseType}", gamePhaseIcon="${phaseIcon}"`);
    setGamePhase(phaseText);
    setGamePhaseType(phaseType);
    setGamePhaseIcon(phaseIcon);
  };

  // 处理发言
  const handleDebateTurn = (data: any) => {
    console.log(`[发言处理] 🎯 开始处理发言消息，data:`, data);

    // 如果游戏已结束，忽略新的发言消息，保持结束画面不变
    if (gameEnded) {
      console.log(`[发言处理] 🚫 游戏已结束，忽略发言消息以保持结束画面`);
      return;
    }

    const { player_name, dialogue } = data;

    if (!player_name || !dialogue) {
      console.error(`[发言处理] ❌ 缺少必要字段! player_name: ${player_name}, dialogue: ${dialogue}`);
      return;
    }

    console.log(`[发言处理] ✅ 收到发言: player_name="${player_name}", dialogue长度=${dialogue?.length || 0}`);
    console.log(`[发言处理] 当前玩家列表长度: ${players.length}`);
    console.log(`[发言处理] 当前玩家列表:`, players.map(p => ({ id: p.id, name: p.name })));

    // 更新历史发言记录
    setHistorySpeeches(prev => [...prev.slice(-4), { name: player_name, content: dialogue }]);

    // ⚠️ 关键：实时更新当前发言者姓名和内容
    console.log(`[发言处理] 🔄 更新状态: currentSpeakerName="${player_name}"`);
    console.log(`[发言处理] 🔄 更新状态: currentSpeech="${dialogue.substring(0, 50)}..."`);
    
    setCurrentSpeakerName(player_name);
    setCurrentSpeech(dialogue);

    // 改进的玩家查找逻辑：支持多种匹配方式
    if (players.length === 0) {
      console.warn(`[发言高亮] ⚠️ 玩家列表为空，无法匹配发言者`);
      setCurrentSpeaker(-1);
      return;
    }

    let playerIndex = -1;

    // 1. 首先尝试精确匹配名称
    playerIndex = players.findIndex(p => p.name === player_name);
    if (playerIndex !== -1) {
      console.log(`[发言高亮] ✅ 精确匹配成功: ${player_name} (索引: ${playerIndex})`);
    } else {
      // 2. 尝试忽略大小写匹配
      playerIndex = players.findIndex(p =>
        p.name.toLowerCase().trim() === player_name.toLowerCase().trim()
      );
      if (playerIndex !== -1) {
        console.log(`[发言高亮] ✅ 忽略大小写匹配成功: ${player_name} -> ${players[playerIndex].name} (索引: ${playerIndex})`);
      } else {
        // 3. 尝试部分匹配（包含关系）
        playerIndex = players.findIndex(p =>
          p.name.includes(player_name) || player_name.includes(p.name)
        );
        if (playerIndex !== -1) {
          console.log(`[发言高亮] ✅ 部分匹配成功: ${player_name} -> ${players[playerIndex].name} (索引: ${playerIndex})`);
        }
      }
    }

    if (playerIndex !== -1) {
      setCurrentSpeaker(playerIndex);
      console.log(`[发言高亮] 🌟 ${player_name} (索引: ${playerIndex}) 开始发言，头像应该亮起`);
      console.log(`[发言高亮] 当前状态: currentSpeaker=${playerIndex}, currentSpeakerName="${player_name}"`);
    } else {
      console.error(`[发言高亮] ❌ 未找到玩家: "${player_name}"`);
      console.error(`[发言高亮] 玩家列表:`, players.map(p => `"${p.name}"`));
      // 如果找不到玩家，重置发言者索引但保留名字和发言
      setCurrentSpeaker(-1);
    }
  };

  // 处理投票
  const handleVoteCast = (data: any) => {
    // 如果游戏已结束，忽略投票消息，保持结束画面不变
    if (gameEnded) {
      console.log(`[投票] 🚫 游戏已结束，忽略投票消息以保持结束画面`);
      return;
    }

    const { voter, target } = data;

    console.log(`[投票] ${voter} 投票给 ${target}`);

    // 先检查是否重复
    setVoteRecords(prev => {
      // 检查是否已存在相同的投票记录
      const isDuplicate = prev.some(record => 
        record.voter === voter && record.target === target
      );
      
      if (isDuplicate) {
        console.warn(`[投票去重] 检测到重复投票，已过滤: ${voter} → ${target}`);
        return prev;
      }
      
      // 不重复，添加新投票记录
      const newRecords = [...prev, { voter, target }];
      
      // 同时更新玩家票数
      setPlayers(prevPlayers => prevPlayers.map(player => {
      if (player.name === target) {
        return { ...player, votes: player.votes + 1 };
      }
      return player;
    }));
      
      return newRecords;
    });
  };

  // 处理夜晚行动
  const handleNightAction = (data: any) => {
    // 如果游戏已结束，忽略夜晚行动，保持结束画面不变
    if (gameEnded) {
      console.log(`[夜晚行动] 🚫 游戏已结束，忽略夜晚行动以保持结束画面`);
      return;
    }

    console.log(`[夜晚行动] 收到行动消息:`, data);

    const { action_type, player_name, target_name, role } = data;
    
    // 构建行动描述 - 与系统消息格式一致，不显示玩家名字
    let actionText = "";
    
    if (action_type === "night_eliminate") {
      actionText = `🐺 狼人打算杀害${target_name}`;
    } else if (action_type === "night_protect") {
      actionText = `⚕️ 医生保护${target_name}`;
    } else if (action_type === "night_investigate") {
      actionText = `🔮 预言家查验${target_name}`;
    } else {
      actionText = `${role || '未知角色'} 对 ${target_name || '未知目标'} 进行了行动`;
    }
    
    // 添加到夜晚行动列表（保留最近5条，并去重）
    setNightActions(prev => {
      // 检查是否已存在相同的行动
      const isDuplicate = prev.some(action => 
        action.player === player_name && 
        action.target === target_name &&
        action.action === actionText
      );
      
      if (isDuplicate) {
        console.warn(`[夜晚行动去重] 检测到重复行动，已过滤: ${actionText}`);
        return prev;
      }
      
      // 添加新行动，保留最近5条
      return [...prev.slice(-4), {
        player: player_name,
        action: actionText,
        target: target_name
      }];
    });
  };

  // 处理玩家放逐
  const handlePlayerExile = (data: any) => {
    console.log(`[玩家放逐] 收到放逐消息:`, data);
    const { exiled_player } = data;
    setExiledPlayer(exiled_player);
    // 清空总结列表，准备接收新的总结
    setPlayerSummaries([]);
  };

  // 处理玩家总结
  const handlePlayerSummary = (data: any) => {
    console.log(`[玩家总结] 收到总结消息:`, data);
    const { player_name, summary } = data;
    
    setPlayerSummaries(prev => {
      // 检查是否已存在该玩家的总结
      const isDuplicate = prev.some(s => s.player === player_name);
      
      if (isDuplicate) {
        console.warn(`[玩家总结去重] 检测到重复总结，已过滤: ${player_name}`);
        return prev;
      }
      
      // 添加新总结
      return [...prev, {
        player: player_name,
        summary: summary
      }];
    });
  };

  // 处理游戏结束
  const handleGameComplete = (data: any) => {
    console.log(`[游戏结束] 收到游戏结束消息:`, data);
    console.log(`[游戏结束] winner_name 类型:`, typeof data.winner_name);
    console.log(`[游戏结束] winner_name 值:`, data.winner_name);

    const { winner, winner_name, players_info } = data;

    setGameEnded(true);
    setWinner(winner);

    // 确保 winnerName 是字符串类型，防止设置为对象
    if (typeof winner_name === 'string') {
      setWinnerName(winner_name);
    } else if (winner_name && typeof winner_name === 'object') {
      // 如果 winner_name 是对象，尝试从中提取合适的文本
      const nameText = winner_name.name || winner_name.display_name || winner_name.toString();
      setWinnerName(nameText);
    } else {
      // 回退到默认值
      setWinnerName(winner || '未知获胜方');
    }
    
    // 更新玩家列表，显示真实角色
    if (players_info) {
      setPlayers(prev => prev.map(player => {
        const info = players_info[player.name];
        if (info) {
          return {
            ...player,
            role: info.role,
            status: info.alive ? "alive" : "eliminated"
          };
        }
        return player;
      }));
    }
  };

  // 处理游戏更新
  const handleGameUpdate = (data: any) => {
    console.log(`[游戏更新] 🎮 收到game_update消息`);
    const { game_state } = data;
    
    if (game_state && game_state.players) {
      console.log(`[游戏更新] 玩家数据类型:`, typeof game_state.players);
      console.log(`[游戏更新] 玩家数据原始内容:`, JSON.stringify(game_state.players, null, 2));
      
      setPlayers(prevPlayers => {
        // 如果是首次初始化（玩家列表为空），直接创建新列表
        if (prevPlayers.length === 0) {
          const newPlayers: Player[] = Object.entries(game_state.players).map(([key, player]: [string, any], index: number) => {
            const playerName = key;
            const playerId = index + 1;
            
            console.log(`[玩家初始化] ✅ Name="${playerName}", ID=${playerId}, Role=${player?.role}, Alive=${player?.alive}`);

        return {
          id: playerId,
          name: playerName,
              role: player?.role || "未知",
              status: player?.alive !== false ? "alive" : "eliminated",
          votes: 0,
        };
          });
          
          console.log(`[玩家初始化] 🎉 总共初始化了 ${newPlayers.length} 个玩家`);
          return newPlayers;
        }
        
        // 如果玩家已存在，只更新状态和角色信息，保留票数和ID
        const updatedPlayers = prevPlayers.map(prevPlayer => {
          const backendPlayer = game_state.players[prevPlayer.name];
          
          if (backendPlayer) {
            const newStatus = backendPlayer.alive !== false ? "alive" : "eliminated";
            
            // 如果状态发生变化，输出日志
            if (prevPlayer.status !== newStatus) {
              console.log(`[状态更新] ${prevPlayer.name}: ${prevPlayer.status} → ${newStatus}`);
            }
            
            return {
              ...prevPlayer,
              role: backendPlayer.role || prevPlayer.role,
              status: newStatus,
            };
          }
          
          return prevPlayer;
        });
        
        console.log(`[游戏更新] 🔄 更新了 ${updatedPlayers.length} 个玩家状态`);
        return updatedPlayers;
      });
    } else {
      console.warn(`[游戏更新] ⚠️ 没有收到有效的game_state或players数据`);
    }
  };

  // 处理日志更新
  const handleLogUpdate = (data: any) => {
    // 日志更新由WebSocket消息格式化器处理
  };

  // 格式化消息显示
  const formatMessageDisplay = (message: FormattedMessage) => {
    const isImportant = WebSocketMessageFormatter.isImportantMessage(message);
    const hasMultiLine = message.content.includes('\n');

    return (
      <div className={`flex items-start gap-2 p-3 rounded hover:bg-slate-800/50 ${
        isImportant ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
      }`}>
        <span className="text-sm mt-1">{message.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${
            isImportant ? 'font-semibold text-amber-400' : 'text-slate-300'
          }`}>
            {hasMultiLine ? (
              // 多行内容：第一行正常显示，详细信息缩进显示
              message.content.split('\n').map((line, index) => (
                <div key={index} className={index > 0 ? 'mt-1 text-xs text-slate-400 italic ml-2' : ''}>
                  {line}
                </div>
              ))
            ) : (
              // 单行内容正常显示
              message.content
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {message.timestamp}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url(/central_background.jpg)' }}
    >
      {/* 顶部控制栏 */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Clear the redirect flag to prevent auto-redirect
                sessionStorage.removeItem('shouldRedirectToGame');
                router.push("/");
              }}
              className="gap-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <div className="h-6 w-px bg-slate-700" />
            <span className="text-xl font-bold text-amber-400">
              AI狼人杀直播
            </span>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="container mx-auto px-4 py-6">
        {/* 游戏进度卡片 - 顶部全宽 */}
        <div className="mb-4">
          <GameProgress
            currentRound={currentRound}
            gamePhase={gamePhase}
            gamePhaseType={gamePhaseType}
            gamePhaseIcon={gamePhaseIcon}
            currentSpeakerName={currentSpeakerName}
            totalPlayers={players.length}
            alivePlayers={players.filter(p => p.status === "alive").length}
          />
        </div>

        {/* 左中右三列布局 */}
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：玩家1-3 */}
          <div className="col-span-2">
            <div className="space-y-4">
                  {players.length > 0 ? (
                players
                  .map((player, originalIndex) => ({ player, originalIndex }))
                  .slice(0, Math.ceil(players.length / 2))
                  .map(({ player, originalIndex }) => {
                    const isActive = currentSpeaker >= 0 && currentSpeaker === originalIndex;
                    
                    // 调试日志
                    if (isActive) {
                      console.log(`[左侧高亮] 🌟 玩家 ${player.name} (原始索引${originalIndex}) 正在发言，卡片应该高亮`);
                      console.log(`[左侧高亮] currentSpeaker=${currentSpeaker}, player.name="${player.name}"`);
                    }

                      return (
                        <div
                        key={`player-left-${player.id || originalIndex}`}
                        className={`transition-all duration-500 ease-out ${
                          isActive ? 'scale-110 translate-x-3' : ''
                        }`}
                      >
                      <Card className={`p-4 relative overflow-hidden ${
                        isActive 
                          ? 'border-4 border-amber-400 shadow-2xl shadow-amber-500/60 bg-gradient-to-br from-amber-500/40 to-amber-900/40 ring-4 ring-amber-400/30' 
                          : player.status === 'eliminated'
                          ? 'border-2 border-slate-700 opacity-40 bg-slate-800/30'
                          : 'border-2 border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:shadow-lg transition-all'
                      }`}>
                        {/* 多层发光边框效果 */}
                        {isActive && (
                          <>
                            {/* 外层快速脉冲 */}
                            <div className="absolute -inset-1 border-4 border-amber-300/60 rounded-lg animate-ping" />
                            {/* 中层慢速脉冲 */}
                            <div className="absolute -inset-0.5 border-2 border-amber-400/40 rounded-lg animate-pulse" />
                            {/* 顶部光带 */}
                            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-300 to-transparent animate-pulse" />
                            {/* 底部光带 */}
                            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-300 to-transparent animate-pulse" />
                            {/* 左侧光带 */}
                            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-transparent via-amber-300 to-transparent animate-pulse" />
                          </>
                        )}
                        
                        <div className="flex flex-col items-center gap-3 relative z-10">
                          <ModelAvatar
                            model={player}
                            isActive={isActive}
                            godMode={godMode}
                            votes={player.votes || 0}
                            showRole={gameEnded}
                          />
                          {isActive && (
                            <div className="text-center mt-2">
                              <div className="px-2 py-1 bg-amber-400/20 rounded-lg border border-amber-400/40">
                                <div className="text-xs text-amber-200 font-extrabold animate-pulse flex items-center justify-center gap-1.5">
                                  <div className="w-2 h-2 bg-amber-300 rounded-full animate-ping" />
                                  <Volume2 className="w-3 h-3" />
                                  发言中
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                        </div>
                      );
                    })
                  ) : (
                <div className="text-slate-400 text-center text-sm">等待玩家...</div>
              )}
            </div>
          </div>

          {/* 中间：本轮发言区域 */}
          <div className="col-span-8">
            <Card className="h-[700px] bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/80 border-slate-700 shadow-2xl">
              <div className="h-full flex flex-col">
                {/* 发言区标题 */}
                <div className="p-4 border-b border-amber-500/30 bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{gamePhaseIcon}</div>
                      <div>
                        <h3 className="font-bold text-lg text-amber-400">{gamePhase}</h3>
                        <p className="text-sm text-slate-400">第 {currentRound} 轮</p>
                      </div>
                    </div>
                    {currentSpeaker >= 0 && currentSpeakerName !== "等待发言" && (
                      <Badge className="bg-amber-500/30 text-amber-200 border-amber-400/50 shadow-lg shadow-amber-500/20">
                        <div className="w-2 h-2 bg-amber-300 rounded-full mr-2 animate-pulse" />
                        {currentSpeakerName} 发言中
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 发言内容区域 */}
                <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                  {/* 调试信息 */}
                  {console.log(`[渲染] gameEnded=${gameEnded}, gamePhaseType="${gamePhaseType}", currentSpeech=${!!currentSpeech}, currentSpeaker=${currentSpeaker}, voteRecords=${voteRecords.length}, nightActions=${nightActions.length}`)}
                  
                  {gameEnded ? (
                    // 游戏结束 - 简化显示获胜信息
                    <div className="w-full max-w-3xl text-center space-y-6 animate-in fade-in duration-700">
                      {/* 简化的获胜信息卡片 */}
                      <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-2 border-amber-400/60 rounded-2xl p-8 shadow-2xl">
                        {/* 适配对话框的图标大小 */}
                        <div className="text-6xl mb-4 animate-bounce">
                          {winner === "Werewolves" ? "🐺" : "👥"}
                        </div>

                        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                          游戏结束
                        </h2>

                        {/* 简化获胜方显示 */}
                        <div className="text-2xl font-bold text-amber-200 mb-4">
                          🎉 {winner === "Werewolves" ? "狼人阵营" : "好人阵营"} 获胜！🎉
                        </div>

                        {/* 简化游戏信息 */}
                        <div className="text-slate-300 text-base">
                          第 {currentRound} 轮 · 存活 {players.filter(p => p.status === "alive").length}/{players.length} 人
                        </div>
                      </div>

                      {/* 简化的角色结果 */}
                      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-600/50 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-amber-300 mb-4">角色分布</h3>
                        <div className="flex justify-center gap-6">
                          {(() => {
                            const roleStats = players.reduce((acc, player) => {
                              acc[player.role] = (acc[player.role] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>);

                            const roleIcons: Record<string, string> = {
                              "Werewolf": "🐺",
                              "Seer": "🔮",
                              "Doctor": "⚕️",
                              "Villager": "👤"
                            };

                            return Object.entries(roleStats).map(([role, count]) => (
                              <div key={role} className="text-center">
                                <div className="text-2xl mb-1">{roleIcons[role] || "❓"}</div>
                                <div className="text-sm text-slate-400">{count}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* 提示信息 */}
                      <div className="text-slate-400 text-sm animate-pulse">
                        游戏已结束，查看左右两侧了解玩家真实身份
                      </div>
                    </div>
                  ) : currentSpeech && currentSpeakerName ? (
                    <div className="w-full max-w-5xl animate-in fade-in duration-500">
                      {/* 发言者头像区域 - 居中大头像 */}
                      <div className="flex flex-col items-center mb-6">
                        {(() => {
                          // 通过姓名查找当前发言玩家
                          const speakingPlayer = currentSpeakerName ?
                            players.find(p => p.name === currentSpeakerName) : null;

                          if (speakingPlayer) {
                            // 找到了玩家，显示原始照片头像
                            return (
                              <div className="relative">
                                {/* 头像容器 - 原始照片加圆边框 */}
                                <div className="w-20 h-20 rounded-full border-4 border-amber-400 shadow-lg overflow-hidden bg-white speaking-border-animate">
                                  {speakingPlayer.avatar ? (
                                    <img
                                      src={speakingPlayer.avatar}
                                      alt={speakingPlayer.name}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600">
                                      {speakingPlayer.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}

                                  {/* 发言状态指示器 */}
                                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
                                </div>
                              </div>
                            );
                          } else {
                            // 没找到玩家，显示通用头像
                            return (
                              <div className="relative">
                                <div className="w-20 h-20 rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-500/30 to-yellow-500/30 flex items-center justify-center">
                                  <Volume2 className="w-10 h-10 text-amber-400" />
                                </div>
                              </div>
                            );
                          }
                        })()}

                        {/* 发言者名字 */}
                        <div className="mt-6 flex items-center gap-3">
                          <Volume2 className="w-5 h-5 text-amber-400 animate-pulse" />
                          <h3 className="text-xl font-bold text-amber-300">
                            {currentSpeakerName}
                          </h3>
                        </div>
                      </div>

                      {/* 发言内容卡片 - 金黄色主题 */}
                      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-2 border-amber-500/40 rounded-2xl p-10 shadow-2xl relative overflow-hidden">
                        {/* 发光背景效果 */}
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 animate-pulse" />

                        {/* 顶部装饰条 */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-500/50" />

                        {/* 左侧装饰条 */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/50" />

                        {/* 发言内容 */}
                        <div className="relative z-10">
                          <p className="text-slate-100 text-lg leading-relaxed whitespace-pre-wrap text-center">
                            {currentSpeech}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 没有发言时，显示系统信息
                    <div className="flex items-center justify-center h-full p-8">
                      <div className="w-full max-w-3xl">
                        {gamePhaseType === "投票" ? (
                          // 投票阶段 - 实时投票结果
                          <div className="space-y-4 animate-in fade-in duration-500">
                            {/* 标题 */}
                            <div className="text-center">
                              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl px-5 py-2">
                                <span className="text-3xl">🗳️</span>
                                <div className="text-left">
                                  <h3 className="text-xl font-bold text-red-400">{gamePhase}</h3>
                                  <p className="text-xs text-red-300">第 {currentRound} 轮 · {voteRecords.length}/{players.filter(p => p.status === 'alive').length} 票</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* 统一看板 */}
                            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
                              {/* 得票排行 */}
                              <div className="mb-3">
                                <h4 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-2">
                                  <span>📊</span>
                                  <span>得票统计</span>
                                </h4>
                                <div className="space-y-2">
                                  {players
                                    .filter(p => p.votes > 0)
                                    .sort((a, b) => b.votes - a.votes)
                                    .map((player, index) => (
                                      <div 
                                        key={player.id}
                                        className="bg-slate-800/40 border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between hover:border-red-400/40 transition-all"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-red-400 font-bold text-sm w-4">#{index + 1}</span>
                                          <span className="text-slate-200 font-medium text-sm">{player.name}</span>
                                        </div>
                                        <Badge variant="destructive" className="font-bold text-xs px-2 py-0">
                                          {player.votes} 票
                                        </Badge>
                                      </div>
                                    ))}
                                  {players.filter(p => p.votes > 0).length === 0 && (
                                    <div className="text-center text-slate-400 py-4">
                                      <p className="text-xs">等待玩家投票...</p>
                                    </div>
                                  )}
                      </div>
                    </div>

                              {/* 投票记录 */}
                              {voteRecords.length > 0 && (
                                <div className="pt-3 border-t border-red-500/20">
                                  <h4 className="text-sm font-bold text-orange-300 mb-2 flex items-center gap-2">
                                    <span>📝</span>
                                    <span>投票记录</span>
                                  </h4>
                                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {voteRecords.map((record, index) => (
                                      <div 
                                        key={index}
                                        className="inline-flex items-center gap-1.5 bg-slate-800/30 border border-orange-500/20 rounded-lg px-2 py-1 text-xs animate-in fade-in duration-300"
                                      >
                                        <span className="text-amber-300 font-medium">{record.voter}</span>
                                        <span className="text-slate-500">→</span>
                                        <span className="text-red-300 font-medium">{record.target}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : nightActions.length > 0 ? (
                          // 显示夜晚行动
                          <div className="space-y-4">
                            <div className="text-center mb-6">
                              <h3 className="text-2xl font-bold text-amber-400 mb-2">🌙 夜晚行动</h3>
                              <p className="text-slate-400 text-sm">场外上帝视角</p>
                            </div>
                            {nightActions.map((action, index) => (
                              <div 
                                key={index}
                                className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-2 border-indigo-500/30 rounded-xl p-5 animate-in fade-in duration-300 hover:border-indigo-400/50 transition-all"
                              >
                                <p className="text-slate-100 text-xl leading-relaxed">
                                  {action.action}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : gamePhaseType === "夜晚" ? (
                          // 夜晚阶段系统信息
                          <div className="text-center space-y-6 animate-in fade-in duration-500">
                            <div className="text-8xl mb-6 animate-pulse">🌙</div>
                            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-2 border-indigo-500/40 rounded-2xl p-8">
                              <h3 className="text-3xl font-bold text-indigo-400 mb-4">{gamePhase}</h3>
                              <p className="text-slate-300 text-lg">天黑请闭眼...</p>
                              <div className="mt-6 flex items-center justify-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                                <p className="text-indigo-400 text-sm font-medium">第 {currentRound} 轮</p>
                              </div>
                            </div>
                          </div>
                        ) : gamePhase === "天亮了" || gamePhaseType === "白天" ? (
                          // 白天阶段系统信息
                          <div className="text-center space-y-6 animate-in fade-in duration-500">
                            <div className="text-8xl mb-6 animate-bounce">☀️</div>
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/40 rounded-2xl p-8">
                              <h3 className="text-3xl font-bold text-yellow-400 mb-4">{gamePhase}</h3>
                              <p className="text-slate-300 text-lg">天亮了，请睁眼...</p>
                              <div className="mt-6 flex items-center justify-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                                <p className="text-yellow-400 text-sm font-medium">第 {currentRound} 轮</p>
                              </div>
                            </div>
                          </div>
                        ) : gamePhaseType === "讨论" && gamePhase !== "准备中" ? (
                          // 讨论阶段等待发言
                          <div className="text-center space-y-6 animate-in fade-in duration-500">
                            <div className="text-8xl mb-6 animate-pulse">💬</div>
                            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-2 border-amber-500/40 rounded-2xl p-8">
                              <h3 className="text-3xl font-bold text-amber-400 mb-4">{gamePhase}</h3>
                              <p className="text-slate-300 text-lg">等待玩家发言...</p>
                              <div className="mt-6 flex items-center justify-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                                <p className="text-amber-400 text-sm font-medium">第 {currentRound} 轮</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // 默认状态
                          <div className="text-center space-y-6 animate-in fade-in duration-500">
                            <div className="text-8xl mb-6 animate-pulse">🎃</div>
                            <div className="bg-gradient-to-r from-slate-700/30 to-slate-600/30 border-2 border-slate-600/40 rounded-2xl p-8">
                              <h3 className="text-2xl font-bold text-slate-400 mb-4">{gamePhase}</h3>
                              <p className="text-slate-500 text-sm">游戏进行中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* 右侧：玩家4-6 */}
          <div className="col-span-2">
            <div className="space-y-4">
              {players.length > 0 ? (
                players
                  .map((player, originalIndex) => ({ player, originalIndex }))
                  .slice(Math.ceil(players.length / 2))
                  .map(({ player, originalIndex }) => {
                    const isActive = currentSpeaker >= 0 && currentSpeaker === originalIndex;
                    
                    // 调试日志
                    if (isActive) {
                      console.log(`[右侧高亮] 🌟 玩家 ${player.name} (原始索引${originalIndex}) 正在发言，卡片应该高亮`);
                      console.log(`[右侧高亮] currentSpeaker=${currentSpeaker}, player.name="${player.name}"`);
                    }
                    
                    return (
                      <div
                        key={`player-right-${player.id || originalIndex}`}
                        className={`transition-all duration-500 ease-out ${
                          isActive ? 'scale-110 -translate-x-3' : ''
                        }`}
                      >
                      <Card className={`p-4 relative overflow-hidden ${
                        isActive 
                          ? 'border-4 border-amber-400 shadow-2xl shadow-amber-500/60 bg-gradient-to-br from-amber-500/40 to-amber-900/40 ring-4 ring-amber-400/30' 
                          : player.status === 'eliminated'
                          ? 'border-2 border-slate-700 opacity-40 bg-slate-800/30'
                          : 'border-2 border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:shadow-lg transition-all'
                      }`}>
                        {/* 多层发光边框效果 */}
                        {isActive && (
                          <>
                            {/* 外层快速脉冲 */}
                            <div className="absolute -inset-1 border-4 border-amber-300/60 rounded-lg animate-ping" />
                            {/* 中层慢速脉冲 */}
                            <div className="absolute -inset-0.5 border-2 border-amber-400/40 rounded-lg animate-pulse" />
                            {/* 顶部光带 */}
                            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-300 to-transparent animate-pulse" />
                            {/* 底部光带 */}
                            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-300 to-transparent animate-pulse" />
                            {/* 右侧光带 */}
                            <div className="absolute top-0 right-0 bottom-0 w-2 bg-gradient-to-b from-transparent via-amber-300 to-transparent animate-pulse" />
                          </>
                        )}
                        
                        <div className="flex flex-col items-center gap-3 relative z-10">
                          <ModelAvatar
                            model={player}
                            isActive={isActive}
                            godMode={godMode}
                            votes={player.votes || 0}
                            showRole={gameEnded}
                          />
                          {isActive && (
                            <div className="text-center mt-2">
                              <div className="px-2 py-1 bg-amber-400/20 rounded-lg border border-amber-400/40">
                                <div className="text-xs text-amber-200 font-extrabold animate-pulse flex items-center justify-center gap-1.5">
                                  <div className="w-2 h-2 bg-amber-300 rounded-full animate-ping" />
                                  <Volume2 className="w-3 h-3" />
                                  发言中
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-400 text-center text-sm">等待玩家...</div>
              )}
            </div>
          </div>
        </div>

        {/* 底部：WebSocket消息记录区域 */}
        <div className="mt-6">
          <Card className="h-[300px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-slate-100">游戏消息记录</h3>
              </div>
              <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">
                {WebSocketMessageFormatter.filterGameMessages(wsMessages).length} 条消息
              </Badge>
            </div>

            <ScrollArea className="h-[240px] p-4">
              <div className="space-y-1">
                {/** 过滤系统消息，只显示重要游戏行动 */}
                {WebSocketMessageFormatter.filterGameMessages(wsMessages).map((message) => (
                  <div key={message.id}>
                    {formatMessageDisplay(message)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* 右下角浮动按钮组 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <Button
          onClick={() => setShowChat(!showChat)}
          className="rounded-full w-14 h-14 shadow-2xl shadow-amber-500/40 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 transition-all duration-300 hover:scale-110"
          size="icon"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
        <Button
          onClick={() => setShowBetting(!showBetting)}
          className="rounded-full w-14 h-14 shadow-2xl shadow-green-500/40 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-green-950 transition-all duration-300 hover:scale-110"
          size="icon"
        >
          <DollarSign className="w-6 h-6" />
        </Button>
      </div>

      {/* 聊天面板浮窗 */}
      {showChat && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] animate-in slide-in-from-right duration-300">
          <ChatPanel onClose={() => setShowChat(false)} />
        </div>
      )}

      {/* 下注面板浮窗 */}
      {showBetting && (
        <BettingPanel
          onClose={() => setShowBetting(false)}
          wolvesOdds={1.8}
          villagersOdds={2.1}
        />
      )}
    </div>
  );
};

export default LiveGamePage;