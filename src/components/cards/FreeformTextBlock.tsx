import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Bold, List, ChevronDown } from 'lucide-react';
import { BlockNode } from '@/lib/types/canvas';

interface FreeformTextBlockProps {
  node: BlockNode;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent | React.TouchEvent) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, partial: Partial<BlockNode>) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
  onTouchStartDrag?: (e: React.TouchEvent, id: string) => void;
  zoom: number;
}

const FONT_SIZE_MAP = {
  small: { label: 'Small', fontSize: 13, lineHeight: '18px' },
  medium: { label: 'Medium', fontSize: 16, lineHeight: '24px' },
  large: { label: 'Large', fontSize: 22, lineHeight: '30px' },
  'extra-large': { label: 'Extra large', fontSize: 32, lineHeight: '40px' },
};

type FontSizeKey = keyof typeof FONT_SIZE_MAP;

export const FreeformTextBlock: React.FC<FreeformTextBlockProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartDrag,
  onTouchStartDrag,
  zoom,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ mouseX: number; startW: number }>({ mouseX: 0, startW: 0 });

  const rawSize = node.data.fontSize;
  const currentSizeKey: FontSizeKey =
    rawSize && typeof rawSize === 'string' && rawSize in FONT_SIZE_MAP
      ? (rawSize as FontSizeKey)
      : 'medium';

  const isBold = Boolean(node.data.isBold);
  const isList = Boolean(node.data.isList);
  const textContent = node.data.content || '';
  const currentWidth = Math.max(160, node.width || 380);

  // Auto-focus and select range on double-click into edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Adjust height dynamically to fit text
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(36, textareaRef.current.scrollHeight)}px`;
    }
  }, [isEditing]);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
      setShowSizeDropdown(false);
    }
  }, [isSelected]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(36, e.target.scrollHeight)}px`;

    onUpdate(node.id, {
      data: {
        ...node.data,
        content: val,
      },
      updatedAt: Date.now(),
    });
  };

  const handleFontSizeChange = (sizeKey: FontSizeKey) => {
    setShowSizeDropdown(false);
    onUpdate(node.id, {
      data: {
        ...node.data,
        fontSize: sizeKey,
      },
      updatedAt: Date.now(),
    });
  };

  const handleToggleBold = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(node.id, {
      data: {
        ...node.data,
        isBold: !isBold,
      },
      updatedAt: Date.now(),
    });
  };

  const handleToggleList = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsList = !isList;
    let newContent = textContent;

    if (newIsList) {
      // Add bullets to each non-empty line if not already there
      newContent = textContent
        .split('\n')
        .map((line) => (line.trim().startsWith('• ') || line.trim().startsWith('- ') ? line : `• ${line}`))
        .join('\n');
    } else {
      // Remove bullets
      newContent = textContent
        .split('\n')
        .map((line) => line.replace(/^([•\-\*]\s*)/, ''))
        .join('\n');
    }

    onUpdate(node.id, {
      data: {
        ...node.data,
        isList: newIsList,
        content: newContent,
      },
      updatedAt: Date.now(),
    });
  };

  // Drag and width resizing logic
  const handleStartResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      startW: currentWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - resizeStartRef.current.mouseX) / (zoom || 1);
      const newWidth = Math.max(140, Math.round(resizeStartRef.current.startW + deltaX));
      onUpdate(node.id, { width: newWidth });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const currentConfig = FONT_SIZE_MAP[currentSizeKey];

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        if (!isEditing && !isResizing) {
          onStartDrag(e, node.id);
        }
      }}
      onTouchStart={(e) => {
        if (!isEditing && onTouchStartDrag) {
          onTouchStartDrag(e, node.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
      className="group relative select-none"
      style={{
        width: `${currentWidth}px`,
        cursor: isEditing ? 'text' : 'grab',
        touchAction: 'none',
      }}
    >
      {/* FIGJAM / FIGMA FLOATING FORMATTING TOOLBAR (Shown when Selected) */}
      {isSelected && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 flex items-center gap-1.5"
          style={{
            bottom: 'calc(100% + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e1e1e',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '4px 8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            color: '#f4f4f5',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Font Size Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSizeDropdown((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#e2e8f0',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title="Font size"
            >
              <span>{currentConfig.label}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {showSizeDropdown && (
              <div
                className="absolute left-0 bottom-full mb-1 flex flex-col py-1"
                style={{
                  backgroundColor: '#18181b',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
                  minWidth: '120px',
                  zIndex: 60,
                }}
              >
                {(Object.keys(FONT_SIZE_MAP) as FontSizeKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFontSizeChange(key)}
                    className="text-left px-3 py-1.5 hover:bg-white/10 text-xs transition-colors"
                    style={{
                      color: currentSizeKey === key ? 'var(--liverpool, #c8102e)' : '#f4f4f5',
                      fontWeight: currentSizeKey === key ? 600 : 400,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {FONT_SIZE_MAP[key].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />

          {/* Bold Button */}
          <button
            type="button"
            onClick={handleToggleBold}
            className={`p-1.5 rounded transition-colors ${
              isBold ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            style={{ border: 'none', background: isBold ? 'rgba(255,255,255,0.2)' : 'transparent', cursor: 'pointer' }}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Bulleted List Button */}
          <button
            type="button"
            onClick={handleToggleList}
            className={`p-1.5 rounded transition-colors ${
              isList ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            style={{ border: 'none', background: isList ? 'rgba(255,255,255,0.2)' : 'transparent', cursor: 'pointer' }}
            title="Bulleted list"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />

          {/* Delete Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1.5 rounded text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            title="Delete text block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FIGMA SELECTION BOUNDING BOX (Cardless, Transparent, 1px Blue Outline) */}
      <div
        className="relative transition-all"
        style={{
          border: isSelected
            ? '1.5px solid #0066FF'
            : '1.5px solid transparent',
          padding: '4px 6px',
          borderRadius: '2px',
          boxSizing: 'border-box',
          minHeight: '36px',
        }}
      >
        {/* Figma Resize Handles (Top-Left, Top-Right, Bottom-Left, Bottom-Right, Edge Right) */}
        {isSelected && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                width: '7px',
                height: '7px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #0066FF',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '7px',
                height: '7px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #0066FF',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                left: '-4px',
                width: '7px',
                height: '7px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #0066FF',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '7px',
                height: '7px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #0066FF',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            />

            {/* Draggable Width Resize Handle on Right Edge */}
            <div
              onMouseDown={handleStartResize}
              className="absolute top-0 bottom-0 -right-2 w-4 cursor-ew-resize flex items-center justify-center z-40"
              title="Drag to adjust width"
            >
              <div
                style={{
                  width: '5px',
                  height: '18px',
                  backgroundColor: '#0066FF',
                  borderRadius: '2px',
                }}
              />
            </div>
          </>
        )}

        {/* INLINE EDITABLE TEXT OR DISPLAY VIEW */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={textContent}
            onChange={handleTextChange}
            onBlur={handleBlur}
            placeholder="Type anything..."
            style={{
              width: '100%',
              minHeight: '36px',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              resize: 'none',
              fontSize: `${currentConfig.fontSize}px`,
              lineHeight: currentConfig.lineHeight,
              fontWeight: isBold ? 700 : 400,
              color: 'var(--text-main, #ffffff)',
              fontFamily: 'inherit',
              wordBreak: 'break-word',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              fontSize: `${currentConfig.fontSize}px`,
              lineHeight: currentConfig.lineHeight,
              fontWeight: isBold ? 700 : 400,
              color: textContent.trim() ? 'var(--text-main, #ffffff)' : 'var(--text-muted, #71717a)',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              boxSizing: 'border-box',
              minHeight: `${currentConfig.fontSize + 4}px`,
            }}
          >
            {textContent.trim() || 'Double-click to type...'}
          </div>
        )}
      </div>
    </div>
  );
};
