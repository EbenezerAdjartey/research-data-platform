import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
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
    expect(screen.getByText(/create.*account|sign up|register/i)).toBeInTheDocument();
  });
});
