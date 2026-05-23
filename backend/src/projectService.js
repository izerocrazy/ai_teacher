const { readProjects, writeProjects } = require("./storage");
const { addLog, createId, nowIso } = require("./utils");

function defaultAgents() {
  return {
    planner: { name: "课件设计师", status: "pending", message: "等待拆解需求", started_at: null, ended_at: null },
    maker: { name: "制作佬", status: "pending", message: "等待制作课件", started_at: null, ended_at: null },
    reviewer: { name: "审核佬", status: "pending", message: "等待质量检查", started_at: null, ended_at: null }
  };
}

function normalizeProject(project) {
  const agents = defaultAgents();
  return {
    subject: "综合",
    grade: "未指定",
    duration: 5,
    artifacts: { requirements: null, html: null, review: null },
    logs: [],
    ...project,
    agents: {
      planner: { ...agents.planner, ...(project.agents?.planner || {}) },
      maker: { ...agents.maker, ...(project.agents?.maker || {}) },
      reviewer: { ...agents.reviewer, ...(project.agents?.reviewer || {}) }
    },
    artifacts: { requirements: null, html: null, review: null, ...(project.artifacts || {}) },
    logs: Array.isArray(project.logs) ? project.logs : []
  };
}

async function listProjects() {
  const projects = (await readProjects()).map(normalizeProject);
  return projects.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function getProject(projectId) {
  const projects = await listProjects();
  return projects.find((project) => project.id === projectId) || null;
}

async function createProject(payload) {
  const title = String(payload.title || "").trim();
  const demand = String(payload.demand || "").trim();
  const subject = String(payload.subject || "综合").trim() || "综合";
  const grade = String(payload.grade || "未指定").trim() || "未指定";
  const duration = Number.parseInt(payload.duration, 10) || 5;

  if (!title || !demand) {
    const error = new Error("Fields 'title' and 'demand' are required");
    error.status = 400;
    throw error;
  }

  const timestamp = nowIso();
  const project = normalizeProject({
    id: createId(title),
    title,
    demand,
    subject,
    grade,
    duration: Math.max(1, Math.min(duration, 120)),
    status: "queued",
    progress: 0,
    created_at: timestamp,
    updated_at: timestamp
  });

  addLog(project, "manager", "info", "项目已创建并加入队列");
  const projects = await readProjects();
  projects.push(project);
  await writeProjects(projects);
  return project;
}

async function resetForRerun(projectId) {
  const projects = await readProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) return null;
  const normalized = normalizeProject(project);
  Object.assign(project, normalized, {
    status: "queued",
    progress: 0,
    agents: defaultAgents(),
    artifacts: { requirements: null, html: null, review: null },
    updated_at: nowIso()
  });
  addLog(project, "manager", "info", "项目已重新加入队列");
  await writeProjects(projects);
  return normalizeProject(project);
}

module.exports = { createProject, getProject, listProjects, normalizeProject, resetForRerun };
