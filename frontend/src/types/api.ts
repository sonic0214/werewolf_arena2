// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Model Types
export interface ModelInfo {
  alias: string;
  id: string;
  provider: string;
  name: string;
  description?: string;
  context_length?: number;
  input_price?: number;
  output_price?: number;
  enabled?: boolean;
}

export interface ModelTestRequest {
  model_alias: string;
  prompt?: string;
}

export interface ModelTestResponse {
  model_alias: string;
  response: string;
  latency_ms: number;
  tokens_used?: number;
  cost?: number;
  success: boolean;
  error?: string;
}

export interface AvailableProviders {
  [provider: string]: {
    name: string;
    available: boolean;
    models_count: number;
    api_key_configured: boolean;
  };
}

// Status Types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime_seconds: number;
}

export interface ServerInfo {
  version: string;
  environment: 'development' | 'production';
  api_version: string;
  documentation_url: string;
  features: {
    websocket_support: boolean;
    game_sessions: boolean;
    model_testing: boolean;
  };
}

export interface GameStats {
  total_games: number;
  active_games: number;
  completed_games: number;
  total_players: number;
  average_game_time_minutes: number;
  win_rates: {
    villager_wins: number;
    werewolf_wins: number;
  };
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Game API Types
export interface GameStartRequest {
  villager_model: string;
  werewolf_model: string;
  player_names?: string[];
  discussion_time_minutes?: number;
  max_rounds?: number;
}

export interface GameStartResponse {
  session_id: string;
  status: string;
  message: string;
}

export interface GameStatusResponse {
  session_id: string;
  status: 'pending' | 'running' | 'finished';
  current_round?: any;
  players?: any[];
  rounds?: any[];
  winner?: 'werewolf' | 'villager' | null;
  created_at?: string;
  updated_at?: string;
  settings?: any;
}

export interface GameListResponse {
  games: Array<{
    session_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
}

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Games
  GAMES: '/api/v1/games',
  GAME_START: '/api/v1/games/start',
  GAME_STATUS: (sessionId: string) => `/api/v1/games/${sessionId}`,
  GAME_STOP: (sessionId: string) => `/api/v1/games/${sessionId}/stop`,
  GAME_DELETE: (sessionId: string) => `/api/v1/games/${sessionId}`,

  // Models
  MODELS: '/api/v1/models/',
  MODEL_INFO: (alias: string) => `/api/v1/models/${alias}`,
  MODEL_TEST: '/api/v1/models/test',
  MODEL_PROVIDERS: '/api/v1/models/providers/available',

  // Status
  HEALTH: '/health',
  STATUS_HEALTH: '/api/v1/status/health',
  STATUS_INFO: '/api/v1/status/info',
  STATUS_STATS: '/api/v1/status/stats',

  // WebSocket
  WEBSOCKET: (sessionId: string) => `/api/v1/ws/${sessionId}`,
} as const;