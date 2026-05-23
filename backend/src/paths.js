const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "../..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const FRONTEND_DIST_DIR = path.join(FRONTEND_DIR, "dist");
const DATA_DIR = path.join(ROOT_DIR, "backend", "data");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const PROJECT_OUTPUT_ROOT = path.join(OUTPUT_DIR, "projects");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

module.exports = {
  ROOT_DIR,
  FRONTEND_DIR,
  FRONTEND_DIST_DIR,
  DATA_DIR,
  OUTPUT_DIR,
  PROJECT_OUTPUT_ROOT,
  PROJECTS_FILE
};
