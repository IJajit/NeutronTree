import React, { useState } from 'react';
import { Cloud, CheckCircle2, ShieldCheck, FolderSync, Info, X } from 'lucide-react';

interface DriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDriveConnected: boolean;
  onConnectDrive: () => void;
}

export const DriveSettingsModal: React.FC<DriveSettingsModalProps> = ({
  isOpen,
  onClose,
  isDriveConnected,
  onConnectDrive,
}) => {
  const [clientId, setClientId] = useState('');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#121212',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '520px',
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
            padding: '20px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cloud className="w-4 h-4 text-[var(--liverpool)]" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
              Google Drive Storage
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '9999px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Status Box */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FolderSync className="w-4 h-4 text-[var(--liverpool)]" />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#ededed' }}>Drive Folder Hierarchy</p>
                <p style={{ fontSize: '11px', color: '#777777', fontFamily: 'monospace', marginTop: '3px' }}>
                  /Google Drive/NeuronTree/[Category]/
                </p>
              </div>
            </div>
            {isDriveConnected ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399', fontSize: '12px', fontWeight: 500 }}>
                <CheckCircle2 className="w-4 h-4" /> Synced
              </span>
            ) : (
              <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 500 }}>Local IndexedDB</span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px 18px',
              borderRadius: '16px',
              backgroundColor: 'var(--liverpool-subtle)',
              border: '1px solid rgba(200, 16, 46, 0.25)',
              color: '#cccccc',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-[var(--liverpool)] shrink-0" style={{ marginTop: '2px' }} />
            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>
                Safe Recycle Bin & Privacy
              </strong>
              Deleted cards are moved to Google Drive&apos;s native Trash (Recycle Bin). Your inspirations are always recoverable.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#aaaaaa', fontWeight: 500 }}>
              Google OAuth Client ID (Optional for Live OAuth PKCE)
            </label>
            <input
              type="text"
              placeholder="xxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#777777', fontSize: '11px' }}>
            <Info className="w-3.5 h-3.5 text-[var(--liverpool)] shrink-0" />
            <span>High-speed client caching is active via browser IndexedDB.</span>
          </div>

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
              Close
            </button>
            <button
              onClick={() => {
                onConnectDrive();
                onClose();
              }}
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
              }}
            >
              {isDriveConnected ? 'Disconnect' : 'Connect Google Drive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
