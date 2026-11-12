import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  Cloud,
  Link,
  Type,
  Image,
  Video,
  FileText
} from 'lucide-react';
import { Category, MediaType } from '@/lib/types/canvas';

interface CategoryDockProps {
  categories: Category[];
  activeCategory: string;
  isDriveConnected: boolean;
  onSelectCategory: (id: string) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onOpenQuickAddType: (type: MediaType) => void;
  onOpenDriveModal: () => void;
}

export const CategoryDock: React.FC<CategoryDockProps> = ({
  categories,
  activeCategory,
  isDriveConnected,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  onOpenQuickAddType,
  onOpenDriveModal,
}) => {
  const [showCategoryPopover, setShowCategoryPopover] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim());
      setNewCatName('');
    }
  };

  return (
    <div className="glass-dock-container relative">
      {/* Category Manager Floating Popover */}
      {showCategoryPopover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 14px)',
            left: '24px',
            backgroundColor: 'rgba(16, 16, 16, 0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '18px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.9)',
            width: '270px',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>Manage Categories</span>
            <button
              onClick={() => setShowCategoryPopover(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of categories with delete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  backgroundColor: activeCategory === cat.id ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  fontSize: '12px',
                  color: activeCategory === cat.id ? '#ffffff' : '#bbb',
                  fontWeight: activeCategory === cat.id ? 600 : 400,
                }}
              >
                <span
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    setShowCategoryPopover(false);
                  }}
                >
                  {cat.name}
                </span>
                <button
                  onClick={() => onDeleteCategory(cat.id)}
                  style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: '2px' }}
                  title={`Delete ${cat.name}`}
                >
                  <X className="w-3 h-3 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category..."
              style={{
                flex: 1,
                fontSize: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '9999px',
                padding: '6px 12px',
                color: '#fff',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 14px',
                backgroundColor: 'var(--liverpool)',
                color: '#fff',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </form>
        </div>
      )}

      {/* Main Glass Dock with perfectly concentric end curvature */}
      <nav
        className="glass-dock-bar"
        style={{
          padding: '6px',
          gap: '6px',
        }}
      >
        {/* Manage Categories Popover Button */}
        <button
          onClick={() => setShowCategoryPopover(!showCategoryPopover)}
          className="glass-circle-btn"
          title="Categories Manager"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* 'All' Universal Canvas Filter */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`filter-pill relative ${activeCategory === 'all' ? 'active' : ''}`}
        >
          <span>All</span>
        </button>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[38vw] no-native-scrollbar py-0.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`filter-pill relative ${isActive ? 'active' : ''}`}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <div className="w-[1px] h-4 mx-1 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        {/* Direct Individual Media Buttons */}
        <button
          onClick={() => onOpenQuickAddType('link')}
          className="glass-circle-btn"
          title="Add Link / Bookmark"
        >
          <Link className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('note')}
          className="glass-circle-btn"
          title="Add Note"
        >
          <Type className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('image')}
          className="glass-circle-btn"
          title="Add Image"
        >
          <Image className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('document')}
          className="glass-circle-btn"
          title="Add PDF / Document"
        >
          <FileText className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('video')}
          className="glass-circle-btn"
          title="Add Video"
        >
          <Video className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        <div className="w-[1px] h-4 mx-1 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        {/* Google Drive Button */}
        <button
          onClick={onOpenDriveModal}
          className="glass-circle-btn"
          title={isDriveConnected ? 'Google Drive Synced' : 'Google Drive Backup'}
        >
          <Cloud className={`w-3.5 h-3.5 ${isDriveConnected ? 'text-emerald-500' : ''}`} style={{ color: isDriveConnected ? undefined : 'var(--text-muted)' }} />
        </button>
      </nav>
    </div>
  );
};
