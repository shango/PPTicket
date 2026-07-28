import { create } from 'zustand';
import { api, clearToken, setUnauthorizedHandler, type User, type TicketWithMeta } from './api';
import { applyTheme, getTheme, type Theme } from './theme';

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
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
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
  sidebarOpen: localStorage.getItem('sidebar_open') !== 'false',
  theme: getTheme(),

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    localStorage.setItem('sidebar_open', String(next));
    set({ sidebarOpen: next });
  },

  // Applied locally first so the switch is instant and so anonymous viewers,
  // who have no user row to save it to, still keep their choice.
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    if (get().user) api.updateTheme(theme).catch(() => {});
  },

  fetchUser: async () => {
    try {
      const user = await api.getMe();
      const theme: Theme = user.theme === 'light' ? 'light' : 'dark';
      applyTheme(theme);
      set({ user, theme, mustChangePassword: !!user.must_change_password, initialized: true });
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

// When any request 401s, a session we believed was valid has expired or been invalidated.
// Reset the cached user and send the user to login. Guarded on `user` so anonymous board
// viewing (where getMe and protected reads legitimately 401) isn't disrupted, and so a
// failed login attempt on the login page doesn't trigger a redirect loop.
setUnauthorizedHandler(() => {
  if (!useStore.getState().user) return;
  clearToken();
  useStore.setState({ user: null, mustChangePassword: false });
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
});
