<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import ProjectDetail from "./components/ProjectDetail.vue";
import ProjectForm from "./components/ProjectForm.vue";
import ProjectList from "./components/ProjectList.vue";
import { createProject, fetchProjects, fetchTalents, rerunProject, testTalent, updateTalent } from "./services/api";

const projects = ref([]);
const talents = ref([]);
const savingTalentKey = ref(null);
const testingTalentKey = ref(null);
const selectedTalentKey = ref("planner");
const talentTestMessage = ref("");
const selectedId = ref(null);
const keyword = ref("");
const status = ref("all");
const error = ref("");
const loading = ref(false);
const route = ref(parseRoute());
const talentTestForm = reactive({
  title: "认识周长动画互动课件",
  subject: "数学",
  grade: "小学三年级",
  duration: 8,
  demand: "用动画演示围成一圈的边线就是周长，并设计一次拖拽或选择互动练习。",
  context: "希望动画清楚展示边线逐段点亮，最后汇总成周长。"
});
const talentTestResults = ref({});
let timer = null;

const navItems = [
  { name: "首页", page: "home" },
  { name: "数字员工", page: "employees" },
  { name: "人才实验室", page: "talent-lab" },
  { name: "创建课件", page: "create" },
  { name: "项目中心", page: "projects" },
  { name: "工作台", page: "workspace" }
];

const employeeProfiles = [

  {
    key: "base_tester",
    avatar: "测",
    name: "基础测试员",
    title: "大模型连通性测试",
    promise: "用最简单的任务检查大模型是否正常在线",
    responsibilities: ["检查模型响应", "返回测试结论", "提示连接问题", "确认基础链路"],
    skills: ["在线测试", "链路检查", "快速反馈"],
    deliverable: "测试结论"
  },  {
    key: "planner",
    avatar: "策",
    name: "课件设计师",
    title: "动画课件设计",
    promise: "把一个想法整理成可以制作的课堂方案",
    responsibilities: ["理解教学目标", "拆解课堂结构", "设计互动方式", "生成验收标准"],
    skills: ["目标拆解", "课堂脚本", "互动设计"],
    deliverable: "需求文档"
  },
  {
    key: "maker",
    avatar: "制",
    name: "课件制作师",
    title: "动画互动课件制作",
    promise: "把方案制作成可以直接打开的动画互动课件",
    responsibilities: ["搭建页面结构", "制作动画演示", "加入练习反馈", "适配手机电脑"],
    skills: ["页面制作", "动画呈现", "交互反馈"],
    deliverable: "动画互动课件"
  },
  {
    key: "reviewer",
    avatar: "审",
    name: "质量审核员",
    title: "交付质量检查",
    promise: "检查课件是否完整、清晰、适合课堂使用",
    responsibilities: ["检查产物完整性", "确认交互反馈", "记录审核结论", "提示改进方向"],
    skills: ["质量检查", "交付验收", "改进建议"],
    deliverable: "审核报告"
  }
];

const filteredProjects = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return projects.value.filter((project) => {
    const matchStatus = status.value === "all" || project.status === status.value;
    const haystack = `${project.title} ${project.subject} ${project.grade} ${project.demand}`.toLowerCase();
    return matchStatus && (!kw || haystack.includes(kw));
  });
});

const selectedProject = computed(() => {
  const id = route.value.id || selectedId.value;
  return projects.value.find((project) => project.id === id) || null;
});

