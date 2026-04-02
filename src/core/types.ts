export type MediaKind = 'video' | 'image' | 'audio';

export type ProjectMediaItem = {
  id: string;
  kind: MediaKind;
  uri: string;      // uri local dentro del sandbox (FileSystem)
  name?: string;
  createdAt: number;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: ProjectMediaItem[];
};
