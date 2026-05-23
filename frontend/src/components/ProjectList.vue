<script setup>
defineProps({
  projects: { type: Array, default: () => [] },
  selectedId: { type: String, default: null }
});

defineEmits(["select"]);

function statusText(status) {
  return { queued: "排队中", running: "执行中", completed: "已完成", failed: "失败" }[status] || status;
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <div class="project-list">
    <p v-if="!projects.length" class="empty">暂无匹配项目。</p>
    <button
      v-for="project in projects"
      :key="project.id"
      type="button"
      class="project-item"
      :class="{ active: project.id === selectedId }"
      @click="$emit('select', project.id)"
    >
      <span class="project-topline">
        <span>
          <strong>{{ project.title }}</strong>
          <small>{{ project.subject }} · {{ project.grade }} · {{ project.duration }} 分钟</small>
        </span>
        <span class="badge" :class="`status-${project.status}`">{{ statusText(project.status) }}</span>
      </span>
      <span class="progress-row">
        <span class="progress-track"><span class="progress-bar" :style="{ width: `${project.progress || 0}%` }"></span></span>
        <em>{{ project.progress || 0 }}%</em>
      </span>
      <span class="project-meta">创建于 {{ formatTime(project.created_at) }}</span>
    </button>
  </div>
</template>
