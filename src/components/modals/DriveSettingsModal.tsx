import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react';
import {
  requestGoogleDriveAuth,
  redirectToGoogleOAuth,
  setStoredAccessToken,
  getStoredAccessToken,
  DEFAULT_CLIENT_ID,
} from '@/lib/drive/googleDrive';

interface DriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDriveConnected: boolean;
  onConnectDrive: (connected: boolean) => void;
  onManualSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export const DriveSettingsModal: React.FC<DriveSettingsModalProps> = ({
  isOpen,
  onClose,
  isDriveConnected,
  onConnectDrive,
  onManualSync,
  isSyncing,
}) => {
  const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedClientId = localStorage.getItem('gdrive_client_id') || DEFAULT_CLIENT_ID;
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
          {/* Credentials Input with inline Synced / Status pill */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Credentials
              </label>
              {isDriveConnected ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#34d399',
                    fontSize: '11px',
                    fontWeight: 500,
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" /> Synced
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 500,
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  Disconnected
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Google OAuth Client ID"
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
            {isDriveConnected && onManualSync && (
              <button
                onClick={async () => {
                  try {
                    await onManualSync();
                  } catch (e) {
                    console.error(e);
                  }
                }}
                disabled={isSyncing || isAuthenticating}
                style={{
                  padding: '9px 18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSyncing ? 'Syncing...' : 'Sync'}
              </button>
            )}
            <button
              onClick={isDriveConnected ? handleDisconnect : handleConnect}
              disabled={isAuthenticating}
              style={{
                padding: '9px 22px',
                backgroundColor: isDriveConnected ? 'rgba(200, 16, 46, 0.2)' : 'var(--liverpool)',
                color: '#ffffff',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                border: isDriveConnected ? '1px solid rgba(200, 16, 46, 0.4)' : 'none',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                boxShadow: isDriveConnected ? 'none' : '0 0 15px var(--liverpool-glow)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isAuthenticating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isDriveConnected ? 'Disconnect' : (isAuthenticating ? 'Authorizing...' : 'Connect Google Drive')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
