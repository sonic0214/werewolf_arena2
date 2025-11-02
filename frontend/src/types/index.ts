import type { HTMLAttributes, ReactNode } from 'react';

// Re-export all types from submodules
export * from './game';
export * from './api';

// Common utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// UI State Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface UIState {
  loading: LoadingState;
  error?: string;
  message?: string;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  theme: Theme;
  primaryColor: string;
  fontSize: 'sm' | 'md' | 'lg';
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface CardProps extends BaseComponentProps, HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: boolean;
}
