import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let urlObj: URL;
    try {
      urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const response = await fetch(urlObj.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return NextResponse.json({
        title: urlObj.hostname,
        url: urlObj.toString(),
        description: '',
        favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
      });
    }

    const html = await response.text();

    const getMetaContent = (nameOrProp: string) => {
      const regex = new RegExp(`<meta[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match && match[1]) return match[1];
      const reversedRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["']`, 'i');
      const matchRev = html.match(reversedRegex);
      return matchRev ? matchRev[1] : null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = getMetaContent('og:title') || getMetaContent('twitter:title') || (titleMatch ? titleMatch[1].trim() : urlObj.hostname);
    const description = getMetaContent('og:description') || getMetaContent('description') || getMetaContent('twitter:description') || '';
    let image = getMetaContent('og:image') || getMetaContent('twitter:image') || '';

    if (image && !image.startsWith('http')) {
      image = new URL(image, urlObj.origin).toString();
    }

    return NextResponse.json({
      title,
      description,
      image,
      url: urlObj.toString(),
      hostname: urlObj.hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
    });
  } catch {
    return NextResponse.json({
      title: targetUrl,
      url: targetUrl,
      description: '',
      favicon: '',
    });
  }
}
