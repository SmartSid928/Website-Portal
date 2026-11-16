// Idea - Student & Teacher Project Portal (Connected with Django Backend)

const icons = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h4l2 2h6A2.5 2.5 0 0 1 20.5 9v8A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7Z"/><path d="M4 10h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 20v-1.8a3.2 3.2 0 0 0-3.2-3.2H7.2A3.2 3.2 0 0 0 4 18.2V20"/><circle cx="10" cy="7.5" r="3.5"/><path d="M16 4.2a3.5 3.5 0 0 1 0 6.7M20 20v-1.8a3.2 3.2 0 0 0-2.4-3.1"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 3-7.5 18-3.7-7.8L2 9.5 21 3Z"/><path d="M9.8 13.2 15 8"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z"/><path d="M13 3v7h7M8 15h8M8 18h6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

// CSRF helper
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function getCsrfToken() {
  const cookieToken = getCookie('csrftoken');
  if (cookieToken) return cookieToken;
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  return '';
}

async function apiFetch(url, options = {}) {
  const defaults = {
    headers: {
      'X-CSRFToken': getCsrfToken(),
      'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'same-origin'
  };

  if (options.body && !(options.body instanceof FormData)) {
    defaults.headers['Content-Type'] = 'application/json';
  }

  const mergedHeaders = Object.assign({}, defaults.headers, options.headers || {});
  return fetch(url, Object.assign({}, defaults, options, { headers: mergedHeaders }));
}

const state = {
  role: "student",
  account: null,
  page: "overview",
  teamName: "",
  isTeamLeader: false,
  courseName: "",
  selectedThread: "team",
  projects: [],
  members: [],
  pendingInvitations: [],
  queries: [],
  messages: { team: [], studio: [], teacher: [] },
  teacherSubmissions: [],
  unreadNotifications: 0
};

const pageNames = {
  overview: "Overview",
  projects: "My projects",
  team: "My team",
  queries: "Queries",
  messages: "Team chat"
};

const content = document.getElementById("content");

function statusClass(status) {
  if (status === "Approved") return "approved";
  if (status === "In review") return "review";
  return "draft";
}

function projectRow(project) {
  return `<div class="project-row">
    <div class="project-icon ${project.color || 'orange'}">${icons.file}</div>
    <div class="project-info">
      <div class="project-name">${escapeHtml(project.name)}</div>
      <div class="project-meta">${escapeHtml(project.type)} · ${escapeHtml(project.date)}</div>
    </div>
    <span class="status ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
  </div>`;
}

function renderMemberRow(member) {
  const isPending = member.status === 'pending';
  const isLeader = !!member.leader;

  let rightContent = '';
  if (isLeader) {
    rightContent = '<span class="leader-tag">LEADER</span>';
  } else {
    const parts = [];
    if (isPending) {
      parts.push('<span class="pending-tag" style="background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;padding:3px 9px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.3px;">PENDING INVITE</span>');
    }
    if (state.isTeamLeader) {
      parts.push(`<button class="button-secondary" type="button" data-edit-member="${member.id}" style="padding:4px 10px;font-size:11px;height:auto;line-height:1.2;border-radius:6px;cursor:pointer;" title="Edit member details">Edit</button>`);
      parts.push(`<button class="button-secondary" type="button" data-delete-member="${member.id}" style="padding:4px 10px;font-size:11px;height:auto;line-height:1.2;border-radius:6px;color:#d32f2f;border-color:#ffcdd2;cursor:pointer;" title="${isPending ? 'Cancel invitation' : 'Remove member from team'}">${isPending ? 'Cancel' : 'Remove'}</button>`);
    }
    if (parts.length) {
      rightContent = `<div class="member-actions" style="display:flex;align-items:center;gap:6px;margin-left:auto;">${parts.join('')}</div>`;
    }
  }

  return `<div class="member-row" style="${isPending ? 'background:#faf9fe;border-radius:8px;padding:6px 10px;margin-bottom:6px;border:1px dashed #dedaf5;' : ''}">
    <div class="avatar ${member.color || ''}" style="${isPending ? 'opacity:0.75;' : ''}">${escapeHtml(member.initials || getInitials(member.name))}</div>
    <div class="member-details">
      <div class="member-name">${escapeHtml(member.name)}</div>
      <div class="member-role">${escapeHtml(member.role)}${isPending ? ' · Awaiting student acceptance' : ''}</div>
    </div>
    ${rightContent}
  </div>`;
}

function membersList() {
  const accepted = state.members.filter(m => m.status !== 'pending');
  const pending = state.members.filter(m => m.status === 'pending');

  let html = '';
  if (accepted.length) {
    html += accepted.map(renderMemberRow).join("");
  } else {
    html += '<div class="empty-state" style="padding:10px 0;">No active members yet.</div>';
  }

  if (pending.length) {
    html += `
      <div class="pending-members-section" style="margin-top:14px;padding-top:12px;border-top:1px dashed #dedaf5;">
        <div style="font-size:11px;font-weight:700;color:#e65100;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span>Pending Invitations (${pending.length})</span>
          <span style="font-size:10px;font-weight:500;color:#8f95b2;text-transform:none;">— awaiting student acceptance</span>
        </div>
        ${pending.map(renderMemberRow).join("")}
      </div>
    `;
  }

  return html;
}

function queriesList() {
  return state.queries.map(query => `<div class="query-item">
    <span class="query-bullet ${query.answered ? "answered" : ""}"></span>
    <div class="query-copy">
      <div class="query-title">${escapeHtml(query.title)}</div>
      <div class="query-meta">${escapeHtml(query.meta)}</div>
      ${query.response ? `<div style="margin-top:4px;color:#28a879;font-size:11px"><strong>Teacher reply:</strong> ${escapeHtml(query.response)}</div>` : ''}
    </div>
  </div>`).join("");
}

// ----------------- Notification Popover & Badge -----------------
let currentNotifFilter = 'all';
let cachedNotifications = [];

function updateNotificationBadge(unreadCount) {
  state.unreadNotifications = Number(unreadCount) || 0;
  const badge = document.getElementById('notificationBadge');
  const badgeCount = document.getElementById('notifBadgeCount');

  if (badge) {
    if (state.unreadNotifications > 0) {
      badge.textContent = state.unreadNotifications > 99 ? '99+' : state.unreadNotifications;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  if (badgeCount) {
    badgeCount.textContent = state.unreadNotifications > 0 ? `${state.unreadNotifications} New` : '0 New';
  }
}

function toggleNotificationsDropdown(open) {
  const dropdown = document.getElementById('notificationsDropdown');
  const btn = document.getElementById('notificationButton');
  if (!dropdown) return;

  const shouldOpen = open !== undefined ? open : dropdown.classList.contains('hidden');
  if (shouldOpen) {
    dropdown.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    loadAndRenderNotifications();
  } else {
    dropdown.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

async function loadAndRenderNotifications() {
  const listEl = document.getElementById('notificationsList');
  if (!listEl) return;

  listEl.innerHTML = '<div class="empty-state" style="padding:28px 16px;">Loading notifications...</div>';

  try {
    const res = await apiFetch('/api/notifications/');
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    cachedNotifications = data.notifications || [];
    updateNotificationBadge(data.unreadCount || 0);
    renderNotificationsList();
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state" style="padding:28px 16px;color:#df696c;">Unable to load notifications. Please try again.</div>';
  }
}

function renderNotificationsList() {
  const listEl = document.getElementById('notificationsList');
  if (!listEl) return;

  const filtered = cachedNotifications.filter(n => {
    if (currentNotifFilter === 'all') return true;
    if (currentNotifFilter === 'submission') return n.type === 'submission';
    if (currentNotifFilter === 'query') return n.type === 'query';
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state" style="padding:32px 16px;text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;color:var(--green);">✓</div>
      <strong style="color:var(--ink);">All caught up!</strong>
      <p style="margin:4px 0 0;font-size:11px;color:var(--muted);">No ${currentNotifFilter === 'all' ? 'notifications' : currentNotifFilter + ' items'} right now.</p>
    </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const isUnread = !item.isRead;
    const iconClass = item.type === 'submission' ? 'orange' : (item.type === 'query' ? 'green' : 'blue');
    const iconSvg = item.type === 'submission' ? icons.folder : (item.type === 'query' ? icons.send : icons.check);

    if (item.type === 'invitation') {
      return `
        <div class="notif-item unread" style="background:#faf9fe;border-left:3px solid #554bd0;" data-notif-id="${item.id}" data-action-type="invitation" data-raw-id="${item.invitationId || item.rawId}">
          <div class="notif-item-icon blue">
            ${icons.mail || icons.send || icons.check}
          </div>
          <div class="notif-item-content">
            <div class="notif-item-top">
              <span class="notif-item-title" style="color:#554bd0;font-weight:700;">${escapeHtml(item.title)}</span>
              <span class="notif-item-time">${escapeHtml(item.time)}</span>
            </div>
            <p class="notif-item-msg" style="margin:4px 0 8px;">${escapeHtml(item.message)}</p>
            <div style="display:flex;gap:8px;">
              <button class="button-primary" type="button" onclick="event.stopPropagation();respondToInvitation(${item.invitationId || item.rawId}, 'accept')" style="padding:4px 12px;font-size:11px;height:auto;">Accept</button>
              <button class="button-secondary" type="button" onclick="event.stopPropagation();respondToInvitation(${item.invitationId || item.rawId}, 'reject')" style="padding:4px 10px;font-size:11px;color:#df696c;border-color:#f5c6cb;height:auto;">Reject</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" data-notif-id="${item.id}" data-action-type="${item.actionType || ''}" data-raw-id="${item.rawId || ''}" data-link-page="${item.linkPage || ''}">
        <div class="notif-item-icon ${iconClass}">
          ${iconSvg}
        </div>
        <div class="notif-item-content">
          <div class="notif-item-top">
            <span class="notif-item-title">${escapeHtml(item.title)}</span>
            <span class="notif-item-time">${escapeHtml(item.time)}</span>
          </div>
          <p class="notif-item-msg">${escapeHtml(item.message)}</p>
          ${item.actionLabel ? `<span class="notif-action-tag">${escapeHtml(item.actionLabel)} &rarr;</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function handleNotificationClick(notifEl) {
  const actionType = notifEl.dataset.actionType;
  const rawId = Number(notifEl.dataset.rawId);
  const linkPage = notifEl.dataset.linkPage;

  toggleNotificationsDropdown(false);

  // If invitation
  if (actionType === 'invitation') {
    state.page = 'team';
    render();
    return;
  }

  // If review action for teacher
  if (actionType === 'review' && rawId) {
    state.page = 'projects';
    render();
    const submissions = getStudentSubmissions();
    const idx = submissions.findIndex(p => p.id === rawId);
    if (idx !== -1) {
      setTimeout(() => reviewModal(idx), 80);
    }
    return;
  }

  // If reply action for teacher
  if (actionType === 'reply' && rawId) {
    state.page = 'overview';
    render();
    const idx = state.queries.findIndex(q => q.id === rawId);
    if (idx !== -1) {
      setTimeout(() => replyModal(idx), 80);
    }
    return;
  }

  // Otherwise navigate to linked page
  if (linkPage) {
    state.page = linkPage;
    render();
  }
}

async function handleMarkAllRead() {
  try {
    await apiFetch('/api/notifications/read/', { method: 'POST', body: JSON.stringify({}) });
    cachedNotifications.forEach(n => { n.isRead = true; });
    updateNotificationBadge(0);
    renderNotificationsList();
    showToast("Notifications marked as read.");
  } catch (err) {
    showToast("Error updating notifications.");
  }
}

let notificationPollTimer = null;
function startNotificationPolling() {
  stopNotificationPolling();
  if (!state.account) return;

  notificationPollTimer = setInterval(async () => {
    if (!state.account) {
      stopNotificationPolling();
      return;
    }
    try {
      const res = await apiFetch('/api/notifications/');
      if (res.status === 401) {
        stopNotificationPolling();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated === false) {
          stopNotificationPolling();
          return;
        }
        updateNotificationBadge(data.unreadCount || 0);
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && !dropdown.classList.contains('hidden')) {
          cachedNotifications = data.notifications || [];
          renderNotificationsList();
        }
      }
    } catch (e) {}
  }, 15000);
}

function stopNotificationPolling() {
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }
}

// ----------------- Page Views -----------------

async function respondToInvitation(invitationId, action) {
  try {
    const res = await apiFetch(`/api/team/invitation/${invitationId}/respond/`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message);
      toggleNotificationsDropdown(false);
      await loadWorkspace();
      await loadAndRenderNotifications();
      render();
    } else {
      showToast(data.error || "Failed to respond to invitation.");
    }
  } catch (err) {
    showToast("Error connecting to server. Please try again.");
  }
}

function invitationBanners() {
  if (!state.pendingInvitations || !state.pendingInvitations.length) return "";
  return state.pendingInvitations.map(inv => `
    <div class="invitation-banner-card" style="background:linear-gradient(135deg, #f7f6ff 0%, #edeaff 100%);border:1px solid #d5ceff;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;box-shadow:0 4px 14px rgba(85,75,208,0.06);">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:#554bd0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📬</div>
        <div>
          <div style="display:inline-block;background:#554bd0;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Team Invitation</div>
          <h3 style="margin:0 0 4px;font-size:15px;color:#181628;font-weight:700;">Join team “${escapeHtml(inv.teamName)}”</h3>
          <p style="margin:0;font-size:12px;color:#5a5477;"><strong>${escapeHtml(inv.leaderName)}</strong> invited you to join as <strong>${escapeHtml(inv.role)}</strong> (${escapeHtml(inv.date)}).</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="button-secondary" type="button" onclick="respondToInvitation(${inv.id}, 'reject')" style="font-size:12px;padding:8px 14px;color:#df696c;border-color:#f5c6cb;">✕ Reject</button>
        <button class="button-primary" type="button" onclick="respondToInvitation(${inv.id}, 'accept')" style="font-size:12px;padding:8px 16px;">✓ Accept & Join Team</button>
      </div>
    </div>
  `).join("");
}

function studentOverview() {
  return `<div class="page-heading">
    <div>
      <p class="eyebrow">STUDENT WORKSPACE</p>
      <h1>Good morning, ${escapeHtml(state.account?.name || "")} <span aria-hidden="true">✦</span></h1>
      <p class="page-subtitle">Your workspace is connected to Django. Add your project details to get started.</p>
    </div>
    <button class="button-primary" data-action="upload">${icons.upload} Upload a project</button>
  </div>
  ${invitationBanners()}
  <section class="welcome-banner">
    <div class="welcome-copy">
      <div class="welcome-kicker">${escapeHtml(state.teamName || "YOUR TEAM")}</div>
      <h2 class="welcome-title">Big ideas start with a great team.</h2>
      <p class="welcome-subtitle">Create your team and invite classmates to work together.</p>
    </div>
    <div class="banner-art" aria-hidden="true">
      <div class="paper-art one"></div>
      <div class="paper-art two"></div>
      <span class="banner-spark">✦</span>
    </div>
    <button class="button-primary" data-action="team">Set up your team <span aria-hidden="true">&rarr;</span></button>
  </section>
  <section class="stats-grid" aria-label="Project summary">
    <article class="stat-card">
      <div class="stat-top"><span>Active projects</span><span class="stat-icon">${icons.folder}</span></div>
      <div class="stat-value" id="projectStat">${state.projects.length.toString().padStart(2, "0")}</div>
      <div class="stat-note">Across this semester</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Approved</span><span class="stat-icon green">${icons.check}</span></div>
      <div class="stat-value">${state.projects.filter(p => p.status === "Approved").length.toString().padStart(2, "0")}</div>
      <div class="stat-note">You’re doing great!</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Awaiting feedback</span><span class="stat-icon orange">${icons.clock}</span></div>
      <div class="stat-value">${state.projects.filter(p => p.status === "In review").length.toString().padStart(2, "0")}</div>
      <div class="stat-note">Your teacher will be in touch</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Team members</span><span class="stat-icon blue">${icons.people}</span></div>
      <div class="stat-value">${state.members.filter(m => m.status !== 'pending').length.toString().padStart(2, "0")}</div>
      <div class="stat-note">Everyone’s on the same page</div>
    </article>
  </section>
  <div class="dashboard-grid">
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Recent projects</h2>
          <p class="panel-description">Your team's latest submissions and updates</p>
        </div>
        <button class="text-button" data-page="projects">View all &rarr;</button>
      </div>
      <div class="projects-list">
        ${state.projects.length ? state.projects.slice(0, 3).map(projectRow).join("") : '<div class="empty-state">No projects submitted yet. Click Upload a project to begin.</div>'}
      </div>
    </section>
    <div class="right-column">
      <section class="panel team-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Your team</h2>
            <p class="panel-description">${escapeHtml(state.teamName || "No team created yet")}</p>
          </div>
          <button class="text-button" data-page="team">Manage</button>
        </div>
        <div class="team-members">
          ${state.members.length ? membersList() : '<div class="empty-state">Your team is empty. Add a teammate when you’re ready.</div>'}
          <button class="add-member" data-action="add-member">＋ Add a teammate</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Teacher Q&A</h2>
            <p class="panel-description">Your latest questions</p>
          </div>
          <button class="text-button" data-page="queries">See all</button>
        </div>
        <div class="query-list">
          ${state.queries.length ? queriesList() : '<div class="empty-state">No questions asked yet. Ask your teacher for guidance anytime.</div>'}
        </div>
      </section>
    </div>
  </div>`;
}

function getStudentSubmissions() {
  return state.teacherSubmissions || [];
}

function formatSubmissionDate(project) {
  if (project.submittedAt) {
    const submitted = new Date(project.submittedAt);
    if (!Number.isNaN(submitted.getTime())) {
      return submitted.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
  }
  const savedDate = String(project.date || "").replace(/^Submitted\s*/i, "").trim();
  return /^(today|yesterday|just now)$/i.test(savedDate) || !savedDate ? "Date not recorded" : savedDate;
}

function teacherOverview() {
  const submissions = getStudentSubmissions();
  const awaiting = submissions.filter(project => project.status === "In review").length;
  const teamsCount = new Set(submissions.map(project => project.teamName).filter(name => name && name !== "Team name not set")).size;

  return `<div class="page-heading">
    <div>
      <p class="eyebrow">TEACHER WORKSPACE</p>
      <h1>Good morning, ${escapeHtml(state.account?.name || "")}</h1>
      <p class="page-subtitle">A live look at your students’ project progress stored in Django.</p>
    </div>
    <button class="button-secondary" data-action="notifications">View notifications</button>
  </div>
  <section class="welcome-banner">
    <div class="welcome-copy">
      <div class="welcome-kicker">YOUR CLASSROOM · DESIGN & TECHNOLOGY</div>
      <h2 class="welcome-title">A little feedback goes a long way.</h2>
      <p class="welcome-subtitle">Review submissions and help every team do their best work.</p>
    </div>
    <div class="banner-art" aria-hidden="true">
      <div class="paper-art one"></div>
      <div class="paper-art two"></div>
      <span class="banner-spark">✦</span>
    </div>
    <button class="button-primary" data-action="review-all">Review submissions <span aria-hidden="true">&rarr;</span></button>
  </section>
  <section class="stats-grid">
    <article class="stat-card">
      <div class="stat-top"><span>Student teams</span><span class="stat-icon">${icons.people}</span></div>
      <div class="stat-value">${teamsCount.toString().padStart(2, "0")}</div>
      <div class="stat-note">Teams with submissions</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Submitted projects</span><span class="stat-icon blue">${icons.folder}</span></div>
      <div class="stat-value">${submissions.length.toString().padStart(2, "0")}</div>
      <div class="stat-note">Across student accounts</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Awaiting review</span><span class="stat-icon orange">${icons.clock}</span></div>
      <div class="stat-value">${awaiting.toString().padStart(2, "0")}</div>
      <div class="stat-note">Ready for your feedback</div>
    </article>
    <article class="stat-card">
      <div class="stat-top"><span>Reviewed</span><span class="stat-icon green">${icons.check}</span></div>
      <div class="stat-value">${(submissions.length - awaiting).toString().padStart(2, "0")}</div>
      <div class="stat-note">Projects with a review status</div>
    </article>
  </section>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">Submissions to review</h2>
        <p class="panel-description">Recent work from your student teams</p>
      </div>
      <div class="toolbar">
        <select class="select-filter" id="reviewFilter" aria-label="Filter submissions">
          <option value="all">All submissions</option>
          <option value="In review">Awaiting review</option>
          <option value="Approved">Reviewed</option>
        </select>
      </div>
    </div>
    <div id="teacherProjects">${teacherProjectRows()}</div>
  </section>
  <div style="height:16px"></div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">Student questions</h2>
        <p class="panel-description">Questions from teams that could use your help</p>
      </div>
      <button class="text-button" data-action="teacher-queries">View inbox &rarr;</button>
    </div>
    <div class="query-list">
      ${state.queries.length ? state.queries.map((q, i) => `<div class="query-item">
        <span class="query-bullet ${q.answered ? "answered" : ""}"></span>
        <div class="query-copy">
          <div class="query-title">${escapeHtml(q.title)}</div>
          <div class="query-meta">${q.answered ? "Answered" : "Needs a reply"} · ${escapeHtml(q.meta || "")}</div>
          ${q.details ? `<div style="margin-top:3px;color:#6b7280;font-size:10px">${escapeHtml(q.details)}</div>` : ''}
          ${q.response ? `<div style="margin-top:4px;color:#28a879;font-size:11px"><strong>Your reply:</strong> ${escapeHtml(q.response)}</div>` : ''}
        </div>
        <button class="text-button" data-reply="${i}">${q.answered ? "Edit Reply" : "Reply"}</button>
      </div>`).join("") : '<div class="empty-state">No student questions yet.</div>'}
    </div>
  </section>`;
}

function teacherProjectRows(filter = "all") {
  const submissions = getStudentSubmissions();
  const rows = submissions.map((project, index) => ({ project, index })).filter(row => filter === "all" || row.project.status === filter);
  if (!rows.length) return '<div class="empty-state">No student submissions match this filter yet.</div>';

  return rows.map(({ project, index }) => `<article class="teacher-project" data-project-card="${index}">
    <div class="teacher-project-summary">
      <div class="project-icon ${project.color || ""}">${icons.file}</div>
      <div class="teacher-project-info">
        <button class="project-title-toggle" type="button" data-expand-project="${index}" aria-expanded="false" aria-controls="project-details-${index}">${escapeHtml(project.name)}</button>
        <div class="project-meta">${escapeHtml(project.teamName || "Team")} · ${escapeHtml(project.studentName || "")}</div>
      </div>
      <div style="display:inline-flex;gap:6px;align-items:center;">
        ${project.downloadUrl ? `<a href="${project.downloadUrl}" class="button-secondary" style="text-decoration:none;display:inline-flex;align-items:center;padding:5px 9px;">Download</a>` : ''}
        ${project.fileUrl ? `<a href="${project.fileUrl}" target="_blank" rel="noopener noreferrer" class="button-secondary" style="text-decoration:none;display:inline-flex;align-items:center;padding:5px 9px;">Open</a>` : ''}
        <button class="button-secondary" data-delete-project="${project.id}" title="Delete project" style="color:#df696c;border-color:#f8d7da;padding:5px 8px;">Delete</button>
      </div>
    </div>
    <div class="project-details hidden" id="project-details-${index}">
      <section class="project-detail-section">
        <h3 class="project-detail-heading">Team</h3>
        <div class="project-detail-grid">
          <div class="project-detail-item"><span class="project-detail-label">Team name</span><span class="project-detail-value">${escapeHtml(project.teamName || "Not set")}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Team leader</span><span class="project-detail-value">${escapeHtml(project.teamLeader || "Not set")}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Department</span><span class="project-detail-value">${escapeHtml(project.department || "Not provided")}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Team members</span><span class="project-detail-value">${escapeHtml(project.teamMembers || "No other members added")}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Submitted by</span><span class="project-detail-value">${escapeHtml(project.studentName || "")} · ${escapeHtml(project.studentEmail || "")}</span></div>
        </div>
      </section>
      <section class="project-detail-section">
        <h3 class="project-detail-heading">Submission</h3>
        <div class="project-detail-grid">
          <div class="project-detail-item"><span class="project-detail-label">Submitted date</span><span class="project-detail-value">${escapeHtml(formatSubmissionDate(project))}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Attached file</span><span class="project-detail-value">${escapeHtml(project.fileName || "No file attached")}</span></div>
          ${project.note ? `<div class="project-detail-item" style="grid-column: 1 / -1;"><span class="project-detail-label">Student note</span><span class="project-detail-value">${escapeHtml(project.note)}</span></div>` : ''}
        </div>
      </section>
      <section class="project-detail-section">
        <h3 class="project-detail-heading">Review</h3>
        <div class="project-detail-grid">
          <div class="project-detail-item"><span class="project-detail-label">Current status</span><span class="project-detail-value">${escapeHtml(project.status)}</span></div>
          <div class="project-detail-item"><span class="project-detail-label">Teacher remark</span><span class="project-detail-value">${escapeHtml(project.remark || "No remark yet")}</span></div>
        </div>
        <div class="project-detail-actions">
          <span class="status ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
          <button class="button-secondary" data-review="${index}">${project.status === "In review" ? "Review project" : "Update feedback"}</button>
        </div>
      </section>
    </div>
  </article>`).join("");
}

function teacherProjectsPage() {
  const submissions = getStudentSubmissions();
  return `<div class="page-heading">
    <div>
      <p class="eyebrow">STUDENT WORKSPACE</p>
      <h1>Student projects</h1>
      <p class="page-subtitle">Select a project name to view its team leader, members, files, and submission details.</p>
    </div>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">All student submissions</h2>
        <p class="panel-description">${submissions.length} ${submissions.length === 1 ? "project" : "projects"} in Django database</p>
      </div>
      <div class="toolbar">
        <select class="select-filter" id="projectFilter" aria-label="Filter student projects">
          <option value="all">All projects</option>
          <option value="In review">Awaiting review</option>
          <option value="Approved">Approved</option>
          <option value="Needs changes">Needs changes</option>
        </select>
      </div>
    </div>
    <div id="teacherProjects">${teacherProjectRows()}</div>
  </section>`;
}

function projectsPage() {
  if (state.role === "teacher") return teacherProjectsPage();

  return `<div class="page-heading">
    <div>
      <p class="eyebrow">YOUR WORK</p>
      <h1>My projects</h1>
      <p class="page-subtitle">Keep track of your team’s submissions and teacher feedback.</p>
    </div>
    <button class="button-primary" data-action="upload">${icons.upload} Upload a project</button>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">All projects</h2>
        <p class="panel-description">${state.projects.length} projects</p>
      </div>
      <span class="term-pill">Workspace</span>
    </div>
    <div class="projects-list">
      ${state.projects.length ? state.projects.map((p, i) => `
        ${projectRow(p)}
        <div class="project-attach-action" style="display:flex;gap:8px;align-items:center;margin: 0 0 8px 54px;flex-wrap:wrap;">
          ${p.downloadUrl ? `<a href="${p.downloadUrl}" class="button-secondary" style="font-size:10px;text-decoration:none;">Download (${escapeHtml(p.fileName || 'file')})</a>` : ''}
          ${p.fileUrl ? `<a href="${p.fileUrl}" target="_blank" class="button-secondary" style="font-size:10px;text-decoration:none;">Preview</a>` : ''}
          <button class="button-secondary" data-attach-file="${i}" style="font-size:10px;">${p.fileName ? "Replace file" : "Attach file"}</button>
          ${p.status !== "Approved" ? `<button class="button-secondary" data-delete-project="${p.id}" style="font-size:10px;color:#df696c;border-color:#f8d7da;">Withdraw</button>` : ''}
        </div>
        ${p.remark ? `<div style="margin:-2px 0 12px 54px;color:#554bd0;font-size:11px;background:#f0efff;padding:6px 10px;border-radius:6px;"><strong>Teacher remark:</strong> ${escapeHtml(p.remark)}</div>` : ""}
      `).join("") : '<div class="empty-state">No projects yet. Upload your team’s first project to get started.</div>'}
    </div>
  </section>`;
}

function teamPage() {
  const acceptedMembers = state.members.filter(m => m.status !== 'pending');
  const pendingMembers = state.members.filter(m => m.status === 'pending');
  const countLabel = `${acceptedMembers.length} active ${acceptedMembers.length === 1 ? 'member' : 'members'}${pendingMembers.length ? ` · ${pendingMembers.length} pending invitation${pendingMembers.length > 1 ? 's' : ''}` : ''}`;

  return `<div class="page-heading">
    <div>
      <p class="eyebrow">YOUR COLLABORATORS</p>
      <h1>My team</h1>
      <p class="page-subtitle">Meet the people bringing your project to life.</p>
    </div>
    <button class="button-primary" data-action="add-member">＋ Add teammate</button>
  </div>
  ${invitationBanners()}
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">${escapeHtml(state.teamName || "Your team")}</h2>
        <p class="panel-description">${countLabel}</p>
      </div>
      <span class="leader-tag" style="padding:6px 9px">TEAM LEADER</span>
    </div>
    <div class="team-members">
      ${state.members.length ? membersList() : '<div class="empty-state">No teammates yet. Invite classmates to build your team.</div>'}
      <button class="add-member" data-action="add-member">＋ Invite another teammate</button>
    </div>
  </section>
  <div style="height:15px"></div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">Team communication</h2>
        <p class="panel-description">Talk with your teammates or connect with other project teams.</p>
      </div>
      <button class="text-button" data-page="messages">Open team chat &rarr;</button>
    </div>
  </section>`;
}

function teacherQueriesRows(filter = "all") {
  const rows = state.queries
    .map((query, index) => ({ query, index }))
    .filter(row => {
      if (filter === "unanswered") return !row.query.answered;
      if (filter === "answered") return row.query.answered;
      return true;
    });

  if (!rows.length) {
    return `<div class="empty-state">${state.queries.length ? "No student questions match this filter." : "No student questions yet. Questions submitted by student teams will appear here."}</div>`;
  }

  return rows.map(({ query, index }) => `
    <div class="query-item" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;">
      <div style="display:flex;gap:10px;min-width:0;flex:1;">
        <span class="query-bullet ${query.answered ? "answered" : ""}"></span>
        <div class="query-copy">
          <div class="query-title" style="font-size:12px;font-weight:600;">${escapeHtml(query.title)}</div>
          <div class="query-meta">${query.answered ? "Answered" : "Needs a reply"} · ${escapeHtml(query.meta || "")}</div>
          ${query.details ? `<div style="margin-top:5px;color:#4b5563;font-size:11px;line-height:1.45;">${escapeHtml(query.details)}</div>` : ''}
          ${query.response ? `<div style="margin-top:7px;color:#1e7e59;background:#eefbf5;border:1px solid #c7f0db;padding:7px 11px;border-radius:6px;font-size:11px;line-height:1.45;"><strong>Your reply:</strong> ${escapeHtml(query.response)}</div>` : ''}
        </div>
      </div>
      <button class="button-secondary" data-reply="${index}" style="font-size:11px;padding:6px 12px;white-space:nowrap;height:fit-content;margin-top:2px;">${query.answered ? "Edit reply" : "Reply"}</button>
    </div>
  `).join("");
}

function teacherQueriesPage() {
  const unansweredCount = state.queries.filter(q => !q.answered).length;
  return `<div class="page-heading">
    <div>
      <p class="eyebrow">STUDENT INQUIRIES</p>
      <h1>Student questions</h1>
      <p class="page-subtitle">Review questions submitted by student project teams and provide guidance.</p>
    </div>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">Student question inbox</h2>
        <p class="panel-description">${state.queries.length} ${state.queries.length === 1 ? "question" : "questions"} total · ${unansweredCount} awaiting reply</p>
      </div>
      <div class="toolbar">
        <select class="select-filter" id="teacherQueryFilter" aria-label="Filter student questions">
          <option value="all">All questions</option>
          <option value="unanswered">Needs a reply</option>
          <option value="answered">Answered</option>
        </select>
      </div>
    </div>
    <div class="query-list" id="teacherQueryList">
      ${teacherQueriesRows()}
    </div>
  </section>`;
}

function queriesPage() {
  if (state.role === "teacher") return teacherQueriesPage();

  return `<div class="page-heading">
    <div>
      <p class="eyebrow">ASK YOUR TEACHER</p>
      <h1>Questions & answers</h1>
      <p class="page-subtitle">Get guidance from your teacher as your team works through the project.</p>
    </div>
    <button class="button-primary" data-action="ask-question">＋ Ask a question</button>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">Your questions</h2>
        <p class="panel-description">Questions are shared directly with your teacher via Django.</p>
      </div>
    </div>
    <div class="query-list">
      ${state.queries.length ? queriesList() : '<div class="empty-state">No questions yet. Ask your teacher for guidance.</div>'}
      <button class="add-member" data-action="ask-question">＋ Ask your teacher a question</button>
    </div>
  </section>`;
}

function messagesPage() {
  const threads = [
    { id: "team", initials: getInitials(state.teamName || "Team"), color: "", name: state.teamName || "Your team", preview: "Team messages appear here", group: "YOUR TEAM" },
    { id: "studio", initials: "OT", color: "green", name: "Other teams", preview: "Conversation with other teams", group: "OTHER TEAMS" },
    { id: "teacher", initials: "T", color: "orange", name: "Your teacher", preview: "Questions and feedback", group: "TEACHER" }
  ];
  const active = threads.find(thread => thread.id === state.selectedThread) || threads[0];
  let threadMarkup = "";
  let lastGroup = "";
  for (const thread of threads) {
    if (thread.group !== lastGroup) {
      threadMarkup += `<div class="thread-label">${thread.group}</div>`;
      lastGroup = thread.group;
    }
    threadMarkup += `<button class="thread-button ${thread.id === active.id ? "active" : ""}" data-thread="${thread.id}">
      <div class="avatar ${thread.color}">${thread.initials}</div>
      <div>
        <div class="thread-name">${thread.name}</div>
        <div class="thread-preview">${thread.preview}</div>
      </div>
    </button>`;
  }

  const messages = state.messages[active.id] || [];
  const messageMarkup = messages.length ? messages.map(message => `
    <div class="message ${message.mine ? "mine" : ""}">
      ${message.mine ? "" : `<div class="avatar ${message.color || ''}">${escapeHtml(message.initials || getInitials(message.name))}</div>`}
      <div class="message-bubble">${escapeHtml(message.text)}</div>
      <span class="message-time">${escapeHtml(message.time || 'Now')}</span>
    </div>
  `).join("") : '<div class="empty-state">No messages yet. Start the conversation.</div>';

  return `<div class="page-heading">
    <div>
      <p class="eyebrow">SAY HELLO</p>
      <h1>Team chat</h1>
      <p class="page-subtitle">Real-time messaging saved directly in Django.</p>
    </div>
  </div>
  <section class="panel chat-layout">
    <div class="chat-threads">${threadMarkup}</div>
    <div class="chat-room">
      <div class="chat-room-head">
        <div class="avatar ${active.color}">${active.initials}</div>
        <div>
          <div class="chat-room-title">${active.name}</div>
          <div class="chat-room-subtitle">${active.id === "team" ? `${state.members.length} members · Your project team` : active.id === "teacher" ? "Your teacher" : "Connect with another team"}</div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-date">CONVERSATION</div>
        ${messageMarkup}
      </div>
      <form class="chat-form" id="chatForm">
        <input class="chat-input" id="chatInput" autocomplete="off" placeholder="Write a message..." aria-label="Write a message">
        <button class="chat-send" aria-label="Send message">${icons.send}</button>
      </form>
    </div>
  </section>`;
}

// Chat polling for real-time messages
let chatPollTimer = null;
function startChatPolling() {
  stopChatPolling();
  if (state.page !== 'messages' || !state.account) return;

  chatPollTimer = setInterval(async () => {
    if (state.page !== 'messages' || !state.account) {
      stopChatPolling();
      return;
    }
    const currentList = state.messages[state.selectedThread] || [];
    const lastId = currentList.length ? currentList[currentList.length - 1].id : 0;
    try {
      const res = await apiFetch(`/api/messages/?thread=${state.selectedThread}&since_id=${lastId}`);
      if (res.status === 401) {
        stopChatPolling();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated === false) {
          stopChatPolling();
          return;
        }
        if (data.messages && data.messages.length) {
          const existingIds = new Set(currentList.map(m => m.id));
          const newItems = data.messages.filter(m => !existingIds.has(m.id));
          if (newItems.length) {
            state.messages[state.selectedThread].push(...newItems);
            const container = document.getElementById("chatMessages");
            if (container) {
              newItems.forEach(msg => {
                const div = document.createElement("div");
                div.className = `message ${msg.mine ? "mine" : ""}`;
                div.innerHTML = `${msg.mine ? "" : `<div class="avatar ${msg.color || ''}">${escapeHtml(msg.initials || getInitials(msg.name))}</div>`}<div class="message-bubble">${escapeHtml(msg.text)}</div><span class="message-time">${escapeHtml(msg.time || 'Now')}</span>`;
                container.appendChild(div);
              });
              container.scrollTop = container.scrollHeight;
            }
          }
        }
      }
    } catch (e) {}
  }, 4000);
}

function stopChatPolling() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

function render() {
  if (!state.account) return;

  document.querySelector(".app-shell").classList.remove("hidden");
  document.getElementById("authScreen").classList.add("hidden");

  document.querySelectorAll(".nav-item").forEach(button => {
    const enabled = state.role === "student" || ["overview", "projects", "queries"].includes(button.dataset.page);
    button.classList.toggle("hidden", !enabled);
    button.classList.toggle("active", button.dataset.page === state.page);
    if (button.dataset.page === state.page) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (state.role === "teacher" && ["team", "messages"].includes(state.page)) {
    state.page = "overview";
  }

  document.getElementById("breadcrumbCurrent").textContent = state.role === "teacher" && state.page === "overview" ? "Teacher dashboard" : pageNames[state.page];
  document.getElementById("profileName").textContent = state.account.name;

  const accountType = state.role === "teacher" ? "Teacher" : "Student";
  const accountPost = state.role === "teacher" ? (state.account.post || "Administrator") : (state.account.post || (state.members.length ? "Team leader" : "Team member"));
  document.getElementById("profileRole").innerHTML = `<span>${escapeHtml(accountType)}</span><span>${escapeHtml(accountPost)}</span>`;
  document.getElementById("profileAvatar").textContent = getInitials(state.account.name);

  const projectCount = state.role === "teacher" ? (state.teacherSubmissions?.length || 0) : state.projects.length;
  const projectNavSpan = document.querySelector('[data-page="projects"] span');
  if (projectNavSpan) projectNavSpan.textContent = state.role === "teacher" ? "Student projects" : "My projects";

  const queryNavSpan = document.querySelector('[data-page="queries"] span');
  if (queryNavSpan) queryNavSpan.textContent = state.role === "teacher" ? "Student questions" : "Queries";

  const pCountEl = document.querySelector('[data-count="projects"]');
  if (pCountEl) pCountEl.textContent = projectCount;

  const qCountEl = document.querySelector('[data-count="queries"]');
  if (qCountEl) {
    const count = state.role === "teacher"
      ? state.queries.filter(q => !q.answered).length
      : state.queries.length;
    qCountEl.textContent = count;
  }

  updateNotificationBadge(state.unreadNotifications);

  const views = {
    overview: () => state.role === "teacher" ? teacherOverview() : studentOverview(),
    projects: projectsPage,
    team: teamPage,
    queries: queriesPage,
    messages: messagesPage
  };

  content.innerHTML = views[state.page]();

  if (state.page === "messages") {
    startChatPolling();
  } else {
    stopChatPolling();
  }

  const filter = document.getElementById("reviewFilter");
  if (filter) {
    filter.addEventListener("change", () => {
      document.getElementById("teacherProjects").innerHTML = teacherProjectRows(filter.value);
    });
  }

  const projectFilter = document.getElementById("projectFilter");
  if (projectFilter) {
    projectFilter.addEventListener("change", () => {
      document.getElementById("teacherProjects").innerHTML = teacherProjectRows(projectFilter.value);
    });
  }

  const teacherQueryFilter = document.getElementById("teacherQueryFilter");
  if (teacherQueryFilter) {
    teacherQueryFilter.addEventListener("change", () => {
      const listEl = document.getElementById("teacherQueryList");
      if (listEl) listEl.innerHTML = teacherQueriesRows(teacherQueryFilter.value);
    });
  }

  const chatForm = document.getElementById("chatForm");
  if (chatForm) chatForm.addEventListener("submit", sendMessage);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function closeModal() {
  document.getElementById("modalHost").innerHTML = "";
}

function showModal(title, subtitle, body, submitLabel, onSubmit) {
  const host = document.getElementById("modalHost");
  host.innerHTML = `<div class="modal-backdrop" data-close-modal>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <div>
          <h2 class="modal-title" id="modalTitle">${title}</h2>
          <p class="modal-subtitle">${subtitle}</p>
        </div>
        <button class="modal-close" type="button" aria-label="Close dialog" data-close-modal>×</button>
      </div>
      <form id="modalForm">
        ${body}
        <div class="modal-actions">
          <button type="button" class="button-secondary" data-close-modal>Cancel</button>
          <button type="submit" class="button-primary">${submitLabel}</button>
        </div>
      </form>
    </section>
  </div>`;

  host.querySelector(".modal").addEventListener("click", event => event.stopPropagation());
  host.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeModal));
  host.querySelector("#modalForm").addEventListener("submit", async event => {
    event.preventDefault();
    const submitBtn = event.currentTarget.querySelector("button[type=submit]");
    const originalText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Please wait...";
    }
    try {
      if (onSubmit) {
        await onSubmit(new FormData(event.currentTarget));
      }
    } finally {
      if (submitBtn && host.contains(submitBtn)) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  const firstField = host.querySelector("input:not([type=file]), textarea");
  if (firstField) firstField.focus();
}

function uploadModal() {
  showModal(
    "Upload a project",
    "Share your team's latest work with your teacher.",
    `<label class="field-label" for="projectTitle">Project title</label>
     <input class="field" id="projectTitle" name="title" placeholder="e.g. Final design prototype" required>
     <label class="field-label" for="projectType">Project type</label>
     <select class="field" id="projectType" name="type">
       <option>Project submission</option>
       <option>Design & Technology</option>
       <option>Research documentation</option>
       <option>Presentation</option>
     </select>
     <label class="drop-zone" id="projectDropZone" for="projectFile">
       ${icons.upload}
       <strong id="fileName">Choose a file or drag it here</strong>
       <span>All file formats supported · Up to 50 MB</span>
     </label>
     <input class="file-input" id="projectFile" name="file" type="file">
     <label class="field-label" for="projectNote">Note for your teacher <span style="color:#a0a5b5;font-weight:500">(optional)</span></label>
     <textarea class="textarea" id="projectNote" name="note" placeholder="Anything you'd like your teacher to know?"></textarea>`,
    "Submit project",
    async formData => {
      const title = String(formData.get("title") || "").trim();
      if (!title) {
        showToast("Please enter a project title.");
        return;
      }

      const file = formData.get("file");
      if (!file || !file.name || file.size === 0) {
        formData.delete("file");
      } else if (file.size > 50 * 1024 * 1024) {
        showToast("Files must be 50 MB or smaller.");
        return;
      }

      try {
        const res = await apiFetch('/api/projects/upload/', {
          method: 'POST',
          body: formData
        });
        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          data = { error: "Failed to parse server response." };
        }
        if (res.ok && data.success && data.project) {
          state.projects.unshift(data.project);
          closeModal();
          render();
          showToast("Project submitted for teacher review!");
        } else {
          showToast(data.error || "Failed to submit project.");
        }
      } catch (err) {
        showToast("Error uploading project to server. Please try again.");
      }
    }
  );

  const fileInput = document.getElementById("projectFile");
  const dropZone = document.getElementById("projectDropZone");
  const fileNameDisplay = document.getElementById("fileName");

  if (fileInput && fileNameDisplay) {
    fileInput.addEventListener("change", () => {
      fileNameDisplay.textContent = fileInput.files.length ? fileInput.files[0].name : "Choose a file or drag it here";
    });
  }

  if (dropZone && fileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#554bd0';
        dropZone.style.background = '#f5f3ff';
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
      });
    });
    dropZone.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        if (fileNameDisplay) {
          fileNameDisplay.textContent = fileInput.files[0].name;
        }
      }
    });
  }
}

