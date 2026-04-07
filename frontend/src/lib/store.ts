import { create } from 'zustand';
import { api, clearToken, type User, type TicketWithMeta } from './api';

interface AppState {
  user: User | null;
  mustChangePassword: boolean;
  tickets: TicketWithMeta[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  fetchUser: () => Promise<void>;
  fetchTickets: (params?: Record<string, string>) => Promise<void>;
  setTickets: (tickets: TicketWithMeta[]) => void;
  optimisticMoveTicket: (ticketId: string, newStatus: string, newSortOrder: number, edcOverride?: number | null) => void;
  setMustChangePassword: (v: boolean) => void;
  logout: () => Promise<void>;
}

export type { AppState };

export const useStore = create<AppState>((set, get) => ({
  user: null,
  mustChangePassword: false,
  tickets: [],
  loading: false,
  initialized: false,
  error: null,

  fetchUser: async () => {
    try {
      const user = await api.getMe();
      document.documentElement.setAttribute('data-theme', user.theme || 'dark');
      set({ user, mustChangePassword: !!user.must_change_password, initialized: true });
    } catch {
      set({ user: null, initialized: true });
    }
  },

  fetchTickets: async (params) => {
    set({ loading: true, error: null });
    try {
      const tickets = await api.getTickets(params);
      set({ tickets, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setTickets: (tickets) => set({ tickets }),

  optimisticMoveTicket: (ticketId, newStatus, newSortOrder, edcOverride) => {
    const tickets = get().tickets.map((t) =>
      t.id === ticketId
        ? { ...t, status: newStatus, sort_order: newSortOrder, ...(edcOverride !== undefined ? { edc: edcOverride } : {}) }
        : t
    );
    set({ tickets });
  },

  setMustChangePassword: (v) => set({ mustChangePassword: v }),

  logout: async () => {
    try { await api.logout(); } catch {}
    clearToken();
    set({ user: null, mustChangePassword: false });
    window.location.href = '/login';
  },
}));
