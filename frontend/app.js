const state = {
  projects: [],
  selectedId: null,
};

const els = {
  form: document.getElementById("projectForm"),
  title: document.getElementById("title"),
  demand: document.getElementById("demand"),
  submitBtn: document.getElementById("submitBtn"),
  createHint: document.getElementById("createHint"),
  refreshBtn: document.getElementById("refreshBtn"),
  projectList: document.getElementById("projectList"),
  detailPanel: document.getElementById("detailPanel"),
};

function formatTime(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status) {
  const map = {
    queued: "排队中",
    pending: "待执行",
    running: "执行中",
    completed: "已完成",
    failed: "失败",
  };
  return map[status] || status;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderProjects() {
  if (state.projects.length === 0) {
    els.projectList.innerHTML = "<p class=\"project-meta\">暂无项目，先提交一个需求试试。</p>";
    return;
  }

  els.projectList.innerHTML = state.projects
    .map((project) => {
      const active = project.id === state.selectedId ? "active" : "";
      const progress = Math.max(0, Math.min(100, project.progress || 0));
      return `
      <article class="project-item ${active}" data-id="${project.id}">
        <div class="project-head">
          <p class="project-title">${escapeHtml(project.title)}</p>
          <span class="badge status-${project.status}">${statusLabel(project.status)}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%"></div></div>
        <p class="project-meta">进度 ${progress}% · 创建时间 ${formatTime(project.created_at)}</p>
      </article>`;
    })
    .join("");

  const items = els.projectList.querySelectorAll(".project-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      state.selectedId = item.dataset.id;
      renderProjects();
      renderDetail();
    });
  });
}

function renderDetail() {
  const project = state.projects.find((p) => p.id === state.selectedId);
  if (!project) {
    els.detailPanel.textContent = "请选择一个项目查看执行日志。";
    return;
  }

  const planner = project.agents?.planner || {};
  const maker = project.agents?.maker || {};
  const logs = Array.isArray(project.logs) ? [...project.logs].reverse() : [];

  const links = [];
  if (project.artifacts?.requirements) {
    links.push(
      `<a class="output-link" href="/${project.artifacts.requirements}" target="_blank" rel="noopener">需求文档</a>`
    );
  }
  if (project.artifacts?.html) {
    links.push(
      `<a class="output-link" href="/${project.artifacts.html}" target="_blank" rel="noopener">教学 HTML</a>`
    );
  }

  els.detailPanel.innerHTML = `
    <p><strong>${escapeHtml(project.title)}</strong></p>
    <p class="project-meta">需求：${escapeHtml(project.demand)}</p>
    <div class="agent-grid">
      <div class="agent-card">
        <strong>${escapeHtml(planner.name || "策划/产品佬")}</strong>
        <span class="badge status-${planner.status || "pending"}">${statusLabel(planner.status || "pending")}</span>
        <small>${escapeHtml(planner.message || "-")}</small>
      </div>
      <div class="agent-card">
        <strong>${escapeHtml(maker.name || "制作佬")}</strong>
        <span class="badge status-${maker.status || "pending"}">${statusLabel(maker.status || "pending")}</span>
        <small>${escapeHtml(maker.message || "-")}</small>
      </div>
    </div>
    <div class="links">${links.join("") || "暂无产物"}</div>
    <h3>执行日志</h3>
    <ul class="log-list">
      ${
        logs.length
          ? logs
              .map(
                (log) => `<li class="log-item">[${formatTime(log.time)}] ${escapeHtml(log.source)}: ${escapeHtml(log.message)}</li>`
              )
              .join("")
          : "<li class=\"log-item\">暂无日志</li>"
      }
    </ul>
  `;
}

async function fetchProjects() {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new Error("failed to fetch projects");
  }
  const data = await res.json();
  state.projects = data.projects || [];

  if (!state.selectedId && state.projects.length > 0) {
    state.selectedId = state.projects[0].id;
  }

  if (state.selectedId && !state.projects.some((p) => p.id === state.selectedId)) {
    state.selectedId = state.projects.length ? state.projects[0].id : null;
  }

  renderProjects();
  renderDetail();
}

async function handleCreate(event) {
  event.preventDefault();

  const title = els.title.value.trim();
  const demand = els.demand.value.trim();
  if (!title || !demand) {
    els.createHint.textContent = "请填写完整项目标题和需求描述。";
    return;
  }

  els.submitBtn.disabled = true;
  els.createHint.textContent = "正在创建项目并投递给数字员工...";

  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, demand }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "create failed");
    }

    els.createHint.textContent = "项目已创建，AI 正在自动执行。";
    els.form.reset();
    await fetchProjects();
    state.selectedId = data.id;
    renderProjects();
    renderDetail();
  } catch (error) {
    els.createHint.textContent = `创建失败：${error.message}`;
  } finally {
    els.submitBtn.disabled = false;
  }
}

function setupEvents() {
  els.form.addEventListener("submit", handleCreate);
  els.refreshBtn.addEventListener("click", () => {
    fetchProjects().catch((err) => {
      els.createHint.textContent = `刷新失败：${err.message}`;
    });
  });
}

async function init() {
  setupEvents();
  try {
    await fetchProjects();
  } catch (err) {
    els.createHint.textContent = "加载项目失败，请确认后端服务已启动。";
  }

  setInterval(() => {
    fetchProjects().catch(() => {
      // Keep silent during polling.
    });
  }, 2000);
}

init();
