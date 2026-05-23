const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function slugify(text) {
  const slug = String(text || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 36);
  return slug || "project";
}

function createId(title) {
  return `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
}

function addLog(project, source, level, message) {
  if (!Array.isArray(project.logs)) project.logs = [];
  project.logs.push({ time: nowIso(), source, level, message });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = { nowIso, slugify, createId, addLog, escapeHtml };
