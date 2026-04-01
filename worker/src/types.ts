export type Role = 'viewer' | 'decision_maker' | 'dev' | 'admin';
export type TicketStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  EMAIL_API_KEY: string;
  ALLOWED_DOMAIN: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  created_at: number;
  last_login: number | null;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: Priority;
  assignee_id: string | null;
  submitter_id: string;
  due_date: number | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: number;
  updated_at: number | null;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  uploader_id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: number;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: Role;
  exp: number;
  iat: number;
}
