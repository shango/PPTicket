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
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: Role;
  must_change_password: number;
  theme: string;
  ticket_size: string;
  notification_email: string | null;
  notify_ticket_created: number;
  notify_ticket_assigned: number;
  notify_ticket_done: number;
  notify_ticket_comment: number;
  notify_user_registered: number;
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
  submitter_id: string;
  edc: number | null;
  product_version: string | null;
  ticket_type: TicketType;
  product_id: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  milestone_id: string | null;
  archived_at: number | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  target_date: number | null;
  status: 'open' | 'closed';
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

export interface SubTask {
  id: string;
  ticket_id: string;
  title: string;
  description: string | null;
  due_date: number | null;
  completed: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  subtask_id: string | null;
  comment_id: string | null;
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
