const fs = require("node:fs/promises");
const { DATA_DIR } = require("./paths");
const path = require("node:path");

const TALENTS_FILE = path.join(DATA_DIR, "talents.json");

const DEFAULT_TALENTS = [

  {
    key: "base_tester",
    name: "基础测试员",
    title: "大模型连通性测试专项人才",
    enabled: true,
    modelEnabled: true,
    model: "codex-default",
    inputRequirements: "接收一条简单测试需求，判断大模型是否能正常理解并返回中文结果。",
    outputRequirements: "用 3 到 5 句话返回测试结论，必须包含：模型是否响应、输入摘要、下一步建议。",
    baseSettings: "你是一个大模型在线状态测试员。你的任务不是生成课件，而是用简短中文确认模型调用链路是否可用。"
  },
  {
    key: "planner",
    name: "课件设计师",
    title: "动画课件设计专项人才",
    enabled: true,
    modelEnabled: true,
    model: "codex-default",
    inputRequirements: "接收项目标题、学科、年级、预计时长、教师原始需求。重点识别教学目标、知识难点、动画演示场景和互动练习目标。",
    outputRequirements: "输出 Markdown 需求文档，包含教学目标、学生画像、动画脚本、互动设计、验收标准和制作注意事项。",
    baseSettings: "你是一名有小学课堂经验的动画课件设计师，语言清晰，重视动画演示和互动反馈，避免空泛表达。"
  },
  {
    key: "maker",
    name: "课件制作师",
    title: "动画互动课件制作专项人才",
    enabled: true,
    modelEnabled: true,
    model: "codex-default",
    inputRequirements: "接收项目需求和策划文档。重点读取动画分镜、互动练习、课堂总结和移动端适配要求。",
    outputRequirements: "输出一个完整单文件 HTML，内嵌 CSS 和 JavaScript，必须包含动画演示区、互动练习、即时反馈和课堂总结。",
    baseSettings: "你是一名动画互动课件制作师，擅长用简洁页面表达知识变化过程，优先保证可运行、可演示、可互动。"
  },
  {
    key: "reviewer",
    name: "质量审核员",
    title: "动画课件质量审核专项人才",
    enabled: true,
    modelEnabled: true,
    model: "codex-default",
    inputRequirements: "接收项目需求、需求文档和互动课件 HTML。重点检查动画表现、互动反馈、结构完整性和课堂可用性。",
    outputRequirements: "输出 Markdown 审核报告，包含通过结论、检查项、风险提醒和后续优化建议。",
    baseSettings: "你是一名教学内容审核员，关注课堂使用效果、动画是否服务理解、互动是否有反馈、产物是否完整。"
  }
];

async function ensureTalents() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TALENTS_FILE);
  } catch {
    await fs.writeFile(TALENTS_FILE, `${JSON.stringify(DEFAULT_TALENTS, null, 2)}\n`, "utf8");
  }
}

function normalizeTalent(talent) {
  const base = DEFAULT_TALENTS.find((item) => item.key === talent.key) || {};
  const merged = talent.key === "base_tester" ? { ...base, key: "base_tester" } : { ...base, ...talent };
  return { ...merged, modelEnabled: true, model: "codex-default" };
}

async function listTalents() {
  await ensureTalents();
  const raw = await fs.readFile(TALENTS_FILE, "utf8");
  const parsed = JSON.parse(raw || "[]");
  const merged = DEFAULT_TALENTS.map((base) => normalizeTalent(parsed.find((item) => item.key === base.key) || base));
  return merged;
}

async function getTalent(key) {
  const talents = await listTalents();
  return talents.find((talent) => talent.key === key) || null;
}

async function saveTalents(talents) {
  await ensureTalents();
  await fs.writeFile(TALENTS_FILE, `${JSON.stringify(talents.map(normalizeTalent), null, 2)}\n`, "utf8");
}

async function updateTalent(key, payload) {
  const talents = await listTalents();
  const index = talents.findIndex((talent) => talent.key === key);
  if (index === -1) return null;
  if (key === "base_tester") return talents[index];
  talents[index] = normalizeTalent({
    ...talents[index],
    name: String(payload.name ?? talents[index].name).trim() || talents[index].name,
    title: String(payload.title ?? talents[index].title).trim() || talents[index].title,
    enabled: Boolean(payload.enabled),
    modelEnabled: true,
    model: "codex-default",
    inputRequirements: String(payload.inputRequirements ?? talents[index].inputRequirements).trim(),
    outputRequirements: String(payload.outputRequirements ?? talents[index].outputRequirements).trim(),
    baseSettings: String(payload.baseSettings ?? talents[index].baseSettings).trim()
  });
  await saveTalents(talents);
  return talents[index];
}

function buildTalentPrompt(talent, project, context = {}) {
  return `# 角色设定\n${talent.baseSettings}\n\n# 输入要求\n${talent.inputRequirements}\n\n# 输出要求\n${talent.outputRequirements}\n\n# 项目信息\n- 标题：${project.title}\n- 学科：${project.subject}\n- 年级：${project.grade}\n- 时长：${project.duration} 分钟\n- 原始需求：${project.demand}\n\n# 上下文\n${context.previousOutput || "暂无"}\n\n请严格按照输出要求生成结果，不要解释你无法执行的内容。`;
}

module.exports = { DEFAULT_TALENTS, buildTalentPrompt, getTalent, listTalents, updateTalent };
