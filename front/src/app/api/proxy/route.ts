import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // URL 쿼리 파라미터에서 대상 URL 가져오기
  const urlParam = request.nextUrl.searchParams.get('url');
  
  if (!urlParam) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  let url: string = urlParam;

  try {
    const baseUrl = new URL(url).origin;
    const isWikimedia = url.includes('wikimedia.org');
    const isGoogle = url.includes('google.com') || url.includes('google.co.');
    
    // 🔥 구글 URL인 경우 미국 지역 설정 파라미터 추가
    if (isGoogle) {
      const urlObj = new URL(url);
      // 이미 gl 또는 hl 파라미터가 없는 경우에만 추가
      if (!urlObj.searchParams.has('gl')) {
        urlObj.searchParams.set('gl', 'us'); // 지역을 미국으로 설정
      }
      if (!urlObj.searchParams.has('hl')) {
        urlObj.searchParams.set('hl', 'en'); // 언어를 영어로 설정
      }
      url = urlObj.toString();
      console.log('Modified Google URL for US region:', url);
    }
    
    // 🔥 구글 및 위키미디어에 대한 헤더 설정
    const fetchOptions: RequestInit = {
      headers: {
        // 기본 헤더들
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        
        ...(isGoogle ? {
          // 🔥 구글에 대한 미국 기반 헤더들
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.google.com/',
          'DNT': '1', // Do Not Track
          'Upgrade-Insecure-Requests': '1',
        } : isWikimedia ? {
          // 위키미디어에 대한 기존 설정 유지
          'Referer': 'https://wikipedia.org',
          'User-Agent': 'Mozilla/5.0 (compatible; WikipediaViewer/1.0)'
        } : {
          // 기타 사이트에 대한 기본 헤더
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
      }
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