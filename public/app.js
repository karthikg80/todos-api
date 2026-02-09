        // Configuration
        const API_URL = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin;

        let currentUser = null;
        let authToken = null;
        let refreshToken = null;
        let todos = [];
        let users = [];
        let adminBootstrapAvailable = false;

        // Initialize app
        function init() {
            // Check for reset token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('token');

            if (resetToken) {
                showResetPassword(resetToken);
                return;
            }

            const token = localStorage.getItem('authToken');
            const refresh = localStorage.getItem('refreshToken');
            const user = localStorage.getItem('user');

            if (token && user) {
                authToken = token;
                refreshToken = refresh;
                currentUser = JSON.parse(user);
                showAppView();
                loadUserProfile();
            }
        }

        // API call with auto-refresh
        async function apiCall(url, options = {}) {
            if (!options.headers) options.headers = {};
            if (authToken && !options.skipAuth) {
                options.headers['Authorization'] = `Bearer ${authToken}`;
            }

            let response = await fetch(url, options);

            // Handle token expiration
            if (response.status === 401 && refreshToken && !options.skipRefresh) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers['Authorization'] = `Bearer ${authToken}`;
                    response = await fetch(url, options);
                } else {
                    logout();
                    return response;
                }
            }

            // If no refresh token is available, clear stale auth state on unauthorized responses.
            if (response.status === 401 && !refreshToken && !options.skipAuth) {
                logout();
            }

            return response;
        }

        // Refresh access token
        async function refreshAccessToken() {
            try {
                const response = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (response.ok) {
                    const data = await response.json();
                    authToken = data.token;
                    refreshToken = data.refreshToken;
                    localStorage.setItem('authToken', authToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    return true;
                }
            } catch (error) {
                console.error('Token refresh failed:', error);
            }
            return false;
        }

        // Switch auth tabs
        function switchAuthTab(tab, triggerEl) {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');

            if (triggerEl) {
                triggerEl.classList.add('active');
            }
            document.getElementById(tab + 'Form').style.display = 'block';
            hideMessage('authMessage');
        }

        // Show forgot password form
        function showForgotPassword() {
            document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
            document.getElementById('forgotPasswordForm').style.display = 'block';
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            hideMessage('authMessage');
        }

        // Show login form
        function showLogin() {
            document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
            document.getElementById('loginForm').style.display = 'block';
            document.querySelectorAll('.auth-tab')[0].classList.add('active');
            hideMessage('authMessage');
        }

        // Show reset password form
        function showResetPassword(token) {
            document.getElementById('resetPasswordForm').dataset.token = token;
            document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
            document.getElementById('resetPasswordForm').style.display = 'block';
        }

        // Handle login
        async function handleLogin(event) {
            event.preventDefault();
            hideMessage('authMessage');

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    authToken = data.token;
                    refreshToken = data.refreshToken;
                    currentUser = data.user;
                    localStorage.setItem('authToken', authToken);
                    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    showAppView();
                    loadUserProfile();
                } else {
                    showMessage('authMessage', data.error || 'Login failed', 'error');
                }
            } catch (error) {
                showMessage('authMessage', 'Network error. Please try again.', 'error');
                console.error('Login error:', error);
            }
        }

        // Handle registration
        async function handleRegister(event) {
            event.preventDefault();
            hideMessage('authMessage');

            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            const payload = { email, password };
            if (name) payload.name = name;

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    authToken = data.token;
                    refreshToken = data.refreshToken;
                    currentUser = data.user;
                    localStorage.setItem('authToken', authToken);
                    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    showMessage('authMessage', 'Account created successfully!', 'success');
                    setTimeout(() => {
                        showAppView();
                        loadUserProfile();
                    }, 1000);
                } else {
                    if (data.errors) {
                        const errorMsg = data.errors.map(e => e.message).join(', ');
                        showMessage('authMessage', errorMsg, 'error');
                    } else {
                        showMessage('authMessage', data.error || 'Registration failed', 'error');
                    }
                }
            } catch (error) {
                showMessage('authMessage', 'Network error. Please try again.', 'error');
                console.error('Registration error:', error);
            }
        }

        // Handle forgot password
        async function handleForgotPassword(event) {
            event.preventDefault();
            hideMessage('authMessage');

            const email = document.getElementById('forgotEmail').value;

            try {
                const response = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('authMessage', data.message || 'Reset link sent! Check your email.', 'success');
                    setTimeout(showLogin, 3000);
                } else {
                    showMessage('authMessage', data.error || 'Failed to send reset link', 'error');
                }
            } catch (error) {
                showMessage('authMessage', 'Network error. Please try again.', 'error');
                console.error('Forgot password error:', error);
            }
        }

        // Handle reset password
        async function handleResetPassword(event) {
            event.preventDefault();
            hideMessage('authMessage');

            const token = document.getElementById('resetPasswordForm').dataset.token;
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;

            if (password !== confirm) {
                showMessage('authMessage', 'Passwords do not match', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('authMessage', 'Password reset successfully! Redirecting to login...', 'success');
                    setTimeout(() => {
                        window.location.href = window.location.pathname;
                    }, 2000);
                } else {
                    showMessage('authMessage', data.error || 'Failed to reset password', 'error');
                }
            } catch (error) {
                showMessage('authMessage', 'Network error. Please try again.', 'error');
                console.error('Reset password error:', error);
            }
        }

        // Load user profile
        async function loadUserProfile() {
            try {
                const response = await apiCall(`${API_URL}/users/me`);
                if (response && response.ok) {
                    const user = await response.json();
                    currentUser = { ...currentUser, ...user };
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserDisplay();
                    await loadAdminBootstrapStatus();

                    // Check if admin and show admin tab
                    if (user.role === 'admin') {
                        document.getElementById('adminNavTab').style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Load profile error:', error);
            }
        }

        // Update user display
        function updateUserDisplay() {
            document.getElementById('userEmail').textContent = currentUser.email;

            const verifiedBadge = document.getElementById('verifiedBadge');
            if (currentUser.isVerified) {
                verifiedBadge.className = 'verified-badge';
                verifiedBadge.textContent = '✓ Verified';
            } else {
                verifiedBadge.className = 'unverified-badge';
                verifiedBadge.textContent = 'Not Verified';
            }

            const adminBadge = document.getElementById('adminBadge');
            if (currentUser.role === 'admin') {
                adminBadge.className = 'admin-badge';
                adminBadge.textContent = '⭐ Admin';
                adminBadge.style.display = 'inline-block';
            } else {
                adminBadge.style.display = 'none';
            }

            // Update profile view
            document.getElementById('profileEmail').textContent = currentUser.email;
            document.getElementById('profileName').textContent = currentUser.name || 'Not set';
            document.getElementById('profileStatus').textContent = currentUser.isVerified ? 'Verified ✓' : 'Not Verified';
            document.getElementById('profileCreated').textContent = new Date(currentUser.createdAt).toLocaleDateString();
            document.getElementById('updateName').value = currentUser.name || '';
            document.getElementById('updateEmail').value = currentUser.email;

            // Show/hide verification banner
            const verificationBanner = document.getElementById('verificationBanner');
            if (verificationBanner) {
                verificationBanner.style.display = currentUser.isVerified ? 'none' : 'block';
            }

            const adminBootstrapSection = document.getElementById('adminBootstrapSection');
            if (adminBootstrapSection) {
                const shouldShow = adminBootstrapAvailable && currentUser.role !== 'admin';
                adminBootstrapSection.style.display = shouldShow ? 'block' : 'none';
            }
        }

        async function loadAdminBootstrapStatus() {
            adminBootstrapAvailable = false;

            if (!currentUser || currentUser.role === 'admin') {
                updateUserDisplay();
                return;
            }

            try {
                const response = await apiCall(`${API_URL}/auth/bootstrap-admin/status`);
                if (response && response.ok) {
                    const status = await response.json();
                    adminBootstrapAvailable = !!status.enabled;
                }
            } catch (error) {
                console.error('Load bootstrap status error:', error);
            } finally {
                updateUserDisplay();
            }
        }

        async function handleAdminBootstrap(event) {
            event.preventDefault();
            hideMessage('profileMessage');

            const secretInput = document.getElementById('adminBootstrapSecret');
            const secret = secretInput.value;
            if (!secret) {
                showMessage('profileMessage', 'Bootstrap secret required', 'error');
                return;
            }

            try {
                const response = await apiCall(`${API_URL}/auth/bootstrap-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret })
                });

                const data = response ? await response.json() : {};
                if (response && response.ok) {
                    currentUser = { ...currentUser, ...data.user };
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    adminBootstrapAvailable = false;
                    document.getElementById('adminNavTab').style.display = 'block';
                    updateUserDisplay();
                    secretInput.value = '';
                    showMessage('profileMessage', 'Admin access granted for this account', 'success');
                    return;
                }

                showMessage('profileMessage', data.error || 'Failed to grant admin access', 'error');
                if (data.error === 'Admin already provisioned') {
                    adminBootstrapAvailable = false;
                    updateUserDisplay();
                }
            } catch (error) {
                showMessage('profileMessage', 'Network error. Please try again.', 'error');
                console.error('Bootstrap admin error:', error);
            }
        }

        // Resend verification email
        async function resendVerification() {
            hideMessage('profileMessage');

            if (!currentUser || !currentUser.email) {
                showMessage('profileMessage', 'User email not found', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUser.email })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('profileMessage', 'Verification email sent! Please check your inbox.', 'success');
                } else {
                    showMessage('profileMessage', data.error || 'Failed to send verification email', 'error');
                }
            } catch (error) {
                showMessage('profileMessage', 'Network error. Please try again.', 'error');
                console.error('Resend verification error:', error);
            }
        }

        // Handle update profile
        async function handleUpdateProfile(event) {
            event.preventDefault();
            hideMessage('profileMessage');

            const name = document.getElementById('updateName').value;
            const email = document.getElementById('updateEmail').value;

            try {
                const response = await apiCall(`${API_URL}/users/me`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name || null, email })
                });

                if (response && response.ok) {
                    const updatedUser = await response.json();
                    currentUser = { ...currentUser, ...updatedUser };
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserDisplay();
                    showMessage('profileMessage', 'Profile updated successfully!', 'success');
                } else {
                    const data = await response.json();
                    showMessage('profileMessage', data.error || 'Failed to update profile', 'error');
                }
            } catch (error) {
                showMessage('profileMessage', 'Network error. Please try again.', 'error');
                console.error('Update profile error:', error);
            }
        }

        // Load todos
        async function loadTodos() {
            try {
                const response = await apiCall(`${API_URL}/todos`);
                if (response && response.ok) {
                    todos = await response.json();

                    // DEBUG: Log what API returned
                    console.log('📥 Loaded todos from API:', todos.length);
                    todos.forEach((todo, i) => {
                        console.log(`Todo ${i}:`, {
                            id: todo.id,
                            title: todo.title,
                            priority: todo.priority,
                            notes: todo.notes,
                            notesLength: todo.notes ? todo.notes.length : 0
                        });
                    });

                    renderTodos();
                    updateCategoryFilter();
                } else {
                    todos = [];
                    selectedTodos.clear();
                    renderTodos();
                    updateCategoryFilter();
                    showMessage('todosMessage', 'Failed to load todos', 'error');
                }
            } catch (error) {
                todos = [];
                selectedTodos.clear();
                renderTodos();
                updateCategoryFilter();
                console.error('Load todos error:', error);
            }
        }

        // Add todo
        async function addTodo() {
            const input = document.getElementById('todoInput');
            const categoryInput = document.getElementById('todoCategoryInput');
            const dueDateInput = document.getElementById('todoDueDateInput');
            const notesInput = document.getElementById('todoNotesInput');

            const title = input.value.trim();
            if (!title) return;

            const payload = {
                title,
                priority: currentPriority
            };

            if (categoryInput.value.trim()) {
                payload.category = categoryInput.value.trim();
            }
            if (dueDateInput.value) {
                payload.dueDate = new Date(dueDateInput.value).toISOString();
            }
            if (notesInput.value.trim()) {
                payload.notes = notesInput.value.trim();
            }

            try {
                const response = await apiCall(`${API_URL}/todos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response && response.ok) {
                    const newTodo = await response.json();
                    todos.unshift(newTodo);
                    renderTodos();
                    updateCategoryFilter();

                    // Clear form
                    input.value = '';
                    categoryInput.value = '';
                    dueDateInput.value = '';
                    notesInput.value = '';

                    // Reset priority to medium
                    setPriority('medium');

                    // Hide notes input
                    notesInput.style.display = 'none';
                    document.getElementById('notesExpandIcon').classList.remove('expanded');
                }
            } catch (error) {
                console.error('Add todo error:', error);
            }
        }

        // Toggle todo
        async function toggleTodo(id, forceValue = null) {
            const todo = todos.find(t => t.id === id);
            if (!todo) return;

            const newCompletedValue = forceValue !== null ? forceValue : !todo.completed;

            try {
                const response = await apiCall(`${API_URL}/todos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: newCompletedValue })
                });

                if (response && response.ok) {
                    const updatedTodo = await response.json();
                    todos = todos.map(t => t.id === id ? updatedTodo : t);
                    renderTodos();

                    // Add undo action only if user initiated (not programmatic)
                    if (forceValue === null && newCompletedValue) {
                        addUndoAction('complete', { id }, 'Todo marked as complete');
                    }
                }
            } catch (error) {
                console.error('Toggle todo error:', error);
            }
        }

        // Delete todo
        async function deleteTodo(id) {
            const todo = todos.find(t => t.id === id);
            if (!todo) return;

            if (!confirm('Delete this todo?')) return;

            // Store todo data for undo
            const todoData = { ...todo };

            try {
                const response = await apiCall(`${API_URL}/todos/${id}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    todos = todos.filter(t => t.id !== id);
                    selectedTodos.delete(id);
                    renderTodos();
                    updateCategoryFilter();

                    // Add undo action
                    addUndoAction('delete', todoData, 'Todo deleted');
                    await loadTodos();
                    return;
                }

                const errorData = response ? await response.json().catch(() => ({})) : {};
                showMessage('todosMessage', errorData.error || 'Failed to delete todo', 'error');
            } catch (error) {
                showMessage('todosMessage', 'Network error while deleting todo', 'error');
                console.error('Delete todo error:', error);
            }
        }

        // Update category filter dropdown
        function updateCategoryFilter() {
            const categories = [...new Set(todos.map(t => t.category).filter(Boolean))];
            const filterSelect = document.getElementById('categoryFilter');
            const currentValue = filterSelect.value;

            filterSelect.innerHTML = '<option value="">All Categories</option>' +
                categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

            if (categories.includes(currentValue)) {
                filterSelect.value = currentValue;
            }
        }

        // Filter todos by category and search
        function filterTodosList(todosList) {
            let filtered = todosList;

            // Category filter
            const categoryFilter = document.getElementById('categoryFilter').value;
            if (categoryFilter) {
                filtered = filtered.filter(todo => todo.category === categoryFilter);
            }

            // Search filter
            const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim();
            if (searchQuery) {
                filtered = filtered.filter(todo =>
                    todo.title.toLowerCase().includes(searchQuery) ||
                    (todo.description && todo.description.toLowerCase().includes(searchQuery)) ||
                    (todo.category && todo.category.toLowerCase().includes(searchQuery))
                );
            }

            return filtered;
        }

        // Called when filter changes
        function filterTodos() {
            renderTodos();
        }

        // Clear all filters
        function clearFilters() {
            document.getElementById('categoryFilter').value = '';
            document.getElementById('searchInput').value = '';
            renderTodos();
        }

        // Render todos
        function renderTodos() {
            const container = document.getElementById('todosContent');

            // Debug: Log todos with notes
            const todosWithNotes = todos.filter(t => t.notes);
            if (todosWithNotes.length > 0) {
                console.log('Todos with notes:', todosWithNotes.map(t => ({id: t.id, title: t.title, notes: t.notes})));
            }

            if (todos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✨</div>
                        <p>No todos yet. Add one above!</p>
                    </div>
                `;
                updateBulkActionsVisibility();
                return;
            }

            const filteredTodos = filterTodosList(todos);

            container.innerHTML = `
                <ul class="todos-list">
                    ${filteredTodos.map((todo, index) => {
                        const isOverdue = todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
                        const dueDateStr = todo.dueDate ? new Date(todo.dueDate).toLocaleString() : '';
                        const isSelected = selectedTodos.has(todo.id);

                        return `
                        <li class="todo-item ${todo.completed ? 'completed' : ''}"
                            draggable="true"
                            data-todo-id="${todo.id}"
                            data-ondragstart="handleDragStart(event)"
                            data-ondragover="handleDragOver(event)"
                            data-ondrop="handleDrop(event)"
                            data-ondragend="handleDragEnd(event)">
                            <input
                                type="checkbox"
                                class="bulk-checkbox"
                                aria-label="Select todo ${escapeHtml(todo.title)}"
                                ${isSelected ? 'checked' : ''}
                                data-onchange="toggleSelectTodo('${todo.id}')"
                                data-onclick="event.stopPropagation()"
                            >
                            <span class="drag-handle">⋮⋮</span>
                            <input
                                type="checkbox"
                                class="todo-checkbox"
                                aria-label="Mark todo ${escapeHtml(todo.title)} complete"
                                ${todo.completed ? 'checked' : ''}
                                data-onchange="toggleTodo('${todo.id}')"
                            >
                            <div class="todo-content" style="flex: 1;">
                                <div class="todo-title">${escapeHtml(todo.title)}</div>
                                ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ''}
                                <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
                                    ${getPriorityIcon(todo.priority)} <span class="priority-badge ${todo.priority}">${todo.priority.toUpperCase()}</span>
                                    ${todo.category ? `<span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">🏷️ ${escapeHtml(todo.category)}</span>` : ''}
                                    ${todo.dueDate ? `<span style="background: ${isOverdue ? '#ff4757' : '#48dbfb'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${isOverdue ? '⚠️' : '📅'} ${dueDateStr}</span>` : ''}
                                </div>
                                ${todo.subtasks && todo.subtasks.length > 0 ? renderSubtasks(todo) : ''}
                                ${todo.notes && todo.notes.trim() ? `
                                    <div class="notes-section">
                                        <button class="notes-toggle" data-onclick="toggleNotes('${todo.id}', event)">
                                            <span class="expand-icon" id="notes-icon-${todo.id}">▶</span>
                                            <span>📝 Notes</span>
                                        </button>
                                        <div class="notes-content" id="notes-content-${todo.id}" style="display: none;">
                                            ${escapeHtml(String(todo.notes))}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <button class="delete-btn" data-onclick="deleteTodo('${todo.id}')">Delete</button>
                        </li>
                    `}).join('')}
                </ul>
            `;

            updateBulkActionsVisibility();
        }

        // ========== PHASE B: PRIORITY, NOTES, SUBTASKS ==========
        let currentPriority = 'medium';

        function handleTodoKeyPress(event) {
            if (event.key === 'Enter') {
                addTodo();
            }
        }

        function setPriority(priority) {
            currentPriority = priority;

            // Update button states
            document.querySelectorAll('.priority-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById(`priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`).classList.add('active');
        }

        function getPriorityIcon(priority) {
            const icons = {
                high: '🔴',
                medium: '🟡',
                low: '🟢'
            };
            return icons[priority] || icons.medium;
        }

        function toggleNotesInput() {
            const notesInput = document.getElementById('todoNotesInput');
            const icon = document.getElementById('notesExpandIcon');

            if (notesInput.style.display === 'none') {
                notesInput.style.display = 'block';
                icon.classList.add('expanded');
            } else {
                notesInput.style.display = 'none';
                icon.classList.remove('expanded');
            }
        }

        function toggleNotes(todoId, event) {
            event.stopPropagation();
            const content = document.getElementById(`notes-content-${todoId}`);
            const icon = document.getElementById(`notes-icon-${todoId}`);

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.add('expanded');
            } else {
                content.style.display = 'none';
                icon.classList.remove('expanded');
            }
        }

        function renderSubtasks(todo) {
            const completedCount = todo.subtasks.filter(s => s.completed).length;
            const totalCount = todo.subtasks.length;

            return `
                <div class="subtasks-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 0.85em; color: var(--text-secondary);">
                            ☑️ Subtasks: ${completedCount}/${totalCount}
                        </span>
                    </div>
                    <ul class="subtask-list">
                        ${todo.subtasks.map(subtask => `
                            <li class="subtask-item ${subtask.completed ? 'completed' : ''}">
                                <input
                                    type="checkbox"
                                    class="todo-checkbox"
                                    aria-label="Mark subtask ${escapeHtml(subtask.title)} complete"
                                    style="width: 16px; height: 16px;"
                                    ${subtask.completed ? 'checked' : ''}
                                    data-onchange="toggleSubtask('${todo.id}', '${subtask.id}')"
                                >
                                <span class="subtask-title">${escapeHtml(subtask.title)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        async function toggleSubtask(todoId, subtaskId) {
            const todo = todos.find(t => t.id === todoId);
            if (!todo || !todo.subtasks) return;

            const subtask = todo.subtasks.find(s => s.id === subtaskId);
            if (!subtask) return;

            try {
                const response = await apiCall(`${API_URL}/todos/${todoId}/subtasks/${subtaskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: !subtask.completed })
                });

                if (response && response.ok) {
                    const updatedSubtask = await response.json();
                    todo.subtasks = todo.subtasks.map(s => s.id === subtaskId ? updatedSubtask : s);
                    renderTodos();
                }
            } catch (error) {
                console.error('Toggle subtask failed:', error);
            }
        }

        // ========== PHASE A: DRAG & DROP FUNCTIONALITY ==========
        let draggedTodoId = null;
        let draggedOverTodoId = null;

        function handleDragStart(e) {
            draggedTodoId = e.target.dataset.todoId;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const todoId = e.currentTarget.dataset.todoId;
            if (todoId !== draggedTodoId) {
                e.currentTarget.classList.add('drag-over');
                draggedOverTodoId = todoId;
            }
        }

        function handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();

            const dropTargetId = e.currentTarget.dataset.todoId;
            e.currentTarget.classList.remove('drag-over');

            if (draggedTodoId && dropTargetId && draggedTodoId !== dropTargetId) {
                reorderTodos(draggedTodoId, dropTargetId);
            }
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.todo-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            draggedTodoId = null;
            draggedOverTodoId = null;
        }

        async function reorderTodos(draggedId, targetId) {
            const draggedIndex = todos.findIndex(t => t.id === draggedId);
            const targetIndex = todos.findIndex(t => t.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            // Reorder in local array
            const [draggedTodo] = todos.splice(draggedIndex, 1);
            todos.splice(targetIndex, 0, draggedTodo);

            // Update order values
            todos.forEach((todo, index) => {
                todo.order = index;
            });

            renderTodos();

            // Persist complete ordering on backend in a single request.
            try {
                const response = await apiCall(`${API_URL}/todos/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        todos.map((todo) => ({ id: todo.id, order: todo.order }))
                    )
                });

                if (!response || !response.ok) {
                    console.error('Failed to persist full todo ordering, reloading from server');
                    await loadTodos();
                }
            } catch (error) {
                console.error('Failed to update todo order:', error);
                await loadTodos();
            }
        }

        // ========== PHASE A: BULK ACTIONS ==========
        let selectedTodos = new Set();

        function toggleSelectTodo(todoId) {
            if (selectedTodos.has(todoId)) {
                selectedTodos.delete(todoId);
            } else {
                selectedTodos.add(todoId);
            }
            updateBulkActionsVisibility();
            updateSelectAllCheckbox();
        }

        function toggleSelectAll() {
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            const filteredTodos = filterTodosList(todos);

            if (selectAllCheckbox.checked) {
                filteredTodos.forEach(todo => selectedTodos.add(todo.id));
            } else {
                filteredTodos.forEach(todo => selectedTodos.delete(todo.id));
            }

            renderTodos();
        }

        function updateSelectAllCheckbox() {
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            const filteredTodos = filterTodosList(todos);
            const allSelected = filteredTodos.length > 0 && filteredTodos.every(todo => selectedTodos.has(todo.id));

            selectAllCheckbox.checked = allSelected;
        }

        function updateBulkActionsVisibility() {
            const toolbar = document.getElementById('bulkActionsToolbar');
            const bulkCount = document.getElementById('bulkCount');

            if (selectedTodos.size > 0) {
                toolbar.style.display = 'flex';
                bulkCount.textContent = `${selectedTodos.size} selected`;
            } else {
                toolbar.style.display = 'none';
            }

            updateSelectAllCheckbox();
        }

        async function completeSelected() {
            if (selectedTodos.size === 0) return;

            const selectedIds = Array.from(selectedTodos);
            const completedIds = [];

            for (const todoId of selectedIds) {
                try {
                    const response = await apiCall(`${API_URL}/todos/${todoId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed: true })
                    });

                    if (response && response.ok) {
                        const todo = todos.find(t => t.id === todoId);
                        if (todo) {
                            todo.completed = true;
                            completedIds.push(todoId);
                        }
                    }
                } catch (error) {
                    console.error('Failed to complete todo:', error);
                }
            }

            if (completedIds.length > 0) {
                addUndoAction('bulk-complete', completedIds, `${completedIds.length} todos marked as complete`);
            }

            selectedTodos.clear();
            renderTodos();
        }

        async function deleteSelected() {
            if (selectedTodos.size === 0) return;

            if (!confirm(`Delete ${selectedTodos.size} selected todo(s)?`)) return;

            const selectedIds = Array.from(selectedTodos);
            const deletedTodos = [];
            let deletedCount = 0;

            for (const todoId of selectedIds) {
                try {
                    const response = await apiCall(`${API_URL}/todos/${todoId}`, {
                        method: 'DELETE'
                    });

                    if (response && response.ok) {
                        const todo = todos.find(t => t.id === todoId);
                        if (todo) {
                            deletedTodos.push({ ...todo });
                        }
                        todos = todos.filter(t => t.id !== todoId);
                        deletedCount += 1;
                    } else {
                        const errorData = response ? await response.json().catch(() => ({})) : {};
                        console.error('Failed to delete todo:', todoId, errorData.error || 'Unknown error');
                    }
                } catch (error) {
                    console.error('Failed to delete todo:', error);
                }
            }

            if (deletedTodos.length > 0) {
                addUndoAction('bulk-delete', deletedTodos, `${deletedTodos.length} todos deleted`);
            }

            selectedTodos.clear();
            renderTodos();
            updateCategoryFilter();
            if (deletedCount > 0) {
                await loadTodos();
            }
        }

        // ========== PHASE A: KEYBOARD SHORTCUTS ==========
        function toggleShortcuts() {
            const overlay = document.getElementById('shortcutsOverlay');
            overlay.classList.toggle('active');
        }

        function closeShortcutsOverlay(event) {
            if (event.target.id === 'shortcutsOverlay') {
                toggleShortcuts();
            }
        }

        // ========== PHASE E: UNDO/REDO FUNCTIONALITY ==========
        let undoStack = [];
        let undoTimeout = null;

        function addUndoAction(action, data, message) {
            undoStack.push({ action, data, timestamp: Date.now() });

            // Keep only last 10 actions
            if (undoStack.length > 10) {
                undoStack.shift();
            }

            showUndoToast(message);
        }

        function showUndoToast(message) {
            const toast = document.getElementById('undoToast');
            const messageEl = document.getElementById('undoMessage');

            messageEl.textContent = message;
            toast.classList.add('active');

            // Clear existing timeout
            if (undoTimeout) {
                clearTimeout(undoTimeout);
            }

            // Hide after 5 seconds
            undoTimeout = setTimeout(() => {
                toast.classList.remove('active');
            }, 5000);
        }

        function performUndo() {
            if (undoStack.length === 0) return;

            const lastAction = undoStack.pop();
            const toast = document.getElementById('undoToast');
            toast.classList.remove('active');

            switch (lastAction.action) {
                case 'delete':
                    // Restore deleted todo
                    restoreTodo(lastAction.data);
                    break;
                case 'complete':
                    // Uncomplete todo
                    toggleTodo(lastAction.data.id, false);
                    break;
                case 'bulk-delete':
                    // Restore multiple todos
                    lastAction.data.forEach(todo => restoreTodo(todo));
                    break;
                case 'bulk-complete':
                    // Uncomplete multiple todos
                    lastAction.data.forEach(todoId => toggleTodo(todoId, false));
                    break;
            }
        }

        async function restoreTodo(todoData) {
            try {
                const createPayload = {
                    title: todoData.title,
                    description: todoData.description,
                    category: todoData.category,
                    dueDate: todoData.dueDate,
                    priority: todoData.priority,
                    notes: todoData.notes,
                };

                const response = await apiCall(`${API_URL}/todos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createPayload)
                });

                if (response && response.ok) {
                    const newTodo = await response.json();
                    let todoToRender = newTodo;

                    // Preserve state that is not supported in create payload.
                    if (todoData.completed === true || Number.isInteger(todoData.order)) {
                        const updateResponse = await apiCall(`${API_URL}/todos/${newTodo.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                completed: !!todoData.completed,
                                ...(Number.isInteger(todoData.order) ? { order: todoData.order } : {})
                            })
                        });

                        if (updateResponse && updateResponse.ok) {
                            todoToRender = await updateResponse.json();
                        }
                    }

                    todos.push(todoToRender);
                    todos.sort((a, b) => {
                        const aOrder = Number.isInteger(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
                        const bOrder = Number.isInteger(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
                        return aOrder - bOrder;
                    });
                    renderTodos();
                    updateCategoryFilter();
                }
            } catch (error) {
                console.error('Failed to restore todo:', error);
            }
        }

        document.addEventListener('keydown', function(e) {
            // Ignore if typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                // Allow Esc to clear search
                if (e.key === 'Escape' && e.target.id === 'searchInput') {
                    e.target.value = '';
                    filterTodos();
                    e.target.blur();
                }
                return;
            }

            // Ctrl/Cmd + N: Focus on new todo input
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                document.getElementById('todoInput')?.focus();
            }

            // Ctrl/Cmd + F: Focus on search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }

            // Ctrl/Cmd + A: Select all todos
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const selectAllCheckbox = document.getElementById('selectAllCheckbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = true;
                    toggleSelectAll();
                }
            }

            // ?: Show keyboard shortcuts
            if (e.key === '?') {
                e.preventDefault();
                toggleShortcuts();
            }
        });

        // Load admin users
        async function loadAdminUsers() {
            hideMessage('adminMessage');

            try {
                const response = await apiCall(`${API_URL}/admin/users`);
                if (response && response.ok) {
                    users = await response.json();
                    renderAdminUsers();
                } else {
                    const data = await response.json();
                    showMessage('adminMessage', data.error || 'Failed to load users', 'error');
                }
            } catch (error) {
                showMessage('adminMessage', 'Network error. Please try again.', 'error');
                console.error('Load users error:', error);
            }
        }

        // Render admin users
        function renderAdminUsers() {
            const container = document.getElementById('adminContent');

            container.innerHTML = `
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
                        ${users.map(user => `
                            <tr>
                                <td>${escapeHtml(user.email)}</td>
                                <td>${escapeHtml(user.name || '-')}</td>
                                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                                <td>${user.isVerified ? '✓' : '✗'}</td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${user.id !== currentUser.id ? `
                                        ${user.role === 'user' ? `
                                            <button class="action-btn promote" data-onclick="changeUserRole('${user.id}', 'admin')">Make Admin</button>
                                        ` : `
                                            <button class="action-btn demote" data-onclick="changeUserRole('${user.id}', 'user')">Remove Admin</button>
                                        `}
                                        <button class="action-btn delete" data-onclick="deleteUser('${user.id}')">Delete</button>
                                    ` : '<em>You</em>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        // Change user role
        async function changeUserRole(userId, role) {
            hideMessage('adminMessage');

            try {
                const response = await apiCall(`${API_URL}/admin/users/${userId}/role`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role })
                });

                if (response && response.ok) {
                    showMessage('adminMessage', `User role updated to ${role}`, 'success');
                    loadAdminUsers();
                } else {
                    const data = await response.json();
                    showMessage('adminMessage', data.error || 'Failed to update role', 'error');
                }
            } catch (error) {
                showMessage('adminMessage', 'Network error. Please try again.', 'error');
                console.error('Change role error:', error);
            }
        }

        // Delete user
        async function deleteUser(userId) {
            if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

            hideMessage('adminMessage');

            try {
                const response = await apiCall(`${API_URL}/admin/users/${userId}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    showMessage('adminMessage', 'User deleted successfully', 'success');
                    loadAdminUsers();
                } else {
                    const data = await response.json();
                    showMessage('adminMessage', data.error || 'Failed to delete user', 'error');
                }
            } catch (error) {
                showMessage('adminMessage', 'Network error. Please try again.', 'error');
                console.error('Delete user error:', error);
            }
        }

        // Switch view
        function switchView(view) {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

            document.getElementById(view + 'View').classList.add('active');
            event.target.classList.add('active');

            if (view === 'todos') {
                loadTodos();
            } else if (view === 'profile') {
                updateUserDisplay();
            } else if (view === 'admin') {
                loadAdminUsers();
            }
        }

        // Handle todo keypress
        function handleTodoKeyPress(event) {
            if (event.key === 'Enter') {
                addTodo();
            }
        }

        // Logout
        async function logout() {
            const tokenToRevoke = refreshToken || localStorage.getItem('refreshToken');

            if (tokenToRevoke) {
                fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: tokenToRevoke })
                }).catch((error) => {
                    console.error('Logout token revocation failed:', error);
                });
            }

            authToken = null;
            refreshToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            todos = [];
            showAuthView();
        }

        // Show app view
        function showAppView() {
            document.getElementById('authView').classList.remove('active');
            document.getElementById('todosView').classList.add('active');
            document.getElementById('navTabs').style.display = 'flex';
            document.getElementById('userBar').style.display = 'flex';
            document.querySelectorAll('.nav-tab')[0].classList.add('active');
            // Prevent previous account data from flashing while fetching current user's data.
            todos = [];
            selectedTodos.clear();
            renderTodos();
            updateCategoryFilter();
            loadTodos();
        }

        // Show auth view
        function showAuthView() {
            document.getElementById('authView').classList.add('active');
            document.getElementById('todosView').classList.remove('active');
            document.getElementById('profileView').classList.remove('active');
            document.getElementById('adminView').classList.remove('active');
            document.getElementById('navTabs').style.display = 'none';
            document.getElementById('userBar').style.display = 'none';
            document.getElementById('adminNavTab').style.display = 'none';
            adminBootstrapAvailable = false;
            showLogin();
        }

        // Show/hide messages
        function showMessage(id, message, type) {
            const el = document.getElementById(id);
            el.textContent = message;
            el.className = `message ${type} show`;
        }

        function hideMessage(id) {
            const el = document.getElementById(id);
            el.classList.remove('show');
        }

        // Escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Dark mode toggle
        function toggleTheme() {
            const body = document.body;
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');

            // Update toggle button icon
            const toggleBtn = document.querySelector('.theme-toggle');
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        }

        // Initialize theme
        function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

            if (shouldBeDark) {
                document.body.classList.add('dark-mode');
                const toggleBtn = document.querySelector('.theme-toggle');
                if (toggleBtn) toggleBtn.textContent = '☀️';
            }
        }

        // ========== PHASE E: SERVICE WORKER REGISTRATION ==========
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                const shouldRegister =
                    window.location.protocol === 'https:' &&
                    window.location.hostname !== 'localhost';

                if (!shouldRegister) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((registration) => registration.unregister()));
                    return;
                }

                navigator.serviceWorker.register('/service-worker.js')
                    .then((registration) => {
                        console.log('Service Worker registered successfully:', registration.scope);
                    })
                    .catch((error) => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }

        function invokeBoundExpression(expression, event, element) {
            const source = expression.trim().replace(/;$/, '');
            if (!source) return;

            const eventMethodMatch = source.match(/^event\.([A-Za-z_$][\w$]*)\(\)$/);
            if (eventMethodMatch) {
                const methodName = eventMethodMatch[1];
                const method = event?.[methodName];
                if (typeof method === 'function') {
                    method.call(event);
                }
                return;
            }

            const callMatch = source.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
            if (!callMatch) return;

            const functionName = callMatch[1];
            const rawArgs = callMatch[2].trim();
            const target = window[functionName];
            if (typeof target !== 'function') return;

            const tokens = rawArgs === '' ? [] : rawArgs.match(/'[^']*'|\"[^\"]*\"|[^,]+/g) || [];
            const args = tokens.map((token) => {
                const arg = token.trim();
                if (arg === 'event') return event;
                if (arg === 'this') return element;
                if (/^'.*'$/.test(arg) || /^\".*\"$/.test(arg)) return arg.slice(1, -1);
                if (arg === 'true') return true;
                if (arg === 'false') return false;
                if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
                return arg;
            });

            target(...args);
        }

        function bindDeclarativeHandlers() {
            if (window.__declarativeHandlersBound) {
                return;
            }
            window.__declarativeHandlersBound = true;

            const events = ['click', 'submit', 'input', 'change', 'keypress', 'dragstart', 'dragover', 'drop', 'dragend'];

            for (const eventType of events) {
                const attribute = `on${eventType}`;
                document.addEventListener(eventType, (event) => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    const element = target.closest(`[data-${attribute}]`);
                    if (!element) return;
                    const expression = element.dataset[attribute];
                    if (!expression) return;
                    invokeBoundExpression(expression, event, element);
                });
            }
        }

        // Initialize theme immediately
        initTheme();

        // Initialize on load
        bindDeclarativeHandlers();
        init();
