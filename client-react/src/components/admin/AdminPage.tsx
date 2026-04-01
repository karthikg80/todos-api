import { useState, useEffect, useCallback } from "react";
import { apiCall } from "../../api/client";
import { AdminFeedbackWorkflow } from "./AdminFeedbackWorkflow";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

interface Props {
  onBack: () => void;
}

export function AdminPage({ onBack }: Props) {
  const [tab, setTab] = useState<"users" | "feedback">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

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

  return (
    <div id="adminPane" className="admin-page">
      <div className="admin-page__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2 className="admin-page__title">Admin</h2>
      </div>

      <div className="admin-page__tabs">
        <button
          className={`ai-workspace__tab${tab === "users" ? " ai-workspace__tab--active" : ""}`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          className={`ai-workspace__tab${tab === "feedback" ? " ai-workspace__tab--active" : ""}`}
          onClick={() => setTab("feedback")}
        >
          Feedback
        </button>
      </div>

      {message && (
        <p id="adminMessage" className="settings-message">
          {message}
        </p>
      )}

      <div id="adminContent" className="admin-page__content">
        {loading && <p>Loading…</p>}

        {tab === "users" && !loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name || "—"}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="admin-table__select"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn--danger"
                      style={{
                        fontSize: "var(--fs-label)",
                        padding: "var(--s-0) var(--s-2)",
                      }}
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "feedback" && !loading && <AdminFeedbackWorkflow />}
      </div>
    </div>
  );
}
