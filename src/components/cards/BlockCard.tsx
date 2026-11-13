import React, { useState } from 'react';
import {
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Edit3,
  X,
  FileText,
  Video,
  Check as CheckIcon
} from 'lucide-react';
import { BlockNode, Category } from '@/lib/types/canvas';

interface BlockCardProps {
  node: BlockNode;
  categories: Category[];
  isSelected: boolean;
  onSelect: (e: React.MouseEvent | React.TouchEvent) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, partial: Partial<BlockNode>) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
  onTouchStartDrag?: (e: React.TouchEvent, id: string) => void;
}

export const BlockCard: React.FC<BlockCardProps> = ({
  node,
  categories,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartDrag,
  onTouchStartDrag,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(node.data.title || '');
  const [editContent, setEditContent] = useState(node.data.content || '');
  const [editUrl, setEditUrl] = useState(node.data.url || '');
  const [editThumbnail, setEditThumbnail] = useState(node.data.thumbnailUrl || '');
  const [editCategory, setEditCategory] = useState(node.category);

  // Sync edit form state if node props update externally (e.g. category deletion)
  React.useEffect(() => {
    setEditCategory(node.category);
    setEditTitle(node.data.title || '');
    setEditContent(node.data.content || '');
    setEditUrl(node.data.url || '');
    setEditThumbnail(node.data.thumbnailUrl || '');
  }, [node]);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.data.url) {
      navigator.clipboard.writeText(node.data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.data.url) {
      window.open(node.data.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    onUpdate(node.id, {
      category: editCategory,
      data: {
        ...node.data,
        title: editTitle,
        content: editContent,
        url: editUrl,
        thumbnailUrl: editThumbnail,
      },
      updatedAt: Date.now(),
    });
  };

  const handleMouseDownCard = (e: React.MouseEvent) => {
    if (isEditing) {
      return;
    }
    onStartDrag(e, node.id);
  };

  const hasValidThumbnail = Boolean(node.data.thumbnailUrl && !imgError);

  // Design Formulas:
  // Outer Radius = 20px
  // Padding = 16px
  // Inner Element Radius = Outer Radius - Padding = 20 - 16 = 4px ~ 8px for nested inputs
  const uniformInputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    boxSizing: 'border-box',
    fontSize: '14px',
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '0 14px',
    color: 'var(--text-main)',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: '40px',
    letterSpacing: '0.015em',
    display: 'flex',
    alignItems: 'center',
  };

  const handleTouchStartCard = (e: React.TouchEvent) => {
    if (isEditing) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('.no-drag')
    ) {
      return;
    }
    if (onTouchStartDrag) {
      onTouchStartDrag(e, node.id);
    }
  };

  return (
    <div
      onMouseDown={handleMouseDownCard}
      onTouchStart={handleTouchStartCard}
      onClick={onSelect}
      className={`card-body-shell group relative flex flex-col select-none touch-manipulation ${
        isEditing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        width: node.width || 360,
        backgroundColor: 'var(--card-bg)',
        borderRadius: '20px', // Outer Corner Radius
        border: isSelected ? '1px solid var(--liverpool)' : '1px solid var(--card-border)',
        boxShadow: isSelected
          ? '0 0 25px var(--liverpool-glow), var(--card-shadow)'
          : 'var(--card-shadow)',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, background-color 0.2s ease',
      }}
    >
      {/* Top Floating Actions: ONLY shown when NOT in edit mode */}
      {!isEditing && (
        <div
          className="absolute top-3.5 right-3.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out z-20 pointer-events-none group-hover:pointer-events-auto"
          style={{
            backdropFilter: 'blur(16px)',
            backgroundColor: 'var(--glass-bg)',
            padding: '5px 8px',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(2px)',
          }}
        >
          {node.data.url && (
            <>
              <button
                onClick={handleOpenLink}
                className="p-1 rounded-full text-neutral-400 hover:text-[var(--text-main)] hover:bg-neutral-500/10 transition-colors"
                title="Open Link in New Tab"
              >
                <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-1 rounded-full text-neutral-400 hover:text-[var(--text-main)] hover:bg-neutral-500/10 transition-colors"
                title="Copy URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditCategory(node.category);
              setEditTitle(node.data.title || '');
              setEditContent(node.data.content || '');
              setEditUrl(node.data.url || '');
              setEditThumbnail(node.data.thumbnailUrl || '');
              setIsEditing(true);
            }}
            className="p-1 rounded-full text-neutral-400 hover:text-[var(--text-main)] hover:bg-neutral-500/10 transition-colors"
            title="Edit Block"
          >
            <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1 rounded-full text-neutral-400 hover:text-[var(--liverpool)] hover:bg-red-500/10 transition-colors"
            title="Move to Recycle Bin"
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}

      {/* EDIT OVERLAY MODE */}
      {isEditing ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.01em' }}>
              Edit Block
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--liverpool)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px var(--liverpool-glow)',
                }}
                title="Save Changes"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--glass-circle-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Cancel Edit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              style={{
                ...uniformInputStyle,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                paddingRight: '36px',
                cursor: 'pointer',
              }}
            >
              <option value="general" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}>
                No Category (Default)
              </option>
              {categories.map((c) => {
                const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
                const displayName = parent ? `${parent.name} → ${c.name}` : c.name;
                return (
                  <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}>
                    {displayName}
                  </option>
                );
              })}
            </select>
            {/* Custom centered chevron arrow matching left/right inset */}
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

          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title..."
            style={uniformInputStyle}
          />

          {node.type === 'note' && (
            <textarea
              rows={Math.max(6, Math.min(22, (editContent.split('\n').length || 1) + 3))}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Notes content..."
              style={{
                ...uniformInputStyle,
                height: 'auto',
                minHeight: '160px',
                padding: '12px 14px',
                lineHeight: '1.6',
                resize: 'vertical',
                letterSpacing: '0.015em',
              }}
            />
          )}

          {node.type === 'link' && (
            <input
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://..."
              style={uniformInputStyle}
            />
          )}

          {(node.type === 'image' || node.type === 'link') && (
            <input
              type="url"
              value={editThumbnail}
              onChange={(e) => setEditThumbnail(e.target.value)}
              placeholder="Image / thumbnail URL..."
              style={uniformInputStyle}
            />
          )}
        </div>
      ) : (
        /* NORMAL VIEW MODE */
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {node.type === 'image' && (
            <div style={{ width: '100%', height: '260px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {hasValidThumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={node.data.thumbnailUrl}
                  alt={node.data.title || 'Inspiration image'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              ) : (
                <div style={{ color: '#888888', fontSize: '12px', fontFamily: 'monospace', padding: '24px' }}>No Image Preview</div>
              )}
            </div>
          )}

          {node.type === 'link' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hasValidThumbnail && (
                <div style={{ width: '100%', height: '190px', overflow: 'hidden', backgroundColor: 'var(--card-footer-bg)', position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={node.data.thumbnailUrl}
                    alt={node.data.title || 'Link preview'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    onError={() => setImgError(true)}
                  />
                </div>
              )}
              {/* Spacing Formula: 20px padding (8pt grid multiple), 16px font title, 13px font desc */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  onClick={handleOpenLink}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888888', cursor: 'pointer', width: 'fit-content' }}
                  className="hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--liverpool)]" />
                  <span className="truncate underline decoration-white/20 underline-offset-2">
                    {node.data.url ? new URL(node.data.url).hostname : 'link'}
                  </span>
                </div>
                <h4
                  onClick={handleOpenLink}
                  style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.4', letterSpacing: '0.02em', cursor: 'pointer' }}
                  className="hover:text-[var(--liverpool)] transition-colors"
                >
                  {node.data.title || node.data.url}
                </h4>
                {node.data.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', letterSpacing: '0.015em', margin: 0 }}>
                    {node.data.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {node.type === 'note' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px', letterSpacing: '0.02em' }}>
                {node.data.title || 'Note'}
              </h4>
              <div
                onDoubleClick={() => setIsEditing(true)}
                style={{
                  fontSize: '13px',
                  color: 'var(--text-sub)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  letterSpacing: '0.015em',
                  cursor: 'text',
                }}
                title="Double click to edit"
              >
                {node.data.content || 'Double click to add notes...'}
              </div>
            </div>
          )}

          {node.type === 'document' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--liverpool-subtle)', color: 'var(--liverpool)' }}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.01em' }}>
                    {node.data.title || 'Document'}
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {node.data.fileName || 'PDF Document'}
                  </span>
                </div>
              </div>
              {node.data.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-sub)', lineHeight: '1.5', letterSpacing: '0.01em' }}>
                  {node.data.description}
                </p>
              )}
            </div>
          )}

          {node.type === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '100%', height: '190px', overflow: 'hidden', backgroundColor: 'var(--card-footer-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <Video className="w-8 h-8 text-[var(--liverpool)]" />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.01em' }}>
                  {node.data.title || 'Video Reference'}
                </h4>
                {node.data.url && (
                  <span
                    onClick={handleOpenLink}
                    style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
                    className="truncate hover:text-[var(--liverpool)]"
                  >
                    {node.data.url}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Footer: clean category text with 12px font and -0.01em tracking */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--card-footer-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
          {(() => {
            const cat = categories.find((c) => c.id === node.category);
            if (!cat) return 'No Category';
            if (cat.parentId) {
              const parent = categories.find((c) => c.id === cat.parentId);
              return parent ? `${parent.name} / ${cat.name}` : cat.name;
            }
            return cat.name;
          })()}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {new Date(node.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
};
