// =============================================================================
// adminUsers.js — Admin user management: load, render, role change, delete.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";

// Load admin users
async function loadAdminUsers() {
  hooks.hideMessage("adminMessage");

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/admin/users`);
    if (response && response.ok) {
      state.users = await response.json();
      renderAdminUsers();
    } else {
      const data = await response.json();
      hooks.showMessage(
        "adminMessage",
        data.error || "Failed to load users",
        "error",
      );
    }
  } catch (error) {
    hooks.showMessage(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    console.error("Load users error:", error);
  }
}

// Render admin users
function renderAdminUsers() {
  const container =
    document.getElementById("adminUsersContent") ||
    document.getElementById("adminContent");

  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.innerHTML = `
                <div class="admin-section__header">
                    <div>
                        <h3 class="admin-section__title">User Management</h3>
                        <p class="admin-section__subtitle">Manage admin access and account cleanup.</p>
                    </div>
                </div>
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Verified</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.users
                          .map(
                            (user) => `
                            <tr>
                                <td>${hooks.escapeHtml(user.email)}</td>
                                <td>${hooks.escapeHtml(user.name || "-")}</td>
                                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                                <td>${user.isVerified ? "✓" : "✗"}</td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${
                                      user.id !== state.currentUser.id
                                        ? `
                                        ${
                                          user.role === "user"
                                            ? `
                                            <button class="action-btn promote" data-onclick="changeUserRole('${user.id}', 'admin')">Make Admin</button>
                                        `
                                            : `
                                            <button class="action-btn demote" data-onclick="changeUserRole('${user.id}', 'user')">Remove Admin</button>
                                        `
                                        }
                                        <button class="action-btn delete" data-onclick="deleteUser('${user.id}')">Delete</button>
                                    `
                                        : "<em>You</em>"
                                    }
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            `;
}

// Change user role
async function changeUserRole(userId, role) {
  hooks.hideMessage("adminMessage");

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/users/${userId}/role`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );

    if (response && response.ok) {
      hooks.showMessage(
        "adminMessage",
        `User role updated to ${role}`,
        "success",
      );
      loadAdminUsers();
    } else {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage(
        "adminMessage",
        data.error || "Failed to update role",
        "error",
      );
    }
  } catch (error) {
    hooks.showMessage(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    console.error("Change role error:", error);
  }
}

// Delete user
async function deleteUser(userId) {
  if (
    !(await hooks.showConfirmDialog(
      "Are you sure you want to delete this user? This action cannot be undone.",
    ))
  )
    return;

  hooks.hideMessage("adminMessage");

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/users/${userId}`,
      {
        method: "DELETE",
      },
    );

    if (response && response.ok) {
      hooks.showMessage("adminMessage", "User deleted successfully", "success");
      loadAdminUsers();
    } else {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage(
        "adminMessage",
        data.error || "Failed to delete user",
        "error",
      );
    }
  } catch (error) {
    hooks.showMessage(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    console.error("Delete user error:", error);
  }
}

export { loadAdminUsers, renderAdminUsers, changeUserRole, deleteUser };
