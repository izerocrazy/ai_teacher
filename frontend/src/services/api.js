async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`);
  return data;
}

export function fetchProjects() {
  return request("/api/projects");
}

export function createProject(payload) {
  return request("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function rerunProject(projectId) {
  return request(`/api/projects/${projectId}/rerun`, { method: "POST" });
}


export function fetchTalents() {
  return request("/api/talents");
}

export function updateTalent(key, payload) {
  return request(`/api/talents/${key}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function testTalent(key, payload) {
  return request(`/api/talents/${key}/test`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