function attachProjectFileModal(index) {
  const project = state.projects[index];
  if (!project) return;

  showModal(
    "Attach project file",
    `Add or replace the file for “${escapeHtml(project.name)}”.`,
    `<label class="field-label" for="replacementFile">Choose project file</label>
     <input class="field" id="replacementFile" name="file" type="file" required>
     <p class="project-meta" style="margin-top:7px">All file formats supported · Up to 50 MB.</p>`,
    "Save attachment",
    async formData => {
      const file = formData.get("file");
      if (!file || !file.name || file.size === 0) {
        showToast("Please choose a file to upload.");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        showToast("Files must be 50 MB or smaller.");
        return;
      }

      try {
        const res = await apiFetch(`/api/projects/${project.id}/attach/`, {
          method: 'POST',
          body: formData
        });
        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          data = { error: "Failed to parse server response." };
        }
        if (res.ok && data.success && data.project) {
          state.projects[index] = data.project;
          closeModal();
          render();
          showToast("Project attachment saved on server.");
        } else {
          showToast(data.error || "Failed to update attachment.");
        }
      } catch (err) {
        showToast("Error updating file.");
      }
    }
  );
}

async function deleteProjectPrompt(projectId) {
  if (!confirm("Are you sure you want to withdraw or delete this project submission?")) return;

  try {
    const res = await apiFetch(`/api/projects/${projectId}/delete/`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      state.projects = state.projects.filter(p => p.id !== projectId);
      if (state.teacherSubmissions) {
        state.teacherSubmissions = state.teacherSubmissions.filter(p => p.id !== projectId);
      }
      render();
      showToast("Submission removed successfully.");
    } else {
      showToast(data.error || "Failed to delete project.");
    }
  } catch (err) {
    showToast("Error deleting project.");
  }
}

