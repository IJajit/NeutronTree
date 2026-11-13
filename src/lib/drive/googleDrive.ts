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
type AuthErrorHandler = () => void;
let onAuthErrorCallback: AuthErrorHandler | null = null;

export function setAuthErrorHandler(callback: AuthErrorHandler | null) {
  onAuthErrorCallback = callback;
}

export function handleAuthError() {
  setStoredAccessToken(null);
  if (onAuthErrorCallback) {
    onAuthErrorCallback();
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    console.warn('Google Drive OAuth access token expired (401 Unauthorized)');
    handleAuthError();
  }
  return res;
}

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

    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const existingId = searchData.files?.[0]?.id;

    if (existingId) {
      await authenticatedFetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
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
      await authenticatedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
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
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = 'neuron_tree_board_meta.json' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
    if (fileId) {
      const res = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
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
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=500`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const files = searchData.files || [];
    const pulledNodesMap = new Map<string, BlockNode>();

    for (const file of files) {
      try {
        const fileRes = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fileRes.ok) {
          const nodeData = await fileRes.json();
          if (nodeData && nodeData.id && nodeData.type) {
            // Deduplicate by node ID, preferring higher updatedAt timestamp
            const existing = pulledNodesMap.get(nodeData.id);
            if (!existing || (nodeData.updatedAt || 0) >= (existing.updatedAt || 0)) {
              pulledNodesMap.set(nodeData.id, nodeData);
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to read Drive file ${file.name}:`, err);
      }
    }

    return Array.from(pulledNodesMap.values());
  } catch (err) {
    console.warn('Failed to pull nodes from Google Drive:', err);
    return [];
  }
}
// In-memory cache for folder IDs to minimize Drive API roundtrips
const folderIdCache = new Map<string, string>();

export function clearFolderIdCache() {
  folderIdCache.clear();
}

