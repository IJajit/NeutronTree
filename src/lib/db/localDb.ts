import Dexie, { Table } from 'dexie';
import { BlockNode, Category, BoardState } from '../types/canvas';

export class InspoDatabase extends Dexie {
  nodes!: Table<BlockNode, string>;
  categories!: Table<Category, string>;
  boardState!: Table<BoardState, string>;

  constructor() {
    super('InspoCanvasDB');
    this.version(1).stores({
      nodes: 'id, type, category, createdAt, updatedAt',
      categories: 'id, order, name',
      boardState: 'id'
    });
  }
}

export const db = new InspoDatabase();

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'architecture', name: 'Architecture', order: 0 },
  { id: 'systemic-design', name: 'Systemic Design', order: 1 },
  { id: 'ui-ux', name: 'UI / Interfaces', order: 2 },
  { id: 'typography', name: 'Typography', order: 3 },
  { id: 'notes', name: 'Field Notes', order: 4 },
];

export const INITIAL_NODES: BlockNode[] = [
  {
    id: 'demo-1',
    type: 'note',
    x: 120,
    y: 120,
    width: 340,
    height: 200,
    category: 'systemic-design',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: {
      title: 'Design Manifesto',
      content: 'Design quietly determines how we live in our world. Where built spaces, digital interfaces, and human behavior meet.\n\n- Pitch black endless surface\n- Liverpool Red accents\n- Direct paste links & images\n- Drag any block anywhere',
    }
  },
  {
    id: 'demo-2',
    type: 'link',
    x: 520,
    y: 120,
    width: 340,
    height: 280,
    category: 'ui-ux',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: {
      title: 'Are.na / Developers',
      url: 'https://www.are.na/developers',
      description: 'Building contextual, associative research spaces and digital gardens for visual synthesis.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    }
  },
  {
    id: 'demo-3',
    type: 'image',
    x: 120,
    y: 380,
    width: 340,
    height: 380,
    category: 'architecture',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: {
      title: 'Brutalist Monolith & Shadows',
      description: 'Spatial density, raw concrete, geometric tension, and light interplay.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
      fileName: 'concrete-geometry.jpg',
    }
  }
];

export async function initializeDbDefaults() {
  try {
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
