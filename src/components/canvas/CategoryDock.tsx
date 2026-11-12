import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  Cloud,
  Link,
  Type,
  Image,
  Video,
  FileText,
  CornerDownRight,
  Plus
} from 'lucide-react';
import { Category, MediaType } from '@/lib/types/canvas';

interface CategoryDockProps {
  categories: Category[];
  activeCategory: string;
  isDriveConnected: boolean;
  onSelectCategory: (id: string) => void;
  onAddCategory: (name: string, parentId?: string) => void;
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
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);

  // Split into Top-level Categories and Subcategories
  const topCategories = categories.filter((c) => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim(), selectedParentId || undefined);
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
            backgroundColor: 'var(--card-bg, rgba(16, 16, 16, 0.94))',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '18px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.9)',
            width: '310px',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>Manage Categories & Subcategories</span>
            <button
              onClick={() => setShowCategoryPopover(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of categories with subcategories nested */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {topCategories.map((cat) => {
              const subs = getSubcategories(cat.id);
              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      borderRadius: '10px',
                      backgroundColor: activeCategory === cat.id ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      fontSize: '12px',
                      color: activeCategory === cat.id ? '#ffffff' : 'var(--text-main)',
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
                      style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: '4px' }}
                      title={`Delete ${cat.name}`}
                    >
                      <X className="w-3.5 h-3.5 hover:text-red-400" />
                    </button>
                  </div>

                  {/* Subcategories list */}
                  {subs.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 10px 5px 22px',
                        borderRadius: '8px',
                        backgroundColor: activeCategory === sub.id ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                        fontSize: '11px',
                        color: activeCategory === sub.id ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
                        onClick={() => {
                          onSelectCategory(sub.id);
                          setShowCategoryPopover(false);
                        }}
                      >
                        <CornerDownRight className="w-3 h-3 text-gray-500" />
                        <span>{sub.name}</span>
                      </div>
                      <button
                        onClick={() => onDeleteCategory(sub.id)}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px' }}
                        title={`Delete ${sub.name}`}
                      >
                        <X className="w-3 h-3 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Add Category / Subcategory Form */}
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name..."
                style={{
                  flex: 1,
                  fontSize: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '7px 12px',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'var(--liverpool)',
                  color: '#fff',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
            </div>

            {/* Parent Category Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nest under:</span>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              >
                <option value="">None (Top-Level Category)</option>
                {topCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </div>
      )}

      {/* Main Glass Dock */}
      <nav
        className="glass-dock-bar"
        style={{
          padding: '6px 8px',
          gap: '6px',
        }}
      >
        {/* Manage Categories Popover Button */}
        <button
          onClick={() => setShowCategoryPopover(!showCategoryPopover)}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Categories Manager"
        >
          <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* 'All' Universal Canvas Filter */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`filter-pill relative touch-manipulation min-h-[36px] ${activeCategory === 'all' ? 'active' : ''}`}
        >
          <span>All</span>
        </button>

        {/* Top-Level Categories with Hover / Touch Subcategory flyouts */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[48vw] no-native-scrollbar py-0.5">
          {topCategories.map((cat) => {
            const subs = getSubcategories(cat.id);
            const isTopActive = activeCategory === cat.id;
            const hasActiveSub = subs.some((s) => s.id === activeCategory);
            const isHovered = hoveredCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => setHoveredCatId(cat.id)}
                onMouseLeave={() => setHoveredCatId(null)}
              >
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className={`filter-pill relative touch-manipulation min-h-[36px] ${isTopActive || hasActiveSub ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{cat.name}</span>
                  {subs.length > 0 && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        marginLeft: '2px',
                      }}
                    >
                      {subs.length}
                    </span>
                  )}
                </button>

                {/* Subcategory Hover Flyout Menu */}
                {subs.length > 0 && isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'var(--card-bg, rgba(16, 16, 16, 0.96))',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '6px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      minWidth: '130px',
                      zIndex: 150,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        fontWeight: 600,
                      }}
                    >
                      {cat.name} Subcategories
                    </div>
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCategory(sub.id);
                          setHoveredCatId(null);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: activeCategory === sub.id ? 'var(--liverpool)' : 'transparent',
                          color: activeCategory === sub.id ? '#ffffff' : 'var(--text-main)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CornerDownRight className="w-3 h-3 opacity-60" />
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-[1px] h-4 mx-1 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        {/* Direct Individual Media Buttons - with 42px touch target */}
        <button
          onClick={() => onOpenQuickAddType('link')}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Add Link / Bookmark"
        >
          <Link className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('note')}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Add Note"
        >
          <Type className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('image')}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Add Image"
        >
          <Image className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('document')}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Add PDF / Document"
        >
          <FileText className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <button
          onClick={() => onOpenQuickAddType('video')}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title="Add Video"
        >
          <Video className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <div className="w-[1px] h-4 mx-1 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        {/* Google Drive Button */}
        <button
          onClick={onOpenDriveModal}
          className="glass-circle-btn touch-manipulation min-w-[38px] min-h-[38px]"
          title={isDriveConnected ? 'Google Drive Synced' : 'Google Drive Backup'}
        >
          <Cloud className={`w-4 h-4 ${isDriveConnected ? 'text-emerald-500' : ''}`} style={{ color: isDriveConnected ? undefined : 'var(--text-muted)' }} />
        </button>
      </nav>
    </div>
  );
};
