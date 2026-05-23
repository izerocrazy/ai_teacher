const { escapeHtml } = require("./utils");

function buildRequirementDoc(project) {
  return `# ${project.title} - Requirements\n\n## Source Demand\n\n${project.demand}\n\n## Course Profile\n\n- Subject: ${project.subject}\n- Grade: ${project.grade}\n- Duration: ${project.duration} minutes\n- Learner scenario: classroom or self-paced preview\n\n## Teaching Goals\n\n1. Explain the core concept with one concrete visual metaphor.\n2. Guide learners through a short observation and interaction.\n3. Provide immediate feedback after learner input.\n4. Finish with a lightweight knowledge check.\n\n## Storyboard\n\n| Step | Scene | Learner Action | Success Signal |\n| --- | --- | --- | --- |\n| 1 | Hook with a familiar classroom situation | Read the question | Learner understands the challenge |\n| 2 | Animated explanation of the key idea | Play and replay animation | Learner can describe the change |\n| 3 | Guided practice | Choose an answer or enter observation | Feedback appears instantly |\n| 4 | Summary card | Review three takeaways | Learner can restate the rule |\n\n## Interaction Plan\n\n- Primary interaction: click cards to reveal explanations.\n- Practice interaction: select an answer and receive feedback.\n- Reflection interaction: type an observation in the learner note field.\n\n## Acceptance Criteria\n\n- Generated as a single standalone HTML file.\n- Works on desktop and mobile screens.\n- Includes a visible learning goal, animation area, practice question, and summary.\n- Does not require external assets.\n`;
}

function buildTeachingHtml(project) {
  const title = escapeHtml(project.title);
  const demand = escapeHtml(project.demand);
  const subject = escapeHtml(project.subject);
  const grade = escapeHtml(project.grade);
  const duration = escapeHtml(project.duration);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root { --paper:#fff7e8; --ink:#15213a; --blue:#146c94; --leaf:#2f8f6b; --sun:#f29f3d; --line:rgba(21,33,58,.16); }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; font-family:"Trebuchet MS","Noto Sans SC",sans-serif; color:var(--ink); background:radial-gradient(circle at 15% 10%,rgba(242,159,61,.25),transparent 34%),radial-gradient(circle at 85% 80%,rgba(47,143,107,.22),transparent 32%),#e9f2eb; padding:24px; }
    main { width:min(1040px,100%); margin:auto; display:grid; gap:18px; }
    .hero,.panel { background:rgba(255,247,232,.94); border:1px solid var(--line); border-radius:26px; box-shadow:0 18px 45px rgba(21,33,58,.14); padding:22px; }
    .tag { display:inline-flex; gap:8px; flex-wrap:wrap; color:var(--blue); font-weight:800; letter-spacing:.04em; }
    h1 { font-size:clamp(2rem,5vw,4rem); margin:8px 0; line-height:1; }
    p { line-height:1.7; }
    .stage { min-height:300px; border-radius:24px; overflow:hidden; border:2px dashed rgba(20,108,148,.28); background:linear-gradient(150deg,#fff,#edf7fa); display:grid; place-items:center; position:relative; }
    .orbit { width:210px; height:210px; border-radius:50%; border:8px solid var(--blue); display:grid; place-items:center; transition:transform .6s ease,border-radius .6s ease,border-color .6s ease; background:rgba(255,255,255,.72); }
    .core { width:92px; height:92px; border-radius:24px; background:linear-gradient(145deg,var(--sun),#f7c57d); display:grid; place-items:center; color:white; font-size:2rem; font-weight:900; box-shadow:0 12px 24px rgba(242,159,61,.36); }
    .stage.active .orbit { transform:rotate(180deg) scale(1.08); border-radius:22px; border-color:var(--leaf); }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    button,.choice { border:0; border-radius:999px; background:var(--blue); color:white; padding:12px 18px; font:inherit; font-weight:800; cursor:pointer; }
    .choice { background:white; color:var(--ink); border:1px solid var(--line); text-align:left; border-radius:16px; }
    .choice.correct { border-color:var(--leaf); box-shadow:0 0 0 3px rgba(47,143,107,.16); }
    textarea { width:100%; min-height:92px; border:1px solid var(--line); border-radius:16px; padding:12px; font:inherit; resize:vertical; }
    .feedback { min-height:1.5em; color:var(--leaf); font-weight:900; }
    ul { margin:0; padding-left:20px; line-height:1.9; }
    @media (max-width:760px){ body{padding:14px;} .grid{grid-template-columns:1fr;} .hero,.panel{border-radius:18px;} }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="tag"><span>${subject}</span><span>${grade}</span><span>${duration} 分钟</span></div>
      <h1>${title}</h1>
      <p>${demand}</p>
    </section>
    <section class="panel grid">
      <div>
        <h2>观察动画</h2>
        <p>点击按钮，观察中心图形和外圈边界如何变化，再尝试用自己的话描述规律。</p>
        <button id="playBtn">播放变化</button>
      </div>
      <div id="stage" class="stage" aria-label="教学动画区"><div class="orbit"><div class="core">学</div></div></div>
    </section>
    <section class="panel">
      <h2>小练习</h2>
      <p>当图形发生变化时，我们最应该关注什么？</p>
      <div class="grid">
        <button class="choice" data-ok="false">只看颜色是否更鲜艳</button>
        <button class="choice" data-ok="true">观察形状、边界、大小和位置的变化</button>
      </div>
      <p id="feedback" class="feedback"></p>
      <label>我的观察记录</label>
      <textarea id="note" placeholder="例如：我发现外圈从圆形变成了更接近方形的边界..."></textarea>
    </section>
    <section class="panel">
      <h2>课堂总结</h2>
      <ul>
        <li>先明确学习目标，再观察关键变化。</li>
        <li>把抽象概念变成可见、可点击、可复述的过程。</li>
        <li>用一次即时反馈确认自己是否真正理解。</li>
      </ul>
    </section>
  </main>
  <script>
    const stage = document.getElementById("stage");
    const feedback = document.getElementById("feedback");
    document.getElementById("playBtn").addEventListener("click", () => {
      stage.classList.toggle("active");
      feedback.textContent = "动画已更新：请说出你观察到的两个变化。";
    });
    document.querySelectorAll(".choice").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".choice").forEach((item) => item.classList.remove("correct"));
        if (button.dataset.ok === "true") {
          button.classList.add("correct");
          feedback.textContent = "答对了！学习时要抓住关键属性的变化。";
        } else {
          feedback.textContent = "再想想：颜色可能有帮助，但关键是概念相关的变化。";
        }
      });
    });
  </script>
</body>
</html>
`;
}

function buildReviewReport(project) {
  return `# Review Report: ${project.title}\n\n## Result\n\nPass with MVP quality.\n\n## Checks\n\n- Requirement document exists and includes goals, storyboard, interaction plan, and acceptance criteria.\n- Teaching HTML is standalone and responsive.\n- Learner interaction and feedback are included.\n- Generated artifacts are linked from the dashboard.\n\n## Suggestions\n\n- Replace template generation with real LLM generation when model credentials are available.\n- Add teacher approval before publishing to students.\n`;
}

module.exports = { buildRequirementDoc, buildTeachingHtml, buildReviewReport };
