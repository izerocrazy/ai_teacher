import json
import mimetypes
import queue
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
OUTPUT_DIR = ROOT_DIR / "output"
DATA_DIR = ROOT_DIR / "backend" / "data"
PROJECTS_FILE = DATA_DIR / "projects.json"
PROJECT_OUTPUT_ROOT = OUTPUT_DIR / "projects"

PROJECT_LOCK = threading.Lock()
PROJECT_QUEUE: queue.Queue[str] = queue.Queue()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    if not PROJECTS_FILE.exists():
        PROJECTS_FILE.write_text("[]", encoding="utf-8")


def load_projects() -> list[dict]:
    ensure_storage()
    raw = PROJECTS_FILE.read_text(encoding="utf-8-sig").strip()
    if not raw:
        return []
    return json.loads(raw)


def save_projects(projects: list[dict]) -> None:
    PROJECTS_FILE.write_text(
        json.dumps(projects, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_log(project: dict, source: str, level: str, message: str) -> None:
    project["logs"].append(
        {
            "time": now_iso(),
            "source": source,
            "level": level,
            "message": message,
        }
    )


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return slug[:32] if slug else "project"


def create_project(title: str, demand: str) -> dict:
    project_id = f"{slugify(title)}-{uuid.uuid4().hex[:8]}"
    project = {
        "id": project_id,
        "title": title,
        "demand": demand,
        "status": "queued",
        "progress": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "agents": {
            "planner": {
                "name": "策划/产品佬",
                "status": "pending",
                "message": "等待执行",
                "started_at": None,
                "ended_at": None,
            },
            "maker": {
                "name": "制作佬",
                "status": "pending",
                "message": "等待执行",
                "started_at": None,
                "ended_at": None,
            },
        },
        "artifacts": {
            "requirements": None,
            "html": None,
        },
        "logs": [],
    }

    add_log(project, "manager", "info", "Project created and queued")

    with PROJECT_LOCK:
        projects = load_projects()
        projects.append(project)
        save_projects(projects)

    PROJECT_QUEUE.put(project_id)
    return project


def update_project(project_id: str, mutator) -> dict | None:
    with PROJECT_LOCK:
        projects = load_projects()
        for project in projects:
            if project["id"] == project_id:
                mutator(project)
                project["updated_at"] = now_iso()
                save_projects(projects)
                return project
    return None


def get_project(project_id: str) -> dict | None:
    with PROJECT_LOCK:
        projects = load_projects()
    for project in projects:
        if project["id"] == project_id:
            return project
    return None


def get_all_projects() -> list[dict]:
    with PROJECT_LOCK:
        projects = load_projects()
    projects.sort(key=lambda p: p["created_at"], reverse=True)
    return projects


def build_requirement_doc(project: dict) -> str:
    return (
        f"# Requirement Document: {project['title']}\n\n"
        "## Source Demand\n"
        f"{project['demand']}\n\n"
        "## Teaching Goals\n"
        "- Clarify one key concept in under 5 minutes.\n"
        "- Include one learner interaction for immediate feedback.\n"
        "- End with a short knowledge check.\n\n"
        "## Storyboard\n"
        "1. Hook: show a simple real-life scene to attract attention.\n"
        "2. Explain: animate the concept step by step.\n"
        "3. Practice: one interactive action from learner.\n"
        "4. Check: lightweight quiz with instant result.\n\n"
        "## Production Notes\n"
        "- Deliverable format: single HTML file with embedded CSS/JS.\n"
        "- Keep assets lightweight and classroom friendly.\n"
        "- Ensure mobile and desktop compatibility.\n"
    )


def build_teaching_html(project: dict) -> str:
    safe_title = project["title"].replace("<", "&lt;").replace(">", "&gt;")
    safe_demand = project["demand"].replace("<", "&lt;").replace(">", "&gt;")

    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>{safe_title}</title>
  <style>
    :root {{
      --bg: #f4f1ea;
      --ink: #172036;
      --card: #fffaf2;
      --accent: #e67f38;
      --accent-2: #00838f;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      min-height: 100vh;
      background:
        radial-gradient(circle at 15% 10%, rgba(230, 127, 56, 0.18), transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(0, 131, 143, 0.22), transparent 35%),
        var(--bg);
      padding: 24px;
      display: grid;
      place-items: center;
    }}
    .stage {{
      width: min(980px, 100%);
      background: var(--card);
      border: 2px solid rgba(23, 32, 54, 0.12);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 14px 30px rgba(23, 32, 54, 0.16);
      display: grid;
      gap: 18px;
    }}
    h1 {{ margin: 0; font-size: clamp(1.5rem, 2.4vw, 2.2rem); }}
    .desc {{ margin: 0; line-height: 1.6; }}
    .scene {{
      position: relative;
      border-radius: 16px;
      border: 1px dashed rgba(23, 32, 54, 0.25);
      background: linear-gradient(160deg, #fff, #f6f9ff);
      min-height: 280px;
      overflow: hidden;
      display: grid;
      place-items: center;
    }}
    .shape {{
      width: 140px;
      height: 140px;
      border-radius: 14px;
      background: linear-gradient(140deg, var(--accent), #f0b17b);
      display: grid;
      place-items: center;
      color: white;
      font-size: 1.8rem;
      font-weight: 700;
      box-shadow: 0 12px 24px rgba(230, 127, 56, 0.35);
      transition: transform 480ms ease, border-radius 320ms ease, width 320ms ease;
    }}
    .shape.animating {{
      animation: pulse 850ms ease-in-out 2;
    }}
    @keyframes pulse {{
      0%, 100% {{ transform: scale(1); }}
      45% {{ transform: scale(1.1) rotate(-4deg); }}
      60% {{ transform: scale(1.08) rotate(4deg); }}
    }}
    .controls {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }}
    button {{
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      font-weight: 700;
      cursor: pointer;
      color: white;
      background: var(--accent-2);
      transition: transform 220ms ease, filter 220ms ease;
    }}
    button:hover {{
      transform: translateY(-2px);
      filter: brightness(1.05);
    }}
    .quiz {{
      border-top: 1px solid rgba(23, 32, 54, 0.15);
      padding-top: 12px;
      display: grid;
      gap: 8px;
    }}
    .result {{
      min-height: 1.4em;
      font-weight: 700;
      color: var(--accent-2);
    }}
  </style>
</head>
<body>
  <main class=\"stage\">
    <h1>{safe_title}</h1>
    <p class=\"desc\">Generated from demand: {safe_demand}</p>

    <section class=\"scene\" aria-label=\"teaching animation area\">
      <div id=\"shape\" class=\"shape\">A</div>
    </section>

    <section class=\"controls\">
      <button id=\"animateBtn\">Play Animation</button>
      <button id=\"transformBtn\">Transform Shape</button>
      <button id=\"resetBtn\">Reset</button>
    </section>

    <section class=\"quiz\">
      <strong>Quick Check</strong>
      <label for=\"answer\">What changed after the transformation?</label>
      <input id=\"answer\" type=\"text\" placeholder=\"Type your answer\" />
      <button id=\"checkBtn\">Check Answer</button>
      <p id=\"result\" class=\"result\"></p>
    </section>
  </main>

  <script>
    const shape = document.getElementById('shape');
    const result = document.getElementById('result');
    const answer = document.getElementById('answer');

    document.getElementById('animateBtn').addEventListener('click', () => {{
      shape.classList.remove('animating');
      void shape.offsetWidth;
      shape.classList.add('animating');
      result.textContent = 'Animation played. Observe the movement carefully.';
    }});

    document.getElementById('transformBtn').addEventListener('click', () => {{
      const isRound = shape.style.borderRadius === '50%';
      shape.style.borderRadius = isRound ? '14px' : '50%';
      shape.style.width = isRound ? '140px' : '170px';
      shape.style.height = isRound ? '140px' : '170px';
      shape.textContent = isRound ? 'A' : 'B';
      result.textContent = 'Shape transformed. Describe what you noticed.';
    }});

    document.getElementById('resetBtn').addEventListener('click', () => {{
      shape.style.borderRadius = '14px';
      shape.style.width = '140px';
      shape.style.height = '140px';
      shape.textContent = 'A';
      answer.value = '';
      result.textContent = 'Scene reset.';
    }});

    document.getElementById('checkBtn').addEventListener('click', () => {{
      const text = answer.value.trim().toLowerCase();
      if (!text) {{
        result.textContent = 'Please enter an observation first.';
        return;
      }}

      const matched = ['shape', 'size', 'round', 'circle', 'changed'].some((k) => text.includes(k));
      result.textContent = matched
        ? 'Good observation. You identified key visual changes.'
        : 'Keep trying. Focus on shape, size, and form.';
    }});
  </script>
</body>
</html>
"""


def run_pipeline(project_id: str) -> None:
    def mark_running(project: dict) -> None:
        project["status"] = "running"
        project["progress"] = 5
        add_log(project, "manager", "info", "Pipeline started")

    update_project(project_id, mark_running)

    try:
        def planner_start(project: dict) -> None:
            planner = project["agents"]["planner"]
            planner["status"] = "running"
            planner["message"] = "Analyzing teaching demand and drafting requirements"
            planner["started_at"] = now_iso()
            add_log(project, "planner", "info", "Planner started")

        project = update_project(project_id, planner_start)
        if not project:
            return

        time.sleep(1)

        project_dir = PROJECT_OUTPUT_ROOT / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        requirement_path = project_dir / "requirements.md"
        requirement_path.write_text(build_requirement_doc(project), encoding="utf-8")

        def planner_done(target: dict) -> None:
            planner = target["agents"]["planner"]
            planner["status"] = "completed"
            planner["message"] = "Requirement document generated"
            planner["ended_at"] = now_iso()
            target["progress"] = 55
            target["artifacts"]["requirements"] = str(
                requirement_path.relative_to(ROOT_DIR).as_posix()
            )
            add_log(target, "planner", "info", "Requirement document written")

        update_project(project_id, planner_done)

        def maker_start(target: dict) -> None:
            maker = target["agents"]["maker"]
            maker["status"] = "running"
            maker["message"] = "Building animation and interaction HTML"
            maker["started_at"] = now_iso()
            add_log(target, "maker", "info", "Maker started")

        project = update_project(project_id, maker_start)
        if not project:
            return

        time.sleep(1.2)

        html_path = project_dir / "index.html"
        html_path.write_text(build_teaching_html(project), encoding="utf-8")

        def maker_done(target: dict) -> None:
            maker = target["agents"]["maker"]
            maker["status"] = "completed"
            maker["message"] = "Interactive teaching HTML generated"
            maker["ended_at"] = now_iso()
            target["progress"] = 100
            target["status"] = "completed"
            target["artifacts"]["html"] = str(html_path.relative_to(ROOT_DIR).as_posix())
            add_log(target, "maker", "info", "Teaching HTML written")
            add_log(target, "manager", "info", "Pipeline completed")

        update_project(project_id, maker_done)

    except Exception as exc:
        def fail(target: dict) -> None:
            target["status"] = "failed"
            target["progress"] = min(target["progress"], 95)
            for agent_key in ["planner", "maker"]:
                agent = target["agents"][agent_key]
                if agent["status"] == "running":
                    agent["status"] = "failed"
                    agent["ended_at"] = now_iso()
            add_log(target, "manager", "error", f"Pipeline failed: {exc}")

        update_project(project_id, fail)


def worker_loop() -> None:
    while True:
        project_id = PROJECT_QUEUE.get()
        try:
            run_pipeline(project_id)
        finally:
            PROJECT_QUEUE.task_done()


class Handler(BaseHTTPRequestHandler):
    server_version = "AIDigitalStaffPlatform/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/projects":
            self.send_json({"projects": get_all_projects()})
            return

        if path.startswith("/api/projects/"):
            project_id = path.split("/")[-1]
            project = get_project(project_id)
            if not project:
                self.send_json({"error": "Project not found"}, status=HTTPStatus.NOT_FOUND)
                return
            self.send_json(project)
            return

        if path.startswith("/output/"):
            rel = path.lstrip("/")
            self.serve_from_root(rel)
            return

        if path in ["/", "/index.html"]:
            self.serve_frontend("index.html")
            return

        if path in ["/app.js", "/styles.css"]:
            self.serve_frontend(path.lstrip("/"))
            return

        self.send_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path != "/api/projects":
            self.send_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        title = (payload.get("title") or "").strip()
        demand = (payload.get("demand") or "").strip()

        if not title or not demand:
            self.send_json(
                {"error": "Fields 'title' and 'demand' are required"},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        project = create_project(title=title, demand=demand)
        self.send_json(project, status=HTTPStatus.CREATED)

    def serve_frontend(self, filename: str) -> None:
        file_path = FRONTEND_DIR / filename
        self.serve_file(file_path)

    def serve_from_root(self, relative_path: str) -> None:
        target = (ROOT_DIR / relative_path).resolve()
        root = ROOT_DIR.resolve()
        if root not in target.parents and target != root:
            self.send_json({"error": "Forbidden"}, status=HTTPStatus.FORBIDDEN)
            return
        self.serve_file(target)

    def serve_file(self, file_path: Path) -> None:
        if not file_path.exists() or not file_path.is_file():
            self.send_json({"error": "File not found"}, status=HTTPStatus.NOT_FOUND)
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        data = file_path.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    ensure_storage()

    worker = threading.Thread(target=worker_loop, daemon=True)
    worker.start()

    server = ThreadingHTTPServer(("127.0.0.1", 8010), Handler)
    print("Server started at http://127.0.0.1:8010")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
