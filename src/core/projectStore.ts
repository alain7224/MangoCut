import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from './types';
import { makeId } from './id';

const KEY = 'mangocut:projects:v1';

async function readAll(): Promise<Project[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Project[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(projects: Project[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(projects));
}

export async function listProjects() {
  const projects = await readAll();
  // más recientes primero
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createProject(name?: string) {
  const now = Date.now();
  const project: Project = {
    id: makeId('prj'),
    name: name?.trim() || `Proyecto ${new Date(now).toLocaleString()}`,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  const projects = await readAll();
  projects.unshift(project);
  await writeAll(projects);
  return project;
}

export async function getProject(id: string) {
  const projects = await readAll();
  return projects.find(p => p.id === id) ?? null;
}

export async function saveProject(updated: Project) {
  const projects = await readAll();
  const idx = projects.findIndex(p => p.id === updated.id);
  if (idx === -1) return;

  projects[idx] = { ...updated, updatedAt: Date.now() };
  await writeAll(projects);
}

export async function deleteProject(id: string) {
  const projects = await readAll();
  await writeAll(projects.filter(p => p.id !== id));
}
