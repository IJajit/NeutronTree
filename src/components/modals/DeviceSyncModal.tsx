import React, { useState } from 'react';
import { Smartphone, Check, Copy, Download, Upload, AlertCircle, RefreshCw, X, Shield } from 'lucide-react';
import { BlockNode, Category, ViewportState } from '@/lib/types/canvas';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: BlockNode[];
  categories: Category[];
  viewport: ViewportState;
  activeCategory: string;
  onRestoreBoard: (nodes: BlockNode[], categories: Category[], viewport?: ViewportState) => Promise<void>;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose,
  nodes,
  categories,
  viewport,
  activeCategory,
  onRestoreBoard,
}) => {
  const [syncCode, setSyncCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const bundle = {
        nodes,
        categories,
        viewport,
        activeCategory,
        timestamp: Date.now(),
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate sync code');

      setSyncCode(data.code);
      setStatusMessage({
        type: 'success',
        text: `Code generated! Enter ${data.code} on your phone to instantly load this exact desktop setup.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate code' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePullByCode = async () => {
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Please enter a 6-character code.' });
      return;
    }

    setIsPulling(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/sync?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid or expired sync code');

      const bundle = data.bundle;
      if (!bundle || !bundle.nodes) {
        throw new Error('Sync bundle does not contain valid board data');
      }

      await onRestoreBoard(bundle.nodes, bundle.categories || [], bundle.viewport);
      setStatusMessage({
        type: 'success',
        text: `Sync complete! Successfully restored ${bundle.nodes.length} blocks & ${bundle.categories?.length || 0} categories.`,
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopyCode = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportJson = () => {
    const bundle = {
      nodes,
      categories,
      viewport,
      activeCategory,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuron-tree-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.nodes)) {
          await onRestoreBoard(parsed.nodes, parsed.categories || [], parsed.viewport);
          setStatusMessage({
            type: 'success',
            text: `Restored ${parsed.nodes.length} blocks from backup file.`,
          });
          setTimeout(() => onClose(), 1000);
        } else {
          setStatusMessage({ type: 'error', text: 'Invalid backup file structure.' });
        }
      } catch {
        setStatusMessage({ type: 'error', text: 'Failed to read backup file.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#121212',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone className="w-4 h-4 text-[var(--liverpool)]" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Cross-Device Live Sync</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '9999px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Alert */}
          {statusMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: statusMessage.type === 'success' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(200, 16, 46, 0.12)',
                border: `1px solid ${statusMessage.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(200, 16, 46, 0.3)'}`,
                color: statusMessage.type === 'success' ? '#34d399' : '#ff6b7e',
                fontSize: '12px',
              }}
            >
              {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* SECTION 1: Send to Phone (Generate Code) */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#ffffff', display: 'block' }}>1. Push Board to Phone</strong>
                <span style={{ fontSize: '11px', color: '#888888' }}>Uploads current layout & generates a 6-letter PIN</span>
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={isGenerating}
                style={{
                  padding: '7px 16px',
                  backgroundColor: 'var(--liverpool)',
                  color: '#fff',
                  borderRadius: '9999px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 0 12px var(--liverpool-glow)',
                }}
              >
                {isGenerating ? 'Generating...' : 'Get Sync Code'}
              </button>
            </div>

            {syncCode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#0a0a0a',
                  border: '1px dashed var(--liverpool)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginTop: '4px',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your 6-Digit PIN</span>
                  <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '0.2em', color: '#ffffff', fontFamily: 'monospace' }}>
                    {syncCode}
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: Receive on Phone (Enter Code) */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <strong style={{ fontSize: '13px', color: '#ffffff', display: 'block' }}>2. Receive on Phone</strong>
              <span style={{ fontSize: '11px', color: '#888888' }}>Enter the 6-letter PIN generated from your desktop</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="e.g. 7K9X2A"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  backgroundColor: '#000',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '16px',
                  fontFamily: 'monospace',
                  letterSpacing: '0.15em',
                  color: '#fff',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              <button
                onClick={handlePullByCode}
                disabled={isPulling}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isPulling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isPulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Sync Now
              </button>
            </div>
          </div>

          {/* Backup / Restore JSON Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
            <button
              onClick={handleExportJson}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup (.json)
            </button>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#888',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              Restore File (.json)
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