const recentProjects = computed(() => projects.value.slice(0, 3));
const employees = computed(() =>
  employeeProfiles.map((profile) => {
    const related = projects.value.filter((project) => project.agents?.[profile.key]);
    const runningProject = related.find((project) => project.agents?.[profile.key]?.status === "running");
    const failedProject = related.find((project) => project.agents?.[profile.key]?.status === "failed");
    const pendingProject = related.find((project) => project.agents?.[profile.key]?.status === "pending" && ["queued", "running"].includes(project.status));
    const completedCount = related.filter((project) => project.agents?.[profile.key]?.status === "completed").length;

    const talent = talents.value.find((item) => item.key === profile.key) || {};

    return {
      ...profile,
      ...talent,
      status: runningProject ? "working" : failedProject ? "attention" : pendingProject ? "waiting" : "idle",
      currentProject: runningProject || pendingProject || null,
      projectCount: related.length,
      completedCount,
      recentProjects: related.slice(0, 3)
    };
  })
);
const selectedTalent = computed(() => employees.value.find((employee) => employee.key === selectedTalentKey.value) || employees.value[0] || null);
const currentTalentTestResult = computed(() => talentTestResults.value[selectedTalentKey.value] || null);
const employeeStats = computed(() => ({
  total: employees.value.length,
  working: employees.value.filter((employee) => employee.status === "working").length,
  completed: employees.value.reduce((sum, employee) => sum + employee.completedCount, 0),
  tasks: projects.value.filter((project) => ["queued", "running"].includes(project.status)).length
}));
const activePage = computed(() => route.value.page);
const stats = computed(() => ({
  total: projects.value.length,
  running: projects.value.filter((item) => ["queued", "running"].includes(item.status)).length,
  completed: projects.value.filter((item) => item.status === "completed").length,
  failed: projects.value.filter((item) => item.status === "failed").length
}));

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [page = "home", id = null] = hash.split("/");
  const normalized = ["home", "employees", "talent-lab", "create", "projects", "project", "workspace"].includes(page) ? page : "home";
  return { page: normalized, id };
}

function go(page, id = null) {
  window.location.hash = id ? `#/${page}/${id}` : `#/${page}`;
}

function selectProject(projectId, targetPage = "project") {
  selectedId.value = projectId;
  go(targetPage, projectId);
}

function statusText(value) {
  return { queued: "排队中", running: "执行中", completed: "已完成", failed: "失败" }[value] || value;
}

function employeeStatusText(value) {
  return { working: "工作中", waiting: "待处理", idle: "空闲", attention: "需关注" }[value] || value;
}

function employeeStatusTone(value) {
  return { working: "status-running", waiting: "status-queued", idle: "status-completed", attention: "status-failed" }[value] || "status-queued";
}

