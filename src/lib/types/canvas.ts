export type MediaType = 'image' | 'link' | 'note' | 'document' | 'video';

export interface Category {
  id: string;
  name: string;
  color?: string;
  description?: string;
  order: number;
}

export interface BlockNode {
  id: string;
  type: MediaType;
  x: number;
  y: number;
  width: number;
  height: number;
  category: string;
  createdAt: number;
  updatedAt: number;
  driveFileId?: string;
  driveFolderId?: string;
  data: {
    title?: string;
    description?: string;
    url?: string;
    thumbnailUrl?: string;
    content?: string; // Markdown for notes
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    aspectRatio?: number;
    colorAccent?: string;
    rawFileBase64?: string;
  };
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardState {
  id: string;
  version: number;
  title: string;
  viewport: ViewportState;
  activeCategory: string; // 'all' or category id
  lastSyncedAt?: number;
}
