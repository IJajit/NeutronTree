import React, { useState } from 'react';
import { X, Link, Type, Image, FileText, Video } from 'lucide-react';
import { Category, MediaType } from '@/lib/types/canvas';

interface QuickAddModalProps {
  isOpen: boolean;
  initialType?: MediaType;
  onClose: () => void;
  categories: Category[];
  activeCategory: string;
  onAdd: (type: MediaType, title: string, category: string, extra: Record<string, string>) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  initialType = 'link',
  onClose,
  categories,
  activeCategory,
  onAdd,
}) => {
  const [tab, setTab] = useState<MediaType>(initialType);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [fileActualName, setFileActualName] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCat, setSelectedCat] = useState(
    activeCategory === 'all' ? (categories[0]?.id || 'general') : activeCategory
  );
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (initialType) {
      setTab(initialType);
    }
  }, [initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (tab === 'link') {
        const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        onAdd('link', data.title || title || url, selectedCat, {
          url: data.url || url,
          description: data.description || description || '',
          thumbnailUrl: data.image || '',
        });
      } else if (tab === 'note') {
        onAdd('note', title || 'Field Note', selectedCat, {
          content: noteContent,
        });
      } else if (tab === 'image') {
        onAdd('image', title || fileActualName || 'Inspiration Snapshot', selectedCat, {
          thumbnailUrl: fileBase64 || imageUrl,
          rawFileBase64: fileBase64 || imageUrl,
          fileName: fileActualName || (title ? `${title}.png` : 'image.png'),
          mimeType: fileMimeType || 'image/png',
        });
      } else if (tab === 'document') {
        onAdd('document', title || fileActualName || fileName || 'Document', selectedCat, {
          fileName: fileActualName || fileName || (title ? `${title}.pdf` : 'document.pdf'),
          description,
          rawFileBase64: fileBase64,
          mimeType: fileMimeType || 'application/pdf',
        });
      } else if (tab === 'video') {
        onAdd('video', title || 'Video Clip', selectedCat, {
          url,
          description,
        });
      }

      onClose();
      setTitle('');
      setUrl('');
      setNoteContent('');
      setImageUrl('');
      setFileName('');
      setDescription('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(24px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#121212',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(92dvh, 850px)',
          margin: 'auto 0',
        }}
      >
        {/* Top Action Bar: Media tabs + Close Button all in the same line! */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => setTab('link')}
              className={`filter-pill ${tab === 'link' ? 'active' : ''}`}
              style={{ color: tab === 'link' ? '#ffffff' : '#888' }}
            >
              <Link className="w-3.5 h-3.5" /> Link
            </button>
            <button
              type="button"
              onClick={() => setTab('note')}
              className={`filter-pill ${tab === 'note' ? 'active' : ''}`}
              style={{ color: tab === 'note' ? '#ffffff' : '#888' }}
            >
              <Type className="w-3.5 h-3.5" /> Note
            </button>
            <button
              type="button"
              onClick={() => setTab('image')}
              className={`filter-pill ${tab === 'image' ? 'active' : ''}`}
              style={{ color: tab === 'image' ? '#ffffff' : '#888' }}
            >
              <Image className="w-3.5 h-3.5" /> Image
            </button>
            <button
              type="button"
              onClick={() => setTab('document')}
              className={`filter-pill ${tab === 'document' ? 'active' : ''}`}
              style={{ color: tab === 'document' ? '#ffffff' : '#888' }}
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={() => setTab('video')}
              className={`filter-pill ${tab === 'video' ? 'active' : ''}`}
              style={{ color: tab === 'video' ? '#ffffff' : '#888' }}
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
          </div>

          {/* Close button in the exact same line */}
          <button
            onClick={onClose}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#888888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginLeft: '12px',
            }}
            title="Cancel / Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaaaaa', marginBottom: '8px', fontWeight: 500 }}>
              Category
            </label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#ededed',
                outline: 'none',
              }}
            >
              {categories.map((c) => {
                const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
                const displayName = parent ? `${parent.name} → ${c.name}` : c.name;
                return (
                  <option key={c.id} value={c.id} style={{ backgroundColor: '#181818', color: '#ffffff' }}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          {tab === 'link' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#aaaaaa', marginBottom: '8px', fontWeight: 500 }}>
                Link URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#ededed',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
          )}

          {tab === 'note' && (
            <>
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ededed',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>
              <div>
                <textarea
                  required
                  rows={6}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type notes..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: '1.65',
                    minHeight: '140px',
                  }}
                />
              </div>
            </>
          )}

          {tab === 'image' && (
            <>
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Image title (optional)..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Direct File Upload Zone */}
              <div
                style={{
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('image-file-input')?.click()}
              >
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileActualName(file.name);
                      setFileMimeType(file.type || 'image/png');
                      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFileBase64(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <p style={{ fontSize: '13px', color: fileActualName ? '#4ade80' : '#888' }}>
                  {fileActualName ? `✓ Selected: ${fileActualName}` : '📁 Click to choose an Image file from computer'}
                </p>
                <span style={{ fontSize: '11px', color: '#555' }}>or paste an image web URL below</span>
              </div>

              <div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or Image URL https://..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {tab === 'document' && (
            <>
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document Name (e.g. Portfolio.pdf)..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              {/* Direct PDF / Document Upload */}
              <div
                style={{
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('doc-file-input')?.click()}
              >
                <input
                  id="doc-file-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileActualName(file.name);
                      setFileMimeType(file.type || 'application/pdf');
                      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFileBase64(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <p style={{ fontSize: '13px', color: fileActualName ? '#4ade80' : '#888' }}>
                  {fileActualName ? `✓ Selected: ${fileActualName}` : '📄 Click to choose a PDF or document file'}
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Document notes..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {tab === 'video' && (
            <>
              <div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Video Title..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Video URL https://..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#ededed',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {/* Action Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                color: '#888888',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '9px 22px',
                backgroundColor: 'var(--liverpool)',
                color: '#ffffff',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 15px var(--liverpool-glow)',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Processing...' : 'Add to Canvas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