function isFixedTalent(employee) {
  return employee?.key === "base_tester";
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function loadTalents() {
  const data = await fetchTalents();
  talents.value = data.talents || [];
}

async function saveTalent(employee) {
  savingTalentKey.value = employee.key;
  try {
    const updated = await updateTalent(employee.key, employee);
    talents.value = talents.value.map((item) => (item.key === updated.key ? updated : item));
    if (!talents.value.some((item) => item.key === updated.key)) talents.value.push(updated);
  } catch (err) {
    error.value = err.message;
  } finally {
    savingTalentKey.value = null;
  }
}

async function runTalentTest(employee) {
  testingTalentKey.value = employee.key;
  talentTestMessage.value = isFixedTalent(employee) ? "正在测试大模型在线状态..." : "正在保存设定并测试...";
  talentTestResults.value = { ...talentTestResults.value, [employee.key]: null };
  try {
    if (!isFixedTalent(employee)) await saveTalent(employee);
    const result = await testTalent(employee.key, talentTestForm);
    talentTestResults.value = { ...talentTestResults.value, [employee.key]: result };
    talentTestMessage.value = result.usedModel ? "测试完成：已收到大模型响应。" : "测试完成：已生成提示词预览，当前未调用大模型。";
  } catch (err) {
    const message = err.message === "Not found"
      ? "测试接口不存在，请重启后端服务后再试。"
      : err.message;
    error.value = message;
    talentTestMessage.value = `测试失败：${message}`;
  } finally {
    testingTalentKey.value = null;
  }
}

async function loadProjects(silent = false) {
  if (!silent) loading.value = true;
  try {
    const data = await fetchProjects();
    projects.value = data.projects || [];
    if (!selectedId.value && projects.value.length) selectedId.value = projects.value[0].id;
    if (route.value.id) selectedId.value = route.value.id;
    if (selectedId.value && !projects.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = projects.value[0]?.id || null;
    }
    error.value = "";
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleCreate(payload) {
  const project = await createProject(payload);
  selectedId.value = project.id;
  await loadProjects(true);
  go("project", project.id);
}

async function handleRerun(projectId) {
  await rerunProject(projectId);
  await loadProjects(true);
}

function onHashChange() {
  route.value = parseRoute();
  if (route.value.id) selectedId.value = route.value.id;
}

onMounted(() => {
  window.addEventListener("hashchange", onHashChange);
  if (!window.location.hash) go("home");
  loadProjects();
  loadTalents().catch((err) => { error.value = err.message; });
  timer = window.setInterval(() => loadProjects(true), 2200);
});

onBeforeUnmount(() => {
  window.removeEventListener("hashchange", onHashChange);
  window.clearInterval(timer);
});
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <button class="brand" type="button" @click="go('home')">
        <span class="brand-mark">教</span>
        <span>
          <strong>智能教学助手</strong>
          <small>数字员工动画课件生成</small>
        </span>
      </button>

      <nav class="nav-tabs" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="item.page"
          type="button"
          :class="{ active: activePage === item.page }"
          @click="go(item.page)"
        >
          {{ item.name }}
        </button>
      </nav>

      <button class="ghost top-action" type="button" @click="loadProjects()">{{ loading ? "同步中" : "同步数据" }}</button>
    </header>

    <p v-if="error" class="error global-error">{{ error }}</p>

    <section v-if="activePage === 'home'" class="page home-page">
      <div class="hero-panel card">
        <div>
          <p class="eyebrow">面向教师的动画课件生成产品</p>
          <h1>把教学想法变成有动画、可互动的课堂课件</h1>
          <p class="subtitle">输入主题、年级和教学目标，数字员工会自动完成需求拆解、动画课件制作和质量检查。</p>
          <div class="hero-actions">
            <button type="button" @click="go('create')">创建课件</button>
            <button class="ghost" type="button" @click="go('employees')">认识数字员工</button>
            <button class="ghost" type="button" @click="go('projects')">查看项目</button>
          </div>
        </div>
        <div class="stat-strip">
          <span><strong>{{ stats.total }}</strong><small>总项目</small></span>
          <span><strong>{{ stats.running }}</strong><small>进行中</small></span>
          <span><strong>{{ stats.completed }}</strong><small>已完成</small></span>
          <span><strong>{{ stats.failed }}</strong><small>异常</small></span>
        </div>
      </div>

      <div class="feature-grid">
        <article class="card feature-card">
          <span>第一步</span>
          <h2>填写教学需求</h2>
          <p>用自然语言说明课程目标、动画效果、互动练习和课堂使用场景。</p>
        </article>
        <article class="card feature-card">
          <span>第二步</span>
          <h2>数字员工制作动画课件</h2>
          <p>策划、制作、审核三个节点自动接力，生成带动画演示和互动练习的课件。</p>
        </article>
        <article class="card feature-card">
          <span>第三步</span>
          <h2>查看动画交付产物</h2>
          <p>在项目详情中打开需求文档、动画互动课件和审核报告。</p>
        </article>
      </div>

      <section class="card recent-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">最近项目</p>
            <h2>继续处理你的课件</h2>
          </div>
          <button class="ghost" type="button" @click="go('projects')">全部项目</button>
        </div>
        <div v-if="recentProjects.length" class="recent-list">
          <button v-for="project in recentProjects" :key="project.id" type="button" @click="selectProject(project.id)">
            <span>
              <strong>{{ project.title }}</strong>
              <small>{{ project.subject }} · {{ project.grade }}</small>
            </span>
            <span class="badge" :class="`status-${project.status}`">{{ statusText(project.status) }}</span>
          </button>
        </div>
        <p v-else class="empty">还没有项目，先创建第一个课件。</p>
      </section>
    </section>

    <section v-else-if="activePage === 'employees'" class="page employees-page">
      <div class="employee-hero card">
        <div>
          <p class="eyebrow">数字员工团队</p>
          <h1>你的动画课件制作小组</h1>
          <p class="subtitle">每个动画课件项目都会由三位数字员工接力完成。你可以查看他们负责什么、当前是否忙碌，以及最近参与了哪些课件。</p>
          <div class="hero-actions">
            <button type="button" @click="go('create')">安排新任务</button>
            <button class="ghost" type="button" @click="go('projects')">查看项目中心</button>
            <button class="ghost" type="button" @click="go('talent-lab')">配置与测试</button>
          </div>
        </div>
        <div class="employee-summary">
          <span><strong>{{ employeeStats.total }}</strong><small>团队成员</small></span>
          <span><strong>{{ employeeStats.working }}</strong><small>正在工作</small></span>
          <span><strong>{{ employeeStats.tasks }}</strong><small>当前任务</small></span>
          <span><strong>{{ employeeStats.completed }}</strong><small>累计完成节点</small></span>
        </div>
      </div>

      <div class="employee-grid">
        <article v-for="employee in employees" :key="employee.key" class="employee-card card">
          <div class="employee-card-head">
            <div class="employee-avatar">{{ employee.avatar }}</div>
            <div>
              <p class="eyebrow">{{ employee.title }}</p>
              <h2>{{ employee.name }}</h2>
            </div>
            <span class="badge" :class="employeeStatusTone(employee.status)">{{ employeeStatusText(employee.status) }}</span>
          </div>

          <p class="employee-promise">{{ employee.promise }}</p>

          <div class="employee-metrics">
            <span><strong>{{ employee.projectCount }}</strong><small>参与项目</small></span>
            <span><strong>{{ employee.completedCount }}</strong><small>完成节点</small></span>
            <span><strong>{{ employee.deliverable }}</strong><small>主要产物</small></span>
          </div>

          <section class="employee-section">
            <h3>擅长能力</h3>
            <div class="skill-row">
              <span v-for="skill in employee.skills" :key="skill">{{ skill }}</span>
            </div>
          </section>

          <section class="employee-section">
            <h3>工作职责</h3>
            <ul class="plain-list">
              <li v-for="item in employee.responsibilities" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="employee-section current-task">
            <h3>当前任务</h3>
            <button v-if="employee.currentProject" type="button" @click="selectProject(employee.currentProject.id)">
              <span>
                <strong>{{ employee.currentProject.title }}</strong>
                <small>{{ employee.currentProject.subject }} · 进度 {{ employee.currentProject.progress || 0 }}%</small>
              </span>
              <span class="badge" :class="`status-${employee.currentProject.status}`">{{ statusText(employee.currentProject.status) }}</span>
            </button>
            <p v-else class="empty">暂无进行中的任务，可以安排一个新课件。</p>
          </section>

          <section class="employee-section">
            <h3>最近协作</h3>
            <div v-if="employee.recentProjects.length" class="mini-project-list">
              <button v-for="project in employee.recentProjects" :key="project.id" type="button" @click="selectProject(project.id)">
                <span>{{ project.title }}</span>
                <small>{{ formatTime(project.created_at) }}</small>
              </button>
            </div>
            <p v-else class="empty">还没有协作记录。</p>
          </section>
        </article>
      </div>

      <section class="card employee-guide">
        <div>
          <p class="eyebrow">如何理解数字员工</p>
          <h2>他们不是一个按钮，而是一条可追踪的协作链路</h2>
        </div>
        <div class="guide-grid">
          <p>你提交的是教学想法，课件设计师会先把它变成可制作的方案。</p>
          <p>课件制作师根据方案生成带动画演示的互动页面，尽量保证手机和电脑都能打开。</p>
          <p>质量审核员会检查产物是否完整，并把审核结论记录下来。</p>
        </div>
      </section>
    </section>

    <section v-else-if="activePage === 'talent-lab'" class="page talent-lab-page">
      <div class="page-title row-title">
        <div>
          <p class="eyebrow">人才实验室</p>
          <h1>配置和测试数字员工</h1>
          <p class="subtitle">为每个专项人才设置输入要求、输出要求和基础设定，再用一段测试需求检查提示词和输出效果。</p>
        </div>
        <button type="button" @click="go('employees')">返回数字员工</button>
      </div>

      <section class="lab-layout">
        <aside class="card talent-picker">
          <p class="eyebrow">选择人才</p>
          <button
            v-for="employee in employees"
            :key="employee.key"
            type="button"
            :class="{ active: selectedTalentKey === employee.key }"
            @click="selectedTalentKey = employee.key"
          >
            <span class="employee-avatar small-avatar">{{ employee.avatar }}</span>
            <span>
              <strong>{{ employee.name }}</strong>
              <small>{{ employee.title }}</small>
            </span>
          </button>
        </aside>

        <section v-if="selectedTalent" class="card talent-editor">
          <div class="section-head">
            <div>
              <p class="eyebrow">专项人才设定</p>
              <h2>{{ selectedTalent.name }}</h2>
            </div>
            <span class="badge" :class="employeeStatusTone(selectedTalent.status)">{{ employeeStatusText(selectedTalent.status) }}</span>
          </div>

          <div class="talent-form two-column-form">
            <label>
              人才名称
              <input v-model="selectedTalent.name" :disabled="isFixedTalent(selectedTalent)" />
            </label>
            <label>
              专项定位
              <input v-model="selectedTalent.title" :disabled="isFixedTalent(selectedTalent)" />
            </label>
            <label class="wide-field">
              输入要求
              <textarea v-model="selectedTalent.inputRequirements" rows="5" :disabled="isFixedTalent(selectedTalent)"></textarea>
            </label>
            <label class="wide-field">
              输出要求
              <textarea v-model="selectedTalent.outputRequirements" rows="5" :disabled="isFixedTalent(selectedTalent)"></textarea>
            </label>
            <label class="wide-field">
              基础设定
              <textarea v-model="selectedTalent.baseSettings" rows="5" :disabled="isFixedTalent(selectedTalent)"></textarea>
            </label>
            <div class="talent-options wide-field">
              <label class="check-line">
                <input v-model="selectedTalent.enabled" type="checkbox" :disabled="isFixedTalent(selectedTalent)" />
                启用该专项人才
              </label>
              <div class="model-static">
                <span>大模型调用</span>
                <strong>默认启用</strong>
              </div>
              <div class="model-static">
                <span>模型通道</span>
                <strong>Codex 默认</strong>
              </div>
            </div>
          </div>

          <p v-if="isFixedTalent(selectedTalent)" class="hint fixed-talent-note">基础测试员是系统内置员工，用于验证大模型是否在线，默认设定不可修改。</p>
          <div class="form-actions">
            <button v-if="!isFixedTalent(selectedTalent)" type="button" :disabled="savingTalentKey === selectedTalent.key" @click="saveTalent(selectedTalent)">
              {{ savingTalentKey === selectedTalent.key ? "保存中" : "保存设定" }}
            </button>
            <button class="ghost" type="button" :disabled="testingTalentKey === selectedTalent.key" @click="runTalentTest(selectedTalent)">
              {{ testingTalentKey === selectedTalent.key ? "测试中" : isFixedTalent(selectedTalent) ? "测试大模型在线" : "保存并测试" }}
            </button>
            <p class="hint">所有数字员工默认使用 Codex 大模型通道；如果 Codex 不可用，会直接显示失败原因。</p>
            <p v-if="talentTestMessage" class="hint test-feedback">{{ talentTestMessage }}</p>
          </div>
        </section>
      </section>

      <section class="lab-layout">
        <section class="card test-input-panel">
          <p class="eyebrow">测试输入</p>
          <h2>模拟一条教师需求</h2>
          <div class="talent-form two-column-form">
            <label>
              测试标题
              <input v-model="talentTestForm.title" />
            </label>
            <label>
              学科
              <input v-model="talentTestForm.subject" />
            </label>
            <label>
              年级
              <input v-model="talentTestForm.grade" />
            </label>
            <label>
              时长/分钟
              <input v-model.number="talentTestForm.duration" type="number" min="1" max="120" />
            </label>
            <label class="wide-field">
              教师需求
              <textarea v-model="talentTestForm.demand" rows="5"></textarea>
            </label>
            <label class="wide-field">
              补充上下文
              <textarea v-model="talentTestForm.context" rows="4"></textarea>
            </label>
          </div>
        </section>

        <section class="card test-output-panel">
          <p class="eyebrow">测试结果</p>
          <h2>{{ currentTalentTestResult ? '最近一次输出' : '等待测试' }}</h2>
          <template v-if="currentTalentTestResult">
            <div class="result-meta">
              <span>调用方式：{{ currentTalentTestResult.usedModel ? 'Codex' : '提示词预览' }}</span>
              <span>模型：{{ currentTalentTestResult.model || '-' }}</span>
            </div>
            <h3>尝试记录</h3>
            <div v-if="currentTalentTestResult.attempts?.length" class="attempt-list">
              <span v-for="(attempt, index) in currentTalentTestResult.attempts" :key="`${attempt.model}-${attempt.transport}-${index}`">
                {{ attempt.model }} · {{ attempt.transport || '接口' }} · {{ attempt.error ? '失败' : '成功' }} · {{ attempt.durationMs }}ms
              </span>
            </div>
            <h3>生成提示词</h3>
            <pre>{{ currentTalentTestResult.prompt }}</pre>
            <h3>输出结果</h3>
            <pre>{{ currentTalentTestResult.output }}</pre>
          </template>
          <p v-else-if="testingTalentKey === selectedTalentKey" class="empty">正在测试，请稍候...</p>
          <p v-else class="empty">选择一个专项人才，填写测试输入后点击“保存并测试”。</p>
        </section>
      </section>
    </section>

    <section v-else-if="activePage === 'create'" class="page create-page">
      <div class="page-title">
        <p class="eyebrow">创建课件</p>
        <h1>提交一个新的教学需求</h1>
        <p class="subtitle">建议写清楚教学目标、学生年级、希望出现的动画演示、互动练习，以及最终课堂使用方式。</p>
      </div>
      <ProjectForm :on-create="handleCreate" />
    </section>

    <section v-else-if="activePage === 'projects'" class="page projects-page">
      <div class="page-title row-title">
        <div>
          <p class="eyebrow">项目中心</p>
          <h1>管理全部课件项目</h1>
        </div>
        <button type="button" @click="go('create')">新建课件</button>
      </div>

      <section class="card board full-board">
        <div class="filters">
          <input v-model="keyword" placeholder="搜索标题、学科、年级或需求" />
          <select v-model="status">
            <option value="all">全部状态</option>
            <option value="queued">排队中</option>
            <option value="running">执行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <ProjectList :projects="filteredProjects" :selected-id="selectedId" @select="selectProject($event)" />
      </section>
    </section>

    <section v-else-if="activePage === 'project'" class="page project-page">
      <button class="text-button" type="button" @click="go('projects')">返回项目中心</button>
      <ProjectDetail :project="selectedProject" @rerun="handleRerun" />
    </section>

    <section v-else class="page workspace-page">
      <div class="page-title">
        <p class="eyebrow">工作台</p>
        <h1>连续创建与监控项目</h1>
        <p class="subtitle">这里保留生产控制视图，适合运营者连续提交需求并观察数字员工执行情况。</p>
      </div>

      <div class="workspace-grid">
        <ProjectForm :on-create="handleCreate" />
        <section class="board card">
          <div class="section-head">
            <div>
              <p class="eyebrow">项目队列</p>
              <h2>实时进度</h2>
            </div>
            <span class="counter">{{ filteredProjects.length }} / {{ projects.length }}</span>
          </div>
          <div class="filters">
            <input v-model="keyword" placeholder="搜索标题、学科、年级或需求" />
            <select v-model="status">
              <option value="all">全部状态</option>
              <option value="queued">排队中</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <ProjectList :projects="filteredProjects" :selected-id="selectedId" @select="selectedId = $event" />
        </section>
      </div>

      <ProjectDetail :project="selectedProject" @rerun="handleRerun" />
    </section>
  </main>
</template>
