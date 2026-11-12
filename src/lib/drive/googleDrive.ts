import { BlockNode } from '../types/canvas';

declare global {
  interface Window {
    google?: any;
  }
}

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let tokenClient: any = null;
let activeAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return activeAccessToken || localStorage.getItem('gdrive_access_token');
}

export function setStoredAccessToken(token: string | null) {
  activeAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('gdrive_access_token', token);
    } else {
      localStorage.removeItem('gdrive_access_token');
    }
  }
}

/**
 * Loads Google Identity Services client script dynamically
 */
export async function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Triggers interactive Google OAuth popup using Google Identity Services
 */
export async function requestGoogleDriveAuth(clientId: string): Promise<string> {
  await loadGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK failed to load. Please check your internet connection or ad blocker.');
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: DRIVE_FILE_SCOPE,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            setStoredAccessToken(response.access_token);
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received from Google.'));
          }
        },
        error_callback: (err: any) => {
          if (err?.type === 'popup_failed_to_open') {
            reject(new Error('Popup blocked! Please allow popups for https://neutrontree.vercel.app in your browser address bar.'));
          } else if (err?.type === 'popup_closed') {
            reject(new Error('Sign-in cancelled. Popup was closed before authorization.'));
          } else {
            reject(new Error(err?.message || 'Google authorization window encountered an error.'));
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Finds or creates a folder in Google Drive
 */
async function getOrCreateDriveFolder(folderName: string, parentId?: string): Promise<string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Missing Google Drive access token');

  // Search if folder already exists
  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Uploads or updates a node block JSON inside /NeuronTree/[Category]/
 */
export async function syncNodeToGoogleDrive(node: BlockNode): Promise<string | null> {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const categoryFolderId = await getOrCreateDriveFolder(node.category || 'general', rootFolderId);

    const fileName = `${node.id}.json`;
    const fileContent = JSON.stringify(node, null, 2);

    // Check if file exists in category folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and '${categoryFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchRes.json();
    const existingFileId = searchData.files?.[0]?.id;

    if (existingFileId) {
      // Update existing file content
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: fileContent,
        }
      );
      return existingFileId;
    } else {
      // Create multipart file upload
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [categoryFolderId],
      };

      const boundary = 'foo_bar_baz_delimiter';
      const multipartBody =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        fileContent +
        `\r\n--${boundary}--`;

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      const uploadData = await uploadRes.json();
      return uploadData.id;
    }
  } catch (err) {
    console.warn('Google Drive sync error:', err);
    return null;
  }
}

/**
 * Moves a node file to native Google Drive Trash (Recycle Bin)
 */
export async function trashNodeOnGoogleDrive(nodeId: string): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return false;

  try {
    const fileName = `${nodeId}.json`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and trashed = false`
      )}&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
    if (fileId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Google Drive trash error:', err);
    return false;
  }
}
