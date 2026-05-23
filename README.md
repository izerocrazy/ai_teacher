# AI Teacher

AI Teacher 是一个多数字员工 + 多项目管理平台。前端使用 Vue 3，后端使用 Node.js 原生 HTTP 服务，项目数据直接存储在文本文件中，生成产物放在 `output/projects/<project_id>/`。

## 功能

- 创建教学项目：标题、学科、年级、时长、需求描述。
- 数字员工流水线：课件设计师 -> 制作佬 -> 审核佬。
- 文本存储：`backend/data/projects.json` 保存项目、状态、日志和产物链接。
- 自动产物：需求文档 `requirements.md`、动画互动课件 `index.html`、审核报告 `review.md`。
- Vue 项目看板：状态筛选、关键词搜索、进度展示、日志查看、产物访问、重新运行。

## 目录结构

```text
.
├── ROADMAP.md                 # 细化需求与迭代计划
├── backend/
│   ├── data/projects.json      # 文本数据存储
│   ├── package.json
│   └── src/
│       ├── generators.js       # 需求文档、动画课件 HTML、审核报告生成
│       ├── paths.js
│       ├── pipeline.js         # 数字员工队列与流水线
│       ├── projectService.js   # 项目领域逻辑
│       ├── server.js           # Node.js HTTP API 与静态文件服务
│       ├── storage.js          # 文本文件读写
│       └── utils.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.vue
│       ├── components/
│       ├── services/api.js
│       └── styles.css
└── output/projects/            # 自动生成的项目产物
```

## 启动方式

### 一键开发启动

```bash
npm run dev
```

脚本会自动检查 `frontend/node_modules`，缺失时先安装依赖，然后同时启动：

- 后端：`http://127.0.0.1:8010`
- 前端：`http://127.0.0.1:5173`

按 `Ctrl+C` 可同时停止前后端服务。

### 1. 安装前端依赖

```bash
npm --prefix frontend install
```

### 2. 启动后端

```bash
npm run dev:backend
```

后端默认地址：`http://127.0.0.1:8010`

### 3. 启动前端开发服务

另开一个终端：

```bash
npm run dev:frontend
```

前端默认地址：`http://127.0.0.1:5173`

## 生产构建

```bash
npm --prefix frontend install
npm run build:frontend
npm start
```

构建后，Node 后端会优先托管 `frontend/dist`，访问 `http://127.0.0.1:8010` 即可。

## API

- `GET /api/health`：健康检查。
- `GET /api/projects`：项目列表。
- `GET /api/projects/:id`：项目详情。
- `POST /api/projects`：创建项目。
- `POST /api/projects/:id/rerun`：重新运行项目流水线。
- `GET /output/projects/<project_id>/<file>`：访问生成产物。

创建项目示例：

```bash
curl -X POST http://127.0.0.1:8010/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"title":"认识周长","subject":"数学","grade":"三年级","duration":8,"demand":"用动画解释周长，并加入一次互动练习。"}'
```

## 后续方向

更细的需求和工程规划见 `ROADMAP.md`。下一步可以接入真实大模型、加入 SSE/WebSocket 实时推送、增加教师审批节点、支持项目 ZIP 导出。
