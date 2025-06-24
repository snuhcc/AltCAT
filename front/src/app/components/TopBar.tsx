'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode } from '../urlMappings';

interface TopBarProps {
  currentUrl: string;
  currentLanguage: LanguageCode;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onLanguageChange: (languageCode: LanguageCode) => void;
}

// 언어 목록 정의
const languages = [
  { code: 'en', flag: '🇺🇸', name: 'EN' },
  { code: 'ko', flag: '🇰🇷', name: 'KR' },
  { code: 'zh', flag: '🇨🇳', name: 'CN' },
  { code: 'es', flag: '🇪🇸', name: 'ES' }
];

export default function TopBar({ currentUrl, currentLanguage, onUrlChange, onSubmit, onLanguageChange }: TopBarProps) {
  const [inputValue, setInputValue] = useState<string>(currentUrl);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 현재 선택된 언어 객체 찾기
  const selectedLanguage = languages.find(lang => lang.code === currentLanguage) || languages[0];

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmedValue = inputValue.trim();
      if (trimmedValue) {
        onUrlChange(trimmedValue);
        onSubmit(trimmedValue);
      }
    }
  };

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onUrlChange(trimmedValue);
      onSubmit(trimmedValue);
    }
  };

  const handleLanguageSelect = (language: typeof languages[0]) => {
    setIsLanguageDropdownOpen(false);
    console.log('Selected language:', language.code);
    onLanguageChange(language.code as LanguageCode);
  };

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
      <div className="text-gray-800 text-lg font-semibold mb-4 md:mb-0">
        Current Website:{' '}
        <a
          href={currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-600 hover:text-blue-500"
        >
          {currentUrl}
        </a>
      </div>

      <div className="flex w-full md:w-auto items-center space-x-2">
        {/* 언어 선택 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <span className="text-lg">{selectedLanguage.flag}</span>
            <span className="text-sm font-medium text-gray-700">{selectedLanguage.name}</span>
            {chevronDownIcon}
          </button>

          {/* 드롭다운 메뉴 */}
          {isLanguageDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
              {languages.map((language) => {
                const isSelected = selectedLanguage.code === language.code;
                
                return (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language)}
                    className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="text-lg">{language.flag}</span>
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