function addMemberModal() {
  showModal(
    "Add a teammate",
    `Invite someone to join ${escapeHtml(state.teamName || "your team")}.`,
    `<label class="field-label" for="memberEmail">Student email</label>
     <input class="field" id="memberEmail" name="email" type="email" placeholder="student@school.edu" required>
     <label class="field-label" for="memberRole">Their role on the team</label>
     <select class="field" name="role" id="memberRole">
       <option>Project contributor</option>
       <option>UI / UX designer</option>
       <option>Frontend developer</option>
       <option>Research & content</option>
     </select>`,
    "Send invite",
    async formData => {
      const email = String(formData.get("email") || "").trim();
      const role = String(formData.get("role") || "Project contributor");
      if (!email) return;

      try {
        const res = await apiFetch('/api/team/add-member/', {
          method: 'POST',
          body: JSON.stringify({ email, role })
        });
        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          data = { error: "Unable to process invitation response." };
        }
        if (res.ok && data.success && data.member) {
          state.members.push(data.member);
          closeModal();
          render();
          showToast(data.message || `Invitation sent to ${email}!`);
        } else {
          showToast(data.error || "Failed to add teammate.");
        }
      } catch (err) {
        showToast("Error connecting to server. Please try again.");
      }
    }
  );
}

function editMemberModal(memberId) {
  const member = state.members.find(m => m.id === Number(memberId));
  if (!member) {
    showToast("Member not found.");
    return;
  }
  const roles = [
    "Project contributor",
    "UI / UX designer",
    "Frontend developer",
    "Backend developer",
    "Full-stack developer",
    "Research & content",
    "QA / Tester"
  ];
  const roleOptions = roles.map(r => `<option value="${escapeHtml(r)}" ${r === member.role ? "selected" : ""}>${escapeHtml(r)}</option>`).join("");
  const customRoleOption = (!roles.includes(member.role) && member.role) ? `<option value="${escapeHtml(member.role)}" selected>${escapeHtml(member.role)}</option>` : "";

  showModal(
    `Edit ${escapeHtml(member.name || "teammate")}`,
    `Update member details for ${escapeHtml(member.email || "this teammate")}.`,
    `<label class="field-label" for="editMemberName">Full name</label>
     <input class="field" id="editMemberName" name="name" type="text" value="${escapeHtml(member.name || "")}" required placeholder="Member name">
     <label class="field-label" for="editMemberRole">Role on team</label>
     <select class="field" name="role" id="editMemberRole">
       ${roleOptions}
       ${customRoleOption}
     </select>`,
    "Save changes",
    async formData => {
      const name = String(formData.get("name") || "").trim();
      const role = String(formData.get("role") || "Project contributor").trim();
      if (!name) {
        showToast("Member name is required.");
        return;
      }

      try {
        const res = await apiFetch(`/api/team/member/${member.id}/edit/`, {
          method: 'POST',
          body: JSON.stringify({ name, role })
        });
        const data = await res.json();
        if (res.ok && data.success && data.member) {
          const idx = state.members.findIndex(m => m.id === member.id);
          if (idx !== -1) {
            state.members[idx] = Object.assign({}, state.members[idx], data.member);
          }
          closeModal();
          render();
          showToast(data.message || "Teammate updated successfully!");
        } else {
          showToast(data.error || "Failed to update member.");
        }
      } catch (err) {
        showToast("Error updating teammate.");
      }
    }
  );
}

