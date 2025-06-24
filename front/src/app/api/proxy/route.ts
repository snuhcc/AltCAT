import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // URL 쿼리 파라미터에서 대상 URL 가져오기
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const baseUrl = new URL(url).origin;
    const isWikimedia = url.includes('wikimedia.org');
    
    // 위키미디어 이미지인 경우에만 특별한 헤더 추가
    const fetchOptions: RequestInit = {
      headers: isWikimedia ? {
        'Referer': 'https://wikipedia.org',
        'User-Agent': 'Mozilla/5.0 (compatible; WikipediaViewer/1.0)'
      } : {}
    };
    
    // 대상 URL에서 콘텐츠 가져오기
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || 'text/html';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // 더 유연한 이미지 태그 매칭을 위한 정규식
      const imgRegex = /<img\s+([^>]*?)src\s*=\s*(['"])(\/\/[^'"]+)\2([^>]*?)>/g;
      const rootImgRegex = /<img\s+([^>]*?)src\s*=\s*(['"])(\/[^'"]+)\2([^>]*?)>/g;
      const relativeImgRegex = /<img\s+([^>]*?)src\s*=\s*(['"])([^'"]+)\2([^>]*?)>/g;
      
      // 프로토콜 상대 경로 처리 (//로 시작하는 URL)
      html = html.replace(imgRegex, (match, pre, quote, src, post) => {
        const imgUrl = `https:${src}`;
        if (src.includes('wikimedia.org')) {
          return `<img ${pre}src=${quote}/api/proxy?url=${encodeURIComponent(imgUrl)}${quote}${post}>`;
        }
        return `<img ${pre}src=${quote}${imgUrl}${quote}${post}>`;
      });
      
      // 루트 상대 경로 처리 (/로 시작하는 URL)
      html = html.replace(rootImgRegex, (match, pre, quote, src, post) => {
        return `<img ${pre}src=${quote}${baseUrl}${src}${quote}${post}>`;
      });
      
      // 일반 상대 경로 및 절대 경로 처리
      html = html.replace(relativeImgRegex, (match, pre, quote, src, post) => {
        if (src.startsWith('http') || src.startsWith('https') || src.startsWith('data:')) {
          if (src.includes('wikimedia.org')) {
            return `<img ${pre}src=${quote}/api/proxy?url=${encodeURIComponent(src)}${quote}${post}>`;
          }
          return match;
        }
        return `<img ${pre}src=${quote}${new URL(src, url).href}${quote}${post}>`;
      });

      // base 태그 추가 및 CSP 헤더 수정
      html = html.replace(/<head>/i, `
        <head>
        <base href="${url}">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data: blob: 'unsafe-inline';">
      `);
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          // X-Frame-Options 및 CSP 헤더 제거/수정
          'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data: blob: 'unsafe-inline'",
        }
      });
    } else {
      // HTML이 아닌 경우(이미지, CSS, JS 등) 원본 그대로 반환
      const blob = await response.blob();
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };

      // 위키미디어 이미지인 경우 캐시 제어 헤더 추가
      if (isWikimedia) {
        headers['Cache-Control'] = 'no-store';
      }

      return new NextResponse(blob, { headers });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
} 