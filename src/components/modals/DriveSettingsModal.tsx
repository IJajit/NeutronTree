import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, ShieldCheck, FolderSync, Info, X, Loader2, AlertCircle } from 'lucide-react';
import {
  requestGoogleDriveAuth,
  redirectToGoogleOAuth,
  setStoredAccessToken,
  getStoredAccessToken,
} from '@/lib/drive/googleDrive';

interface DriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDriveConnected: boolean;
  onConnectDrive: (connected: boolean) => void;
}

export const DriveSettingsModal: React.FC<DriveSettingsModalProps> = ({
  isOpen,
  onClose,
  isDriveConnected,
  onConnectDrive,
}) => {
  const [clientId, setClientId] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedClientId = localStorage.getItem('gdrive_client_id') || '';
      setClientId(savedClientId);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = () => {
    const trimmedId = clientId.trim();
    if (!trimmedId) {
      setErrorMessage('Please enter your Google OAuth Client ID.');
      return;
    }

    if (trimmedId.startsWith('GOCSPX-')) {
      setErrorMessage('That looks like a Client Secret (starts with GOCSPX-). Please paste the Client ID ending with .apps.googleusercontent.com');
      return;
    }

    if (!trimmedId.endsWith('.apps.googleusercontent.com')) {
      setErrorMessage('Your Client ID must end with .apps.googleusercontent.com (find it in Google Cloud Credentials).');
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);
    localStorage.setItem('gdrive_client_id', trimmedId);

    // Use full direct redirect flow to bypass popup blockers and COOP isolation completely
    redirectToGoogleOAuth(trimmedId);
  };

  const handleDisconnect = () => {
    setStoredAccessToken(null);
    onConnectDrive(false);
    setErrorMessage(null);
  };

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
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Google OAuth Client ID (from Google Cloud Credentials)
            </label>
            <input
              type="text"
              placeholder="123456789-abcdef.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              style={{
                width: '100%',
                backgroundColor: 'var(--input-bg)',
                border: errorMessage ? '1px solid var(--liverpool)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(200, 16, 46, 0.12)',
                border: '1px solid rgba(200, 16, 46, 0.3)',
                color: '#ff6b7e',
                fontSize: '12px',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
            <Info className="w-3.5 h-3.5 text-[var(--liverpool)] shrink-0" />
            <span>Authorized Origin: <code style={{ color: 'var(--text-main)' }}>https://neutrontree.vercel.app</code></span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              onClick={onClose}
              disabled={isAuthenticating}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={isDriveConnected ? handleDisconnect : handleConnect}
              disabled={isAuthenticating}
              style={{
                padding: '9px 22px',
                backgroundColor: isDriveConnected ? 'rgba(255, 255, 255, 0.1)' : 'var(--liverpool)',
                color: '#ffffff',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                boxShadow: isDriveConnected ? 'none' : '0 0 15px var(--liverpool-glow)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isAuthenticating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isDriveConnected ? 'Disconnect' : (isAuthenticating ? 'Authorizing with Google...' : 'Connect Google Drive')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
