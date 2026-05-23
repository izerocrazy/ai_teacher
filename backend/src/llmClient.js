const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function runCodex(prompt, model, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const outputFile = path.join(os.tmpdir(), `ai-teacher-codex-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
    const args = [
      "exec",
      "--skip-git-repo-check",
      "--output-last-message",
      outputFile
    ];

    if (model && model !== "codex-default") args.push("--model", model);
    args.push("-");

    const child = spawn("codex", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        model,
        stdout,
        stderr,
        error: "Codex 调用超时",
        durationMs: Date.now() - startedAt,
        transport: "codex"
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        model,
        stdout,
        stderr,
        error: `无法启动 codex 命令：${error.message}`,
        durationMs: Date.now() - startedAt,
        transport: "codex"
      });
    });
    child.on("close", async (code, signal) => {
      clearTimeout(timer);
      let finalOutput = stdout;
      try {
        const fileOutput = await fs.readFile(outputFile, "utf8");
        if (fileOutput.trim()) finalOutput = fileOutput;
      } catch {
        // Codex may fail before writing the final-message file.
      }
      try { await fs.unlink(outputFile); } catch {}

      const error = code === 0 ? null : (stderr || stdout || `codex 退出码：${code ?? "无"}${signal ? `，信号：${signal}` : ""}`);
      resolve({
        model,
        stdout: finalOutput,
        stderr,
        error,
        durationMs: Date.now() - startedAt,
        transport: "codex"
      });
    });

    child.stdin.end(prompt);
  });
}

async function callTalentModel(prompt, options = {}) {
  const model = options.model || process.env.AI_TEACHER_CODEX_MODEL || "codex-default";
  const timeoutMs = Number(options.timeoutMs || process.env.AI_TEACHER_LLM_TIMEOUT_MS || 120000);
  const result = await runCodex(prompt, model, timeoutMs);
  return {
    ...result,
    attempts: [{
      model,
      transport: "codex",
      error: result.error,
      durationMs: result.durationMs
    }]
  };
}

module.exports = { callTalentModel };
