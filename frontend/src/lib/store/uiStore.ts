import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Theme, ThemeConfig, LoadingState } from '@/types';

interface UIStoreState {
  // Theme
  theme: Theme;
  themeConfig: ThemeConfig;

  // Layout
  sidebarOpen: boolean;
  fullscreenMode: boolean;

  // Notifications
  notifications: Notification[];
  soundEnabled: boolean;

  // Loading states
  globalLoading: LoadingState;
  loadingMessages: Record<string, string>;

  // Actions
  setTheme: (theme: Theme) => void;
  setThemeConfig: (config: Partial<ThemeConfig>) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleFullscreen: () => void;
  setFullscreenMode: (fullscreen: boolean) => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  toggleSound: () => void;

  // Loading
  setGlobalLoading: (loading: LoadingState) => void;
  setLoadingMessage: (key: string, message: string) => void;
  removeLoadingMessage: (key: string) => void;

  // Reset
  reset: () => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  timestamp: number;
}

const initialThemeConfig: ThemeConfig = {
  theme: 'system',
  primaryColor: '#3b82f6',
  fontSize: 'md',
};

export const useUIStore = create<UIStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        themeConfig: initialThemeConfig,
        sidebarOpen: true,
        fullscreenMode: false,
        notifications: [],
        soundEnabled: true,
        globalLoading: 'idle',
        loadingMessages: {},

        // Theme actions
        setTheme: (theme) => {
          set((state) => ({
            themeConfig: { ...state.themeConfig, theme },
          }));

          // Apply theme to document
          if (typeof window !== 'undefined') {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');

            if (theme === 'system') {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              root.classList.add(systemTheme);
            } else {
              root.classList.add(theme);
            }
          }
        },

        setThemeConfig: (config) => {
          set((state) => ({
            themeConfig: { ...state.themeConfig, ...config },
          }));

          // Apply theme changes
          const { themeConfig } = get();
          get().setTheme(themeConfig.theme);
        },

        // Layout actions
        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }));
        },

        setSidebarOpen: (open) => {
          set({ sidebarOpen: open });
        },

        toggleFullscreen: () => {
          const { fullscreenMode } = get();

          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            set({ fullscreenMode: true });
          } else {
            document.exitFullscreen();
            set({ fullscreenMode: false });
          }
        },

        setFullscreenMode: (fullscreen) => {
          set({ fullscreenMode: fullscreen });
        },

        // Notification actions
        addNotification: (notification) => {
          const id = Date.now().toString();
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: Date.now(),
          };

          set((state) => ({
            notifications: [...state.notifications, newNotification],
          }));

          // Auto remove notification after duration
          const duration = notification.duration || 5000;
          setTimeout(() => {
            get().removeNotification(id);
          }, duration);

          // Play sound if enabled
          if (get().soundEnabled) {
            get().playNotificationSound(notification.type);
          }
        },

        removeNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        toggleSound: () => {
          set((state) => ({ soundEnabled: !state.soundEnabled }));
        },

        // Loading actions
        setGlobalLoading: (loading) => {
          set({ globalLoading: loading });
        },

        setLoadingMessage: (key, message) => {
          set((state) => ({
            loadingMessages: { ...state.loadingMessages, [key]: message },
          }));
        },

        removeLoadingMessage: (key) => {
          set((state) => {
            const newMessages = { ...state.loadingMessages };
            delete newMessages[key];
            return { loadingMessages: newMessages };
          });
        },

        // Reset
        reset: () => {
          set({
            theme: 'system',
            themeConfig: initialThemeConfig,
            sidebarOpen: true,
            fullscreenMode: false,
            notifications: [],
            soundEnabled: true,
            globalLoading: 'idle',
            loadingMessages: {},
          });
        },

        // Helper method for playing notification sounds
        playNotificationSound: (type: Notification['type']) => {
          if (typeof window === 'undefined') return;

          try {
            const audio = new Audio();
            switch (type) {
              case 'success':
                audio.src = '/sounds/success.mp3';
                break;
              case 'error':
                audio.src = '/sounds/error.mp3';
                break;
              case 'warning':
                audio.src = '/sounds/warning.mp3';
                break;
              default:
                audio.src = '/sounds/info.mp3';
            }
            audio.volume = 0.3;
            audio.play().catch(() => {
              // Ignore audio play errors
            });
          } catch (error) {
            // Ignore audio creation errors
          }
        },
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          themeConfig: state.themeConfig,
          sidebarOpen: state.sidebarOpen,
          soundEnabled: state.soundEnabled,
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

// Selectors
export const useTheme = () => useUIStore((state) => state.theme);
export const useThemeConfig = () => useUIStore((state) => state.themeConfig);
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);
export const useFullscreenMode = () => useUIStore((state) => state.fullscreenMode);
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useSoundEnabled = () => useUIStore((state) => state.soundEnabled);
export const useGlobalLoading = () => useUIStore((state) => state.globalLoading);
export const useLoadingMessages = () => useUIStore((state) => state.loadingMessages);

// Actions
export const useUIActions = () => useUIStore((state) => ({
  setTheme: state.setTheme,
  setThemeConfig: state.setThemeConfig,
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
  toggleFullscreen: state.toggleFullscreen,
  setFullscreenMode: state.setFullscreenMode,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  clearNotifications: state.clearNotifications,
  toggleSound: state.toggleSound,
  setGlobalLoading: state.setGlobalLoading,
  setLoadingMessage: state.setLoadingMessage,
  removeLoadingMessage: state.removeLoadingMessage,
  reset: state.reset,
}));