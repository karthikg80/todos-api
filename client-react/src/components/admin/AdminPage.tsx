import { useState, useEffect, useCallback, useMemo } from "react";
import { apiCall } from "../../api/client";
import { AdminFeedbackWorkflow } from "./AdminFeedbackWorkflow";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  emailVerified: boolean;
}

interface Props {
  onBack: () => void;
}

const AVATAR_HUES = [210, 250, 330, 160, 30, 280, 190, 350, 50, 130];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function avatarColor(email: string): string {
  const hue = AVATAR_HUES[hashCode(email) % AVATAR_HUES.length];
  return `hsl(${hue} 45% 50%)`;
}

export function AdminPage({ onBack }: Props) {
  const [tab, setTab] = useState<"users" | "feedback">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [feedbackCount, setFeedbackCount] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch {
      /* network error */
    }
    setLoading(false);
  }, []);

  const loadFeedbackCount = useCallback(async () => {
    try {
      const res = await apiCall("/admin/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedbackCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

  useEffect(() => {
    loadFeedbackCount();
  }, [loadFeedbackCount]);

  const handleRoleChange = useCallback(
    async (userId: string, role: string) => {
      const res = await apiCall(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setMessage("Role updated");
        loadUsers();
        setTimeout(() => setMessage(""), 2000);
      }
    },
    [loadUsers],
  );

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      if (!confirm("Delete this user? This cannot be undone.")) return;
      const res = await apiCall(`/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage("User deleted");
        loadUsers();
        setTimeout(() => setMessage(""), 2000);
      }
    },
    [loadUsers],
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)),
    );
  }, [users, search]);

  return (
    <div id="adminPane" className="admin-page">
      {/* Sidebar nav */}
      <nav className="admin-nav">
        <button className="admin-nav__back" onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          <span className="admin-nav__heading">Admin</span>
        </button>

        <div className="admin-nav__items">
          <button
            className={`admin-nav__item${tab === "users" ? " admin-nav__item--active" : ""}`}
            onClick={() => setTab("users")}
          >
            <span>Users</span>
            {users.length > 0 && (
              <span className="admin-nav__badge">{users.length}</span>
            )}
          </button>
          <button
            className={`admin-nav__item${tab === "feedback" ? " admin-nav__item--active" : ""}`}
            onClick={() => setTab("feedback")}
          >
            <span>Feedback</span>
            {feedbackCount > 0 && (
              <span className="admin-nav__badge">{feedbackCount}</span>
            )}
          </button>
        </div>
      </nav>

      {/* Content area */}
      <div className="admin-content">
        {message && (
          <p id="adminMessage" className="settings-message">
            {message}
          </p>
        )}

        {tab === "users" && (
          <div className="admin-users">
            <div className="admin-users__toolbar">
              <input
                type="text"
                className="admin-users__search"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner" />
                Loading users...
              </div>
            ) : (
              <div className="admin-users__list">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="admin-user-card">
                    <div
                      className="admin-user-avatar"
                      style={{ background: avatarColor(u.email) }}
                    >
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="admin-user-card__info">
                      <span className="admin-user-card__email">
                        {u.email}
                        {u.emailVerified && (
                          <span
                            className="admin-verified-badge"
                            title="Email verified"
                          >
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="admin-user-card__name">
                        {u.name || "\u2014"}
                      </span>
                    </div>
                    <div className="admin-user-card__role">
                      <button
                        type="button"
                        className={`field-chip field-chip--muted${u.role === "user" ? " field-chip--active" : ""}`}
                        onClick={() =>
                          u.role !== "user" && handleRoleChange(u.id, "user")
                        }
                      >
                        user
                      </button>
                      <button
                        type="button"
                        className={`field-chip field-chip--accent${u.role === "admin" ? " field-chip--active" : ""}`}
                        onClick={() =>
                          u.role !== "admin" && handleRoleChange(u.id, "admin")
                        }
                      >
                        admin
                      </button>
                    </div>
                    <span className="admin-user-card__date">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      className="admin-user-card__delete"
                      onClick={() => handleDeleteUser(u.id)}
                      title="Delete user"
                      aria-label="Delete user"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4m2 0v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4h9.34z" />
                      </svg>
                    </button>
                  </div>
                ))}

                {filteredUsers.length === 0 && !loading && (
                  <div className="afw-empty-block">
                    {search ? "No users match your search." : "No users found."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "feedback" && <AdminFeedbackWorkflow />}
      </div>
    </div>
  );
}
