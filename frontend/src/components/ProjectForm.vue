<script setup>
import { reactive, ref } from "vue";

const props = defineProps({ onCreate: { type: Function, required: true } });
const isSubmitting = ref(false);
const message = ref("");
const form = reactive({
  title: "",
  subject: "数学",
  grade: "小学三年级",
  duration: 8,
  demand: ""
});

async function submit() {
  message.value = "";
  if (!form.title.trim() || !form.demand.trim()) {
    message.value = "请填写项目标题和需求描述。";
    return;
  }

  isSubmitting.value = true;
  try {
    await props.onCreate({ ...form });
    form.title = "";
    form.demand = "";
    message.value = "项目已创建，数字员工开始接力。";
  } catch (error) {
    message.value = error.message;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <form class="composer card" @submit.prevent="submit">
    <div class="section-head">
      <div>
        <p class="eyebrow">新建项目</p>
        <h2>创建需求</h2>
      </div>
      <span class="step-label">第一步</span>
    </div>

    <label>
      项目标题
      <input v-model="form.title" placeholder="例如：认识周长动画互动课件" />
    </label>

    <div class="field-row">
      <label>
        学科
        <input v-model="form.subject" placeholder="数学" />
      </label>
      <label>
        年级
        <input v-model="form.grade" placeholder="小学三年级" />
      </label>
      <label>
        时长/分钟
        <input v-model.number="form.duration" type="number" min="1" max="120" />
      </label>
    </div>

    <label>
      需求描述
      <textarea v-model="form.demand" rows="6" placeholder="写清教学目标、动画效果、互动练习、课堂使用场景..."></textarea>
    </label>

    <div class="form-actions">
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? "创建中..." : "创建并自动运行" }}
      </button>
      <p class="hint">{{ message || "提交后将进入策划、动画制作、审核流水线。" }}</p>
    </div>
  </form>
</template>
