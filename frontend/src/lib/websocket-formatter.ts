/**
 * WebSocket消息格式化器
 * 将原始WebSocket消息格式化为直观的游戏信息
 */

export interface FormattedMessage {
  id: string;
  timestamp: string;
  type: 'phase' | 'speech' | 'vote' | 'action' | 'system' | 'error';
  content: string;
  playerName?: string;
  targetName?: string;
  icon: string;
  colorClass: string;
  isSystemMessage?: boolean; // 标记是否为系统消息，用于过滤
}

// 游戏消息类型配置 - 定义哪些消息应该在游戏记录中显示
const GAME_MESSAGE_TYPES = {
  // 在游戏记录中显示的消息类型（重要游戏行动）
  DISPLAY: new Set([
    'debate_turn',
    'vote_cast',
    'night_action',
    'phase_change',
    'player_action',
    'player_exile',
    'player_summary',
    'round_complete',
    'game_complete',
    'connection_established',
    'error'
  ]),
  // 过滤掉的消息类型（系统消息）
  FILTER: new Set([
    'game_update',
    'ping',
    'pong',
    'status_update'
  ])
};

export class WebSocketMessageFormatter {
  /**
   * 判断消息是否应该在游戏记录中显示
   */
  static shouldDisplayMessage(messageType: string): boolean {
    return GAME_MESSAGE_TYPES.DISPLAY.has(messageType);
  }

  /**
   * 判断是否为系统消息（需要过滤）
   */
  static isSystemMessage(messageType: string): boolean {
    return GAME_MESSAGE_TYPES.FILTER.has(messageType);
  }

  /**
   * 格式化WebSocket消息
   */
  static formatMessage(data: any): FormattedMessage | null {
    if (!data || !data.type) return null;

    const { type, data: messageData, timestamp } = data;
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    switch (type) {
      case 'connection_established':
        return this.formatConnectionEstablished(messageData, messageId);

      case 'phase_change':
        return this.formatPhaseChange(messageData, messageId);

      case 'debate_turn':
        return this.formatDebateTurn(messageData, messageId);

      case 'vote_cast':
        return this.formatVoteCast(messageData, messageId);

      case 'night_action':
        return this.formatNightAction(messageData, messageId);

      case 'player_action':
        return this.formatPlayerAction(messageData, messageId);

      case 'player_exile':
        return this.formatPlayerExile(messageData, messageId);

      case 'player_summary':
        return this.formatPlayerSummary(messageData, messageId);

      case 'game_update':
        return this.formatGameUpdate(messageData, messageId);

      case 'round_complete':
        return this.formatRoundComplete(messageData, messageId);

      case 'game_complete':
        return this.formatGameComplete(messageData, messageId);

      default:
        return this.formatUnknownMessage(type, messageData, messageId);
    }
  }

