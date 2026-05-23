const fs = require("node:fs/promises");
const path = require("node:path");
const { PROJECT_OUTPUT_ROOT, ROOT_DIR } = require("./paths");
const { buildRequirementDoc, buildReviewReport, buildTeachingHtml } = require("./generators");
const { buildTalentPrompt, getTalent } = require("./talentService");
const { callTalentModel } = require("./llmClient");
const { updateProject } = require("./storage");
const { addLog, nowIso } = require("./utils");

const queue = [];
let running = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArtifactUrl(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

async function generateWithTalent(talentKey, project, fallbackBuilder, context = {}) {
  const talent = await getTalent(talentKey);
  if (!talent || !talent.enabled) return fallbackBuilder(project);

  const prompt = buildTalentPrompt(talent, project, context);
  project.talent_prompts = { ...(project.talent_prompts || {}), [talentKey]: prompt };

  if (!talent.modelEnabled) {
    return fallbackBuilder(project);
  }

  const result = await callTalentModel(prompt, { model: talent.model });
  project.llm_debug = {
    ...(project.llm_debug || {}),
    [talentKey]: { model: result.model, error: result.error, attempts: result.attempts }
  };
  if (result.error) return fallbackBuilder(project);
  return result.stdout.trim() || fallbackBuilder(project);
}

async function markAgent(projectId, key, status, message, progress, logMessage) {
  return updateProject(projectId, (project) => {
    const agent = project.agents[key];
    agent.status = status;
    agent.message = message;
    if (status === "running") agent.started_at = nowIso();
    if (["completed", "failed"].includes(status)) agent.ended_at = nowIso();
    if (typeof progress === "number") project.progress = progress;
    if (logMessage) addLog(project, key, status === "failed" ? "error" : "info", logMessage);
  });
}

async function runPipeline(projectId) {
  await updateProject(projectId, (project) => {
    project.status = "running";
    project.progress = 5;
    addLog(project, "manager", "info", "数字员工流水线启动");
  });

  const projectDir = path.join(PROJECT_OUTPUT_ROOT, projectId);
  await fs.mkdir(projectDir, { recursive: true });

  try {
    let project = await markAgent(projectId, "planner", "running", "正在分析教学需求并撰写需求文档", 18, "策划开始工作");
    if (!project) return;
    await wait(500);
    const requirementsPath = path.join(projectDir, "requirements.md");
    await fs.writeFile(requirementsPath, await generateWithTalent("planner", project, buildRequirementDoc), "utf8");
    await updateProject(projectId, (target) => {
      target.agents.planner.status = "completed";
      target.agents.planner.message = "需求文档已生成";
      target.agents.planner.ended_at = nowIso();
      target.progress = 42;
      target.artifacts.requirements = toArtifactUrl(requirementsPath);
      addLog(target, "planner", "info", "requirements.md 已写入");
    });

    project = await markAgent(projectId, "maker", "running", "正在生成互动教学 HTML", 58, "制作开始工作");
    if (!project) return;
    await wait(700);
    const htmlPath = path.join(projectDir, "index.html");
    await fs.writeFile(htmlPath, await generateWithTalent("maker", project, buildTeachingHtml, { previousOutput: project.artifacts?.requirements || "需求文档已生成" }), "utf8");
    await updateProject(projectId, (target) => {
      target.agents.maker.status = "completed";
      target.agents.maker.message = "互动课件已生成";
      target.agents.maker.ended_at = nowIso();
      target.progress = 78;
      target.artifacts.html = toArtifactUrl(htmlPath);
      addLog(target, "maker", "info", "index.html 已写入");
    });

    project = await markAgent(projectId, "reviewer", "running", "正在检查产物完整性", 88, "审核开始工作");
    if (!project) return;
    await wait(400);
    const reviewPath = path.join(projectDir, "review.md");
    await fs.writeFile(reviewPath, await generateWithTalent("reviewer", project, buildReviewReport, { previousOutput: JSON.stringify(project.artifacts || {}) }), "utf8");
    await updateProject(projectId, (target) => {
      target.agents.reviewer.status = "completed";
      target.agents.reviewer.message = "质量检查通过";
      target.agents.reviewer.ended_at = nowIso();
      target.progress = 100;
      target.status = "completed";
      target.artifacts.review = toArtifactUrl(reviewPath);
      addLog(target, "reviewer", "info", "review.md 已写入");
      addLog(target, "manager", "info", "项目流水线完成");
    });
  } catch (error) {
    await updateProject(projectId, (project) => {
      project.status = "failed";
      project.progress = Math.min(project.progress || 0, 95);
      for (const agent of Object.values(project.agents)) {
        if (agent.status === "running") {
          agent.status = "failed";
          agent.ended_at = nowIso();
          agent.message = "执行失败";
        }
      }
      addLog(project, "manager", "error", `流水线失败：${error.message}`);
    });
  }
}

function enqueue(projectId) {
  queue.push(projectId);
  drainQueue();
}

async function drainQueue() {
  if (running) return;
  running = true;
  while (queue.length) {
    const projectId = queue.shift();
    await runPipeline(projectId);
  }
  running = false;
}

module.exports = { enqueue, runPipeline };
