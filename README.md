# ai_teacher

多数字员工 + 多项目管理平台（MVP）。

## 目录结构

- `frontend/`：前端看板（需求提交、项目列表、进度监控、日志查看）
- `backend/`：后端 API 和数字员工流水线引擎
- `output/`：项目产物目录（自动生成需求文档与教学 HTML）

## 当前数字员工

- `策划/产品佬`：根据需求产出可制作的需求文档（`requirements.md`）
- `制作佬`：根据需求文档产出教学动画与交互 HTML（`index.html`）

## 项目流程

1. 在前端提交需求。
2. 后端自动创建项目并加入队列。
3. AI 数字员工自动接力执行：
   1. 策划/产品佬生成需求文档
   2. 制作佬生成教学 HTML
4. 项目经理看板实时展示状态、进度和日志。

## 启动方式

在仓库根目录执行：

```powershell
python .\backend\server.py
```

启动后访问：

- 平台主页：`http://127.0.0.1:8010`
- 项目 API：`http://127.0.0.1:8010/api/projects`

## 产物位置

每个新项目会生成目录：

- `output/projects/<project_id>/requirements.md`
- `output/projects/<project_id>/index.html`

## 后续扩展建议

- 增加更多数字员工（测试佬、审核佬、发布佬）
- 把项目数据从 JSON 升级到数据库（SQLite/PostgreSQL）
- 增加 WebSocket/SSE 实时推送，替代轮询
- 接入真实大模型调用，让策划和制作内容完全自动生成
