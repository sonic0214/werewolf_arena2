import { apiClient } from './client';
import {
  GameStartRequest,
  GameStartResponse,
  GameStatusResponse,
  GameListResponse,
  API_ENDPOINTS,
} from '@/types/api';

export const gamesAPI = {
  // Start a new game
  async startGame(request: GameStartRequest): Promise<GameStartResponse> {
    const response = await apiClient.post<GameStartResponse>(API_ENDPOINTS.GAME_START, request);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start game');
    }

    return response.data;
  },

  // Get game status
  async getGameStatus(sessionId: string): Promise<GameStatusResponse> {
    const response = await apiClient.get<GameStatusResponse>(API_ENDPOINTS.GAME_STATUS(sessionId));

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get game status');
    }

    return response.data;
  },

  // List all games
  async listGames(): Promise<GameListResponse> {
    const response = await apiClient.get<GameListResponse>(API_ENDPOINTS.GAMES);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list games');
    }

    return response.data;
  },

  // Stop a running game
  async stopGame(sessionId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(API_ENDPOINTS.GAME_STOP(sessionId));

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to stop game');
    }

    return response.data;
  },

  // Delete a game session
  async deleteGame(sessionId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(API_ENDPOINTS.GAME_DELETE(sessionId));

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to delete game');
    }

    return response.data;
  },

  // Check if game exists
  async gameExists(sessionId: string): Promise<boolean> {
    try {
      await this.getGameStatus(sessionId);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Poll game status for real-time updates
  async pollGameStatus(
    sessionId: string,
    callback: (status: GameStatusResponse) => void,
    interval: number = 2000
  ): Promise<() => void> {
    const pollInterval = setInterval(async () => {
      try {
        const status = await this.getGameStatus(sessionId);
        callback(status);

        // Stop polling if game is finished
        if (status.status === 'finished') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling game status:', error);
        clearInterval(pollInterval);
      }
    }, interval);

    // Return function to stop polling
    return () => clearInterval(pollInterval);
  },
};