  /**
   * 格式化连接建立消息
   */
  private static formatConnectionEstablished(data: any, messageId: string): FormattedMessage {
    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: `🔗 游戏会话已连接: ${data.session_id}`,
      icon: '🔗',
      colorClass: 'text-blue-500',
      isSystemMessage: true
    };
  }

  /**
   * 格式化阶段变更消息
   */
  private static formatPhaseChange(data: any, messageId: string): FormattedMessage {
    const { phase, round_number } = data;
    let content = '';
    let icon = '';

    switch (phase) {
      case 'night':
        content = `🌙 天黑了，请闭眼... (第${round_number}轮)`;
        icon = '🌙';
        break;
      case 'day':
        content = `☀️ 天亮了，请睁眼... (第${round_number}轮)`;
        icon = '☀️';
        break;
      case 'debate':
        content = `💬 发言阶段开始 (第${round_number}轮)`;
        icon = '💬';
        break;
      case 'voting':
        content = `🗳️ 投票环节开始 (第${round_number}轮)`;
        icon = '🗳️';
        break;
      case 'night_kill':
        content = `🌃 夜晚行动开始 (第${round_number}轮)`;
        icon = '🌃';
        break;
      default:
        content = `📢 阶段变更: ${phase} (第${round_number}轮)`;
        icon = '📢';
    }

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'phase',
      content,
      icon,
      colorClass: 'text-green-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化发言消息
   */
  private static formatDebateTurn(data: any, messageId: string): FormattedMessage {
    const { player_name, dialogue } = data;

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'speech',
      content: `💬 ${player_name}发言: ${dialogue}`,
      playerName: player_name,
      icon: '💬',
      colorClass: 'text-purple-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化投票消息
   */
  private static formatVoteCast(data: any, messageId: string): FormattedMessage {
    const { voter, target } = data;

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'vote',
      content: `🗳️ ${voter}投票给${target}`,
      playerName: voter,
      targetName: target,
      icon: '🗳️',
      colorClass: 'text-orange-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化夜晚行动消息
   */
  private static formatNightAction(data: any, messageId: string): FormattedMessage {
    const { action_type, player_name, target_name, details } = data;

    let content = '';
    let icon = '';

    switch (action_type) {
      case 'werewolf_kill':
      case 'eliminate':
      case 'night_eliminate':
        content = `🐺 狼人杀了${target_name}`;
        icon = '🐺';
        break;
      case 'doctor_protect':
      case 'protect':
      case 'night_protect':
        content = `👨‍⚕️ 医生保护了${target_name}`;
        icon = '👨‍⚕️';
        break;
      case 'seer_investigate':
      case 'investigate':
      case 'night_investigate':
        content = `🔮 预言家查验了${target_name}${details?.investigation_result ? `，发现是${details.investigation_result}` : ''}`;
        icon = '🔮';
        break;
      case 'hunter_shoot':
        content = `🏹 猎人开枪射杀了${target_name}`;
        icon = '🏹';
        break;
      case 'guard_protect':
        content = `🛡️ 守卫守护了${target_name}`;
        icon = '🛡️';
        break;
      default:
        content = `⚡ ${player_name}执行了${action_type}`;
        icon = '⚡';
    }

    // 添加详细的action和reasoning信息
    if (details?.action || details?.reasoning) {
      const actionInfo = details.action ? `行动: ${details.action}` : '';
      const reasoningInfo = details.reasoning ? `推理: ${details.reasoning}` : '';

      if (actionInfo || reasoningInfo) {
        content += '\n';
        if (actionInfo) {
          content += `  ${actionInfo}`;
        }
        if (reasoningInfo) {
          content += (actionInfo ? '\n' : '  ') + `💭 ${reasoningInfo}`;
        }
      }
    }

    // 如果是错误类型，添加错误信息
    if (action_type === 'error' && details?.action) {
      content = `❌ ${player_name}: ${details.action}`;
      icon = '❌';
      if (details?.reason) {
        content += `\n原因: ${details.reason}`;
      }
    }

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'action',
      content,
      playerName: player_name,
      targetName: target_name,
      icon,
      colorClass: action_type === 'error' ? 'text-red-600' : 'text-red-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化玩家行动消息
   */
  private static formatPlayerAction(data: any, messageId: string): FormattedMessage {
    const { action_type, player_name, player_role, target_name, details } = data;

    let content = '';
    let icon = '';

    switch (action_type) {
      case 'night_eliminate':
        content = `🐺 狼人选择击杀目标`;
        icon = '🐺';
        break;
      case 'night_protect':
        content = `⚕️ 医生选择保护目标`;
        icon = '⚕️';
        break;
      case 'night_investigate':
        content = `🔮 预言家选择查验目标`;
        icon = '🔮';
        break;
      case 'bid':
        content = `💰 ${player_name}竞价发言权`;
        icon = '💰';
        break;
      default:
        content = `⚡ ${player_name}执行了${action_type}`;
        icon = '⚡';
    }

    if (target_name) {
      content += ` (目标: ${target_name})`;
    }

    if (details?.action) {
      content += `\n📝 ${details.action}`;
    }

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'action',
      content,
      playerName: player_name,
      targetName: target_name,
      icon,
      colorClass: 'text-indigo-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化玩家放逐消息
   */
  private static formatPlayerExile(data: any, messageId: string): FormattedMessage {
    const { exiled_player, round_number } = data;

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'action',
      content: `⚖️ ${exiled_player}被投票放逐 (第${round_number}轮)`,
      playerName: exiled_player,
      icon: '⚖️',
      colorClass: 'text-red-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化玩家总结消息
   */
  private static formatPlayerSummary(data: any, messageId: string): FormattedMessage {
    const { player_name, summary, round_number } = data;

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'speech',
      content: `📝 ${player_name}总结: ${summary}`,
      playerName: player_name,
      icon: '📝',
      colorClass: 'text-cyan-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化游戏更新消息
   */
  private static formatGameUpdate(data: any, messageId: string): FormattedMessage {
    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: '🔄 游戏状态已更新',
      icon: '🔄',
      colorClass: 'text-blue-400',
      isSystemMessage: true
    };
  }

  /**
   * 格式化回合完成消息
   */
  private static formatRoundComplete(data: any, messageId: string): FormattedMessage {
    const { round, next_phase } = data;

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: `✅ 第${round?.round_number || 0}轮完成`,
      icon: '✅',
      colorClass: 'text-green-400',
      isSystemMessage: false
    };
  }

  /**
   * 格式化游戏完成消息
   */
  private static formatGameComplete(data: any, messageId: string): FormattedMessage {
    const { winner, winner_name, final_round, players_info } = data;

    let winnerText = '';
    switch (winner) {
      case 'Werewolves':
        winnerText = '🐺 狼人阵营获胜！';
        break;
      case 'werewolves':
        winnerText = '🐺 狼人阵营获胜！';
        break;
      case 'Villagers':
        winnerText = '👥 好人阵营获胜！';
        break;
      case 'villagers':
        winnerText = '👥 好人阵营获胜！';
        break;
      default:
        winnerText = `🎉 ${winner_name || winner}获胜！`;
    }

    // 构建详细的游戏结果信息
    let content = `🎊 游戏结束！${winnerText}`;

    if (final_round?.round_number) {
      content += ` (总轮数: ${final_round.round_number})`;
    }

    // 添加玩家统计信息
    if (players_info) {
      const players = Object.values(players_info);
      const aliveCount = players.filter((p: any) => p.alive).length;
      const totalCount = players.length;

      // 统计各角色数量
      const roleStats: Record<string, number> = players.reduce((acc: Record<string, number>, player: any) => {
        acc[player.role] = (acc[player.role] || 0) + 1;
        return acc;
      }, {});

      content += `\n\n📊 游戏统计:`;
      content += `\n  • 存活玩家: ${aliveCount}/${totalCount}人`;

      Object.entries(roleStats).forEach(([role, count]) => {
        const roleIcons: Record<string, string> = {
          "Werewolf": "🐺",
          "Seer": "🔮",
          "Doctor": "⚕️",
          "Villager": "👤"
        };
        const icon = roleIcons[role] || "❓";
        const roleNames: Record<string, string> = {
          "Werewolf": "狼人",
          "Seer": "预言家",
          "Doctor": "医生",
          "Villager": "村民"
        };
        const roleName = roleNames[role] || role;
        content += `\n  • ${icon}${roleName}: ${count}人`;
      });
    }

    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content,
      icon: '🎊',
      colorClass: 'text-yellow-500',
      isSystemMessage: false
    };
  }

  /**
   * 格式化未知消息
   */
  private static formatUnknownMessage(type: string, data: any, messageId: string): FormattedMessage {
    return {
      id: messageId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: `❓ 未知消息类型: ${type}`,
      icon: '❓',
      colorClass: 'text-gray-400',
      isSystemMessage: true
    };
  }

  /**
   * 格式化连接消息
   */
  static formatConnectionMessage(message: string): FormattedMessage {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: `🔗 ${message}`,
      icon: '🔗',
      colorClass: 'text-blue-500',
      isSystemMessage: true
    };
  }

  /**
   * 格式化连接错误消息
   */
  static formatErrorMessage(error: string): FormattedMessage {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type: 'error',
      content: `❌ 连接错误: ${error}`,
      icon: '❌',
      colorClass: 'text-red-600',
      isSystemMessage: true
    };
  }

  /**
   * 格式化连接关闭消息
   */
  static formatCloseMessage(): FormattedMessage {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: '🔌 WebSocket连接已关闭',
      icon: '🔌',
      colorClass: 'text-gray-500',
      isSystemMessage: true
    };
  }

  /**
   * 过滤消息列表，只显示游戏相关的重要消息
   */
  static filterGameMessages(messages: FormattedMessage[]): FormattedMessage[] {
    return messages.filter(msg => !msg.isSystemMessage);
  }

  /**
   * 批量格式化消息并过滤
   */
  static formatAndFilterMessages(rawMessages: any[]): FormattedMessage[] {
    const formatted = rawMessages
      .map(msg => this.formatMessage(msg))
      .filter((msg): msg is FormattedMessage => msg !== null);

    return this.filterGameMessages(formatted);
  }

  /**
   * 获取消息类型的中文名称
   */
  static getMessageTypeName(type: string): string {
    switch (type) {
      case 'phase': return '阶段变更';
      case 'speech': return '发言';
      case 'vote': return '投票';
      case 'action': return '行动';
      case 'system': return '系统';
      case 'error': return '错误';
      default: return '未知';
    }
  }

  /**
   * 判断是否为重要消息（需要高亮显示）
   */
  static isImportantMessage(message: FormattedMessage): boolean {
    return message.type === 'phase' ||
           message.type === 'error' ||
           message.content.includes('游戏结束') ||
           message.content.includes('获胜');
  }
}