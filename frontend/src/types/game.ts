// Player Types
export type PlayerRole = 'villager' | 'werewolf' | 'seer' | 'doctor';

export interface Player {
  id: number;
  name: string;
  role: PlayerRole;
  alive: boolean;
  avatar?: string;
  reasoning?: string;
}

// Game State Types
export interface GamePhase {
  name: string;
  type: 'day' | 'night';
  number: number;
}

export interface Vote {
  voter_id: number;
  target_id: number;
  reason?: string;
}

export interface Round {
  id: string;
  phase: GamePhase;
  players: Player[];
  votes: Vote[];
  discussions: DiscussionMessage[];
  night_actions?: NightAction[];
  winner?: PlayerRole;
}

export interface NightAction {
  player_id: number;
  action: 'kill' | 'save' | 'check';
  target_id?: number;
  result?: string;
}

export interface DiscussionMessage {
  player_id: number;
  message: string;
  timestamp: string;
  phase: GamePhase;
}

// Game State
export interface GameState {
  session_id: string;
  status: 'waiting' | 'running' | 'finished';
  current_round?: Round;
  rounds: Round[];
  players: Player[];
  winner?: PlayerRole;
  created_at: string;
  updated_at: string;
  settings: GameSettings;
}

export interface GameSettings {
  villager_models: string[];
  werewolf_models: string[];
  player_names: string[];
  discussion_time_minutes: number;
  max_rounds: number;
}

// Game View (for specific player perspective)
export interface GameView {
  game_state: GameState;
  player_id: number;
  private_reasoning?: string;
  available_actions: string[];
}

// API Request/Response Types
export interface GameStartRequest {
  villager_model: string;
  werewolf_model: string;
  player_names?: string[];
  discussion_time_minutes?: number;
  max_rounds?: number;
}

export interface GameStartResponse {
  session_id: string;
  message: string;
  game_view: GameView;
}

export interface GameStatusResponse {
  session_id: string;
  status: string;
  game_state?: GameState;
  game_view?: GameView;
}

export interface GameListResponse {
  games: Array<{
    session_id: string;
    status: string;
    created_at: string;
    player_count: number;
    current_round?: number;
    winner?: PlayerRole;
  }>;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type:
    | 'game_update'
    | 'round_complete'
    | 'game_complete'
    | 'error'
    | 'connection_established'
    | 'ping'
    | 'pong'
    | 'debate_turn'
    | 'vote_cast'
    | 'night_action'
    | 'phase_change'
    | 'player_action'
    | 'player_exile'
    | 'player_summary'
    | 'status_update';
  data: any;
  timestamp: string;
}

export interface GameUpdateMessage extends WebSocketMessage {
  type: 'game_update';
  data: {
    game_state: GameState;
    game_view?: GameView;
  };
}

export interface RoundCompleteMessage extends WebSocketMessage {
  type: 'round_complete';
  data: {
    round: Round;
    next_phase?: GamePhase;
  };
}

export interface GameCompleteMessage extends WebSocketMessage {
  type: 'game_complete';
  data: {
    winner: PlayerRole;
    final_round: Round;
    game_state: GameState;
  };
}

export interface DebateTurnMessage extends WebSocketMessage {
  type: 'debate_turn';
  data: {
    sequence_number: number;
    player_name: string;
    dialogue: string;
    timestamp: string;
  };
}

export interface VoteCastMessage extends WebSocketMessage {
  type: 'vote_cast';
  data: {
    sequence_number: number;
    voter: string;
    target: string;
    timestamp: string;
  };
}

export interface NightActionMessage extends WebSocketMessage {
  type: 'night_action';
  data: {
    sequence_number: number;
    action_type: string;
    player_name: string;
    player_role?: string;
    target_name?: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}

export interface PhaseChangeMessage extends WebSocketMessage {
  type: 'phase_change';
  data: {
    sequence_number?: number;
    phase: string;
    round_number: number;
    timestamp: string;
  };
}

export interface PlayerActionMessage extends WebSocketMessage {
  type: 'player_action';
  data: {
    sequence_number: number;
    action_type: string;
    player_name: string;
    player_role: string;
    target_name?: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}

export interface PlayerExileMessage extends WebSocketMessage {
  type: 'player_exile';
  data: {
    sequence_number: number;
    exiled_player: string;
    round_number: number;
    timestamp: string;
  };
}

export interface PlayerSummaryMessage extends WebSocketMessage {
  type: 'player_summary';
  data: {
    sequence_number: number;
    player_name: string;
    summary: string;
    round_number: number;
    timestamp: string;
  };
}

export interface StatusUpdateMessage extends WebSocketMessage {
  type: 'status_update';
  data: {
    status: 'running' | 'stopped';
    game_state?: GameState;
  };
}