'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, initializeDbDefaults } from '@/lib/db/localDb';
import { BlockNode, Category, ViewportState, MediaType } from '@/lib/types/canvas';
import { BlockCard } from '@/components/cards/BlockCard';
import { CategoryDock } from '@/components/canvas/CategoryDock';
import { Minimap } from '@/components/canvas/Minimap';
import { QuickAddModal } from '@/components/modals/QuickAddModal';
import { DriveSettingsModal } from '@/components/modals/DriveSettingsModal';
import { Undo2, ZoomIn, ZoomOut, Maximize2, Sun, Moon, Search, Eye } from 'lucide-react';
import {
  getStoredAccessToken,
  syncNodeToGoogleDrive,
  trashNodeOnGoogleDrive,
  trashCategoryOnGoogleDrive,
  handleOAuthRedirectResponse,
  pullNodesFromGoogleDrive,
  syncBoardStateToDrive,
  pullBoardStateFromDrive,
  setAuthErrorHandler,
  cleanWipeAndResyncDrive,
} from '@/lib/drive/googleDrive';

export default function Home() {
  const [nodes, setNodes] = useState<BlockNode[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const activeCategoryRef = useRef<string>('all');
  activeCategoryRef.current = activeCategory;

  const [viewport, setViewport] = useState<ViewportState>({ x: 140, y: 140, zoom: 0.95 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Right-click Marquee Selection State
  const [isSelectingMarquee, setIsSelectingMarquee] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Undo / Redo History Stack (Past & Future)
  const undoStackRef = useRef<BlockNode[][]>([]);
  const redoStackRef = useRef<BlockNode[][]>([]);
  const isUndoRedoActionRef = useRef<boolean>(false);

  const pushUndoSnapshot = (currentNodes: BlockNode[]) => {
    if (isUndoRedoActionRef.current) return;
    undoStackRef.current.push(JSON.parse(JSON.stringify(currentNodes)));
    if (undoStackRef.current.length > 40) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = []; // clear redo on new action
  };

  // Modals & UI States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialType, setQuickAddInitialType] = useState<MediaType>('link');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDeviceSyncModalOpen, setIsDeviceSyncModalOpen] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<BlockNode | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Pan tracking
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Theme mode: 'dark' (default) or 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');


  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isTouchOrSmall = mobileRegex.test(userAgent) || (typeof window !== 'undefined' && window.innerWidth <= 768);
      setIsMobile(isTouchOrSmall);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('inspo-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('inspo-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Card Dragging tracking
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialPositions: Map<string, { x: number; y: number }>;
  }>({
    mouseX: 0,
    mouseY: 0,
    initialPositions: new Map(),
  });

  // Initialize Data
  useEffect(() => {
    async function loadData() {
      // Check for incoming redirect OAuth token from Google
      const connectedFromRedirect = handleOAuthRedirectResponse();

      await initializeDbDefaults();
      const allCats = await db.categories.orderBy('order').toArray();
      const allNodes = await db.nodes.toArray();
      const savedBoard = await db.boardState.get('main');

      // Always populate local database items first so user never sees an empty screen
      const catIdSet = new Set(allCats.map((c) => c.id));
      const fallbackCatId = allCats[0]?.id || 'uncategorized';
      const healedNodes = await Promise.all(
        allNodes.map(async (n) => {
          if (!n.category || !catIdSet.has(n.category)) {
            await db.nodes.update(n.id, { category: fallbackCatId, updatedAt: Date.now() });
            return { ...n, category: fallbackCatId };
          }
          return n;
        })
      );

      setCategories(allCats);
      setNodes(healedNodes);
      if (healedNodes.length > 0) {
        centerCanvasOnNodes(healedNodes);
      } else if (savedBoard) {
        setViewport(savedBoard.viewport);
      }
      if (savedBoard) {
        setActiveCategory(catIdSet.has(savedBoard.activeCategory) ? savedBoard.activeCategory : 'all');
      }

      // Check live Drive connection token
      const isConnected = connectedFromRedirect || Boolean(getStoredAccessToken());
      setIsDriveConnected(isConnected);

      // Register handler for expired 401 tokens
      setAuthErrorHandler(() => {
        setIsDriveConnected(false);
        setIsDriveModalOpen(true);
      });

      // If Google Drive is connected, non-destructively pull/sync cards from cloud
      if (isConnected) {
        try {
          const [driveNodes, cloudMeta] = await Promise.all([
            pullNodesFromGoogleDrive(),
            pullBoardStateFromDrive(),
          ]);

          if (driveNodes.length > 0) {
            // Save cloud nodes into local DB without losing user data
            for (const dNode of driveNodes) {
              await db.nodes.put(dNode);
            }
            const updatedNodes = await db.nodes.toArray();
            setNodes(updatedNodes);
            // If local board was empty, center on nodes once loaded from cloud
            if (healedNodes.length === 0) {
              centerCanvasOnNodes(updatedNodes);
            }
          }

          if (cloudMeta) {
            if (cloudMeta.categories && cloudMeta.categories.length > 0) {
              await db.categories.clear();
              for (const c of cloudMeta.categories) {
                await db.categories.put(c);
              }
              setCategories(cloudMeta.categories);
            }
            // Only adopt cloud viewport if on desktop and viewport is within bounding area of nodes
            const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
            if (!isSmallScreen && cloudMeta.viewport) {
              setViewport(cloudMeta.viewport);
            }
            if (cloudMeta.activeCategory) {
              setActiveCategory(cloudMeta.activeCategory);
            }
          }
        } catch (e) {
          console.warn('Drive pull error:', e);
        }
      }
    }
    loadData();
  }, []);

  // Save Viewport & Categories to DB and Cloud Drive
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await db.boardState.update('main', { viewport, activeCategory });
        if (!isMobile && isDriveConnected && categories.length > 0) {
          syncBoardStateToDrive({
            categories,
            viewport,
            activeCategory,
            updatedAt: Date.now(),
          });
        }
      } catch {
        // Ignore
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [viewport, activeCategory, categories, isDriveConnected]);

  // Google Drive 15-Minute Auto-Sync
  useEffect(() => {
    if (!isDriveConnected) return;

    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const interval = setInterval(() => {
      console.log('[Auto-Sync] Triggering 15-minute Google Drive background auto-sync...');
      handleManualSyncWithDrive();
    }, FIFTEEN_MINUTES_MS);

    return () => clearInterval(interval);
  }, [isDriveConnected, nodes, categories, viewport, activeCategory]);

  // Global Clipboard Paste Handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = async (event) => {
                const base64Url = event.target?.result as string;
                await handleAddNodeDirect(
                  'image',
                  'Pasted Image',
                  activeCategory === 'all' ? (categories[0]?.id || 'general') : activeCategory,
                  { thumbnailUrl: base64Url }
                );
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }

        const text = e.clipboardData.getData('text');
        if (text && text.trim()) {
          const trimmed = text.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            try {
              const res = await fetch(`/api/unfurl?url=${encodeURIComponent(trimmed)}`);
              const data = await res.json();
              await handleAddNodeDirect(
                'link',
                data.title || trimmed,
                activeCategory === 'all' ? (categories[0]?.id || 'general') : activeCategory,
                {
                  url: data.url || trimmed,
                  description: data.description || '',
                  thumbnailUrl: data.image || '',
                }
              );
            } catch {
              await handleAddNodeDirect(
                'link',
                trimmed,
                activeCategory === 'all' ? (categories[0]?.id || 'general') : activeCategory,
                { url: trimmed }
              );
            }
          } else {
            await handleAddNodeDirect(
              'note',
              'Quick Note',
              activeCategory === 'all' ? (categories[0]?.id || 'general') : activeCategory,
              { content: trimmed }
            );
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeCategory, categories, viewport]);

  // Keyboard Shortcuts (Cmd+K for quick add, Escape to reset to 'all')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickAddInitialType('link');
        setIsQuickAddOpen(true);
        return;
      }

      if (e.key === 'Escape' || e.code === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        // Prevent default browser escape behavior
        e.preventDefault();
        e.stopPropagation();

        setSelectedNodeId(null);
        setIsQuickAddOpen(false);
        setIsDriveModalOpen(false);

        // Always set category back to 'all'
        setActiveCategory('all');
        activeCategoryRef.current = 'all';

        // Unblur any focused element (like the active category pill or input)
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Undo / Redo Key listener (Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y)
  useEffect(() => {
    const handleUndoRedoKeys = async (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          if (redoStackRef.current.length > 0) {
            const nextState = redoStackRef.current.pop()!;
            undoStackRef.current.push(JSON.parse(JSON.stringify(nodes)));
            isUndoRedoActionRef.current = true;
            await db.nodes.clear();
            for (const n of nextState) {
              await db.nodes.put(n);
            }
            setNodes(nextState);
            if (isDriveConnected) {
              for (const n of nextState) {
                syncNodeToGoogleDrive(n);
              }
            }
            isUndoRedoActionRef.current = false;
          }
        } else {
          // Undo
          if (undoStackRef.current.length > 0) {
            const prevState = undoStackRef.current.pop()!;
            redoStackRef.current.push(JSON.parse(JSON.stringify(nodes)));
            isUndoRedoActionRef.current = true;
            await db.nodes.clear();
            for (const n of prevState) {
              await db.nodes.put(n);
            }
            setNodes(prevState);
            if (isDriveConnected) {
              for (const n of prevState) {
                syncNodeToGoogleDrive(n);
              }
            }
            isUndoRedoActionRef.current = false;
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        // Redo alternative (Ctrl+Y)
        e.preventDefault();
        if (redoStackRef.current.length > 0) {
          const nextState = redoStackRef.current.pop()!;
          undoStackRef.current.push(JSON.parse(JSON.stringify(nodes)));
          isUndoRedoActionRef.current = true;
          await db.nodes.clear();
          for (const n of nextState) {
            await db.nodes.put(n);
          }
          setNodes(nextState);
          if (isDriveConnected) {
            for (const n of nextState) {
              syncNodeToGoogleDrive(n);
            }
          }
          isUndoRedoActionRef.current = false;
        }
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeys);
    return () => window.removeEventListener('keydown', handleUndoRedoKeys);
  }, [nodes, isDriveConnected]);

  // Card Dragging Implementation
  const handleStartDragNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Record undo state before move begins
    pushUndoSnapshot(nodes);

    const isAlreadySelected = selectedNodeIds.has(id);
    const activeSelectedSet = isAlreadySelected ? selectedNodeIds : new Set([id]);
    if (!isAlreadySelected) {
      setSelectedNodeIds(activeSelectedSet);
      setSelectedNodeId(id);
    }

    const posMap = new Map<string, { x: number; y: number }>();
    for (const sId of activeSelectedSet) {
      const n = nodes.find((item) => item.id === sId);
      if (n) {
        posMap.set(sId, { x: n.x, y: n.y });
      }
    }

    setDraggingNodeId(id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialPositions: posMap,
    };
  };

  // Touch Handlers for Mobile & Tablet Canvas Navigation
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;
      // Pan if touching the canvas background or the dot matrix grid layer
      if (!target || target === canvasRef.current || target.classList.contains('canvas-bg-grid')) {
        setSelectedNodeId(null);
        setIsPanning(true);
        panStartRef.current = { x: touch.clientX - viewport.x, y: touch.clientY - viewport.y };
      }
    } else if (e.touches.length === 2) {
      // Pinch to Zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = viewport.zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggingNodeId && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = (touch.clientX - dragStartRef.current.mouseX) / viewport.zoom;
      const deltaY = (touch.clientY - dragStartRef.current.mouseY) / viewport.zoom;

      setNodes((prev) =>
        prev.map((n) => {
          const initPos = dragStartRef.current.initialPositions.get(n.id);
          if (initPos) {
            return { ...n, x: initPos.x + deltaX, y: initPos.y + deltaY };
          }
          return n;
        })
      );
    } else if (isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      const newX = touch.clientX - panStartRef.current.x;
      const newY = touch.clientY - panStartRef.current.y;
      setViewport((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      // Pinch zoom handling
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDist / touchStartDistRef.current;
      const newZoom = Math.min(Math.max(0.2, touchStartZoomRef.current * scale), 2.5);
      setViewport((prev) => ({ ...prev, zoom: newZoom }));
    }
  };

  const handleTouchEnd = async () => {
    if (draggingNodeId) {
      const movedIds = Array.from(dragStartRef.current.initialPositions.keys());
      for (const id of movedIds) {
        const movedNode = nodes.find((n) => n.id === id);
        if (movedNode) {
          await db.nodes.update(movedNode.id, { x: movedNode.x, y: movedNode.y });
          if (isDriveConnected) {
            syncNodeToGoogleDrive(movedNode);
          }
        }
      }
      setDraggingNodeId(null);
    }
    setIsPanning(false);
    touchStartDistRef.current = null;
  };

  const handleStartDragNodeTouch = (e: React.TouchEvent, id: string) => {
    if (isMobile) return;
    const touch = e.touches[0];
    const node = nodes.find((n) => n.id === id);
    if (!node || !touch) return;

    pushUndoSnapshot(nodes);

    const isAlreadySelected = selectedNodeIds.has(id);
    const activeSelectedSet = isAlreadySelected ? selectedNodeIds : new Set([id]);
    if (!isAlreadySelected) {
      setSelectedNodeIds(activeSelectedSet);
      setSelectedNodeId(id);
    }

    const posMap = new Map<string, { x: number; y: number }>();
    for (const sId of activeSelectedSet) {
      const n = nodes.find((item) => item.id === sId);
      if (n) {
        posMap.set(sId, { x: n.x, y: n.y });
      }
    }

    setDraggingNodeId(id);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      initialPositions: posMap,
    };
  };

  // Mouse Handlers (Left Click Pan, Right Click Marquee Box Select, Card Group Drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;

    // Right-Click (Button 2): Start Marquee Multi-Select Box
    if (e.button === 2) {
      e.preventDefault();
      setIsSelectingMarquee(true);
      setMarqueeBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    // Left Click: Clear selection if clicking empty canvas, or begin canvas pan
    if (
      target === canvasRef.current ||
      target?.classList.contains('canvas-bg-grid') ||
      e.button === 1 ||
      e.shiftKey
    ) {
      if (!e.shiftKey) {
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
      }
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelectingMarquee && marqueeBox) {
      setMarqueeBox((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null));

      // Calculate canvas bounds of marquee box
      const minScreenX = Math.min(marqueeBox.startX, e.clientX);
      const maxScreenX = Math.max(marqueeBox.startX, e.clientX);
      const minScreenY = Math.min(marqueeBox.startY, e.clientY);
      const maxScreenY = Math.max(marqueeBox.startY, e.clientY);

      const canvasMinX = (minScreenX - viewport.x) / viewport.zoom;
      const canvasMaxX = (maxScreenX - viewport.x) / viewport.zoom;
      const canvasMinY = (minScreenY - viewport.y) / viewport.zoom;
      const canvasMaxY = (maxScreenY - viewport.y) / viewport.zoom;

      // Select all nodes that intersect the marquee box
      const newlySelected = new Set<string>();
      for (const node of nodes) {
        const nodeW = node.width || 340;
        const nodeH = node.height || 260;
        const intersects =
          node.x < canvasMaxX &&
          node.x + nodeW > canvasMinX &&
          node.y < canvasMaxY &&
          node.y + nodeH > canvasMinY;

        if (intersects) {
          newlySelected.add(node.id);
        }
      }
      setSelectedNodeIds(newlySelected);
      if (newlySelected.size === 1) {
        setSelectedNodeId(Array.from(newlySelected)[0]);
      } else if (newlySelected.size === 0) {
        setSelectedNodeId(null);
      }
    } else if (draggingNodeId) {
      const deltaX = (e.clientX - dragStartRef.current.mouseX) / viewport.zoom;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / viewport.zoom;

      setNodes((prev) =>
        prev.map((n) => {
          const initPos = dragStartRef.current.initialPositions.get(n.id);
          if (initPos) {
            return { ...n, x: initPos.x + deltaX, y: initPos.y + deltaY };
          }
          return n;
        })
      );
    } else if (isPanning) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (isSelectingMarquee) {
      setIsSelectingMarquee(false);
      setMarqueeBox(null);
    }

    if (draggingNodeId) {
      const movedIds = Array.from(dragStartRef.current.initialPositions.keys());
      for (const id of movedIds) {
        const movedNode = nodes.find((n) => n.id === id);
        if (movedNode) {
          await db.nodes.update(movedNode.id, { x: movedNode.x, y: movedNode.y });
          if (isDriveConnected) {
            syncNodeToGoogleDrive(movedNode);
          }
        }
      }
      setDraggingNodeId(null);
    }
    setIsPanning(false);
  };

  // Prevent native browser context menu when right-clicking on canvas for marquee select
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Centers viewport so all nodes are comfortably visible on screen
  const centerCanvasOnNodes = (items: BlockNode[]) => {
    if (typeof window === 'undefined' || items.length === 0) return;
    const minX = Math.min(...items.map((n) => n.x));
    const maxX = Math.max(...items.map((n) => n.x + (n.width || 340)));
    const minY = Math.min(...items.map((n) => n.y));
    const maxY = Math.max(...items.map((n) => n.y + (n.height || 260)));

    const contentWidth = Math.max(maxX - minX, 100);
    const contentHeight = Math.max(maxY - minY, 100);
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // On mobile screens, choose a zoom level that frames the content without getting lost
    const isMobile = screenW < 768;
    const padding = isMobile ? 60 : 120;
    const fitZoom = Math.min(
      (screenW - padding) / contentWidth,
      (screenH - padding) / contentHeight
    );
    const initialZoom = isMobile
      ? Math.max(0.35, Math.min(fitZoom, 0.75))
      : Math.max(0.4, Math.min(fitZoom, 1.0));

    // Guard against NaN or infinite coordinates
    const targetX = screenW / 2 - centerX * initialZoom;
    const targetY = screenH / 2 - centerY * initialZoom;
    if (Number.isFinite(targetX) && Number.isFinite(targetY) && Number.isFinite(initialZoom)) {
      setViewport({
        x: targetX,
        y: targetY,
        zoom: Number(initialZoom.toFixed(2)),
      });
    }
  };

  const handleResetTo100 = () => {
    if (nodes.length > 0) {
      centerCanvasOnNodes(nodes);
    } else {
      setViewport({
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 200,
        zoom: 1.0,
      });
    }
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    const newZoom = Math.min(Math.max(0.2, viewport.zoom * zoomFactor), 2.5);

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
    const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

    setViewport({ x: newX, y: newY, zoom: newZoom });
  };

  // Category Operations
  const handleSelectCategory = (categoryId: string) => {
    setActiveCategory(categoryId);

    if (categoryId !== 'all') {
      // Find nodes matching this category or any child subcategories
      const catNodes = nodes.filter((n) => {
        if (n.category === categoryId) return true;
        const nodeCat = categories.find((c) => c.id === n.category);
        return nodeCat && nodeCat.parentId === categoryId;
      });

      if (catNodes.length > 0) {
        centerCanvasOnNodes(catNodes);
      }
    } else {
      // 'All' selected - center on all nodes
      if (nodes.length > 0) {
        centerCanvasOnNodes(nodes);
      }
    }
  };

  const handleAddCategory = async (name: string, parentId?: string) => {
    const rawId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const newCat: Category = {
      id: rawId ? (parentId ? `${parentId}-${rawId}` : rawId) : `cat-${Date.now()}`,
      name,
      parentId,
      order: categories.length,
    };
    await db.categories.put(newCat);
    setCategories((prev) => [...prev, newCat]);
    setActiveCategory(newCat.id);
  };

  const handleDeleteCategory = async (id: string) => {
    const catToDelete = categories.find((c) => c.id === id);
    const remainingCats = categories.filter((c) => c.id !== id);
    const fallbackCat = remainingCats[0]?.id || 'uncategorized';

    await db.categories.delete(id);
    setCategories(remainingCats);

    const affectedNodes = nodes.filter((n) => n.category === id);
    for (const node of affectedNodes) {
      await db.nodes.update(node.id, { category: fallbackCat, updatedAt: Date.now() });
      if (isDriveConnected) {
        const catName = remainingCats.find((c) => c.id === fallbackCat)?.name;
        syncNodeToGoogleDrive({ ...node, category: fallbackCat, updatedAt: Date.now() }, catName);
      }
    }

    setNodes((prev) =>
      prev.map((n) => (n.category === id ? { ...n, category: fallbackCat, updatedAt: Date.now() } : n))
    );

    if (activeCategory === id) {
      setActiveCategory('all');
    }

    if (isDriveConnected && catToDelete) {
      trashCategoryOnGoogleDrive(catToDelete.name);
    }
  };

  // Card Operations
  const handleDeleteNode = async (id: string) => {
    const nodeToDelete = nodes.find((n) => n.id === id);
    if (nodeToDelete) {
      pushUndoSnapshot(nodes);
      setRecentlyDeleted(nodeToDelete);
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 6000);

      await db.nodes.delete(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      // Move to Google Drive native trash if connected
      if (isDriveConnected) {
        trashNodeOnGoogleDrive(id, nodeToDelete.data.title || nodeToDelete.data.fileName);
      }
    }
  };

  const handleUndoDelete = async () => {
    if (recentlyDeleted) {
      await db.nodes.put(recentlyDeleted);
      setNodes((prev) => [...prev, recentlyDeleted]);
      if (isDriveConnected) {
        syncNodeToGoogleDrive(recentlyDeleted);
      }
      setRecentlyDeleted(null);
      setShowUndoToast(false);
    }
  };

  const handleAddNodeDirect = async (
    type: BlockNode['type'],
    title: string,
    category: string,
    extra: Record<string, string>
  ) => {
    const screenCenterX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const screenCenterY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

    const newNode: BlockNode = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      x: screenCenterX - 170 + (Math.random() * 40 - 20),
      y: screenCenterY - 120 + (Math.random() * 40 - 20),
      width: type === 'link' || type === 'image' ? 360 : 340,
      height: type === 'note' ? 220 : 280,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        title,
        ...extra,
      },
    };

    pushUndoSnapshot(nodes);
    await db.nodes.put(newNode);
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds(new Set([newNode.id]));

    // Sync to Google Drive if connected
    if (isDriveConnected) {
      const catObj = categories.find((c) => c.id === newNode.category);
      syncNodeToGoogleDrive(newNode, catObj?.name);
    }
  };

  const handleUpdateNode = async (id: string, partial: Partial<BlockNode>) => {
    await db.nodes.update(id, partial);
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, ...partial } as BlockNode;
          if (isDriveConnected) {
            const catObj = categories.find((c) => c.id === updated.category);
            syncNodeToGoogleDrive(updated, catObj?.name);
          }
          return updated;
        }
        return n;
      })
    );
  };

  const handleManualSyncWithDrive = async () => {
    if (!isDriveConnected) {
      setIsDriveModalOpen(true);
      return;
    }
    setIsSyncingDrive(true);
    try {
      if (nodes.length > 0) {
        // Clean wipe of Google Drive folder and cleanly resync active board state and nodes
        await cleanWipeAndResyncDrive(nodes, {
          categories,
          viewport,
          activeCategory,
          updatedAt: Date.now(),
        });
      } else {
        const [driveNodes, cloudMeta] = await Promise.all([
          pullNodesFromGoogleDrive(),
          pullBoardStateFromDrive(),
        ]);

        if (driveNodes.length > 0) {
          await db.nodes.clear();
          for (const dNode of driveNodes) {
            await db.nodes.put(dNode);
          }
          const updatedNodes = await db.nodes.toArray();
          setNodes(updatedNodes);
          centerCanvasOnNodes(updatedNodes);
        }

        if (cloudMeta) {
          if (cloudMeta.categories && cloudMeta.categories.length > 0) {
            await db.categories.clear();
            for (const c of cloudMeta.categories) {
              await db.categories.put(c);
            }
            setCategories(cloudMeta.categories);
          }
          if (cloudMeta.viewport) {
            setViewport(cloudMeta.viewport);
          }
          if (cloudMeta.activeCategory) {
            setActiveCategory(cloudMeta.activeCategory);
          }
        }
      }
    } catch (err) {
      console.warn('Manual sync error:', err);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleOpenDirectType = (type: MediaType) => {
    setQuickAddInitialType(type);
    setIsQuickAddOpen(true);
  };

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
        cursor: 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Background Dot Matrix Grid */}
      <div
        className="canvas-bg-grid"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: theme === 'dark' ? 0.35 : 0.45,
          backgroundImage: 'radial-gradient(var(--dot-color) 1px, transparent 1px)',
          backgroundSize: `${30 * viewport.zoom}px ${30 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      {/* Infinite Canvas World Layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transition: isPanning || draggingNodeId ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {nodes.map((node) => {
          // Check if matches activeCategory directly, OR matches a subcategory of activeCategory
          // Viewer search query filter
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const titleMatch = (node.data.title || '').toLowerCase().includes(q);
            const descMatch = (node.data.description || '').toLowerCase().includes(q);
            const contentMatch = (node.data.content || '').toLowerCase().includes(q);
            const fileNameMatch = (node.data.fileName || '').toLowerCase().includes(q);
            const urlMatch = (node.data.url || '').toLowerCase().includes(q);
            if (!titleMatch && !descMatch && !contentMatch && !fileNameMatch && !urlMatch) {
              return null;
            }
          }

          const isCategoryMatch = (() => {
            if (activeCategory === 'all') return true;
            if (node.category === activeCategory) return true;
            // If activeCategory is a parent category, show all nodes belonging to any of its subcategories as well!
            const nodeCat = categories.find((c) => c.id === node.category);
            if (nodeCat && nodeCat.parentId === activeCategory) return true;
            return false;
          })();

          const isSelected = selectedNodeId === node.id || selectedNodeIds.has(node.id);
          return (
            <div
              key={node.id}
              className="card-container-wrapper"
              style={{
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                pointerEvents: 'auto',
                opacity: isCategoryMatch ? 1 : 0.2,
                zIndex: isSelected ? 30 : 1,
              }}
            >
              <BlockCard
                node={node}
                categories={categories}
                isSelected={isSelected}
                onSelect={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  if (e.shiftKey) {
                    setSelectedNodeIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    });
                  } else {
                    setSelectedNodeIds(new Set([node.id]));
                  }
                }}
                onDelete={handleDeleteNode}
                onUpdate={handleUpdateNode}
                onStartDrag={handleStartDragNode}
                onTouchStartDrag={handleStartDragNodeTouch}
              />
            </div>
          );
        })}
      </div>

      {/* Right-Click Marquee Drag Multi-Selection Box */}
      {isSelectingMarquee && marqueeBox && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
            top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
            width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
            height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
            backgroundColor: 'rgba(200, 16, 46, 0.12)',
            border: '1.5px dashed var(--liverpool)',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 60,
            boxShadow: '0 0 12px var(--liverpool-glow)',
          }}
        />
      )}

      {/* Unified Bottom-Center Glass Dock */}
      <CategoryDock
        categories={categories}
        activeCategory={activeCategory}
        isDriveConnected={isDriveConnected}
        onSelectCategory={handleSelectCategory}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onOpenQuickAddType={handleOpenDirectType}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onSyncWithDrive={handleManualSyncWithDrive}
        isSyncing={isSyncingDrive}
        isMobileViewer={isMobile}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Top-Left Controls: Theme Toggle + Zoom Controls (keeps bottom clean for dock pill) */}
      <div
        className="fixed top-4 left-4 md:top-6 md:left-6 z-40 flex items-center gap-2"
      >
        {/* Theme Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="glass-circle-btn"
          style={{
            width: '32px',
            height: '32px',
            backdropFilter: 'blur(28px) saturate(190%) brightness(105%)',
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 12px 30px -6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-neutral-800" />
          )}
        </button>

        {/* Zoom Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backdropFilter: 'blur(28px) saturate(190%) brightness(105%)',
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '9999px',
            padding: '3px 5px',
            gap: '3px',
            boxShadow: '0 12px 30px -6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          <span style={{ fontSize: '11px', padding: '0 5px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '34px', textAlign: 'center' }}>
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.max(0.2, prev.zoom - 0.1) }))}
            className="glass-circle-btn"
            style={{ width: '26px', height: '26px' }}
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.min(2.5, prev.zoom + 0.1) }))}
            className="glass-circle-btn"
            style={{ width: '26px', height: '26px' }}
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={handleResetTo100}
            className="glass-circle-btn"
            style={{ width: '26px', height: '26px' }}
            title="Center and Reset to 100%"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Radar Minimap */}
      <Minimap
        nodes={nodes}
        viewport={viewport}
        onNavigate={(targetX, targetY) => setViewport((prev) => ({ ...prev, x: targetX, y: targetY }))}
      />

      {/* Soft-Delete Undo Toast */}
      {showUndoToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '9999px',
            padding: '10px 20px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
          }}
        >
          <span style={{ fontSize: '13px', color: '#ededed' }}>Moved to Google Drive Recycle Bin</span>
          <button
            onClick={handleUndoDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--liverpool)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
        </div>
      )}

      {/* Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialType={quickAddInitialType}
        onClose={() => setIsQuickAddOpen(false)}
        categories={categories}
        activeCategory={activeCategory}
        onAdd={handleAddNodeDirect}
      />

      <DriveSettingsModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        isDriveConnected={isDriveConnected}
        onConnectDrive={(connected) => setIsDriveConnected(connected)}
        onManualSync={handleManualSyncWithDrive}
        isSyncing={isSyncingDrive}
      />

      
    </div>
  );
}
