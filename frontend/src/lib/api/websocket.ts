import {
  WebSocketMessage,
  GameUpdateMessage,
  RoundCompleteMessage,
  GameCompleteMessage,
} from '@/types/game';

type WebSocketEventHandler = (data: any) => void;
type WebSocketErrorHandler = (error: Error) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;
  private isConnecting: boolean = false; // 添加连接中标志
  private shouldReconnect: boolean = true; // 添加是否应该重连的标志

  constructor(url?: string) {
    this.url = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  }

  // Connect to WebSocket server
  connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        console.warn('[WS] WebSocket not available (not in browser environment)');
        reject(new Error('WebSocket not available'));
        return;
      }

      // Validate sessionId
      if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
        console.error('[WS] Invalid sessionId:', sessionId);
        reject(new Error(`Invalid sessionId: ${sessionId}`));
        return;
      }

      // 检查是否已经在连接或已连接
      if (this.isConnecting) {
        console.warn('[WS] Already connecting, skipping...');
        reject(new Error('Already connecting'));
        return;
      }

      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.currentSessionId === sessionId) {
        console.log('[WS] Already connected to this session');
        resolve();
        return;
      }

      // 如果已有连接但是不同的session，先断开
      if (this.socket && this.currentSessionId !== sessionId) {
        console.log('[WS] Switching to different session, disconnecting old connection');
        this.disconnect();
      }

      this.isConnecting = true;
      this.shouldReconnect = true;
      this.currentSessionId = sessionId;
      const wsUrl = `${this.url}/ws/${sessionId}`;
      const connectionId = Math.random().toString(36).substring(7);
      console.log(`[WS:${connectionId}] Connecting to ${wsUrl}`);

      try {
        this.socket = new WebSocket(wsUrl);
        console.log(`[WS:${connectionId}] WebSocket object created, initial readyState:`, this.socket.readyState);

        this.socket.onopen = () => {
          console.log(`[WS:${connectionId}] ✅ Connected successfully, readyState:`, this.socket?.readyState);
          this.reconnectAttempts = 0;
          this.isConnecting = false; // 重置连接中标志
          if (this.onConnect) {
            this.onConnect();
          }
          resolve();
        };

        this.socket.onerror = (error) => {
          console.error(`[WS:${connectionId}] ❌ Connection error:`, error);
          console.error(`[WS:${connectionId}] WebSocket URL was:`, wsUrl);
          console.error(`[WS:${connectionId}] WebSocket readyState:`, this.socket?.readyState);
          console.error(`[WS:${connectionId}] Error occurred at:`, new Date().toISOString());
          this.isConnecting = false; // 重置连接中标志

          // 注意：onerror可能在onclose之前或之后触发
          // 如果是网络问题，onerror会先触发，然后onclose会触发
          if (this.onError) {
            this.onError(new Error('WebSocket connection error'));
          }
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.log(`[WS:${connectionId}] Disconnected:`, event.code, event.reason);
          console.log(`[WS:${connectionId}] Close event details:`, {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            type: event.type
          });
          this.isConnecting = false; // 重置连接中标志

          if (this.onDisconnect) {
            this.onDisconnect(event.reason || 'Connection closed');
          }

          // 只有在shouldReconnect为true且不是正常关闭时才重连
          if (this.shouldReconnect && event.code !== 1000 && this.currentSessionId) {
            console.log(`[WS:${connectionId}] Will attempt to reconnect...`);
            this.handleReconnect();
          }
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WS] Error parsing message:', error);
          }
        };
      } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    console.log('[WS] Disconnect called');
    this.shouldReconnect = false; // 明确表示不要重连
    this.isConnecting = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      const currentState = this.socket.readyState;
      console.log(`[WS] Closing WebSocket connection... (readyState: ${currentState})`);

      // 先移除事件监听器，避免触发onclose/onerror
      const socket = this.socket;
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.onmessage = null;

      this.socket = null;
      this.currentSessionId = null;

      // 只在OPEN或CONNECTING状态时关闭
      if (currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING) {
        try {
          socket.close(1000, 'Client disconnect');
        } catch (error) {
          console.warn('[WS] Error closing socket:', error);
        }
      }
    } else {
      this.currentSessionId = null;
    }

    this.reconnectAttempts = 0;
  }

  // Check if connected
  isConnected(): boolean {
    if (typeof WebSocket === 'undefined') return false;
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // Send message to server
  send(event: string, data?: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: event, data }));
    } else {
      console.warn('[WS] Cannot send message, not connected');
    }
  }

  // Event handlers
  private onGameUpdate?: WebSocketEventHandler;
  private onRoundComplete?: WebSocketEventHandler;
  private onGameComplete?: WebSocketEventHandler;
  private onDebateTurn?: WebSocketEventHandler;
  private onVoteCast?: WebSocketEventHandler;
  private onNightAction?: WebSocketEventHandler;
  private onPhaseChange?: WebSocketEventHandler;
  private onPlayerAction?: WebSocketEventHandler;
  private onPlayerExile?: WebSocketEventHandler;
  private onPlayerSummary?: WebSocketEventHandler;
  private onError?: WebSocketErrorHandler;
  private onConnect?: () => void;
  private onDisconnect?: WebSocketEventHandler;

  // Set event handlers
  on(event: 'game_update', handler: (data: GameUpdateMessage) => void): void;
  on(event: 'round_complete', handler: (data: RoundCompleteMessage) => void): void;
  on(event: 'game_complete', handler: (data: GameCompleteMessage) => void): void;
  on(event: 'debate_turn', handler: (data: any) => void): void;
  on(event: 'vote_cast', handler: (data: any) => void): void;
  on(event: 'night_action', handler: (data: any) => void): void;
  on(event: 'phase_change', handler: (data: any) => void): void;
  on(event: 'player_action', handler: (data: any) => void): void;
  on(event: 'player_exile', handler: (data: any) => void): void;
  on(event: 'player_summary', handler: (data: any) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'connect', handler: () => void): void;
  on(event: 'disconnect', handler: (reason: string) => void): void;
  on(event: string, handler: WebSocketEventHandler): void {
    switch (event) {
      case 'game_update':
        this.onGameUpdate = handler as (data: GameUpdateMessage) => void;
        break;
      case 'round_complete':
        this.onRoundComplete = handler as (data: RoundCompleteMessage) => void;
        break;
      case 'game_complete':
        this.onGameComplete = handler as (data: GameCompleteMessage) => void;
        break;
      case 'debate_turn':
        this.onDebateTurn = handler;
        break;
      case 'vote_cast':
        this.onVoteCast = handler;
        break;
      case 'night_action':
        this.onNightAction = handler;
        break;
      case 'phase_change':
        this.onPhaseChange = handler;
        break;
      case 'player_action':
        this.onPlayerAction = handler;
        break;
      case 'player_exile':
        this.onPlayerExile = handler;
        break;
      case 'player_summary':
        this.onPlayerSummary = handler;
        break;
      case 'error':
        this.onError = handler as WebSocketErrorHandler;
        break;
      case 'connect':
        this.onConnect = handler as () => void;
        break;
      case 'disconnect':
        this.onDisconnect = handler;
        break;
    }
  }

  // Remove event handlers
  off(event: string): void {
    switch (event) {
      case 'game_update':
        this.onGameUpdate = undefined;
        break;
      case 'round_complete':
        this.onRoundComplete = undefined;
        break;
      case 'game_complete':
        this.onGameComplete = undefined;
        break;
      case 'debate_turn':
        this.onDebateTurn = undefined;
        break;
      case 'vote_cast':
        this.onVoteCast = undefined;
        break;
      case 'night_action':
        this.onNightAction = undefined;
        break;
      case 'phase_change':
        this.onPhaseChange = undefined;
        break;
      case 'player_action':
        this.onPlayerAction = undefined;
        break;
      case 'player_exile':
        this.onPlayerExile = undefined;
        break;
      case 'player_summary':
        this.onPlayerSummary = undefined;
        break;
      case 'error':
        this.onError = undefined;
        break;
      case 'connect':
        this.onConnect = undefined;
        break;
      case 'disconnect':
        this.onDisconnect = undefined;
        break;
    }
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketMessage): void {
    console.log('[WS] Received message:', message.type, message.data);

    try {
      switch (message.type) {
        case 'connection_established':
          console.log('[WS] Connection established:', message.data);
          break;
        case 'game_update':
          if (this.onGameUpdate) {
            this.onGameUpdate(message as GameUpdateMessage);
          }
          break;
        case 'round_complete':
          if (this.onRoundComplete) {
            this.onRoundComplete(message as RoundCompleteMessage);
          }
          break;
        case 'game_complete':
          if (this.onGameComplete) {
            this.onGameComplete(message as GameCompleteMessage);
          }
          break;
        case 'debate_turn':
          if (this.onDebateTurn) {
            this.onDebateTurn(message);
          }
          break;
        case 'vote_cast':
          if (this.onVoteCast) {
            this.onVoteCast(message);
          }
          break;
        case 'night_action':
          if (this.onNightAction) {
            this.onNightAction(message);
          }
          break;
        case 'phase_change':
          if (this.onPhaseChange) {
            this.onPhaseChange(message);
          }
          break;
        case 'player_action':
          if (this.onPlayerAction) {
            this.onPlayerAction(message);
          }
          break;
        case 'player_exile':
          if (this.onPlayerExile) {
            this.onPlayerExile(message);
          }
          break;
        case 'player_summary':
          if (this.onPlayerSummary) {
            this.onPlayerSummary(message);
          }
          break;
        case 'status_update':
          if (this.onGameUpdate) {
            this.onGameUpdate(message as GameUpdateMessage);
          }
          break;
        case 'ping':
          // Respond to ping with pong
          this.send('pong');
          break;
        case 'pong':
          // Server responded to our ping
          console.log('[WS] Pong received');
          break;
        case 'error':
          if (this.onError) {
            this.onError(new Error(message.data?.message || 'WebSocket error'));
          }
          break;
        default:
          console.warn('[WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WS] Error handling message:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  // Handle reconnection logic
  private handleReconnect(): void {
    // 检查是否应该重连
    if (!this.shouldReconnect) {
      console.log('[WS] Reconnect disabled, skipping...');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentSessionId) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        if (this.currentSessionId && this.shouldReconnect) {
          this.connect(this.currentSessionId).catch((error) => {
            console.error('[WS] Reconnection failed:', error);
          });
        }
      }, delay);
    } else {
      console.error('[WS] Max reconnection attempts reached or reconnect disabled');
      if (this.onError) {
        this.onError(new Error('Max reconnection attempts reached'));
      }
    }
  }

  // Get connection status
  getStatus(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    if (typeof WebSocket === 'undefined' || !this.socket) return 'disconnected';

    switch (this.socket.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected';
      default:
        return 'disconnected';
    }
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();

// Export class for custom instances
export { WebSocketClient };