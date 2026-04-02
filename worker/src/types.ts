export type Role = 'viewer' | 'decision_maker' | 'dev' | 'admin';
export type TicketStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'p0' | 'p1' | 'p2' | 'p3';
export type TicketType = 'bug' | 'feature';

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  JWT_SECRET: string;
  EMAIL_API_KEY: string;
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
  edc: number | null;
  product_version: string | null;
  ticket_type: TicketType;
  product_id: string | null;
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
  created_at: number;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: Role;
  exp: number;
  iat: number;
}
