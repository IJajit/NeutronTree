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
  Plus,
  Smartphone,
  Search,
  Eye,
  RefreshCw,
  Edit2,
  Check
} from 'lucide-react';
import { Category, MediaType } from '@/lib/types/canvas';

interface CategoryDockProps {
  categories: Category[];
  activeCategory: string;
  isDriveConnected: boolean;
  onSelectCategory: (id: string) => void;
  onAddCategory: (name: string, parentId?: string) => void;
  onRenameCategory?: (id: string, newName: string) => void;
  onDeleteCategory: (id: string) => void;
  onOpenQuickAddType: (type: MediaType) => void;
  onOpenDriveModal: () => void;
  onOpenDeviceSyncModal?: () => void;
  onSyncWithDrive?: () => void;
  isSyncing?: boolean;
  isMobileViewer?: boolean;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  isCategoryMenuOpen?: boolean;
  onToggleCategoryMenu?: (open: boolean) => void;
}

export const CategoryDock: React.FC<CategoryDockProps> = ({
  categories,
  activeCategory,
  isDriveConnected,
  onSelectCategory,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onOpenQuickAddType,
  onOpenDriveModal,
  onOpenDeviceSyncModal,
  onSyncWithDrive,
  isSyncing,
  isMobileViewer,
  isSearchOpen,
  onToggleSearch,
  searchQuery = '',
  onSearchChange,
  isCategoryMenuOpen,
  onToggleCategoryMenu,
}) => {
  const [internalPopover, setInternalPopover] = useState(false);
  const showCategoryPopover = isCategoryMenuOpen !== undefined ? isCategoryMenuOpen : internalPopover;
  const setShowCategoryPopover = (open: boolean) => {
    if (onToggleCategoryMenu) {
      onToggleCategoryMenu(open);
    } else {
      setInternalPopover(open);
    }
  };
  const [newCatName, setNewCatName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const handleStartRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setEditingCatId(id);
    setEditingCatName(currentName);
  };

  const handleSaveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingCatName.trim() && onRenameCategory) {
      onRenameCategory(id, editingCatName.trim());
    }
    setEditingCatId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCatId(null);
  };
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleCatMouseEnter = (catId: string, hasSubs: boolean) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hasSubs) {
      setHoveredCatId(catId);
    }
  };

  const handleCatMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCatId(null);
    }, 180);
  };

  // Close menus on Escape key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        setShowCategoryPopover(false);
        setHoveredCatId(null);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, []);

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
          className="category-popover-menu"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 14px)',
            left: '12px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: 'var(--card-bg, rgba(16, 16, 16, 0.94))',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '18px',
            boxShadow: 'var(--popover-shadow)',
            width: '320px',
            maxHeight: 'min(75dvh, 520px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              {isMobileViewer ? 'Categories' : 'Manage Categories & Subcategories'}
            </span>
            <button
              onClick={() => setShowCategoryPopover(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of categories with subcategories nested */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
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
                      gap: '8px',
                    }}
                  >
                    {editingCatId === cat.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e, cat.id);
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            backgroundColor: 'var(--input-bg)',
                            border: '1px solid var(--liverpool)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '12px',
                            color: '#fff',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={(e) => handleSaveRename(e, cat.id)}
                          style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                          title="Save name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          style={{ cursor: 'pointer', flex: 1 }}
                          onClick={() => {
                            onSelectCategory(cat.id);
                            setShowCategoryPopover(false);
                          }}
                        >
                          {cat.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {!isMobileViewer && (
                            <>
                              <button
                                onClick={(e) => handleStartRename(e, cat.id, cat.name)}
                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
                                title={`Rename ${cat.name}`}
                              >
                                <Edit2 className="w-3 h-3 hover:text-white" />
                              </button>
                              <button
                                onClick={() => onDeleteCategory(cat.id)}
                                style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: '4px' }}
                                title={`Delete ${cat.name}`}
                              >
                                <X className="w-3.5 h-3.5 hover:text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
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
                        gap: '6px',
                      }}
                    >
                      {editingCatId === sub.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          <CornerDownRight className="w-3 h-3 text-gray-500 shrink-0" />
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(e, sub.id);
                              if (e.key === 'Escape') setEditingCatId(null);
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              backgroundColor: 'var(--input-bg)',
                              border: '1px solid var(--liverpool)',
                              borderRadius: '6px',
                              padding: '2px 6px',
                              fontSize: '11px',
                              color: '#fff',
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={(e) => handleSaveRename(e, sub.id)}
                            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                            title="Save name"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {!isMobileViewer && (
                              <>
                                <button
                                  onClick={(e) => handleStartRename(e, sub.id, sub.name)}
                                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '3px' }}
                                  title={`Rename ${sub.name}`}
                                >
                                  <Edit2 className="w-2.5 h-2.5 hover:text-white" />
                                </button>
                                <button
                                  onClick={() => onDeleteCategory(sub.id)}
                                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px' }}
                                  title={`Delete ${sub.name}`}
                                >
                                  <X className="w-3 h-3 hover:text-red-400" />
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Add Category / Subcategory Form - ONLY on Desktop */}
          {!isMobileViewer && (
            <form
              onSubmit={handleCreateCategory}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name..."
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--liverpool)',
                    color: '#fff',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 0 12px var(--liverpool-glow)',
                  }}
                >
                  Add
                </button>
              </div>

              {/* Parent Category Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Nest under (Optional Parent):
                </span>
                <div style={{ position: 'relative', width: '100%' }}>
                  <select
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '8px 36px 8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      outline: 'none',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}>
                      None (Top-Level Category)
                    </option>
                    {topCategories.map((c) => (
                      <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Custom Chevron Arrow positioned 14px inside right edge */}
                  <div
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Main Glass Dock */}
      <nav
        className="glass-dock-bar"
      >
        {/* Manage Categories Popover Button */}
        <button
          onClick={() => setShowCategoryPopover(!showCategoryPopover)}
          className="glass-circle-btn touch-manipulation"
          title="Categories Manager"
        >
          <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* 'All' Universal Canvas Filter */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`filter-pill relative touch-manipulation ${activeCategory === 'all' ? 'active' : ''}`}
        >
          <span>All</span>
        </button>

        {/* Top-Level Categories with Click / Hover Subcategory flyouts */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[34vw] md:max-w-[48vw] no-native-scrollbar py-0.5">
          {topCategories.map((cat) => {
            const subs = getSubcategories(cat.id);
            const isTopActive = activeCategory === cat.id;
            const hasActiveSub = subs.some((s) => s.id === activeCategory);
            const isFlyoutOpen = hoveredCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => handleCatMouseEnter(cat.id, subs.length > 0)}
                onMouseLeave={handleCatMouseLeave}
              >
                <button
                  onClick={() => {
                    onSelectCategory(cat.id);
                    if (subs.length > 0) {
                      setHoveredCatId((prev) => (prev === cat.id ? null : cat.id));
                    }
                  }}
                  className={`filter-pill relative touch-manipulation min-h-[36px] ${isTopActive || hasActiveSub ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>{cat.name}</span>
                  {subs.length > 0 && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--border)',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                      }}
                    >
                      {subs.length}
                    </span>
                  )}
                </button>

                {/* Subcategory Flyout Menu with consistent background */}
                {subs.length > 0 && isFlyoutOpen && (
                  <div
                    onMouseEnter={() => handleCatMouseEnter(cat.id, true)}
                    onMouseLeave={handleCatMouseLeave}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 14px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'var(--card-bg)',
                      backdropFilter: 'blur(28px) saturate(190%)',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      padding: '8px',
                      boxShadow: 'var(--popover-shadow)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      minWidth: '150px',
                      zIndex: 150,
                    }}
                  >
                    {/* Invisible bridge to prevent mouse leave gap jitter */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        height: '16px',
                        backgroundColor: 'transparent',
                        pointerEvents: 'auto',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        padding: '4px 8px',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border-subtle)',
                        marginBottom: '2px',
                      }}
                    >
                      {cat.name}
                    </div>

                    {/* Quick option to select all in this category */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCategory(cat.id);
                        setHoveredCatId(null);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: activeCategory === cat.id ? 'var(--liverpool)' : 'transparent',
                        color: activeCategory === cat.id ? '#ffffff' : 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>All {cat.name}</span>
                    </button>

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
                        <CornerDownRight className="w-3.5 h-3.5 opacity-60" />
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>


        {/* Search Popover / Input Bar */}
        {isSearchOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 12px)',
              left: 0,
              right: 0,
              width: '100%',
              backgroundColor: 'var(--card-bg, rgba(16, 16, 16, 0.95))',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--border)',
              borderRadius: '9999px',
              padding: '6px 14px',
              boxShadow: 'var(--popover-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 120,
              boxSizing: 'border-box',
            }}
          >
            <Search className="w-4 h-4 text-[var(--liverpool)] shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search title, note, file or link..."
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: 'var(--text-main)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange && onSearchChange('')}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Mobile View: Search -> Refresh -> Cloud (no divider line) */}
        {isMobileViewer ? (
          <>
            <button
              onClick={onToggleSearch}
              className={`glass-circle-btn touch-manipulation ${isSearchOpen || searchQuery ? 'primary' : ''}`}
              title="Search canvas blocks"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => window.location.reload()}
              className="glass-circle-btn touch-manipulation"
              title="Refresh website"
            >
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Google Drive Button & Direct Cloud Sync Button */}
            <button
              onClick={onOpenDriveModal}
              className="glass-circle-btn touch-manipulation"
              title={isDriveConnected ? 'Google Drive (Connected) - Click to manage & sync' : 'Connect Google Drive'}
            >
              <Cloud
                className={`w-4 h-4 ${isDriveConnected ? 'text-emerald-500' : ''} ${isSyncing ? 'animate-pulse' : ''}`}
                style={{ color: isDriveConnected ? undefined : 'var(--text-muted)' }}
              />
            </button>
          </>
        ) : (
          <>
            <div className="w-[1px] h-4 mx-1 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

            {/* Desktop Full Media Creation Suite */}
            <button
              onClick={() => onOpenQuickAddType('link')}
              className="glass-circle-btn touch-manipulation"
              title="Add Link / Bookmark"
            >
              <Link className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            <button
              onClick={() => onOpenQuickAddType('note')}
              className="glass-circle-btn touch-manipulation"
              title="Add Note"
            >
              <Type className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            <button
              onClick={() => onOpenQuickAddType('image')}
              className="glass-circle-btn touch-manipulation"
              title="Add Image"
            >
              <Image className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            <button
              onClick={() => onOpenQuickAddType('document')}
              className="glass-circle-btn touch-manipulation"
              title="Add PDF / Document"
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            <button
              onClick={() => onOpenQuickAddType('video')}
              className="glass-circle-btn touch-manipulation"
              title="Add Video"
            >
              <Video className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Desktop Search Button */}
            <button
              onClick={onToggleSearch}
              className={`glass-circle-btn touch-manipulation ${isSearchOpen || searchQuery ? 'primary' : ''}`}
              title="Search canvas blocks"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Google Drive Button & Direct Cloud Sync Button */}
            <button
              onClick={onOpenDriveModal}
              className="glass-circle-btn touch-manipulation"
              title={isDriveConnected ? 'Google Drive (Connected) - Click to manage & sync' : 'Connect Google Drive'}
            >
              <Cloud
                className={`w-4 h-4 ${isDriveConnected ? 'text-emerald-500' : ''} ${isSyncing ? 'animate-pulse' : ''}`}
                style={{ color: isDriveConnected ? undefined : 'var(--text-muted)' }}
              />
            </button>
          </>
        )}
      </nav>
    </div>
  );
};
