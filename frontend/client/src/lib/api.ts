/**
 * Keystone / Paper Ledger: API client layer for Django REST Framework.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000/api";

export type TaskStatus = "todo" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskOrdering =
  | "created_at" | "-created_at"
  | "updated_at" | "-updated_at"
  | "deadline" | "-deadline"
  | "priority" | "-priority"
  | "title" | "-title";

export interface UserInfo {
  id?: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_joined?: string;
}

export interface TaskItem {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  team?: number | null;
  team_name?: string | null;
  created_by?: string;
  assigned_to?: number | null;
  assigned_to_username?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedTasks {
  count: number;
  next: string | null;
  previous: string | null;
  results: TaskItem[];
}

export interface TeamMember {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface TeamItem {
  id: number;
  name: string;
  description?: string;
  created_by?: string;
  members: number[];
  members_detail?: TeamMember[];
  task_count?: number;
  created_at?: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  completed: number;
}

export interface TaskFilters {
  status?: TaskStatus | "all" | "";
  priority?: TaskPriority | "all" | "";
  team?: number | string | "";
  assigned_to?: number | string | "";
  search?: string;
  ordering?: TaskOrdering;
  page?: number;
  page_size?: number;
}

export function getStoredToken(): string | null {
  return localStorage.getItem("access_token");
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem("user_info");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_info");
}

/**
 * Format DRF error response into a human-readable message.
 */
function formatDrfError(body: unknown, status: number): string {
  if (!body) return `Request failed with status ${status}`;

  if (typeof body === "string") return body;

  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;
    if (obj.detail) return String(obj.detail);
    if (obj.message) return String(obj.message);

    const messages: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        const text = value.join(" ");
        messages.push(key === "non_field_errors" ? text : `${key}: ${text}`);
      } else if (typeof value === "string") {
        messages.push(key === "non_field_errors" ? value : `${key}: ${value}`);
      } else if (value && typeof value === "object") {
        messages.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    if (messages.length > 0) return messages.join(" | ");
  }

  return `Request failed with status ${status}`;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshToken(): Promise<string | null> {
  const refresh = getStoredRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      clearAuthStorage();
      return null;
    }
    const data = await res.json();
    if (data.access) {
      localStorage.setItem("access_token", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh_token", data.refresh);
      }
      return data.access;
    }
    return null;
  } catch {
    clearAuthStorage();
    return null;
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Unable to reach the server. Please check your connection.");
  }

  // Handle 401 and attempt JWT refresh once
  if (response.status === 401 && getStoredRefreshToken() && !path.includes("/auth/")) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshToken();
      isRefreshing = false;
      onRefreshed(newToken);
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        try {
          response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
        } catch {
          throw new Error("Unable to reach the server. Please check your connection.");
        }
      }
    } else {
      const retryToken = await new Promise<string | null>((resolve) => {
        refreshSubscribers.push(resolve);
      });
      if (retryToken) {
        headers.set("Authorization", `Bearer ${retryToken}`);
        try {
          response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
        } catch {
          throw new Error("Unable to reach the server. Please check your connection.");
        }
      }
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get("content-type") || "";
  let body: unknown = null;
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const errorMsg = formatDrfError(body, response.status);
    throw new Error(errorMsg);
  }

  return body as T;
}

export const api = {
  // ── Authentication ──────────────────────────────────────────────────────
  async login(identifier: string, password: string) {
    const payload = identifier.includes("@")
      ? { email: identifier, password }
      : { username: identifier, password };

    const result = await request<{
      access: string;
      refresh: string;
      username?: string;
      email?: string;
      user_id?: number;
    }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    localStorage.setItem("access_token", result.access);
    localStorage.setItem("refresh_token", result.refresh);

    const user: UserInfo = {
      id: result.user_id,
      username: result.username || identifier,
      email: result.email || (identifier.includes("@") ? identifier : ""),
    };
    localStorage.setItem("user_info", JSON.stringify(user));

    return result;
  },

  async register(payload: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) {
    return request<UserInfo>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCurrentUser() {
    const user = await request<UserInfo>("/auth/me/");
    localStorage.setItem("user_info", JSON.stringify(user));
    return user;
  },

  async getUsers(): Promise<UserInfo[]> {
    return request<UserInfo[]>("/auth/users/");
  },

  // ── Tasks ────────────────────────────────────────────────────────────────
  async getTasks(filters: TaskFilters = {}): Promise<PaginatedTasks> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== "" && v !== "all") {
        params[k] = String(v);
      }
    }
    const qs = new URLSearchParams(params).toString();
    const res = await request<PaginatedTasks | TaskItem[]>(`/tasks/${qs ? `?${qs}` : ""}`);
    if (Array.isArray(res)) {
      return { count: res.length, next: null, previous: null, results: res };
    }
    return res;
  },

  async getTask(id: number | string): Promise<TaskItem> {
    return request<TaskItem>(`/tasks/${id}/`);
  },

  async createTask(payload: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    deadline?: string | null;
    team?: number | null;
    assigned_to?: number | null;
  }) {
    return request<TaskItem>("/tasks/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateTask(
    id: number | string,
    payload: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      deadline: string | null;
      team: number | null;
      assigned_to: number | null;
    }>
  ) {
    return request<TaskItem>(`/tasks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteTask(id: number | string) {
    return request<void>(`/tasks/${id}/`, { method: "DELETE" });
  },

  async getTaskStatistics() {
    return request<TaskStats>("/tasks/statistics/");
  },

  // ── Teams ────────────────────────────────────────────────────────────────
  async getTeams() {
    const res = await request<TeamItem[] | { count: number; results: TeamItem[] }>("/teams/");
    return (Array.isArray(res) ? res : res?.results ?? []) as TeamItem[];
  },

  async getTeam(id: number | string) {
    return request<TeamItem>(`/teams/${id}/`);
  },

  async createTeam(payload: { name: string; description?: string }) {
    return request<TeamItem>("/teams/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateTeam(id: number | string, payload: Partial<{ name: string; description?: string }>) {
    return request<TeamItem>(`/teams/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteTeam(id: number | string) {
    return request<void>(`/teams/${id}/`, { method: "DELETE" });
  },

  async addTeamMember(
    teamId: number | string,
    payload: { user_id?: number; username?: string; email?: string }
  ) {
    return request<{ detail: string }>(`/teams/${teamId}/members/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async removeTeamMember(teamId: number | string, userId: number | string) {
    return request<{ detail: string }>(`/teams/${teamId}/members/${userId}/`, {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId }),
    });
  },
};
