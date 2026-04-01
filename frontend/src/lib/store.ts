import { create } from 'zustand';
import { api, type User, type TicketWithMeta } from './api';

interface AppState {
  user: User | null;
  tickets: TicketWithMeta[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  fetchUser: () => Promise<void>;
  fetchTickets: (params?: Record<string, string>) => Promise<void>;
  setTickets: (tickets: TicketWithMeta[]) => void;
  optimisticMoveTicket: (ticketId: string, newStatus: string, newSortOrder: number) => void;
  logout: () => Promise<void>;
}

export type { AppState };

export const useStore = create<AppState>((set, get) => ({
  user: null,
  tickets: [],
  loading: false,
  initialized: false,
  error: null,

  fetchUser: async () => {
    try {
      const user = await api.getMe();
      set({ user, initialized: true });
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

  optimisticMoveTicket: (ticketId, newStatus, newSortOrder) => {
    const tickets = get().tickets.map((t) =>
      t.id === ticketId ? { ...t, status: newStatus, sort_order: newSortOrder } : t
    );
    set({ tickets });
  },

  logout: async () => {
    await api.logout();
    set({ user: null });
    window.location.href = '/login';
  },
}));