async function getOrCreateDriveFolder(folderName: string, parentId?: string): Promise<string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Missing Google Drive access token');

  const cacheKey = `${parentId || 'root'}:${folderName}`;
  if (folderIdCache.has(cacheKey)) {
    return folderIdCache.get(cacheKey)!;
  }

  // Search if folder already exists
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await authenticatedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      folderIdCache.set(cacheKey, searchData.files[0].id);
      return searchData.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await authenticatedFetch('https://www.googleapis.com/drive/v3/files', {
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

  if (createRes.ok) {
    const createData = await createRes.json();
    if (createData.id) {
      folderIdCache.set(cacheKey, createData.id);
      return createData.id;
    }
  }

  return '';
}

/**
 * Helper to upload raw binary data (image, pdf) or text/shortcut to Google Drive
 * Cleans up any duplicate/old files with the same name across NeuronTree folders before uploading
 */
async function uploadMediaFileToDrive(
  fileName: string,
  mimeType: string,
  blobOrText: Blob | string,
  parentFolderId: string,
  token: string
): Promise<string | null> {
  try {
    // Check if a file with this name already exists in target folder or across other categories
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and trashed = false`
      )}&fields=files(id, parents)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const existingFiles: Array<{ id: string; parents?: string[] }> = searchData.files || [];

    // If an existing file is already in the target folder, update it in place
    const matchingInTarget = existingFiles.find((f) => f.parents?.includes(parentFolderId));
    if (matchingInTarget) {
      if (typeof blobOrText === 'string') {
        await authenticatedFetch(
          `https://www.googleapis.com/upload/drive/v3/files/${matchingInTarget.id}?uploadType=media`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
            body: blobOrText,
          }
        );
      }
      return matchingInTarget.id;
    }

    // If it exists in a different folder (e.g. card changed category), trash the old duplicate
    for (const oldFile of existingFiles) {
      await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${oldFile.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
    }

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

    const uploadRes = await authenticatedFetch(
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
 * Resolves the Google Drive folder ID for a category, supporting nested hierarchy
 * (e.g. NeuronTree/Resources/Animation).
 * If the category is a subcategory, it ensures the parent folder exists directly inside NeuronTree,
 * and creates the subcategory folder nested inside that parent folder.
 * Root of NeuronTree will ONLY contain top-level parent categories.
 */
export async function getCategoryDriveFolder(
  categoryIdOrName: string,
  categories?: Category[]
): Promise<string> {
  const rootFolderId = await getOrCreateDriveFolder('NeuronTree');

  // If no categories list provided, check if it's already a clean top-level name
  if (!categories || categories.length === 0) {
    const cleanName = categoryIdOrName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'General';
    return await getOrCreateDriveFolder(cleanName, rootFolderId);
  }

  // 1. Try to match by ID first, then by name
  const catObj = categories.find((c) => c.id === categoryIdOrName) ||
                 categories.find((c) => c.name.toLowerCase() === categoryIdOrName.toLowerCase());

  if (!catObj) {
    const cleanName = categoryIdOrName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'General';
    return await getOrCreateDriveFolder(cleanName, rootFolderId);
  }

  // If this category is a subcategory (has parentId)
  if (catObj.parentId) {
    const parentCat = categories.find((c) => c.id === catObj.parentId);
    const parentName = (parentCat?.name || catObj.parentId).replace(/[\\/:*?"<>|]/g, '_').trim();
    // 1. Ensure parent folder exists inside NeuronTree
    const parentFolderId = await getOrCreateDriveFolder(parentName, rootFolderId);
    // 2. Ensure subcategory folder exists inside the parent folder (nested!)
    const subName = catObj.name.replace(/[\\/:*?"<>|]/g, '_').trim();
    return await getOrCreateDriveFolder(subName, parentFolderId);
  }

  // Top-level category folder directly inside NeuronTree
  const topName = catObj.name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return await getOrCreateDriveFolder(topName, rootFolderId);
}

/**
 * Uploads or updates a node block inside /NeuronTree/[ParentCategory]/[Subcategory]/
 * Creates direct accessible human files (Images, PDFs, .url Shortcuts, .md Notes)
 * along with the companion index JSON for canvas reconstruction.
 * Automatically removes any duplicate files in other categories to prevent duplicates.
 */
export async function syncNodeToGoogleDrive(
  node: BlockNode,
  categories?: Category[] | string
): Promise<string | null> {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    let categoryFolderId: string;
    if (Array.isArray(categories)) {
      categoryFolderId = await getCategoryDriveFolder(node.category, categories);
    } else if (typeof categories === 'string') {
      const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
      categoryFolderId = await getOrCreateDriveFolder(categories, rootFolderId);
    } else {
      const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
      categoryFolderId = await getOrCreateDriveFolder(node.category || 'General', rootFolderId);
    }

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
          // Use 2.5s abort timeout so unreachable/slow external links or CORS issues never stall sync
          const fetchImg = await fetch(node.data.thumbnailUrl, {
            signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined,
          });
          if (fetchImg.ok) {
            imgBlob = await fetchImg.blob();
          }
        } catch {
          // Ignore external image download errors (preview images hosted on external CDN)
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

    // 2. Upload canvas coordinate state JSON directly to the target category folder
    const fileName = `${node.id}.json`;
    const fileContent = JSON.stringify(node, null, 2);

    // Check directly inside target category folder
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${fileName}' and '${categoryFolderId}' in parents and trashed = false`
      )}&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    let existingId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      existingId = searchData.files?.[0]?.id || null;
    }

    if (existingId) {
      // Update existing file content in place
      await authenticatedFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: fileContent,
        }
      );
      return existingId;
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

      const uploadRes = await authenticatedFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        return uploadData.id || null;
      }
      return null;
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

    const searchRes = await authenticatedFetch(
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
      await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
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
 * Renames a category folder on Google Drive and updates the board meta file
 */
export async function renameCategoryOnGoogleDrive(
  oldName: string,
  newName: string,
  parentId?: string,
  categories?: Category[]
): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');
    let parentFolderId = rootFolderId;

    if (parentId && categories) {
      const parentCat = categories.find((c) => c.id === parentId);
      if (parentCat) {
        parentFolderId = await getOrCreateDriveFolder(parentCat.name.replace(/[\\/:*?"<>|]/g, '_').trim(), rootFolderId);
      }
    }

    // Search for existing folder with oldName
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${oldName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const folderId = searchData.files?.[0]?.id;
      if (folderId) {
        await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName.replace(/[\\/:*?"<>|]/g, '_').trim() }),
        });
      }
    }

    // Clear folder cache so subsequent operations use the updated folder
    clearFolderIdCache();
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
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${categoryName}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const folderId = searchData.files?.[0]?.id;
    if (folderId) {
      await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
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

/**
 * Clean wipe of all files/folders inside /NeuronTree/ on Google Drive to eliminate
 * any orphaned folders (e.g. legacy 'general') or duplicated assets from prior sessions,
 * then cleanly push the current board state and all active blocks.
 * Runs in parallel batches with caching so it finishes in a few seconds without hanging.
 */
export async function cleanWipeAndResyncDrive(nodes: BlockNode[], bundle: CloudBoardSyncBundle): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) return;

  // Clear in-memory folder cache to ensure fresh hierarchy
  clearFolderIdCache();

  try {
    const rootFolderId = await getOrCreateDriveFolder('NeuronTree');

    // 1. Fetch all items (folders, json, media assets) directly inside NeuronTree
    const searchRes = await authenticatedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id, name)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const files: Array<{ id: string; name: string }> = searchData.files || [];

      // Trash all old/orphan contents in root folder in parallel chunks of 10
      const chunkSize = 10;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.allSettled(
          chunk.map((file) =>
            authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ trashed: true }),
            })
          )
        );
      }
    }

    // 2. Resync clean meta board state
    await syncBoardStateToDrive(bundle);

    // 3. Pre-create category and subcategory folders so nodes don't race creating them
    if (bundle.categories && bundle.categories.length > 0) {
      // Create parent categories first
      const parents = bundle.categories.filter((c) => !c.parentId);
      for (const parent of parents) {
        await getCategoryDriveFolder(parent.id, bundle.categories);
      }
      // Create subcategories next
      const children = bundle.categories.filter((c) => !!c.parentId);
      for (const child of children) {
        await getCategoryDriveFolder(child.id, bundle.categories);
      }
    }

    // 4. Resync all current nodes in parallel chunks of 4
    const nodeChunkSize = 4;
    for (let i = 0; i < nodes.length; i += nodeChunkSize) {
      const chunk = nodes.slice(i, i + nodeChunkSize);
      await Promise.allSettled(
        chunk.map((node) => syncNodeToGoogleDrive(node, bundle.categories))
      );
    }
  } catch (err) {
    console.warn('Error during clean wipe & resync of Google Drive:', err);
  }
}
