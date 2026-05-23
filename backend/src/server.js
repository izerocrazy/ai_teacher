const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { FRONTEND_DIST_DIR, FRONTEND_DIR, ROOT_DIR } = require("./paths");
const { ensureStorage } = require("./storage");
const { createProject, getProject, listProjects, resetForRerun } = require("./projectService");
const { enqueue } = require("./pipeline");
const { buildTalentPrompt, getTalent, listTalents, updateTalent } = require("./talentService");
const { callTalentModel } = require("./llmClient");

const PORT = Number(process.env.PORT || 8010);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { "Content-Type": "application/json; charset=utf-8" });
}

async function testTalent(key, payload) {
  const talent = await getTalent(key);
  if (!talent) return null;

  const project = {
    title: String(payload.title || "测试动画课件").trim() || "测试动画课件",
    subject: String(payload.subject || "数学").trim() || "数学",
    grade: String(payload.grade || "小学三年级").trim() || "小学三年级",
    duration: Number.parseInt(payload.duration, 10) || 8,
    demand: String(payload.demand || "用动画解释知识点，并加入一次互动练习。").trim()
  };
  const prompt = buildTalentPrompt(talent, project, { previousOutput: payload.context || "这是一次前端测试，不依赖真实项目产物。" });

  if (talent.modelEnabled) {
    const result = await callTalentModel(prompt, { model: talent.model });
    return {
      talent,
      project,
      prompt,
      usedModel: true,
      model: result.model,
      output: result.error ? `大模型调用失败：${result.error}` : result.stdout,
      attempts: result.attempts || []
    };
  }

  return {
    talent,
    project,
    prompt,
    usedModel: false,
    model: talent.model,
    output: `测试已生成提示词。当前未调用 Codex。\n\n请确认该专项人才已启用大模型调用；默认通道为 Codex。`,
    attempts: []
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function serveFile(res, filePath) {
  const data = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, data, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
}

function safeResolve(root, requestPath) {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const target = path.resolve(root, decoded);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

async function serveStatic(reqPath, res) {
  if (reqPath.startsWith("/output/")) {
    const target = safeResolve(ROOT_DIR, reqPath);
    if (!target) return sendJson(res, 403, { error: "Forbidden" });
    if (!(await fileExists(target))) return sendJson(res, 404, { error: "File not found" });
    return serveFile(res, target);
  }

  const hasBuild = await fileExists(path.join(FRONTEND_DIST_DIR, "index.html"));
  const staticRoot = hasBuild ? FRONTEND_DIST_DIR : FRONTEND_DIR;
  const fallbackIndex = path.join(staticRoot, "index.html");
  const requestFile = reqPath === "/" ? "index.html" : reqPath;
  const target = safeResolve(staticRoot, requestFile);

  if (target && (await fileExists(target))) return serveFile(res, target);
  if (await fileExists(fallbackIndex)) return serveFile(res, fallbackIndex);
  return sendJson(res, 404, { error: "Frontend not built. Run npm --prefix frontend install && npm --prefix frontend run build." });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "ai-teacher-backend", time: new Date().toISOString() });
  }

  if (req.method === "GET" && url.pathname === "/api/talents") {
    return sendJson(res, 200, { talents: await listTalents() });
  }

  if (parts[0] === "api" && parts[1] === "talents" && parts[2] && req.method === "PUT") {
    const payload = await readJsonBody(req);
    const talent = await updateTalent(parts[2], payload);
    return talent ? sendJson(res, 200, talent) : sendJson(res, 404, { error: "Talent not found" });
  }

  if (parts[0] === "api" && parts[1] === "talents" && parts[2] && parts[3] === "test" && req.method === "POST") {
    const payload = await readJsonBody(req);
    const result = await testTalent(parts[2], payload);
    return result ? sendJson(res, 200, result) : sendJson(res, 404, { error: "Talent not found" });
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(res, 200, { projects: await listProjects() });
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const payload = await readJsonBody(req);
    const project = await createProject(payload);
    enqueue(project.id);
    return sendJson(res, 201, project);
  }

  if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
    const projectId = parts[2];
    if (req.method === "GET" && parts.length === 3) {
      const project = await getProject(projectId);
      return project ? sendJson(res, 200, project) : sendJson(res, 404, { error: "Project not found" });
    }

    if (req.method === "POST" && parts[3] === "rerun") {
      const project = await resetForRerun(projectId);
      if (!project) return sendJson(res, 404, { error: "Project not found" });
      enqueue(project.id);
      return sendJson(res, 202, project);
    }
  }

  return sendJson(res, 404, { error: "Not found" });
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, "");

  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    return await serveStatic(url.pathname, res);
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    return sendJson(res, status, { error: error.message || "Internal server error" });
  }
}

async function main() {
  await ensureStorage();
  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    console.log(`AI Teacher backend listening at http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { handleRequest };
