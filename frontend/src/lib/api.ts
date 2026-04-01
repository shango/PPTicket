const BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getToken(): string | null {
  return localStorage.getItem('session_token');
}

export function setToken(token: string) {
  localStorage.setItem('session_token', token);
}

export function clearToken() {
  localStorage.removeItem('session_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...options?.headers },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = '/login';
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
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Users
  getMe: () => request<User>('/api/v1/users/me'),
  getUsers: () => request<User[]>('/api/v1/users'),
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
  due_date: number | null;
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
  due_date?: number | null;
}

export interface UpdateTicketPayload {
  title: string;
  description: string;
  priority: string;
  assignee_id: string | null;
  due_date: number | null;
  tags: string[];
}
