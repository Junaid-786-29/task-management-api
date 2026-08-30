import { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { toast, Toaster } from "sonner";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Command,
  Filter,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  api,
  clearAuthStorage,
  getStoredToken,
  getStoredUser,
  PaginatedTasks,
  TaskFilters,
  TaskItem,
  TaskOrdering,
  TaskPriority,
  TaskStats,
  TaskStatus,
  TeamItem,
  TeamMember,
  UserInfo,
} from "./lib/api";

/** Keystone / Paper Ledger: Swiss-editorial task workbench with warm paper, ink navy, and coral action cues. */

type ViewKey = "dashboard" | "tasks" | "teams" | "profile";

const navItems: { label: string; icon: typeof LayoutDashboard; href: string; key: ViewKey }[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/", key: "dashboard" },
  { label: "Tasks", icon: ClipboardList, href: "/tasks", key: "tasks" },
  { label: "Teams", icon: Users, href: "/teams", key: "teams" },
];

function App() {
  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ className: "paper-toast" }} />
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route>
          <AppFrame />
        </Route>
      </Switch>
    </>
  );
}

function AppFrame() {
  const [location, navigate_] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [view, setView] = useState<ViewKey>(
    location === "/tasks" ? "tasks" : location === "/teams" ? "teams" : location === "/profile" ? "profile" : "dashboard"
  );
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, todo: 0, in_progress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [ordering, setOrdering] = useState<TaskOrdering>("-created_at");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(getStoredUser());

  // Verify authentication on startup
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthLoading(false);
      navigate_("/login");
      return;
    }

    api.getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      })
      .catch(() => {
        clearAuthStorage();
        setUser(null);
        setAuthLoading(false);
        navigate_("/login");
      });
  }, [navigate_]);

  const loadTasks = useCallback(async (filters: TaskFilters = {}) => {
    if (!getStoredToken()) return;
    setLoading(true);
    try {
      const res = await api.getTasks({
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        team: teamFilter || undefined,
        search: query || undefined,
        ordering,
        page,
        ...filters,
      });
      setTasks(res.results);
      setTaskCount(res.count);
      const pageSize = 10;
      setPageCount(Math.max(1, Math.ceil(res.count / pageSize)));
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, teamFilter, query, ordering, page]);

  const loadData = useCallback(async () => {
    if (!getStoredToken()) return;
    setLoading(true);
    try {
      const [tasksRes, teamsRes, statsRes] = await Promise.allSettled([
        api.getTasks({ ordering: "-created_at" }),
        api.getTeams(),
        api.getTaskStatistics(),
      ]);

      if (tasksRes.status === "fulfilled") {
        setTasks(tasksRes.value.results);
        setTaskCount(tasksRes.value.count);
        const pageSize = 10;
        setPageCount(Math.max(1, Math.ceil(tasksRes.value.count / pageSize)));
      }

      if (teamsRes.status === "fulfilled") {
        setTeams(teamsRes.value || []);
      }

      if (statsRes.status === "fulfilled" && statsRes.value) {
        setStats(statsRes.value);
      }

      setApiError(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload tasks when filters/ordering/page change
  useEffect(() => {
    if (!authLoading) {
      loadTasks();
    }
  }, [statusFilter, priorityFilter, teamFilter, ordering, page, authLoading]);

  const currentLabel = view === "dashboard" ? "Overview" : view[0].toUpperCase() + view.slice(1);

  function navigate(next: ViewKey) {
    setView(next);
    setMobileOpen(false);
    window.history.pushState({}, "", next === "dashboard" ? "/" : `/${next}`);
  }

  function logout() {
    clearAuthStorage();
    toast.success("Signed out of workspace");
    navigate_("/login");
  }

  const handleToggleStatus = async (task: TaskItem) => {
    const nextStatus: TaskStatus =
      task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "completed" : "todo";
    try {
      const updated = await api.updateTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: updated.status } : t)));
      // Refresh stats
      api.getTaskStatistics().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await api.deleteTask(taskToDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      setTaskCount((c) => Math.max(0, c - 1));
      toast.success("Task deleted");
      setTaskToDelete(null);
      api.getTaskStatistics().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const handleViewTeamTasks = (teamId: number) => {
    setTeamFilter(String(teamId));
    setView("tasks");
    window.history.pushState({}, "", "/tasks");
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#18212b] paper-grain">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <div className="brand-name">keystone</div>
            <div className="brand-kicker">work in structure</div>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">{user?.username?.[0]?.toUpperCase() || "K"}</div>
          <div className="min-w-0">
            <div className="workspace-title">{user?.username || "Keystone User"}</div>
            <div className="workspace-subtitle">{user?.email || "Personal workspace"}</div>
          </div>
          <ChevronDown size={15} className="text-[#8a8f8c]" />
        </div>

        <div className="nav-section-label">Workspace</div>
        <nav className="nav-stack" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`nav-item ${view === item.key ? "nav-item-active" : ""}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.key === "tasks" && tasks.length > 0 && <span className="nav-count">{tasks.length}</span>}
                {item.key === "teams" && teams.length > 0 && <span className="nav-count">{teams.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="nav-section-label nav-section-spaced">Manage</div>
        <nav className="nav-stack">
          <button className="nav-item" onClick={() => toast.info("Calendar will reflect task deadlines.")}>
            <CalendarDays size={17} strokeWidth={1.8} />
            <span>Calendar</span>
          </button>
          <button className="nav-item" onClick={() => toast.info("Task rhythm statistics are active on Overview.")}>
            <Activity size={17} strokeWidth={1.8} />
            <span>Reports</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="focus-card">
            <div className="focus-card-top">
              <span className="focus-dot" />
              Daily focus
            </div>
            <p>Make room for the work that moves the week.</p>
            <div className="focus-rule">
              <span
                style={{
                  width: `${stats.total ? Math.min(100, Math.round((stats.completed / stats.total) * 100)) : 0}%`,
                }}
              />
            </div>
            <small>
              {stats.completed} of {stats.total} completed
            </small>
          </div>
          <button className="nav-item" onClick={() => navigate("profile")}>
            <Settings2 size={17} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
          <button className="nav-item nav-logout" onClick={logout}>
            <LogOut size={17} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span className="breadcrumb-muted">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{currentLabel}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workspace"
                aria-label="Search workspace"
              />
              <kbd>
                <Command size={11} /> K
              </kbd>
            </div>
            <button className="icon-button" onClick={() => toast.info("No unread notifications")} aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="profile-wrap">
              <button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}>
                <span className="avatar">
                  {user?.username ? user.username.slice(0, 2).toUpperCase() : "U"}
                </span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <strong>{user?.username || "—"}</strong>
                  <span>{user?.email || "—"}</span>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("profile");
                    }}
                  >
                    View profile
                  </button>
                  <button onClick={logout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-wrap">
          {apiError && (
            <div className="api-banner">
              <div className="api-banner-icon">
                <CircleHelp size={16} />
              </div>
              <div>
                <strong>API connection alert</strong>
                <span>{apiError}</span>
              </div>
              <button onClick={loadData}>
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}

          {view === "dashboard" && (
            <DashboardView
              tasks={tasks}
              stats={stats}
              loading={loading}
              onCreate={() => setShowCreateTask(true)}
              onTasks={() => navigate("tasks")}
              onToggleStatus={handleToggleStatus}
              onEditTask={(t) => setEditingTask(t)}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onViewTask={(t) => setViewingTask(t)}
            />
          )}

          {view === "tasks" && (
            <TasksView
              tasks={tasks}
              loading={loading}
              taskCount={taskCount}
              page={page}
              pageCount={pageCount}
              onPageChange={(p) => setPage(p)}
              statusFilter={statusFilter}
              setStatusFilter={(v) => { setStatusFilter(v); setPage(1); }}
              priorityFilter={priorityFilter}
              setPriorityFilter={(v) => { setPriorityFilter(v); setPage(1); }}
              teamFilter={teamFilter}
              setTeamFilter={(v) => { setTeamFilter(v); setPage(1); }}
              ordering={ordering}
              setOrdering={(v) => { setOrdering(v); setPage(1); }}
              query={query}
              setQuery={(v) => { setQuery(v); setPage(1); }}
              onSearch={() => loadTasks()}
              teams={teams}
              onCreate={() => setShowCreateTask(true)}
              onToggleStatus={handleToggleStatus}
              onEditTask={(t) => setEditingTask(t)}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onViewTask={(t) => setViewingTask(t)}
            />
          )}

          {view === "teams" && (
            <TeamsView
              teams={teams}
              loading={loading}
              onRefresh={loadData}
              currentUser={user}
              onViewTeamTasks={handleViewTeamTasks}
            />
          )}

          {view === "profile" && (
            <ProfileView user={user} stats={stats} />
          )}
        </div>
      </main>

      {showCreateTask && (
        <CreateTaskModal
          teams={teams}
          onClose={() => setShowCreateTask(false)}
          onCreated={(newTask) => {
            setTasks((prev) => [newTask, ...prev]);
            setShowCreateTask(false);
            toast.success("Task created");
            loadData();
          }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          teams={teams}
          onClose={() => setEditingTask(null)}
          onUpdated={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setEditingTask(null);
            toast.success("Task updated");
            loadData();
          }}
        />
      )}

      {taskToDelete && (
        <ConfirmDeleteModal
          task={taskToDelete}
          deleting={deleting}
          onClose={() => setTaskToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          teams={teams}
          onClose={() => setViewingTask(null)}
          onEdit={() => { setEditingTask(viewingTask); setViewingTask(null); }}
          onDelete={() => { setTaskToDelete(viewingTask); setViewingTask(null); }}
          onToggleStatus={handleToggleStatus}
        />
      )}
    </div>
  );
}

function DashboardView({
  tasks,
  stats,
  loading,
  onCreate,
  onTasks,
  onToggleStatus,
  onEditTask,
  onDeleteTask,
  onViewTask,
}: {
  tasks: TaskItem[];
  stats: TaskStats;
  loading: boolean;
  onCreate: () => void;
  onTasks: () => void;
  onToggleStatus: (task: TaskItem) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (task: TaskItem) => void;
  onViewTask: (task: TaskItem) => void;
}) {
  const statCards = [
    { label: "Total tasks", value: stats.total, tone: "ink", note: "Across your workspace" },
    { label: "To do", value: stats.todo, tone: "sand", note: "Ready to begin" },
    { label: "In progress", value: stats.in_progress, tone: "coral", note: "Currently moving" },
    { label: "Completed", value: stats.completed, tone: "sage", note: "Closed this cycle" },
  ];

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            Live Register
          </div>
          <h1>
            Make room for
            <br />
            <em>good work.</em>
          </h1>
          <p className="heading-copy">
            A quiet place to see what matters, what’s moving, and what needs your attention next.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={17} /> New task
        </button>
      </section>

      <section className="stats-grid">
        {statCards.map((stat) => (
          <div className={`stat-card stat-${stat.tone}`} key={stat.label}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{loading ? "—" : stat.value}</div>
            <div className="stat-note">{stat.note}</div>
            <div className="stat-corner">↗</div>
          </div>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="panel task-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Recent activity</div>
              <h2>The task register</h2>
            </div>
            <button className="text-button" onClick={onTasks}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          {loading ? (
            <LoadingRows />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={23} />}
              title="The register is clear."
              copy="Tasks from your Django API will land here. Start by creating your first one."
              action="Create first task"
              onAction={onCreate}
            />
          ) : (
            <TaskRows
              tasks={tasks.slice(0, 5)}
              onToggleStatus={onToggleStatus}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onViewTask={onViewTask}
            />
          )}
        </div>

        <div className="panel rhythm-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">At a glance</div>
              <h2>Work rhythm</h2>
            </div>
            <MoreHorizontal size={18} className="muted-icon" />
          </div>
          <div className="rhythm-graphic">
            <div className="rhythm-ring">
              <div>
                <strong>{completionRate}%</strong>
                <span>complete</span>
              </div>
            </div>
            <div className="rhythm-legend">
              <div>
                <span className="legend-dot coral" />
                In motion <strong>{stats.in_progress}</strong>
              </div>
              <div>
                <span className="legend-dot sage" />
                Completed <strong>{stats.completed}</strong>
              </div>
              <div>
                <span className="legend-dot sand" />
                Waiting <strong>{stats.todo}</strong>
              </div>
            </div>
          </div>
          <div className="next-mark">
            <Sparkles size={15} />
            <span>
              {stats.in_progress > 0
                ? `${stats.in_progress} task${stats.in_progress > 1 ? "s" : ""} in progress right now.`
                : "Nothing urgent is hiding in the margins."}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function TasksView({
  tasks,
  loading,
  taskCount,
  page,
  pageCount,
  onPageChange,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  teamFilter,
  setTeamFilter,
  ordering,
  setOrdering,
  query,
  setQuery,
  onSearch,
  teams,
  onCreate,
  onToggleStatus,
  onEditTask,
  onDeleteTask,
  onViewTask,
}: {
  tasks: TaskItem[];
  loading: boolean;
  taskCount: number;
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  statusFilter: "all" | TaskStatus;
  setStatusFilter: (v: "all" | TaskStatus) => void;
  priorityFilter: "all" | TaskPriority;
  setPriorityFilter: (v: "all" | TaskPriority) => void;
  teamFilter: string;
  setTeamFilter: (v: string) => void;
  ordering: TaskOrdering;
  setOrdering: (v: TaskOrdering) => void;
  query: string;
  setQuery: (v: string) => void;
  onSearch: () => void;
  teams: TeamItem[];
  onCreate: () => void;
  onToggleStatus: (task: TaskItem) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (task: TaskItem) => void;
  onViewTask: (task: TaskItem) => void;
}) {
  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || teamFilter !== "" || query !== "";

  function clearFilters() {
    setStatusFilter("all");
    setPriorityFilter("all");
    setTeamFilter("");
    setQuery("");
  }

  return (
    <>
      <section className="page-heading compact">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            Task register
          </div>
          <h1>All the moving parts.</h1>
          <p className="heading-copy">Filter the work, then give the next useful thing your full attention.</p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={17} /> New task
        </button>
      </section>

      {/* Search row */}
      <div className="filter-row" style={{ flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
        <div className="global-search" style={{ flex: "1 1 220px", maxWidth: "340px" }}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search by title or description…"
            aria-label="Search tasks"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} style={{ border: 0, background: "transparent", color: "#888", padding: "0 4px" }}>
              <X size={13} />
            </button>
          )}
        </div>
        <button className="secondary-button" style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }} onClick={onSearch}>
          <Search size={13} /> Search
        </button>
        {hasFilters && (
          <button className="text-button" onClick={clearFilters} style={{ fontSize: "11px" }}>
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Filter + sort row */}
      <div className="filter-row" style={{ flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "14px" }}>
        <div className="filter-label"><Filter size={14} /> Status</div>
        {(["all", "todo", "in_progress", "completed"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`filter-chip ${statusFilter === key ? "filter-chip-active" : ""}`}
          >
            {key === "all" ? "All" : key === "in_progress" ? "In progress" : key === "todo" ? "To do" : "Completed"}
          </button>
        ))}

        <div style={{ width: "1px", height: "20px", background: "#ddd", margin: "0 4px" }} />
        <div className="filter-label">Priority</div>
        {(["all", "low", "medium", "high", "urgent"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setPriorityFilter(key)}
            className={`filter-chip ${priorityFilter === key ? "filter-chip-active" : ""}`}
          >
            {key === "all" ? "Any" : key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}

        {teams.length > 0 && (
          <>
            <div style={{ width: "1px", height: "20px", background: "#ddd", margin: "0 4px" }} />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ fontSize: "12px", padding: "4px 8px", border: "1px solid #d6cfc4", background: "#f9f6ef", height: "28px" }}
              aria-label="Filter by team"
            >
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "#888" }}>Sort</span>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as TaskOrdering)}
            style={{ fontSize: "12px", padding: "4px 8px", border: "1px solid #d6cfc4", background: "#f9f6ef", height: "28px" }}
            aria-label="Sort tasks"
          >
            <option value="-created_at">Newest first</option>
            <option value="created_at">Oldest first</option>
            <option value="-updated_at">Recently updated</option>
            <option value="deadline">Deadline (asc)</option>
            <option value="-deadline">Deadline (desc)</option>
            <option value="title">Title A–Z</option>
            <option value="-title">Title Z–A</option>
          </select>
        </div>
      </div>

      <div className="panel task-panel tasks-full">
        {loading ? (
          <LoadingRows />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<Search size={23} />}
            title="No tasks match this view."
            copy={hasFilters ? "Try adjusting the filters or search query." : "Create a new task to add to the register."}
            action={hasFilters ? "Clear filters" : "Create task"}
            onAction={hasFilters ? clearFilters : onCreate}
          />
        ) : (
          <TaskRows
            tasks={tasks}
            onToggleStatus={onToggleStatus}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onViewTask={onViewTask}
          />
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", padding: "0 2px" }}>
          <span style={{ fontSize: "12px", color: "#888" }}>
            {taskCount} task{taskCount !== 1 ? "s" : ""} · Page {page} of {pageCount}
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="secondary-button"
              style={{ minHeight: "28px", padding: "0 10px", fontSize: "12px" }}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              className="secondary-button"
              style={{ minHeight: "28px", padding: "0 10px", fontSize: "12px" }}
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TaskRows({
  tasks,
  onToggleStatus,
  onEditTask,
  onDeleteTask,
  onViewTask,
}: {
  tasks: TaskItem[];
  onToggleStatus?: (task: TaskItem) => void;
  onEditTask?: (task: TaskItem) => void;
  onDeleteTask?: (task: TaskItem) => void;
  onViewTask?: (task: TaskItem) => void;
}) {
  return (
    <div className="task-rows">
      {tasks.map((task) => (
        <div className="task-row" key={task.id}>
          <button
            type="button"
            className={`task-check ${task.status === "completed" ? "task-check-done" : ""}`}
            onClick={() => onToggleStatus && onToggleStatus(task)}
            title={`Mark as ${task.status === "todo" ? "in progress" : task.status === "in_progress" ? "completed" : "to do"}`}
          >
            {task.status === "completed" && <Check size={13} />}
          </button>
          <div
            className="task-main"
            style={{ cursor: "pointer" }}
            onClick={() => onViewTask ? onViewTask(task) : onEditTask && onEditTask(task)}
          >
            <strong>{task.title}</strong>
            <span>
              {task.team_name ? `Team: ${task.team_name}` : "Personal"}
              {task.assigned_to_username ? ` · Assigned: ${task.assigned_to_username}` : ""}
              {task.deadline ? ` · Due ${new Date(task.deadline).toLocaleDateString()}` : ""}
            </span>
          </div>
          <span className={`status-pill status-${task.status}`}>
            {task.status === "in_progress" ? "In progress" : task.status === "todo" ? "To do" : "Completed"}
          </span>
          <span className={`priority-dot priority-${task.priority}`} title={`${task.priority} priority`} />
          {onEditTask && (
            <button
              className="row-more"
              onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
              aria-label={`Edit ${task.title}`}
              title="Edit task"
            >
              <Settings2 size={15} />
            </button>
          )}
          {onDeleteTask && (
            <button
              className="row-more"
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
              aria-label={`Delete ${task.title}`}
              title="Delete task"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamsView({
  teams,
  loading,
  onRefresh,
  currentUser,
  onViewTeamTasks,
}: {
  teams: TeamItem[];
  loading: boolean;
  onRefresh: () => void;
  currentUser?: UserInfo | null;
  onViewTeamTasks?: (teamId: number) => void;
}) {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [viewingTeam, setViewingTeam] = useState<TeamItem | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ team: TeamItem; member: TeamMember } | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<TeamItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [search, setSearch] = useState("");

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemoving(true);
    try {
      await api.removeTeamMember(memberToRemove.team.id, memberToRemove.member.id);
      toast.success(`Removed ${memberToRemove.member.username} from ${memberToRemove.team.name}`);
      setMemberToRemove(null);
      if (viewingTeam && viewingTeam.id === memberToRemove.team.id) {
        setViewingTeam((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.filter((id) => id !== memberToRemove.member.id),
                members_detail: (prev.members_detail || []).filter((m) => m.id !== memberToRemove.member.id),
              }
            : null
        );
      }
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  const handleConfirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    setDeletingTeam(true);
    try {
      await api.deleteTeam(teamToDelete.id);
      toast.success(`Deleted team "${teamToDelete.name}"`);
      if (viewingTeam && viewingTeam.id === teamToDelete.id) {
        setViewingTeam(null);
      }
      setTeamToDelete(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeletingTeam(false);
    }
  };

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.created_by && t.created_by.toLowerCase().includes(q))
    );
  }, [teams, search]);

  return (
    <>
      <section className="page-heading compact">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            Team directory
          </div>
          <h1>Bring the right people into focus.</h1>
          <p className="heading-copy">Organize your collaborators, assign tasks, and share workspaces.</p>
        </div>
        <button className="primary-button" onClick={() => setShowCreateTeam(true)}>
          <Plus size={17} /> Create team
        </button>
      </section>

      {teams.length > 0 && (
        <div style={{ marginBottom: "20px", maxWidth: "340px" }}>
          <div className="global-search" style={{ display: "flex", width: "100%" }}>
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter teams or owners…"
              aria-label="Filter teams"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ border: 0, background: "transparent", color: "#888", padding: "0 4px" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="panel task-panel">
          <LoadingRows />
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="panel task-panel">
          <EmptyState
            icon={<Users size={23} />}
            title={teams.length === 0 ? "No teams created yet." : "No matching teams found."}
            copy={
              teams.length === 0
                ? "Create a team to collaborate with other users and organize tasks."
                : "Try adjusting your search query."
            }
            action={teams.length === 0 ? "Create your first team" : "Clear search"}
            onAction={() => (teams.length === 0 ? setShowCreateTeam(true) : setSearch(""))}
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredTeams.map((team) => {
            const isOwner = currentUser?.username === team.created_by;
            const membersList = team.members_detail || [];

            return (
              <div
                className="panel"
                key={team.id}
                style={{
                  padding: "22px",
                  display: "grid",
                  gap: "14px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() => setViewingTeam(team)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div className="eyebrow" style={{ color: "var(--coral)", fontSize: "9px" }}>
                        Owner: {team.created_by}
                      </div>
                      {isOwner && (
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "1px 5px",
                            background: "#f3dcd8",
                            color: "var(--coral)",
                            fontWeight: 700,
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <h3 style={{ font: "500 22px 'Space Grotesk'", margin: "6px 0 2px" }}>{team.name}</h3>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="secondary-button"
                      style={{ minHeight: "30px", padding: "0 10px", fontSize: "11px" }}
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowAddMember(true);
                      }}
                      title={isOwner ? "Add member" : "View / add member"}
                    >
                      <UserPlus size={13} /> Add
                    </button>
                    {isOwner && (
                      <button
                        className="row-more"
                        style={{ padding: "4px 6px" }}
                        onClick={() => setTeamToDelete(team)}
                        title="Delete team"
                        aria-label={`Delete ${team.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {team.description && (
                  <p style={{ color: "#777b77", fontSize: "13px", lineHeight: 1.4, margin: "0" }}>
                    {team.description}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: "#f9f6ef",
                    border: "1px solid #ece6da",
                    fontSize: "12px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ color: "#777" }}>
                    Tasks: <strong>{team.task_count ?? 0}</strong>
                  </span>
                  {onViewTeamTasks && (
                    <button
                      className="text-button"
                      style={{ fontSize: "11px", padding: 0 }}
                      onClick={() => onViewTeamTasks(team.id)}
                    >
                      View tasks <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #eee8df", paddingTop: "14px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#8d918d",
                      fontWeight: 700,
                      marginBottom: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Members ({membersList.length || team.members?.length || 0})</span>
                    {team.created_at && (
                      <span style={{ fontWeight: 400, textTransform: "none" }}>
                        Created {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                    {membersList.length > 0 ? (
                      membersList.slice(0, 4).map((m) => {
                        const isMemberOwner = team.created_by === m.username;
                        return (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "6px 10px",
                              background: "#f9f6ef",
                              border: "1px solid #ece6da",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  background: isMemberOwner ? "var(--coral)" : "#ddd8cc",
                                  color: isMemberOwner ? "white" : "var(--ink)",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                {m.username?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div>
                                <strong>{m.username}</strong>
                                {isMemberOwner && (
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      marginLeft: "6px",
                                      padding: "1px 4px",
                                      background: "#f3dcd8",
                                      color: "var(--coral)",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Owner
                                  </span>
                                )}
                                {m.email && (
                                  <span style={{ color: "#888", marginLeft: "6px", fontSize: "11px" }}>
                                    {m.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isOwner && !isMemberOwner && (
                              <button
                                className="row-more"
                                onClick={() => setMemberToRemove({ team, member: m })}
                                title={`Remove ${m.username}`}
                                aria-label={`Remove ${m.username}`}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ color: "#888", fontSize: "12px", fontStyle: "italic" }}>
                        {team.members?.length ? `${team.members.length} members` : "No members added yet"}
                      </div>
                    )}
                    {membersList.length > 4 && (
                      <span style={{ fontSize: "11px", color: "#888", textAlign: "center" }}>
                        +{membersList.length - 4} more members (click card to view all)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateTeam && (
        <CreateTeamModal
          onClose={() => setShowCreateTeam(false)}
          onCreated={() => {
            setShowCreateTeam(false);
            toast.success("Team created successfully");
            onRefresh();
          }}
        />
      )}

      {viewingTeam && (
        <TeamDetailModal
          team={viewingTeam}
          currentUser={currentUser}
          onClose={() => setViewingTeam(null)}
          onAddMember={() => {
            setSelectedTeam(viewingTeam);
            setShowAddMember(true);
          }}
          onRemoveMember={(member) => setMemberToRemove({ team: viewingTeam, member })}
          onDeleteTeam={() => setTeamToDelete(viewingTeam)}
          onViewTeamTasks={onViewTeamTasks}
        />
      )}

      {showAddMember && selectedTeam && (
        <AddMemberModal
          team={selectedTeam}
          onClose={() => {
            setShowAddMember(false);
            setSelectedTeam(null);
          }}
          onAdded={() => {
            setShowAddMember(false);
            setSelectedTeam(null);
            toast.success("Member added to team");
            onRefresh();
          }}
        />
      )}

      {memberToRemove && (
        <ConfirmRemoveMemberModal
          teamName={memberToRemove.team.name}
          memberName={memberToRemove.member.username}
          removing={removing}
          onClose={() => setMemberToRemove(null)}
          onConfirm={handleConfirmRemoveMember}
        />
      )}

      {teamToDelete && (
        <ConfirmDeleteTeamModal
          teamName={teamToDelete.name}
          deleting={deletingTeam}
          onClose={() => setTeamToDelete(null)}
          onConfirm={handleConfirmDeleteTeam}
        />
      )}
    </>
  );
}

function ProfileView({ user, stats }: { user: UserInfo | null; stats: TaskStats }) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return (
    <section className="empty-page" style={{ maxWidth: "800px" }}>
      <div className="eyebrow">
        <span className="eyebrow-mark" />
        Account Profile
      </div>
      <h1>Your work identity.</h1>
      <p>Your authentication credentials and current workspace profile information.</p>

      <div className="panel" style={{ padding: "26px", marginTop: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "4px" }}>Username</div>
            <strong style={{ fontSize: "16px" }}>{user?.username || "—"}</strong>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: "4px" }}>Email</div>
            <strong style={{ fontSize: "16px" }}>{user?.email || "—"}</strong>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: "4px" }}>Full Name</div>
            <strong style={{ fontSize: "16px" }}>{fullName || "—"}</strong>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: "4px" }}>User ID</div>
            <span style={{ fontSize: "14px", color: "#555" }}>{user?.id ? `#${user.id}` : "Active User"}</span>
          </div>
          {user?.date_joined && (
            <div>
              <div className="eyebrow" style={{ marginBottom: "4px" }}>Date Joined</div>
              <span style={{ fontSize: "14px", color: "#555" }}>{new Date(user.date_joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
          <div>
            <div className="eyebrow" style={{ marginBottom: "4px" }}>Workspace Tasks</div>
            <span style={{ fontSize: "14px", color: "#555" }}>{stats.total} total ({stats.completed} completed)</span>
          </div>
        </div>

        <div className="next-mark" style={{ margin: "16px 0 0" }}>
          <Sparkles size={15} />
          <span>Profile data authenticated securely via Django REST Framework JWT tokens.</span>
        </div>
      </div>
    </section>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows">
      {[1, 2, 3].map((i) => (
        <div className="loading-row" key={i}>
          <span />
          <div>
            <span />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <button className="secondary-button" onClick={onAction}>
        {action} <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

function CreateTaskModal({
  teams,
  onClose,
  onCreated,
}: {
  teams: TeamItem[];
  onClose: () => void;
  onCreated: (task: TaskItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [teamId, setTeamId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Give the task a title first");
    setSaving(true);
    try {
      const created = await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        team: teamId ? Number(teamId) : null,
        deadline: deadline || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
      });
      onCreated(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task could not be created");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">New entry</div>
            <h2 id="create-title">Add a task</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to move?"
              required
            />
          </label>
          <label>
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context or notes"
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Team (optional)
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No Team (Personal)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label>
              Assign to (optional)
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ""}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Deadline (optional)
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button disabled={saving} className="primary-button" type="submit">
              {saving ? "Saving…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  teams,
  onClose,
  onUpdated,
}: {
  task: TaskItem;
  teams: TeamItem[];
  onClose: () => void;
  onUpdated: (task: TaskItem) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [teamId, setTeamId] = useState<string>(task.team ? String(task.team) : "");
  const [assignedTo, setAssignedTo] = useState<string>(task.assigned_to ? String(task.assigned_to) : "");
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : ""
  );
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title cannot be empty");
    setSaving(true);
    try {
      const updated = await api.updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        team: teamId ? Number(teamId) : null,
        deadline: deadline || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
      });
      onUpdated(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">Modify entry</div>
            <h2 id="edit-title">Edit task</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details"
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No Team (Personal)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label>
              Assign to
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ""}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button disabled={saving} className="primary-button" type="submit">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  teams,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  task: TaskItem;
  teams: TeamItem[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: (task: TaskItem) => void;
}) {
  const teamName = task.team_name || (task.team ? teams.find((t) => t.id === task.team)?.name : null);
  const nextStatus: TaskStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "completed" : "todo";
  const nextStatusLabel = nextStatus === "in_progress" ? "In progress" : nextStatus === "completed" ? "Completed" : "To do";

  function fieldRow(label: string, value: React.ReactNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "14px", color: "#18212b" }}>{value || <em style={{ color: "#bbb" }}>—</em>}</span>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="detail-title" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow">Task detail</div>
            <h2 id="detail-title" style={{ fontSize: "18px", margin: 0, wordBreak: "break-word" }}>{task.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          {task.description && (
            <div style={{ marginBottom: "16px", fontSize: "14px", color: "#444", lineHeight: 1.6, background: "#f0ece2", padding: "10px 14px", borderLeft: "3px solid #c8b89a" }}>
              {task.description}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {fieldRow("Status", (
              <span className={`status-pill status-${task.status}`}>
                {task.status === "in_progress" ? "In progress" : task.status === "todo" ? "To do" : "Completed"}
              </span>
            ))}
            {fieldRow("Priority", (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className={`priority-dot priority-${task.priority}`} />
                {task.priority[0].toUpperCase() + task.priority.slice(1)}
              </span>
            ))}
            {fieldRow("Team", teamName || "Personal")}
            {fieldRow("Assigned to", task.assigned_to_username || "Unassigned")}
            {fieldRow("Deadline", task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null)}
            {fieldRow("Created by", task.created_by)}
            {fieldRow("Created", task.created_at ? new Date(task.created_at).toLocaleString() : null)}
            {fieldRow("Updated", task.updated_at ? new Date(task.updated_at).toLocaleString() : null)}
          </div>
        </div>

        <div className="modal-actions" style={{ borderTop: "1px solid #e8e1d5", marginTop: "8px" }}>
          <button type="button" className="secondary-button" onClick={onDelete} style={{ color: "var(--coral)", borderColor: "var(--coral)" }}>
            <Trash2 size={14} /> Delete
          </button>
          <button type="button" className="secondary-button" onClick={() => onToggleStatus(task)}>
            <Check size={14} /> Mark {nextStatusLabel}
          </button>
          <button type="button" className="primary-button" onClick={onEdit}>
            <Settings2 size={14} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  task,
  deleting,
  onClose,
  onConfirm,
}: {
  task: TaskItem;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: "var(--coral)" }}>Confirm deletion</div>
            <h2 id="delete-title">Delete task?</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "#777b77", fontSize: "13px", lineHeight: 1.5, margin: "0 0 20px" }}>
          Are you sure you want to permanently delete <strong>&ldquo;{task.title}&rdquo;</strong>? This action will remove the task record from MySQL and cannot be undone.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "var(--coral)" }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (team: TeamItem) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Team name is required");
    setSaving(true);
    try {
      const created = await api.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="team-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">Team directory</div>
            <h2 id="team-title">New Team</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Team Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design & Engineering"
              required
            />
          </label>
          <label>
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team work on?"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button disabled={saving} className="primary-button" type="submit">
              {saving ? "Creating…" : "Create team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamDetailModal({
  team,
  currentUser,
  onClose,
  onAddMember,
  onRemoveMember,
  onDeleteTeam,
  onViewTeamTasks,
}: {
  team: TeamItem;
  currentUser?: UserInfo | null;
  onClose: () => void;
  onAddMember: () => void;
  onRemoveMember: (member: TeamMember) => void;
  onDeleteTeam: () => void;
  onViewTeamTasks?: (teamId: number) => void;
}) {
  const isOwner = currentUser?.username === team.created_by;
  const membersList = team.members_detail || [];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="team-detail-title" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ color: "var(--coral)" }}>
              {isOwner ? "Owner (You)" : `Owner: ${team.created_by}`}
            </div>
            <h2 id="team-detail-title" style={{ fontSize: "20px", margin: 0, wordBreak: "break-word" }}>
              {team.name}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          {team.description && (
            <div style={{ marginBottom: "16px", fontSize: "14px", color: "#444", lineHeight: 1.6, background: "#f0ece2", padding: "10px 14px", borderLeft: "3px solid #c8b89a" }}>
              {team.description}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div style={{ background: "#f9f6ef", padding: "10px 12px", border: "1px solid #ece6da" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#8d918d", fontWeight: 700 }}>
                Associated Tasks
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "4px" }}>
                <strong style={{ fontSize: "18px" }}>{team.task_count ?? 0}</strong>
                {onViewTeamTasks && (
                  <button
                    className="text-button"
                    style={{ fontSize: "11px", padding: 0 }}
                    onClick={() => {
                      onClose();
                      onViewTeamTasks(team.id);
                    }}
                  >
                    View tasks <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: "#f9f6ef", padding: "10px 12px", border: "1px solid #ece6da" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#8d918d", fontWeight: 700 }}>
                Total Members
              </div>
              <div style={{ marginTop: "4px" }}>
                <strong style={{ fontSize: "18px" }}>{membersList.length || team.members?.length || 0}</strong>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee8df", paddingTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#8d918d", fontWeight: 700 }}>
                Team Members
              </span>
              <button
                className="secondary-button"
                style={{ minHeight: "26px", padding: "0 8px", fontSize: "11px" }}
                onClick={() => {
                  onClose();
                  onAddMember();
                }}
              >
                <UserPlus size={12} /> Add Member
              </button>
            </div>

            <div style={{ display: "grid", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
              {membersList.map((m) => {
                const isMemberOwner = team.created_by === m.username;
                const isCurrentUser = currentUser?.username === m.username;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      background: "#f9f6ef",
                      border: "1px solid #ece6da",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          background: isMemberOwner ? "var(--coral)" : "#ddd8cc",
                          color: isMemberOwner ? "white" : "var(--ink)",
                          fontSize: "10px",
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {m.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <strong>{m.username}</strong>
                        {isCurrentUser && <span style={{ color: "#888", marginLeft: "4px", fontSize: "10px" }}>(you)</span>}
                        {isMemberOwner && (
                          <span
                            style={{
                              fontSize: "9px",
                              marginLeft: "6px",
                              padding: "1px 4px",
                              background: "#f3dcd8",
                              color: "var(--coral)",
                              fontWeight: 700,
                            }}
                          >
                            Owner
                          </span>
                        )}
                        {m.email && <span style={{ color: "#888", marginLeft: "6px", fontSize: "11px" }}>{m.email}</span>}
                      </div>
                    </div>
                    {isOwner && !isMemberOwner && (
                      <button
                        className="row-more"
                        onClick={() => onRemoveMember(m)}
                        title={`Remove ${m.username}`}
                        aria-label={`Remove ${m.username}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ borderTop: "1px solid #e8e1d5", marginTop: "16px" }}>
          {isOwner && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                onClose();
                onDeleteTeam();
              }}
              style={{ color: "var(--coral)", borderColor: "var(--coral)", marginRight: "auto" }}
            >
              <Trash2 size={14} /> Delete Team
            </button>
          )}
          {onViewTeamTasks && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                onClose();
                onViewTeamTasks(team.id);
              }}
            >
              <ClipboardList size={14} /> View Team Tasks
            </button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({
  team,
  onClose,
  onAdded,
}: {
  team: TeamItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers()
      .then((allUsers) => {
        const memberUsernames = new Set(
          (team.members_detail || []).map((m) => m.username.toLowerCase())
        );
        const available = allUsers.filter((u) => !memberUsernames.has(u.username.toLowerCase()));
        setUsers(available);
        if (available.length === 0) {
          setMode("manual");
        }
      })
      .catch(() => {
        setMode("manual");
      })
      .finally(() => {
        setLoadingUsers(false);
      });
  }, [team]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "select") {
        if (!selectedUserId) {
          toast.error("Please select a user");
          setSaving(false);
          return;
        }
        await api.addTeamMember(team.id, { user_id: Number(selectedUserId) });
      } else {
        if (!manualInput.trim()) {
          toast.error("Enter a username or email");
          setSaving(false);
          return;
        }
        const payload = manualInput.includes("@")
          ? { email: manualInput.trim() }
          : { username: manualInput.trim() };
        await api.addTeamMember(team.id, payload);
      }
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">{team.name}</div>
            <h2 id="add-member-title">Add member</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === "select" && (
            <label>
              Select User
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loadingUsers}
                required
              >
                <option value="">Choose a user to add…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} {u.email ? `(${u.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === "manual" && (
            <label>
              Username or Email
              <input
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. junaid or user@example.com"
                required
              />
            </label>
          )}

          <div style={{ margin: "6px 0 14px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: "11px" }}
              onClick={() => setMode(mode === "select" ? "manual" : "select")}
            >
              {mode === "select" ? "Or type username / email manually →" : "← Or select from registered users"}
            </button>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button disabled={saving} className="primary-button" type="submit">
              {saving ? "Adding…" : "Add to team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmRemoveMemberModal({
  teamName,
  memberName,
  removing,
  onClose,
  onConfirm,
}: {
  teamName: string;
  memberName: string;
  removing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="remove-member-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: "var(--coral)" }}>Remove collaborator</div>
            <h2 id="remove-member-title">Remove member?</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "#777b77", fontSize: "13px", lineHeight: 1.5, margin: "0 0 20px" }}>
          Are you sure you want to remove <strong>{memberName}</strong> from <strong>{teamName}</strong>? They will no longer have access to this team&rsquo;s tasks and register.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={removing}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "var(--coral)" }}
            onClick={onConfirm}
            disabled={removing}
          >
            {removing ? "Removing…" : "Remove member"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTeamModal({
  teamName,
  deleting,
  onClose,
  onConfirm,
}: {
  teamName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-team-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: "var(--coral)" }}>Delete team</div>
            <h2 id="delete-team-title">Delete {teamName}?</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "#777b77", fontSize: "13px", lineHeight: 1.5, margin: "0 0 20px" }}>
          Are you sure you want to delete this team? All member associations will be cleared. This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "var(--coral)" }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete team"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getStoredToken()) setLocation("/");
  }, [setLocation]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        if (!username.trim() || !email.trim() || !password) {
          toast.error("Please fill in username, email, and password");
          setLoading(false);
          return;
        }
        await api.register({
          username: username.trim(),
          email: email.trim(),
          password,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        });
        toast.success("Account created! Logging in…");
        await api.login(email.trim(), password);
        setLocation("/");
      } else {
        if (!identifier.trim() || !password) {
          toast.error("Please enter email/username and password");
          setLoading(false);
          return;
        }
        await api.login(identifier.trim(), password);
        toast.success("Signed in successfully");
        setLocation("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page paper-grain">
      <div className="login-aside">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span />
            <span />
          </div>
          <div>
            <div className="brand-name">keystone</div>
            <div className="brand-kicker">work in structure</div>
          </div>
        </div>
        <div className="login-aside-copy">
          <div className="eyebrow">
            <span className="eyebrow-mark" />A clearer way to work
          </div>
          <h1>
            Keep the
            <br />
            <em>signal.</em>
          </h1>
          <p>Tasks, teams, and the next useful thing—held in one considered workspace.</p>
        </div>
        <div className="login-aside-foot">
          © 2026 Keystone Studio <span>01 / 01</span>
        </div>
      </div>

      <div className="login-card-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="eyebrow">{isRegister ? "New workspace member" : "Workspace access"}</div>
          <h2>
            Good work
            <br />
            <em>{isRegister ? "begins here." : "starts here."}</em>
          </h2>
          <p className="login-copy">
            {isRegister ? "Create your credentials to join." : "Sign in to return to your register."}
          </p>

          {isRegister ? (
            <>
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. junaid"
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                />
              </label>
              <div className="form-grid">
                <label>
                  First name (optional)
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                  />
                </label>
                <label>
                  Last name (optional)
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                  />
                </label>
              </div>
              <label>
                Password (min 8 characters)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Email address or Username
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="you@company.com or username"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </label>
            </>
          )}

          <button disabled={loading} className="primary-button login-submit" type="submit">
            {loading ? "Processing…" : isRegister ? "Create account" : "Enter workspace"}{" "}
            <ArrowUpRight size={16} />
          </button>

          <div style={{ marginTop: "12px", textAlign: "center" }}>
            <button
              type="button"
              className="text-button"
              style={{ margin: "0 auto" }}
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
            </button>
          </div>

          <div className="login-note">
            <span className="focus-dot" />
            Your data stays with your Django API.
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
