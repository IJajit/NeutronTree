import { BlockNode, Category } from '../types/canvas';

declare global {
  interface Window {
    google?: any;
  }
}

export const DEFAULT_CLIENT_ID = '523293829704-gos7rnsh1997a9ff87jkh9p90qvlmoac.apps.googleusercontent.com';
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
 * Checks URL hash on page load for OAuth redirect response
 */
export function handleOAuthRedirectResponse(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.location.hash) return false;

  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('access_token');
  if (token) {
    setStoredAccessToken(token);
    // Clean up hash from address bar
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }
  return false;
}

/**
 * Direct full-page OAuth redirect (100% reliable, immune to popup blockers & browser isolation)
 */
export function redirectToGoogleOAuth(clientId: string) {
  if (typeof window === 'undefined') return;
  // Strip trailing slashes to guarantee exact match with standard origins
  const redirectUri = window.location.origin.replace(/\/+$/, '');
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId.trim(),
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: DRIVE_FILE_SCOPE,
      include_granted_scopes: 'true',
      prompt: 'consent',
    }).toString();

  window.location.href = authUrl;
}

/**
 * Triggers interactive Google OAuth popup using Google Identity Services
 */
export function requestGoogleDriveAuth(clientId: string): Promise<string> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window not available'));
  }

  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(
      new Error('Google Identity Services script is still loading. Please wait 2 seconds and try again.')
    );
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    // Failsafe timeout after 2 minutes
    const failsafeTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Sign-in timed out. Please try again or check if popups are enabled.'));
      }
    }, 120000);

    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: DRIVE_FILE_SCOPE,
        callback: (response: any) => {
          console.log('GIS token callback received:', response);
          if (resolved) return;
          clearTimeout(failsafeTimeout);

          if (response.error) {
            resolved = true;
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            resolved = true;
            setStoredAccessToken(response.access_token);
            resolve(response.access_token);
          } else {
            resolved = true;
            reject(new Error('No access token received from Google.'));
          }
        },
        error_callback: (err: any) => {
          console.warn('GIS error_callback received:', err);
          if (resolved) return;

          if (err?.type === 'popup_failed_to_open') {
            clearTimeout(failsafeTimeout);
            resolved = true;
            reject(new Error('Popup blocked! Please allow popups for https://neutrontree.vercel.app in your browser address bar.'));
          } else if (err?.type === 'popup_closed') {
            console.log('Popup navigation event received; awaiting consent completion.');
          } else {
            clearTimeout(failsafeTimeout);
            resolved = true;
            reject(new Error(err?.message || 'Google authorization window encountered an error.'));
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      clearTimeout(failsafeTimeout);
      reject(err);
    }
  });
}

/**
 * Board state sync bundle interface
 */
export interface CloudBoardSyncBundle {
  categories: Category[];
  viewport: { x: number; y: number; zoom: number };
  activeCategory: string;
  updatedAt: number;
}

/**
 * Syncs the global board state (categories hierarchy + positions) to Google Drive
 */
export async function syncBoardStateToDrive(bundle: CloudBoardSyncBundle): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const fileName = 'neuron_tree_board_meta.json';
    const content = JSON.stringify(bundle, null, 2);

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const existingId = searchData.files?.[0]?.id;

    if (existingId) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: content,
      });
    } else {
      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify({ name: fileName, mimeType: 'application/json', parents: [rootFolderId] })], {
          type: 'application/json; charset=UTF-8',
        })
      );
      form.append('file', new Blob([content], { type: 'application/json' }), fileName);
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    }
  } catch (err) {
    console.warn('Error saving board state to Drive:', err);
  }
}

/**
 * Pulls the global board state (categories hierarchy + positions) from Google Drive
 */
export async function pullBoardStateFromDrive(): Promise<CloudBoardSyncBundle | null> {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = 'neuron_tree_board_meta.json' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
    if (fileId) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return (await res.json()) as CloudBoardSyncBundle;
      }
    }
    return null;
  } catch (err) {
    console.warn('Error pulling board state from Drive:', err);
    return null;
  }
}

/**
 * Pulls all blocks saved in Google Drive into local browser storage
 */
export async function pullNodesFromGoogleDrive(): Promise<BlockNode[]> {
  const token = getStoredAccessToken();
  if (!token) return [];

  try {
    // 1. Search for all .json block state files in Google Drive created by this app (.json files ending with .json)
    const query = `mimeType = 'application/json' and name contains '.json' and name != 'neuron_tree_board_meta.json' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=500`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchRes.json();
    const files = searchData.files || [];
    const pulledNodes: BlockNode[] = [];

    for (const file of files) {
      try {
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fileRes.ok) {
          const nodeData = await fileRes.json();
          if (nodeData && nodeData.id && nodeData.type) {
            pulledNodes.push(nodeData);
          }
        }
      } catch (err) {
        console.warn(`Failed to read Drive file ${file.name}:`, err);
      }
    }

    return pulledNodes;
  } catch (err) {
    console.warn('Failed to pull nodes from Google Drive:', err);
    return [];
  }
}
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
 * Helper to upload raw binary data (image, pdf) or text/shortcut to Google Drive
 */
async function uploadMediaFileToDrive(
  fileName: string,
  mimeType: string,
  blobOrText: Blob | string,
  parentFolderId: string,
  token: string
): Promise<string | null> {
  try {
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [parentFolderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }));
    if (typeof blobOrText === 'string') {
      form.append('file', new Blob([blobOrText], { type: mimeType }), fileName);
    } else {
      form.append('file', blobOrText, fileName);
    }

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    const uploadData = await uploadRes.json();
    return uploadData.id || null;
  } catch (err) {
    console.warn('Error uploading media asset to Drive:', err);
    return null;
  }
}

