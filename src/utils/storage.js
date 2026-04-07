import AsyncStorage from "@react-native-async-storage/async-storage";

const PROJECTS_KEY = "mangocut_projects";

export async function loadProjects() {
  try {
    const raw = await AsyncStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveProject(project) {
  try {
    const current = await loadProjects();
    const idx = current.findIndex((p) => p.id === project.id);
    let next = current;
    if (idx >= 0) {
      next = [...current];
      next[idx] = project;
    } else {
      next = [project, ...current];
    }
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return [];
  }
}
