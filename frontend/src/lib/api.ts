const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Cross-domain (production) uses Bearer tokens; same-origin (local dev) uses HttpOnly cookies
const IS_CROSS_ORIGIN = !!BASE;

export function getToken(): string | null {
  return IS_CROSS_ORIGIN ? localStorage.getItem('session_token') : null;
}

export function setToken(token: string) {
  if (IS_CROSS_ORIGIN) localStorage.setItem('session_token', token);
}

export function clearToken() {
  localStorage.removeItem('session_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    credentials: IS_CROSS_ORIGIN ? 'omit' : 'include',
    headers: { ...headers, ...options?.headers },
    ...options,
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }

  const json = await res.json() as { data: T; error: { code: string; message: string } | null };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; must_change_password: boolean; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  setup: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>('/auth/setup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Users
  getMe: () => request<User>('/api/v1/users/me'),
  getUsers: () => request<User[]>('/api/v1/users'),
  createUser: (data: { email: string; name: string; password: string; role?: string }) =>
    request<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, role: string) =>
    request<User>(`/api/v1/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  suspendUser: (id: string) =>
    request(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // Tickets
  getTickets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<TicketWithMeta[]>(`/api/v1/tickets${qs}`);
  },
  getTicket: (id: string) => request<TicketDetail>(`/api/v1/tickets/${id}`),
  createTicket: (data: CreateTicketPayload) =>
    request<TicketWithMeta>('/api/v1/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id: string, data: Partial<UpdateTicketPayload>) =>
    request<TicketWithMeta>(`/api/v1/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveTicket: (id: string, status: string, sort_order: number) =>
    request(`/api/v1/tickets/${id}/move`, { method: 'PATCH', body: JSON.stringify({ status, sort_order }) }),
  deleteTicket: (id: string) =>
    request(`/api/v1/tickets/${id}`, { method: 'DELETE' }),

  // Comments
  getComments: (ticketId: string) => request<Comment[]>(`/api/v1/tickets/${ticketId}/comments`),
  addComment: (ticketId: string, body: string) =>
    request<Comment>(`/api/v1/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  editComment: (id: string, body: string) =>
    request<Comment>(`/api/v1/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteComment: (id: string) =>
    request(`/api/v1/comments/${id}`, { method: 'DELETE' }),

  // Attachments
  getAttachments: (ticketId: string) => request<Attachment[]>(`/api/v1/tickets/${ticketId}/attachments`),
  getUploadUrl: (ticketId: string, filename: string, content_type: string) =>
    request<{ key: string; upload_url: string }>(`/api/v1/tickets/${ticketId}/attachments/upload-url`, {
      method: 'POST', body: JSON.stringify({ filename, content_type }),
    }),
  registerAttachment: (ticketId: string, data: { filename: string; url: string; mime_type: string; size_bytes: number }) =>
    request<Attachment>(`/api/v1/tickets/${ticketId}/attachments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAttachment: (id: string) =>
    request(`/api/v1/attachments/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: () => request<Project[]>('/api/v1/projects'),
  createProject: (data: { name: string; abbreviation: string; color?: string; default_owner_id?: string }) =>
    request<Project>('/api/v1/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: { name?: string; abbreviation?: string; color?: string; default_owner_id?: string | null }) =>
    request<Project>(`/api/v1/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request(`/api/v1/projects/${id}`, { method: 'DELETE' }),

  // Columns
  getColumns: () => request<Column[]>('/api/v1/columns'),
  createColumn: (data: { name: string; color?: string }) =>
    request<Column>('/api/v1/columns', { method: 'POST', body: JSON.stringify(data) }),
  updateColumn: (id: string, data: Partial<{ name: string; color: string; sort_order: number; is_initial: boolean; is_terminal: boolean }>) =>
    request<Column>(`/api/v1/columns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reorderColumns: (order: { id: string; sort_order: number }[]) =>
    request<Column[]>('/api/v1/columns/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  deleteColumn: (id: string) =>
    request(`/api/v1/columns/${id}`, { method: 'DELETE' }),
};

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: 'viewer' | 'decision_maker' | 'dev' | 'admin' | 'suspended';
  created_at: number;
  last_login: number | null;
}

export interface TicketWithMeta {
  id: string;
  ticket_number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  submitter_id: string;
  edc: number | null;
  product_version: string | null;
  ticket_type: 'bug' | 'feature';
  product_id: string | null;
  product_name: string | null;
  product_abbreviation: string | null;
  product_color: string | null;
  submitter_name: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  tags: string[];
}

export interface TicketDetail extends TicketWithMeta {
  comment_count: number;
  attachment_count: number;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  created_at: number;
  updated_at: number | null;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  uploader_id: string;
  uploader_name: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: number;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  priority?: string;
  tags?: string[];
  edc?: number | null;
  product_version?: string | null;
  ticket_type?: 'bug' | 'feature';
  product_id?: string | null;
  submitter_id?: string | null;
}

export interface UpdateTicketPayload {
  title: string;
  description: string;
  priority: string;
  assignee_id: string | null;
  edc: number | null;
  product_version: string | null;
  ticket_type: 'bug' | 'feature';
  product_id: string | null;
  tags: string[];
}

export interface Column {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  color: string;
  is_initial: number;
  is_terminal: number;
  created_at: number;
}

export interface Project {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  default_owner_id: string | null;
  default_owner_name: string | null;
  created_at: number;
}
