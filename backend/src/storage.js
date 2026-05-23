const fs = require("node:fs/promises");
const path = require("node:path");
const { DATA_DIR, PROJECT_OUTPUT_ROOT, PROJECTS_FILE } = require("./paths");

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PROJECT_OUTPUT_ROOT, { recursive: true });
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    await fs.writeFile(PROJECTS_FILE, "[]\n", "utf8");
  }
}

async function readProjects() {
  await ensureStorage();
  const raw = await fs.readFile(PROJECTS_FILE, "utf8");
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeProjects(projects) {
  await ensureStorage();
  const tmp = `${PROJECTS_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  await fs.rename(tmp, PROJECTS_FILE);
}

async function updateProject(projectId, mutator) {
  const projects = await readProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) return null;
  await mutator(project);
  project.updated_at = new Date().toISOString();
  await writeProjects(projects);
  return project;
}

function artifactPath(projectId, filename) {
  return path.join(PROJECT_OUTPUT_ROOT, projectId, filename);
}

module.exports = {
  ensureStorage,
  readProjects,
  writeProjects,
  updateProject,
  artifactPath
};
