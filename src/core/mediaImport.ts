import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Project, ProjectMediaItem, MediaKind } from './types';
import { makeId } from './id';
import { saveProject } from './projectStore';

function guessKind(mime?: string | null, name?: string | null): MediaKind {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();

  if (m.startsWith('video/') || n.match(/\.(mp4|mov|mkv|webm)$/)) return 'video';
  if (m.startsWith('audio/') || n.match(/\.(mp3|wav|m4a|aac|ogg)$/)) return 'audio';
  return 'image';
}

async function ensureDir(dirUri: string) {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
}

export async function importIntoProject(project: Project) {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['video/*', 'image/*', 'audio/*'],
  });

  if (result.canceled) return project;

  const baseDir = `${FileSystem.documentDirectory}mangocut/projects/${project.id}/`;
  await ensureDir(baseDir);

  const newItems: ProjectMediaItem[] = [];

  for (const a of result.assets) {
    const id = makeId('media');
    const kind = guessKind(a.mimeType, a.name);
    const safeName = (a.name || `${id}`).replace(/[^\w.\-]+/g, '_');
    const dest = `${baseDir}${id}_${safeName}`;

    // Copiamos al sandbox (opción 2: no depender del archivo original)
    await FileSystem.copyAsync({ from: a.uri, to: dest });

    newItems.push({
      id,
      kind,
      uri: dest,
      name: a.name || safeName,
      createdAt: Date.now(),
    });
  }

  const updated: Project = {
    ...project,
    items: [...project.items, ...newItems],
    updatedAt: Date.now(),
  };

  await saveProject(updated);
  return updated;
}
