'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode, URLMappingUtils } from '../urlMappings';

interface TopBarProps {
  currentUrl: string;
  currentLanguage: LanguageCode;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onLanguageChange: (languageCode: LanguageCode) => void;
}

// 🚫 더 이상 사용하지 않음 - urlMappings의 지원 언어 목록을 동적으로 가져옴
// const languages = [
//   { code: 'en', flag: '🇺🇸', name: 'EN' },
//   { code: 'ko', flag: '🇰🇷', name: 'KR' },
//   { code: 'zh', flag: '🇨🇳', name: 'CN' },
//   { code: 'es', flag: '🇪🇸', name: 'ES' }
// ];

// 동적 언어 정보 생성을 위한 매핑
const languageInfo = {
  en: { flag: '🇺🇸', name: 'EN' },
  ko: { flag: '🇰🇷', name: 'KR' },
  zh: { flag: '🇨🇳', name: 'CN' },
  es: { flag: '🇪🇸', name: 'ES' }
};

// 모든 언어 목록 (표시용)
const allLanguages = [
  { code: 'en' as LanguageCode, ...languageInfo.en },
  { code: 'ko' as LanguageCode, ...languageInfo.ko },
  { code: 'zh' as LanguageCode, ...languageInfo.zh },
  { code: 'es' as LanguageCode, ...languageInfo.es }
];

export default function TopBar({ currentUrl, currentLanguage, onUrlChange, onSubmit, onLanguageChange }: TopBarProps) {
  const [inputValue, setInputValue] = useState<string>(currentUrl);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<LanguageCode[]>(['en']); // 기본값으로 영어만
  const [pendingLanguage, setPendingLanguage] = useState<LanguageCode | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 지원 언어 목록 가져오기
  useEffect(() => {
    const fetchSupportedLanguages = async () => {
      try {
        const baseUrl = URLMappingUtils.extractBaseUrl(currentUrl);
        const supported = await URLMappingUtils.getSupportedLanguages(baseUrl);
        setSupportedLanguages(supported);
      } catch (error) {
        console.error('Failed to fetch supported languages:', error);
        setSupportedLanguages(['en']); // fallback
      }
    };

    fetchSupportedLanguages();
  }, [currentUrl]);

  // 현재 선택된 언어 정보 가져오기 (pendingLanguage가 있으면 우선 표시)
  const displayLanguage = pendingLanguage || currentLanguage;
  const selectedLanguageInfo = languageInfo[displayLanguage] || languageInfo.en;

  // 🚫 더 이상 사용하지 않음 - 지원되는 언어만 표시
  // const availableLanguages = supportedLanguages.map(code => ({
  //   code,
  //   ...languageInfo[code]
  // }));

  // 🚫 더 이상 사용하지 않음 - 하드코딩된 언어 배열에서 찾기
  // const selectedLanguage = languages.find(lang => lang.code === currentLanguage) || languages[0];

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // currentUrl이 변경되면 inputValue 동기화
  useEffect(() => {
    setInputValue(currentUrl);
  }, [currentUrl]);

  // currentLanguage가 변경되면 pendingLanguage 초기화
  useEffect(() => {
    setPendingLanguage(null);
  }, [currentLanguage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmedValue = inputValue.trim();
      if (trimmedValue) {
        onUrlChange(trimmedValue);
        onSubmit(trimmedValue);
        
        // pending된 언어가 있으면 함께 적용
        if (pendingLanguage) {
          onLanguageChange(pendingLanguage);
          setPendingLanguage(null);
        }
      }
    }
  };

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onUrlChange(trimmedValue);
      onSubmit(trimmedValue);
      
      // pending된 언어가 있으면 함께 적용
      if (pendingLanguage) {
        onLanguageChange(pendingLanguage);
        setPendingLanguage(null);
      }
    }
  };

  const handleLanguageSelect = (language: typeof allLanguages[0]) => {
    setIsLanguageDropdownOpen(false);
    console.log('Selected language (pending):', language.code);
    setPendingLanguage(language.code as LanguageCode); // 즉시 적용하지 않고 pending 상태로 설정
  };

  // 🚫 더 이상 사용하지 않을 수 있음 - 지원되지 않는 언어 선택 시 처리 로직
  // if (!supportedLanguages.includes(currentLanguage)) {
  //   // 이 로직은 위의 useEffect에서 처리됨
  // }

  const searchIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );

  const arrowRightIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5 text-white ml-2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
      />
    </svg>
  );

  const chevronDownIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4 text-gray-600"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );

  return (
    <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-gray-100 shadow-inner">
      <div className="flex items-start gap-2 mb-4 md:mb-0 flex-1 min-w-0">
        <span className="text-gray-800 text-lg font-semibold whitespace-nowrap">
          Current Website:
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-500 text-lg font-semibold break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-all'
            }}
            title={currentUrl}
          >
            {currentUrl}
          </a>
        </div>
      </div>

      <div className="flex w-full md:w-auto items-center space-x-2">
        {/* 언어 선택 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <span className="text-lg">{selectedLanguageInfo.flag}</span>
            <span className="text-sm font-medium text-gray-700">{selectedLanguageInfo.name}</span>
            {chevronDownIcon}
          </button>

          {/* 드롭다운 메뉴 - 모든 언어 표시 */}
          {isLanguageDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
              {allLanguages.map((language) => {
                const isSelected = (pendingLanguage || currentLanguage) === language.code;
                
                return (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language)}
                    className={`w-full flex items-center space-x-2 px-3 py-2 text-left transition-colors ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">
                      {language.flag}
                    </span>
                    <span className="text-sm font-medium">{language.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative w-full md:w-72">
          {searchIcon}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter target URL"
            className="w-full pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="flex items-center justify-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition"
        >
          Submit
          {arrowRightIcon}
        </button>
      </div>
    </div>
  );
}