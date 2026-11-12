'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, initializeDbDefaults } from '@/lib/db/localDb';
import { BlockNode, Category, ViewportState, MediaType } from '@/lib/types/canvas';
import { BlockCard } from '@/components/cards/BlockCard';
import { CategoryDock } from '@/components/canvas/CategoryDock';
import { Minimap } from '@/components/canvas/Minimap';
import { QuickAddModal } from '@/components/modals/QuickAddModal';
import { DriveSettingsModal } from '@/components/modals/DriveSettingsModal';
import { Undo2, ZoomIn, ZoomOut, Maximize2, Sun, Moon } from 'lucide-react';
import {
  getStoredAccessToken,
  syncNodeToGoogleDrive,
  trashNodeOnGoogleDrive,
  handleOAuthRedirectResponse,
  pullNodesFromGoogleDrive,
  syncBoardStateToDrive,
  pullBoardStateFromDrive,
} from '@/lib/drive/googleDrive';

export default function Home() {
  const [nodes, setNodes] = useState<BlockNode[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const activeCategoryRef = useRef<string>('all');
  activeCategoryRef.current = activeCategory;

  const [viewport, setViewport] = useState<ViewportState>({ x: 140, y: 140, zoom: 0.95 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modals & UI States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialType, setQuickAddInitialType] = useState<MediaType>('link');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<BlockNode | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Pan tracking
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Theme mode: 'dark' (default) or 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialNodeX: number; initialNodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialNodeX: 0,
    initialNodeY: 0,
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

      // Check live Drive connection token
      const isConnected = connectedFromRedirect || Boolean(getStoredAccessToken());
      setIsDriveConnected(isConnected);

      // If Google Drive is connected, pull all real cloud cards and sync board arrangement
      if (isConnected) {
        try {
          const [driveNodes, cloudMeta] = await Promise.all([
            pullNodesFromGoogleDrive(),
            pullBoardStateFromDrive(),
          ]);

          if (driveNodes.length > 0) {
            // Remove local stock demo nodes if we have authentic drive cards
            await db.nodes.clear();
            for (const dNode of driveNodes) {
              await db.nodes.put(dNode);
            }
            const updatedNodes = await db.nodes.toArray();
            setNodes(updatedNodes);
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
        } catch (e) {
          console.warn('Drive pull error:', e);
        }
      } else {
        // Auto-heal: Ensure all nodes reference an existing category, else migrate to 'general'
        const catIdSet = new Set(allCats.map((c) => c.id));
        const healedNodes = await Promise.all(
          allNodes.map(async (n) => {
            if (n.category !== 'general' && !catIdSet.has(n.category)) {
              await db.nodes.update(n.id, { category: 'general', updatedAt: Date.now() });
              return { ...n, category: 'general' };
            }
            return n;
          })
        );

        setCategories(allCats);
        setNodes(healedNodes);
        if (savedBoard) {
          setViewport(savedBoard.viewport);
          setActiveCategory(catIdSet.has(savedBoard.activeCategory) ? savedBoard.activeCategory : 'all');
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
        if (isDriveConnected && categories.length > 0) {
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

  // Card Dragging Implementation
  const handleStartDragNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    setSelectedNodeId(id);
    setDraggingNodeId(id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialNodeX: node.x,
      initialNodeY: node.y,
    };
  };

  // Touch Handlers for Mobile & Tablet Canvas Navigation
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (e.target === canvasRef.current) {
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
      const newX = dragStartRef.current.initialNodeX + deltaX;
      const newY = dragStartRef.current.initialNodeY + deltaY;

      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
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
      const movedNode = nodes.find((n) => n.id === draggingNodeId);
      if (movedNode) {
        await db.nodes.update(movedNode.id, { x: movedNode.x, y: movedNode.y });
      }
      setDraggingNodeId(null);
    }
    setIsPanning(false);
    touchStartDistRef.current = null;
  };

  const handleStartDragNodeTouch = (e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    const node = nodes.find((n) => n.id === id);
    if (!node || !touch) return;

    setSelectedNodeId(id);
    setDraggingNodeId(id);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      initialNodeX: node.x,
      initialNodeY: node.y,
    };
  };

  // Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.button === 1 || e.shiftKey) {
      setSelectedNodeId(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const deltaX = (e.clientX - dragStartRef.current.mouseX) / viewport.zoom;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / viewport.zoom;
      const newX = dragStartRef.current.initialNodeX + deltaX;
      const newY = dragStartRef.current.initialNodeY + deltaY;

      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
      );
    } else if (isPanning) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = async () => {
    if (draggingNodeId) {
      const movedNode = nodes.find((n) => n.id === draggingNodeId);
      if (movedNode) {
        await db.nodes.update(movedNode.id, { x: movedNode.x, y: movedNode.y });
      }
      setDraggingNodeId(null);
    }
    setIsPanning(false);
  };

  const handleResetTo100 = () => {
    if (nodes.length > 0) {
      const avgX = nodes.reduce((acc, curr) => acc + curr.x + (curr.width || 360) / 2, 0) / nodes.length;
      const avgY = nodes.reduce((acc, curr) => acc + curr.y + (curr.height || 260) / 2, 0) / nodes.length;
      setViewport({
        x: window.innerWidth / 2 - avgX * 1.0,
        y: window.innerHeight / 2 - avgY * 1.0,
        zoom: 1.0,
      });
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
      const catNodes = nodes.filter((n) => n.category === categoryId);
      if (catNodes.length > 0) {
        const avgX = catNodes.reduce((acc, curr) => acc + curr.x, 0) / catNodes.length;
        const avgY = catNodes.reduce((acc, curr) => acc + curr.y, 0) / catNodes.length;

        setViewport({
          x: window.innerWidth / 2 - avgX * 1,
          y: window.innerHeight / 2 - avgY * 1,
          zoom: 1.0,
        });
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
    await db.categories.delete(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));

    const affectedNodes = nodes.filter((n) => n.category === id);
    for (const node of affectedNodes) {
      await db.nodes.update(node.id, { category: 'general', updatedAt: Date.now() });
    }

    setNodes((prev) =>
      prev.map((n) => (n.category === id ? { ...n, category: 'general', updatedAt: Date.now() } : n))
    );

    if (activeCategory === id) {
      setActiveCategory('all');
    }
  };

  // Card Operations
  const handleDeleteNode = async (id: string) => {
    const nodeToDelete = nodes.find((n) => n.id === id);
    if (nodeToDelete) {
      setRecentlyDeleted(nodeToDelete);
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 6000);

      await db.nodes.delete(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));

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

    await db.nodes.put(newNode);
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);

    // Sync to Google Drive if connected
    if (isDriveConnected) {
      syncNodeToGoogleDrive(newNode);
    }
  };

  const handleUpdateNode = async (id: string, partial: Partial<BlockNode>) => {
    await db.nodes.update(id, partial);
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, ...partial } as BlockNode;
          if (isDriveConnected) {
            syncNodeToGoogleDrive(updated);
          }
          return updated;
        }
        return n;
      })
    );
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
          const isCategoryMatch = (() => {
            if (activeCategory === 'all') return true;
            if (node.category === activeCategory) return true;
            // If activeCategory is a parent category, show all nodes belonging to any of its subcategories as well!
            const nodeCat = categories.find((c) => c.id === node.category);
            if (nodeCat && nodeCat.parentId === activeCategory) return true;
            return false;
          })();

          const isSelected = selectedNodeId === node.id;
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
      />

      {/* Bottom-Left Controls: Theme Toggle + Zoom Controls */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Theme Mode Toggle (Left side of zoom bar) */}
        <button
          onClick={toggleTheme}
          className="glass-circle-btn"
          style={{
            width: '36px',
            height: '36px',
            backdropFilter: 'blur(28px) saturate(190%) brightness(105%)',
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
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
            padding: '4px 6px',
            gap: '4px',
            boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          <span style={{ fontSize: '12px', padding: '0 6px', color: 'var(--text-muted)', fontWeight: 500, minWidth: '38px', textAlign: 'center' }}>
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.max(0.2, prev.zoom - 0.1) }))}
            className="glass-circle-btn"
            style={{ width: '28px', height: '28px' }}
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.min(2.5, prev.zoom + 0.1) }))}
            className="glass-circle-btn"
            style={{ width: '28px', height: '28px' }}
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetTo100}
            className="glass-circle-btn"
            style={{ width: '28px', height: '28px' }}
            title="Center and Reset to 100%"
          >
            <Maximize2 className="w-3.5 h-3.5" />
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
      />
    </div>
  );
}
