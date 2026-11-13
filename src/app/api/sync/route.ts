import { NextResponse } from 'next/server';

interface SyncPayload {
  bundle: any;
  updatedAt: number;
}

// In-memory sync cache for codes (keyed by uppercase 6-character code)
const syncStorage = new Map<string, SyncPayload>();

// Periodic cleanup of codes older than 48 hours
function cleanupExpired() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [code, val] of syncStorage.entries()) {
    if (val.updatedAt < cutoff) {
      syncStorage.delete(code);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    cleanupExpired();

    let code = (body.code || '').trim().toUpperCase();
    if (!code) {
      // Generate random memorable 6-char alphanumeric code (excluding ambiguous 0, O, 1, I)
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      do {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      } while (syncStorage.has(code));
    }

    if (!body.bundle) {
      return NextResponse.json({ error: 'Missing board sync bundle' }, { status: 400 });
    }

    syncStorage.set(code, {
      bundle: body.bundle,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      code,
      message: `Board synced under code ${code}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Code parameter is required' }, { status: 400 });
    }

    const payload = syncStorage.get(code);
    if (!payload) {
      return NextResponse.json({ error: 'Sync code not found or expired. Please generate a fresh code on your other device.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      code,
      bundle: payload.bundle,
      updatedAt: payload.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve synced board' }, { status: 500 });
  }
}
