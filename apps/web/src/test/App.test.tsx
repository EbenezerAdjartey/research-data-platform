import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useAuth (now in its own file)
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock AuthContext module (AuthProvider wrapper + AuthContext object)
vi.mock('@/context/AuthContext', () => ({
  AuthContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from '../App';

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('redirects unauthenticated users to login', () => {
    renderApp('/projects');
    // Should redirect to login since user is null
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders login page at /login', () => {
    renderApp('/login');
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders register page at /register', () => {
    renderApp('/register');
    expect(screen.getByRole('heading', { name: /create.*account|sign up|register/i })).toBeInTheDocument();
  });
});
