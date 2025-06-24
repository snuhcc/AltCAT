'use client';

import React, { useCallback, useState, useEffect } from 'react';
import ImageCard from './ImageCard';
import { ParsedImage } from '../types';

interface MainContentProps {
  parsedImages: ParsedImage[];
  currentLanguage?: string;
  updateImageAlt: (
    id: number,
    field:
      | 'previous_alt_text'
      | 'ai_generated_alt_text'
      | 'ai_modified_alt_text'
      | 'customized_alt_text'
      | 'culture_aware_alt_text'
      | 'image_type',
    value: string
  ) => void;
  currentUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;

  downloadedHtml: string;
  setParsedImagesMap: React.Dispatch<React.SetStateAction<any>>;
}

export default function MainContent({
  parsedImages,
  currentLanguage,
  updateImageAlt,
  currentUrl,
  loading,
  setLoading,
  downloadedHtml,
  setParsedImagesMap
}: MainContentProps) {
  const [randomQuote, setRandomQuote] = useState<string>('');

  useEffect(() => {
    const quotes = [
      "The only limit to our realization of tomorrow is our doubts of today.\n- Franklin D. Roosevelt",
      "Success is not final, failure is not fatal: It is the courage to continue that counts.\n- Winston Churchill",
      "It does not matter how slowly you go as long as you do not stop.\n- Confucius",
      "In the middle of every difficulty lies opportunity.\n- Albert Einstein",
      "Your time is limited, so don't waste it living someone else's life.\n- Steve Jobs",
      "Life is what happens when you're busy making other plans.\n- John Lennon",
      "Do what you can, with what you have, where you are.\n- Theodore Roosevelt",
      "Believe you can and you're halfway there.\n- Theodore Roosevelt",
      "The best way to predict the future is to create it.\n- Peter Drucker",
      "Happiness is not something ready-made. It comes from your own actions.\n- Dalai Lama",
    ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    setRandomQuote(quote);
  }, []); // 컴포넌트 마운트 시에만 실행

  const formattedQuote = randomQuote.split('\n').map((line, index) => (
    <React.Fragment key={index}>
      {line}
      <br />
    </React.Fragment>
  ));

  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  
  // 프록시 URL 생성
  const getProxyUrl = (url: string) => {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  // iframe 로딩 상태 변경 핸들러
  const handleIframeLoad = () => {
    setIframeLoading(false);
  };

  const handleIframeError = () => {
    setIframeError(true);
    setIframeLoading(false);
  };

  // 다운로드 로직 (동일)
  const handleDownloadHtml = useCallback(() => {
    if (!downloadedHtml) {
      alert('HTML이 없습니다.');
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(downloadedHtml, 'text/html');

    parsedImages.forEach((img) => {
      const { image_url, customized_alt_text, previous_alt_text } = img;
      const newAlt = customized_alt_text?.trim() || previous_alt_text?.trim() || '';
      const targetImg = doc.querySelector(`img[src="${image_url}"]`);
      if (targetImg) {
        targetImg.setAttribute('alt', newAlt);
      } else {
        console.error('Image not found:', image_url);
      }
    });

    const updatedHtml = doc.documentElement.outerHTML;

    setParsedImagesMap((prev: any) => {
      if (!prev[currentUrl]) return prev;
      return {
        ...prev,
        [currentUrl]: {
          ...prev[currentUrl],
          htmlCode: updatedHtml,
        },
      };
    });

    const blob = new Blob([updatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'updated_page.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [downloadedHtml, parsedImages, setParsedImagesMap, currentUrl]);

  return (
    <div className="flex flex-1 bg-gradient-to-r from-gray-100 to-gray-200">
      {/* Left Side */}
      <div className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        {/** 
         *  loading === true 이거나, parsedImages.length === 0 이면 
         *  동일한 로딩 영역을 보여준다. 
         */}
        {(loading || parsedImages.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl shadow-lg p-8">
            <div className="loader animate-spin rounded-full border-8 border-blue-400 border-t-transparent w-24 h-24 mb-6"></div>
            <p className="text-gray-700 text-lg text-center italic">{formattedQuote}</p>
            {/* 
              로딩이 끝났는데도 0개라면 "No images available" 문구를 추가. 
              ※ 필요 없다면 제거 가능
            */}
            {!loading && parsedImages.length === 0 && (
              <p className="text-gray-500 text-center text-2xl mt-4">
              </p>
            )}
          </div>
        ) : (
          // 로딩이 끝났고, 이미지 배열도 1개 이상인 경우 => ImageCard 렌더
          parsedImages.map((parsedImage) => (
            <ImageCard
              key={parsedImage.id}
              image={parsedImage}
              updateImageAlt={updateImageAlt}
              currentLanguage={currentLanguage}
            />
          ))
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-300 hidden md:block"></div>

      {/* Right Side (Live Preview) */}
      <div className="w-full md:w-1/2 bg-white relative">
        <div className="absolute inset-0 p-4 flex flex-col">
          {/* 헤더 라인: Live Preview + Download Updated HTML 버튼 */}
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              Live Preview
            </h2>
            <button
              onClick={handleDownloadHtml}
              className={`
                py-2 px-4
                border-2 border-blue-500
                text-blue-500 bg-blue-100
                rounded-md shadow-md
                hover:bg-blue-500 hover:text-white
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-300
              `}
            >
              Download Updated HTML
            </button>
          </div>

          {/* 리버스 프록시로 로드되는 iframe */}
          <div className="flex-1 bg-gray-100 rounded-lg shadow-md overflow-hidden relative">
            {/* 로딩 인디케이터 */}
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                <div className="loader animate-spin rounded-full border-8 border-blue-400 border-t-transparent w-16 h-16"></div>
              </div>
            )}
            
            {/* 에러 메시지 */}
            {iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white z-10">
                <div className="text-red-600 bg-red-100 p-4 rounded-lg shadow-md max-w-md">
                  <p className="font-semibold">프리뷰를 로드할 수 없습니다</p>
                  <p className="text-sm mt-2">
                    웹사이트 콘텐츠를 가져오는 중 오류가 발생했습니다.
                  </p>
                  <p className="text-xs mt-2 italic">
                    URL: {currentUrl}
                  </p>
                  <button 
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md text-sm"
                    onClick={() => {
                      setIframeLoading(true);
                      setIframeError(false);
                    }}
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            )}
            
            {/* iframe - 리버스 프록시 URL로 로드 */}
            <iframe
              src={getProxyUrl(currentUrl)}
              title={currentUrl}
              className="w-full h-full rounded-lg"
              style={{
                transform: 'scale(0.95)',
                transformOrigin: '0 0',
                width: '105%',
                height: '105%',
              }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}