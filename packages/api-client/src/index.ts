import type {
  LoginRequest, RegisterRequest, TokenResponse, User,
  Project, ProjectCreate, ProjectUpdate,
  Dataset, DatasetPreview,
  AnalysisRequest, AnalysisResult,
  VisualizationCreate, Visualization,
  ReportCreate, Report,
} from '@rdp/shared-types';

const API_BASE = import.meta.env?.VITE_API_URL || '/api/v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onTokenRefresh: ((tokens: TokenResponse) => void) | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function setOnTokenRefresh(callback: (tokens: TokenResponse) => void) {
  onTokenRefresh = callback;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) throw new ApiError(retry.status, await retry.text());
      if (retry.status === 204) return undefined as T;
      return retry.json();
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

async function refreshTokens(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const tokens: TokenResponse = await res.json();
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    onTokenRefresh?.(tokens);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API Error ${status}: ${body}`);
  }
}

// Auth
export const auth = {
  register: (data: RegisterRequest) =>
    request<TokenResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: LoginRequest) =>
    request<TokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request<User>('/auth/me'),
  updateProfile: (data: Partial<Pick<User, 'full_name' | 'institution'>>) =>
    request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  logout: (refresh_token: string) =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }),
};

// Projects
export const projects = {
  list: () => request<Project[]>('/projects/'),
  get: (id: number) => request<Project>(`/projects/${id}`),
  create: (data: ProjectCreate) =>
    request<Project>('/projects/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: ProjectUpdate) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// Datasets
export const datasets = {
  list: (projectId: number) => request<Dataset[]>(`/datasets/${projectId}`),
  upload: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<Dataset>(`/datasets/${projectId}/upload`, { method: 'POST', body: formData });
  },
  preview: (projectId: number, datasetId: number, rows = 50) =>
    request<DatasetPreview>(`/datasets/${projectId}/${datasetId}/preview?rows=${rows}`),
  delete: (projectId: number, datasetId: number) =>
    request<void>(`/datasets/${projectId}/${datasetId}`, { method: 'DELETE' }),
};

// Analysis
export const analysis = {
  run: (data: AnalysisRequest) =>
    request<AnalysisResult>('/analysis/run', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request<AnalysisResult>(`/analysis/${id}`),
  listByProject: (projectId: number) =>
    request<AnalysisResult[]>(`/analysis/project/${projectId}`),
};

// Visualizations
export const visualizations = {
  create: (data: VisualizationCreate) =>
    request<Visualization>('/analysis/visualizations', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request<Visualization>(`/analysis/visualizations/${id}`),
};

// Billing
export const billing = {
  status: () => request<{ subscription_status: string; stripe_enabled: boolean }>('/billing/status'),
  checkout: () => request<{ url: string }>('/billing/checkout', { method: 'POST' }),
  portal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
};

// Reports
export const reports = {
  create: (data: ReportCreate) =>
    request<Report>('/reports/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request<Report>(`/reports/${id}`),
  listByProject: (projectId: number) =>
    request<Report[]>(`/reports/project/${projectId}`),
  downloadUrl: (id: number) => `${API_BASE}/reports/${id}/download`,
};
