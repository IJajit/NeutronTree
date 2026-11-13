import Dexie, { Table } from 'dexie';
import { BlockNode, Category, BoardState } from '../types/canvas';

export class InspoDatabase extends Dexie {
  nodes!: Table<BlockNode, string>;
  categories!: Table<Category, string>;
  boardState!: Table<BoardState, string>;

  constructor() {
    super('InspoCanvasDB');
    this.version(2).stores({
      nodes: 'id, type, category, createdAt, updatedAt',
      categories: 'id, order, name',
      boardState: 'id'
    });
  }
}

export const db = new InspoDatabase();

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_NODES: BlockNode[] = [];

export async function initializeDbDefaults() {
  try {
    // Purge legacy demo categories if they exist (e.g. from previous sessions)

    const oldNames = ['architecture', 'systemic design', 'ui / interfaces', 'typography', 'field notes'];
    const currentCats = await db.categories.toArray();
    for (const c of currentCats) {
      if (oldNames.includes(c.name.toLowerCase().trim()) || c.id === 'architecture' || c.id === 'systemic-design' || c.id === 'ui-ux' || c.id === 'typography' || c.id === 'notes') {
        await db.categories.delete(c.id);
      }
    }

    const legacyCategoryIds = ['architecture', 'systemic-design', 'ui-ux', 'typography', 'notes'];
    for (const legacyId of legacyCategoryIds) {
      const cat = await db.categories.get(legacyId);
      if (cat && ['Architecture', 'Systemic Design', 'UI / Interfaces', 'Typography', 'Field Notes'].includes(cat.name)) {
        await db.categories.delete(legacyId);
      }
    }

    // Purge legacy demo nodes
    const legacyDemoNodeIds = ['demo-1', 'demo-2', 'demo-3'];
    for (const dId of legacyDemoNodeIds) {
      await db.nodes.delete(dId);
    }

    const catCount = await db.categories.count();
    if (catCount === 0) {
      for (const cat of INITIAL_CATEGORIES) {
        await db.categories.put(cat);
      }
    }

    const nodeCount = await db.nodes.count();
    if (nodeCount === 0) {
      for (const node of INITIAL_NODES) {
        await db.nodes.put(node);
      }
    }

    const existingBoard = await db.boardState.get('main');
    if (!existingBoard) {
      await db.boardState.put({
        id: 'main',
        version: 1,
        title: 'Neuron Tree',
        viewport: { x: 200, y: 150, zoom: 0.95 },
        activeCategory: 'all',
        lastSyncedAt: Date.now()
      });
    }
  } catch (err) {
    console.warn('Database initialization note:', err);
  }
}
