import { apiClient } from './client';
import {
  GameStartAPIRequest,
  GameStartAPIResponse,
  GameStatusAPIResponse,
  GameListAPIResponse,
  API_ENDPOINTS,
} from '@/types/api';

export const gamesAPI = {
  // Start a new game
  async startGame(request: GameStartAPIRequest): Promise<GameStartAPIResponse> {
    const response = await apiClient.post<GameStartAPIResponse>(API_ENDPOINTS.GAME_START, request);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start game');
    }

    return response.data;
  },

  // Get game status
  async getGameStatus(sessionId: string): Promise<GameStatusAPIResponse> {
    const response = await apiClient.get<GameStatusAPIResponse>(API_ENDPOINTS.GAME_STATUS(sessionId));

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get game status');
    }

    return response.data;
  },

  // List all games
  async listGames(): Promise<GameListAPIResponse> {
    const response = await apiClient.get<GameListAPIResponse>(API_ENDPOINTS.GAMES);

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
    callback: (status: GameStatusAPIResponse) => void,
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