async function removeMemberPrompt(memberId) {
  const member = state.members.find(m => m.id === Number(memberId));
  const memberName = member ? member.name : "this teammate";
  if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/team/member/${memberId}/delete/`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      state.members = state.members.filter(m => m.id !== Number(memberId));
      render();
      showToast(data.message || "Teammate removed from team.");
    } else {
      showToast(data.error || "Failed to remove teammate.");
    }
  } catch (err) {
    showToast("Error removing teammate.");
  }
}

function questionModal() {
  if (state.role === "teacher") {
    showToast("Questions can only be submitted by student teams.");
    return;
  }
  showModal(
    "Ask your teacher",
    "Your question will be saved and sent to your teacher.",
    `<label class="field-label" for="questionSubject">What’s your question about?</label>
     <input class="field" id="questionSubject" name="subject" placeholder="A short summary" required>
     <label class="field-label" for="questionDetails">Add some details</label>
     <textarea class="textarea" id="questionDetails" name="details" placeholder="Tell your teacher what you need help with..." required></textarea>`,
    "Send question",
    async formData => {
      const subject = String(formData.get("subject") || "").trim();
      const details = String(formData.get("details") || "").trim();
      if (!subject) return;

      try {
        const res = await apiFetch('/api/queries/create/', {
          method: 'POST',
          body: JSON.stringify({ subject, details })
        });
        const data = await res.json();
        if (data.success && data.query) {
          state.queries.unshift(data.query);
          closeModal();
          render();
          showToast("Your question was sent to your teacher.");
        } else {
          showToast(data.error || "Failed to send question.");
        }
      } catch (err) {
        showToast("Error sending question.");
      }
    }
  );
}

function reviewModal(index) {
  const submissions = getStudentSubmissions();
  const project = submissions[index];
  if (!project) return;

  const subtitle = `${project.studentName || ""} · ${project.teamName || ""} · ${project.type}`;

  showModal(
    "Review submission",
    subtitle,
    `<label class="field-label" for="reviewStatus">Review status</label>
     <select class="field" id="reviewStatus" name="status">
       <option ${project.status === "Approved" ? "selected" : ""}>Approved</option>
       <option ${project.status === "In review" ? "selected" : ""}>In review</option>
       <option ${project.status === "Needs changes" ? "selected" : ""}>Needs changes</option>
     </select>
     <label class="field-label" for="reviewRemark">Teacher remark</label>
     <textarea class="textarea" id="reviewRemark" name="remark" placeholder="Share specific, constructive feedback...">${project.remark ? escapeHtml(project.remark) : ""}</textarea>`,
    "Save feedback",
    async formData => {
      const status = String(formData.get("status"));
      const remark = String(formData.get("remark") || "").trim();

      try {
        const res = await apiFetch(`/api/projects/${project.id}/review/`, {
          method: 'POST',
          body: JSON.stringify({ status, remark })
        });
        const data = await res.json();
        if (data.success) {
          project.status = status;
          project.remark = remark;
          closeModal();
          render();
          showToast("Feedback saved in Django for the student team.");
        } else {
          showToast(data.error || "Failed to save review.");
        }
      } catch (err) {
        showToast("Error saving feedback to server.");
      }
    }
  );
}

function replyModal(index) {
  const query = state.queries[index];
  if (!query) return;

  showModal(
    query.answered ? "Update your response" : "Reply to student",
    query.title,
    `<label class="field-label" for="teacherReply">Teacher response</label>
     <textarea class="textarea" id="teacherReply" name="reply" placeholder="Write a helpful response..." required>${query.response ? escapeHtml(query.response) : ""}</textarea>`,
    query.answered ? "Update response" : "Send response",
    async formData => {
      const reply = String(formData.get("reply") || "").trim();
      try {
        const res = await apiFetch(`/api/queries/${query.id}/reply/`, {
          method: 'POST',
          body: JSON.stringify({ reply })
        });
        const data = await res.json();
        if (data.success && data.query) {
          state.queries[index] = Object.assign(query, data.query);
          closeModal();
          render();
          showToast("Your response was sent to the student team.");
        } else {
          showToast(data.error || "Failed to send response.");
        }
      } catch (err) {
        showToast("Error sending reply to server.");
      }
    }
  );
}

async function sendMessage(event) {
  event.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  try {
    const res = await apiFetch('/api/messages/send/', {
      method: 'POST',
      body: JSON.stringify({ thread: state.selectedThread, text })
    });
    const data = await res.json();
    if (data.success && data.message) {
      if (!state.messages[state.selectedThread]) {
        state.messages[state.selectedThread] = [];
      }
      state.messages[state.selectedThread].push(data.message);
      render();
      const messagesContainer = document.getElementById("chatMessages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } else {
      showToast(data.error || "Failed to send message.");
    }
  } catch (err) {
    showToast("Error connecting to server.");
  }
}

// ----------------- Global Click and Event Listeners -----------------

document.addEventListener("click", event => {
  // Navigation
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    state.page = pageButton.dataset.page;
    render();
    return;
  }

  // Outside click on notifications dropdown
  const dropdown = document.getElementById("notificationsDropdown");
  const notifBtn = document.getElementById("notificationButton");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    if (!dropdown.contains(event.target) && (!notifBtn || !notifBtn.contains(event.target))) {
      toggleNotificationsDropdown(false);
    }
  }

  // Notification items click
  const notifItem = event.target.closest(".notif-item");
  if (notifItem) {
    handleNotificationClick(notifItem);
    return;
  }

  // Notification filter tab click
  const notifTab = event.target.closest("[data-notif-filter]");
  if (notifTab) {
    currentNotifFilter = notifTab.dataset.notifFilter;
    document.querySelectorAll("[data-notif-filter]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.notifFilter === currentNotifFilter);
    });
    renderNotificationsList();
    return;
  }

  // Mark all read button click
  if (event.target.closest("#markAllReadBtn")) {
    handleMarkAllRead();
    return;
  }

  // General actions
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "upload") uploadModal();
    else if (action === "add-member") addMemberModal();
    else if (action === "ask-question") {
      if (state.role === "teacher") {
        showToast("Questions can only be submitted by student teams.");
      } else {
        questionModal();
      }
    }
    else if (action === "team") { state.page = "team"; render(); }
    else if (action === "review-all") {
      toggleNotificationsDropdown(false);
      state.page = "projects";
      render();
    }
    else if (action === "teacher-queries") {
      state.page = "queries";
      render();
    }
    else if (action === "help") showToast("Help center: ask your teacher or visit class resources.");
    else if (action === "logout") { handleLogout(); }
    else if (action === "notifications" || action === "toggle-notifications") {
      toggleNotificationsDropdown();
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-project]");
  if (deleteButton) {
    deleteProjectPrompt(Number(deleteButton.dataset.deleteProject));
    return;
  }

  const editMemberBtn = event.target.closest("[data-edit-member]");
  if (editMemberBtn) {
    editMemberModal(Number(editMemberBtn.dataset.editMember));
    return;
  }

  const deleteMemberBtn = event.target.closest("[data-delete-member]");
  if (deleteMemberBtn) {
    removeMemberPrompt(Number(deleteMemberBtn.dataset.deleteMember));
    return;
  }

  const threadButton = event.target.closest("[data-thread]");
  if (threadButton) {
    state.selectedThread = threadButton.dataset.thread;
    render();
    return;
  }

  const reviewButton = event.target.closest("[data-review]");
  if (reviewButton) { reviewModal(Number(reviewButton.dataset.review)); return; }

  const attachFileButton = event.target.closest("[data-attach-file]");
  if (attachFileButton) { attachProjectFileModal(Number(attachFileButton.dataset.attachFile)); return; }

  const expandProjectButton = event.target.closest("[data-expand-project]");
  if (expandProjectButton) {
    toggleProjectDetails(expandProjectButton);
    return;
  }

  const projectCard = event.target.closest("[data-project-card]");
  if (projectCard && !event.target.closest("button") && !event.target.closest("a")) {
    toggleProjectDetails(projectCard.querySelector("[data-expand-project]"));
  }

  const replyButton = event.target.closest("[data-reply]");
  if (replyButton) { replyModal(Number(replyButton.dataset.reply)); }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    toggleNotificationsDropdown(false);
  }
});

function getInitials(name) {
  return String(name || "").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
}

function toggleProjectDetails(toggleButton) {
  if (!toggleButton) return;
  const details = document.getElementById(toggleButton.getAttribute("aria-controls"));
  const expanded = toggleButton.getAttribute("aria-expanded") === "true";
  toggleButton.setAttribute("aria-expanded", String(!expanded));
  details?.classList.toggle("hidden", expanded);
}

function applyTheme(theme) {
  const allowed = ["light", "night", "ambient"];
  const selected = allowed.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = selected;
  const iconsMap = { light: "☼", night: "☾", ambient: "◐" };
  const labels = { light: "Light", night: "Night", ambient: "Ambient" };
  const iconEl = document.getElementById("themeIcon");
  if (iconEl) iconEl.textContent = iconsMap[selected];

  const toggleEl = document.getElementById("themeToggle");
  if (toggleEl) {
    toggleEl.setAttribute("aria-label", `Color mode: ${labels[selected]}. Click to change mode.`);
    toggleEl.title = `Color mode: ${labels[selected]} · Click to change`;
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = selected === "night" ? "#141a23" : selected === "ambient" ? "#f4ecdf" : "#f6f7fb";
  localStorage.setItem("ideaTheme", selected);
}

const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const modes = ["light", "night", "ambient"];
    const current = document.documentElement.dataset.theme || "light";
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    applyTheme(next);
    showToast(`Entered ${next[0].toUpperCase()}${next.slice(1)} mode`);
  });
}
applyTheme(localStorage.getItem("ideaTheme") || "light");

let authMode = "signup";
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  document.getElementById("signupFields").classList.toggle("hidden", !signup);
  document.getElementById("accountName").required = signup;
  updateSignupFields();
  document.getElementById("accountPassword").autocomplete = signup ? "new-password" : "current-password";
  document.getElementById("authTitle").textContent = signup ? "Start with a fresh account" : "Log in to your account";
  document.getElementById("authCopy").textContent = signup ? "Enter your own details to set up your student or teacher workspace." : "Enter the email and password you used when you created your account.";
  document.getElementById("authSubmit").textContent = signup ? "Submit" : "Log in";
  document.getElementById("signupTab").classList.toggle("active", signup);
  document.getElementById("loginTab").classList.toggle("active", !signup);
  document.getElementById("authError").textContent = "";
}

function updatePostOptions() {
  const role = document.getElementById("accountRole").value;
  const options = role === "teacher" ? ["Administrator", "Instructor"] : ["Team leader", "Team member"];
  document.getElementById("accountPost").innerHTML = '<option value="" selected disabled>Choose your post</option>' + options.map(post => `<option value="${post}">${post}</option>`).join("");
  updateSignupFields();
}

function updateSignupFields() {
  const isStudent = document.getElementById("accountRole").value === "student";
  document.getElementById("studentSetupFields").classList.toggle("hidden", !isStudent || authMode !== "signup");
  document.getElementById("accountPost").required = isStudent && authMode === "signup";
  document.getElementById("accountDepartment").required = isStudent && authMode === "signup";
}

document.getElementById("signupTab").addEventListener("click", () => setAuthMode("signup"));
document.getElementById("loginTab").addEventListener("click", () => setAuthMode("login"));
document.getElementById("accountRole").addEventListener("change", updatePostOptions);
updatePostOptions();

// Auth form submission to Django
document.getElementById("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const error = document.getElementById("authError");

  if (!email || !password) {
    error.textContent = "Enter your email and password to continue.";
    return;
  }

  const endpoint = authMode === "signup" ? "/api/auth/signup/" : "/api/auth/login/";
  const payload = {
    email,
    password,
    name: String(form.get("name") || "").trim(),
    role: String(form.get("role") || "student"),
    post: String(form.get("post") || ""),
    department: String(form.get("department") || "").trim(),
    teamName: String(form.get("teamName") || "").trim()
  };

  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      error.textContent = data.error || "Authentication failed. Please check your credentials.";
      return;
    }

    if (data.csrfToken) {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) meta.content = data.csrfToken;
    }

    // Success! Load workspace from Django
    await loadWorkspace();
    showToast(authMode === "signup" ? "Account created successfully!" : "Logged in successfully!");
  } catch (err) {
    error.textContent = "Unable to connect to server. Please try again.";
  }
});

async function handleLogout() {
  state.account = null;
  stopChatPolling();
  stopNotificationPolling();
  toggleNotificationsDropdown(false);

  try {
    await apiFetch('/api/auth/logout/', { method: 'POST' });
  } catch (e) {}

  state.members = [];
  state.pendingInvitations = [];
  state.projects = [];
  state.queries = [];
  state.teacherSubmissions = [];
  state.unreadNotifications = 0;
  state.isTeamLeader = false;

  document.querySelector(".app-shell").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
  setAuthMode("login");
  showToast("Logged out successfully.");
}

async function loadWorkspace() {
  try {
    const res = await apiFetch('/api/workspace/');
    if (!res.ok) {
      if (res.status === 401) {
        document.querySelector(".app-shell").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
      }
      return;
    }
    const data = await res.json();

    state.role = data.role || "student";
    state.account = data.account;
    state.teamName = data.teamName || "";
    state.isTeamLeader = !!data.isTeamLeader;
    state.members = data.members || [];
    state.pendingInvitations = data.pendingInvitations || [];
    state.projects = data.projects || [];
    state.queries = data.queries || [];
    state.messages = data.messages || { team: [], studio: [], teacher: [] };
    state.teacherSubmissions = data.submissions || [];
    state.unreadNotifications = data.account?.unreadNotifications || 0;

    render();
    updateNotificationBadge(state.unreadNotifications);
    startNotificationPolling();
  } catch (err) {
    console.error("Error loading workspace from Django:", err);
  }
}

// Check initial session with Django on page load
async function initSession() {
  try {
    const res = await apiFetch('/api/auth/session/');
    const data = await res.json();
    if (data.authenticated && data.user) {
      await loadWorkspace();
    } else {
      document.querySelector(".app-shell").classList.add("hidden");
      document.getElementById("authScreen").classList.remove("hidden");
      setAuthMode("login");
    }
  } catch (err) {
    document.querySelector(".app-shell").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
  }
}

initSession();
