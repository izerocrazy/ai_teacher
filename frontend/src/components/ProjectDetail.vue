<script setup>
const props = defineProps({ project: { type: Object, default: null } });
defineEmits(["rerun"]);

function statusText(status) {
  return { queued: "排队中", pending: "待执行", running: "执行中", completed: "已完成", failed: "失败" }[status] || status;
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function artifactLabel(key) {
  return { requirements: "需求文档", html: "互动课件", review: "审核报告" }[key] || key;
}

function sourceLabel(source) {
  return {
    manager: "项目经理",
    planner: "策划",
    maker: "制作",
    reviewer: "审核"
  }[source] || source;
}

function levelLabel(level) {
  return { info: "信息", error: "错误", warn: "提醒" }[level] || level;
}
</script>

<template>
  <section class="detail card">
    <template v-if="project">
      <div class="detail-head">
        <div>
          <p class="eyebrow">项目详情</p>
          <h2>{{ project.title }}</h2>
          <p class="muted">{{ project.subject }} · {{ project.grade }} · {{ project.duration }} 分钟</p>
        </div>
        <button class="ghost" type="button" @click="$emit('rerun', project.id)">重新运行</button>
      </div>

      <section class="detail-section">
        <div class="section-title">需求摘要</div>
        <p class="demand">{{ project.demand }}</p>
      </section>

      <section class="detail-section">
        <div class="section-title">数字员工</div>
        <div class="agent-grid">
        <article v-for="agent in project.agents" :key="agent.name" class="agent-card">
          <strong>{{ agent.name }}</strong>
          <span class="badge" :class="`status-${agent.status}`">{{ statusText(agent.status) }}</span>
          <small>{{ agent.message }}</small>
        </article>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-title">交付产物</div>
        <div class="artifact-row">
        <a
          v-for="(href, key) in project.artifacts"
          v-show="href"
          :key="key"
          class="artifact-link"
          :href="`/${href}`"
          target="_blank"
          rel="noopener"
        >
          {{ artifactLabel(key) }}
        </a>
          <span v-if="!Object.values(project.artifacts || {}).some(Boolean)" class="muted">暂无产物</span>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-title">执行日志</div>
        <ul class="log-list">
        <li v-for="log in [...(project.logs || [])].reverse()" :key="`${log.time}-${log.message}`" class="log-item">
          <span>{{ formatTime(log.time) }}</span>
          <strong>{{ sourceLabel(log.source) }}</strong>
          <em>{{ levelLabel(log.level) }}</em>
          <p>{{ log.message }}</p>
        </li>
        </ul>
      </section>
    </template>

    <p v-else class="empty">请选择一个项目查看详情。</p>
  </section>
</template>