/**
 * Converts a base64 Data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
    const bstr = atob(parts[1] || parts[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([dataUrl], { type: fallbackMime });
  }
}

/**
 * Uploads or updates a node block inside /NeuronTree/[Category]/
 * Creates direct accessible human files (Images, PDFs, .url Shortcuts, .md Notes)
 * along with the companion index JSON for canvas reconstruction.
 */
export async function syncNodeToGoogleDrive(node: BlockNode): Promise<string | null> {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const categoryFolderId = await getOrCreateDriveFolder(node.category || 'general', rootFolderId);

    // 1. Upload the real, accessible user asset (Images, PDFs, Links, Markdown Notes)
    const cleanTitle = (node.data.title || node.id).replace(/[\\/:*?"<>|]/g, '_').trim();

    if (node.type === 'image') {
      let imgBlob: Blob | null = null;
      const imgExt = (node.data.mimeType || 'image/png').split('/')[1] || 'png';
      const userFileName = node.data.fileName || `${cleanTitle}.${imgExt}`;

      if (node.data.thumbnailUrl?.startsWith('data:')) {
        imgBlob = dataUrlToBlob(node.data.thumbnailUrl, node.data.mimeType || 'image/png');
      } else if (node.data.thumbnailUrl?.startsWith('http')) {
        try {
          const fetchImg = await fetch(node.data.thumbnailUrl);
          if (fetchImg.ok) {
            imgBlob = await fetchImg.blob();
          }
        } catch (e) {
          console.warn('Could not fetch external image directly:', e);
        }
      }

      if (imgBlob) {
        await uploadMediaFileToDrive(userFileName, node.data.mimeType || 'image/png', imgBlob, categoryFolderId, token);
      }
    } else if (node.type === 'document') {
      const userFileName = node.data.fileName || `${cleanTitle}.pdf`;
      let docBlob: Blob | null = null;
      if (node.data.rawFileBase64?.startsWith('data:')) {
        docBlob = dataUrlToBlob(node.data.rawFileBase64, node.data.mimeType || 'application/pdf');
      } else {
        docBlob = new Blob([node.data.description || ''], { type: 'text/plain' });
      }
      await uploadMediaFileToDrive(userFileName, node.data.mimeType || 'application/pdf', docBlob, categoryFolderId, token);
    } else if (node.type === 'link' && node.data.url) {
      // Create clickable Internet Shortcut (.url file) that directly opens in browsers
      const urlShortcutContent = `[InternetShortcut]\r\nURL=${node.data.url}\r\n`;
      const shortcutFileName = `${cleanTitle}.url`;
      await uploadMediaFileToDrive(shortcutFileName, 'text/plain', urlShortcutContent, categoryFolderId, token);
    } else if (node.type === 'note') {
      // Create readable Markdown document
      const noteContent = `# ${node.data.title || 'Note'}\r\n\r\n${node.data.content || ''}\r\n`;
      const noteFileName = `${cleanTitle}.md`;
      await uploadMediaFileToDrive(noteFileName, 'text/markdown', noteContent, categoryFolderId, token);
    }

    // 2. Upload canvas coordinate state JSON
    const fileName = `${node.id}.json`;
    const fileContent = JSON.stringify(node, null, 2);

    // Check if JSON exists in category folder
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
      const form = new FormData();
      form.append(
        'metadata',
        new Blob(
          [JSON.stringify({ name: fileName, mimeType: 'application/json', parents: [categoryFolderId] })],
          { type: 'application/json; charset=UTF-8' }
        )
      );
      form.append('file', new Blob([fileContent], { type: 'application/json' }), fileName);

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
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
 * Moves a node file and its associated media asset to native Google Drive Trash (Recycle Bin)
 */
export async function trashNodeOnGoogleDrive(nodeId: string, nodeTitle?: string): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return false;

  try {
    const cleanTitle = (nodeTitle || '').replace(/[\\/:*?"<>|]/g, '_').trim();
    const queryParts = [`name contains '${nodeId}'`];
    if (cleanTitle) {
      queryParts.push(`name contains '${cleanTitle}'`);
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `(${queryParts.join(' or ')}) and trashed = false`
      )}&fields=files(id, name)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchRes.json();
    const files = searchData.files || [];

    for (const file of files) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });
    }

    return files.length > 0;
  } catch (err) {
    console.warn('Google Drive trash error:', err);
    return false;
  }
}

/**
 * Moves all files associated with a category to a new category folder or trashes the folder
 */
export async function moveCategoryOnGoogleDrive(oldCategoryName: string, newCategoryName: string): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const oldFolderId = await getOrCreateDriveFolder(oldCategoryName, rootFolderId);
    // Rename old folder
    await fetch(`https://www.googleapis.com/drive/v3/files/${oldFolderId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newCategoryName }),
    });
  } catch (err) {
    console.warn('Google Drive category rename error:', err);
  }
}

/**
 * Trashes a category folder and its contents on Google Drive
 */
export async function trashCategoryOnGoogleDrive(categoryName: string): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${categoryName}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const folderId = searchData.files?.[0]?.id;
    if (folderId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });
    }
  } catch (err) {
    console.warn('Google Drive trash category error:', err);
  }
}
