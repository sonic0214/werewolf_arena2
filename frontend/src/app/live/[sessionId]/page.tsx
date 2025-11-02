'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useGameStore, useCurrentGame, useGameLoading, useGameError, useWebSocketStatus, useGameActions } from '@/lib/store/gameStore';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { GameState, Player } from '@/types/game';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { GameLog, useGameLogs } from '@/components/game/GameLog';
import { GameStats } from '@/components/game/GameStats';
import { GameTimeline, generateTimelineEvents } from '@/components/game/GameTimeline';
import { LiveGameProgress } from '@/components/game/LiveGameProgress';
import { PlayerInteractions, generateInteractions } from '@/components/game/PlayerInteractions';
import { useCallback } from 'react';

export default function LiveGamePage() {
  const params = useParams();
  const router = useRouter();
  // Handle params.sessionId which could be string | string[] | undefined
  const rawSessionId = params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  console.log('[LiveGamePage] sessionId from params:', sessionId, 'type:', typeof sessionId);

  const currentGame = useCurrentGame();
  const loading = useGameLoading();
  const error = useGameError();
  const isWebSocketConnected = useWebSocketStatus();
  const { getGameStatus } = useGameActions();

  // Parse game logs from current game state with error handling
  const gameLogs = useGameLogs(currentGame);

  // Generate timeline events
  const timelineEvents = currentGame ? generateTimelineEvents(currentGame) : [];

  // Generate player interactions
  const playerInteractions = currentGame ? generateInteractions(currentGame) : [];

  // Debug state
  const [debugInfo, setDebugInfo] = useState<string>('-- Initializing --');

  // Use WebSocket for real-time updates
  const websocket = useWebSocket(sessionId);

  // Fetch initial game status
  useEffect(() => {
    if (sessionId) {
      setDebugInfo(`Fetching game status for sessionId: ${sessionId}`);
      setDebugInfo(prev => prev + `\ngetGameStatus function: ${typeof getGameStatus}`);

      // Direct API call for debugging
      fetch(`http://localhost:8000/api/v1/games/${sessionId}`)
        .then(response => response.json())
        .then(data => {
          setDebugInfo(prev => prev + `\nDirect API call result: ${JSON.stringify(data).substring(0, 100)}...`);
        })
        .catch(error => {
          setDebugInfo(prev => prev + `\nDirect API call error: ${error.message}`);
        });

      // Call store function
      try {
        getGameStatus(sessionId);
        setDebugInfo(prev => prev + `\nCalled getGameStatus successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setDebugInfo(prev => prev + `\nError calling getGameStatus: ${errorMessage}`);
      }
    }
  }, [sessionId]); // Remove getGameStatus from dependencies to prevent infinite re-renders

  // Handle WebSocket messages through store
  // The websocket hook will update the game store automatically
  // when it receives messages from the server

  const handleBackToHome = () => {
    // Clear the redirect flag to prevent auto-redirect
    sessionStorage.removeItem('shouldRedirectToGame');
    router.push('/');
  };

  const formatGameTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: zhCN
      });
    } catch {
      return timestamp;
    }
  };

  if (loading === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">加载游戏状态中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-400 mb-4">游戏加载失败</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <Button onClick={handleBackToHome} variant="primary">
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">游戏未找到</h2>
            <p className="text-gray-300 mb-6">游戏会话 {sessionId} 不存在或已结束</p>

            {/* Debug information */}
            <div className="mt-4 p-3 bg-gray-800 rounded text-left">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">调试信息:</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {debugInfo || 'No debug info yet'}
              </pre>
            </div>

            <Button onClick={handleBackToHome} variant="primary" className="mt-4">
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleBackToHome}
                variant="secondary"
                size="sm"
              >
                ← 返回
              </Button>
              <div>
                <h1 className="text-lg font-semibold">狼人杀 - 直播观战</h1>
                <p className="text-sm text-gray-400">房间号: {sessionId}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-300">
                  {isWebSocketConnected ? '实时连接' : '连接断开'}
                </span>
              </div>

              <Badge variant={currentGame?.status === 'running' ? 'success' : 'secondary'}>
                {currentGame?.status === 'running' ? '进行中' :
                 currentGame?.status === 'finished' ? '已结束' : '等待中'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 实时进程 - 全宽 */}
        <div className="mb-8">
          <LiveGameProgress gameState={currentGame} recentLogs={gameLogs.slice(-5)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">

            {/* Game Status */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">游戏状态</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {currentGame?.players?.filter(p => p.alive).length || 0}
                    </div>
                    <div className="text-sm text-gray-400">存活玩家</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">
                      {currentGame?.players?.filter(p => !p.alive).length || 0}
                    </div>
                    <div className="text-sm text-gray-400">淘汰玩家</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {currentGame?.players?.filter(p => p.role === 'werewolf' && p.alive).length || 0}
                    </div>
                    <div className="text-sm text-gray-400">存活狼人</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {currentGame?.current_round?.phase?.number || 0}
                    </div>
                    <div className="text-sm text-gray-400">当前回合</div>
                  </div>
                </div>

                {currentGame?.current_round && (
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="font-semibold mb-2">当前阶段</h3>
                    <div className="flex items-center space-x-4">
                      <Badge variant={currentGame.current_round.phase.type === 'day' ? 'warning' : 'secondary'}>
                        {currentGame.current_round.phase.type === 'day' ? '白天' : '黑夜'}
                      </Badge>
                      <span className="text-gray-300">
                        第 {currentGame.current_round.phase.number} 回合
                      </span>
                      <span className="text-gray-400">
                        {currentGame.current_round.phase.name}
                      </span>
                    </div>
                  </div>
                )}

                {currentGame?.winner && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h3 className="font-semibold mb-2 text-green-400">游戏结束</h3>
                    <p className="text-lg">
                      {currentGame.winner === 'werewolf' ? '狼人' : '好人'}阵营获胜！
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Players Grid */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">玩家状态</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentGame?.players?.map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  )) || <div className="text-gray-500 text-center col-span-2">暂无玩家数据</div>}
                </div>
              </div>
            </Card>

            {/* Player Interactions */}
            <PlayerInteractions
              players={currentGame?.players || []}
              interactions={playerInteractions}
              currentRound={currentGame?.rounds?.length || 0}
            />

            {/* Game Timeline */}
            <GameTimeline events={timelineEvents} maxHeight="600px" />

            {/* Current Round Details */}
            {currentGame?.current_round && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4">当前回合详情</h2>

                  {/* Discussions */}
                  {currentGame.current_round.discussions &&
                   currentGame.current_round.discussions.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3 text-blue-400">讨论发言</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {currentGame.current_round.discussions.map((discussion, index) => (
                          <div key={index} className="bg-gray-800 rounded p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-yellow-400">
                                玩家 {discussion.player_id}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatGameTime(discussion.timestamp)}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm">{discussion.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Votes */}
                  {currentGame.current_round.votes &&
                   currentGame.current_round.votes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3 text-red-400">投票情况</h3>
                      <div className="space-y-2">
                        {currentGame.current_round.votes.map((vote, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-800 rounded p-2">
                            <span className="text-sm">
                              玩家 {vote.voter_id} → 玩家 {vote.target_id}
                            </span>
                            {vote.reason && (
                              <span className="text-xs text-gray-400 italic">
                                "{vote.reason}"
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Night Actions */}
                  {currentGame.current_round.night_actions &&
                   currentGame.current_round.night_actions.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 text-purple-400">夜晚行动</h3>
                      <div className="space-y-2">
                        {currentGame.current_round.night_actions.map((action, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-800 rounded p-2">
                            <span className="text-sm">
                              玩家 {action.player_id} 使用 {action.action}
                              {action.target_id && ` → 玩家 ${action.target_id}`}
                            </span>
                            {action.result && (
                              <span className="text-xs text-green-400">
                                {action.result}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Game Stats */}
            <GameStats gameState={currentGame} />

            {/* Game Logs */}
            <GameLog logs={gameLogs} maxHeight="400px" showFilters={true} />

            {/* Connection Status */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">连接状态</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">WebSocket</span>
                    <Badge variant={isWebSocketConnected ? 'success' : 'danger'}>
                      {isWebSocketConnected ? '已连接' : '未连接'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">自动刷新</span>
                    <Badge variant="success">启用</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Player Card Component
function PlayerCard({ player }: { player: Player }) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'werewolf': return 'text-red-400';
      case 'seer': return 'text-blue-400';
      case 'doctor': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'werewolf': return '狼人';
      case 'seer': return '预言家';
      case 'doctor': return '医生';
      case 'villager': return '村民';
      default: return role;
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${
      player.alive
        ? 'border-gray-700 bg-gray-800/50'
        : 'border-red-900/50 bg-red-900/20'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            player.alive ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div>
            <h3 className="font-semibold">{player.name}</h3>
            <p className={`text-sm ${getRoleColor(player.role)}`}>
              {getRoleName(player.role)}
            </p>
          </div>
        </div>

        <div className="text-right">
          <Badge variant={player.alive ? 'success' : 'danger'} size="sm">
            {player.alive ? '存活' : '淘汰'}
          </Badge>
        </div>
      </div>

      {player.reasoning && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 italic">{player.reasoning}</p>
        </div>
      )}
    </div>
  );
}