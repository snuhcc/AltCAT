// << ImageCard.tsx >>

'use client';

import React, { useState } from 'react';
import { ParsedImage } from '../types';
import { regenerateImage, translateToCultureAware } from '../api';

interface ImageCardProps {
  image: ParsedImage;
  currentLanguage?: string; // 추가: 현재 선택된 언어
  updateImageAlt: (
    id: number,
    field:
      | 'previous_alt_text'
      | 'ai_generated_alt_text'
      | 'ai_modified_alt_text'
      | 'customized_alt_text'
      | 'culture_aware_alt_text' // 추가 (2025.06.25)
      | 'image_type',
    value: string
  ) => void;
}

export default function ImageCard({ image, currentLanguage, updateImageAlt }: ImageCardProps) {
  const {
    id,
    image_url,
    previous_alt_text,
    ai_generated_alt_text,
    ai_modified_alt_text,
    image_type,
    customized_alt_text,
    culture_aware_alt_text, // 추가 (2025.06.25)
  } = image;

  const [showSaved, setShowSaved] = useState(false);

  // Local loading states
  const [isAIGeneratedLoading, setIsAIGeneratedLoading] = useState(false);
  // const [isAIModifiedLoading, setIsAIModifiedLoading] = useState(false);
  const [isCultureAwareLoading, setIsCultureAwareLoading] = useState(false);  // 추가 (2025.06.25)

  // 상태별 스타일
  const getStatusStyles = () => {
    if (previous_alt_text && previous_alt_text.trim() !== '') {
      return {
        borderColor: 'border-green-400',
        bgColor: 'bg-green-100',
        btnColor: 'bg-green-500',
        hoverColor: 'hover:bg-green-600',
      };
    } else {
      return {
        borderColor: 'border-red-400',
        bgColor: 'bg-red-100',
        btnColor: 'bg-red-500',
        hoverColor: 'hover:bg-red-600',
      };
    }
  };

  const { borderColor, bgColor, btnColor, hoverColor } = getStatusStyles();

  // 이미지 유형 매핑
  const typeColorMap: Record<string, string> = {
    'Photos and Portraits': 'bg-blue-200 text-blue-800',
    'Images that Contain Text': 'bg-green-200 text-green-800',
    'Logos': 'bg-yellow-200 text-yellow-800',
    'Decorative Images': 'bg-pink-200 text-pink-800',
    'Background Images': 'bg-gray-300 text-gray-800',
    'Controls, Form Elements, and Links': 'bg-indigo-200 text-indigo-800',
    'Bullets': 'bg-red-200 text-red-800',
    'Spacers and Separators': 'bg-purple-200 text-purple-800',
    'Charts, Graphs, and Diagrams': 'bg-orange-200 text-orange-800',
    'Watermarks': 'bg-teal-200 text-teal-800',
    'Signatures': 'bg-blue-200 text-blue-800',
  };

  const typeOptions = Object.keys(typeColorMap);
  const singleType = image_type && image_type.trim() !== '' ? image_type : 'Photos and Portraits';
  const typeClass = typeColorMap[singleType] || 'bg-gray-200 text-gray-800';

  const getDefaultValue = (value: string | null | undefined, defaultValue: string) => {
    return value && value.trim() !== '' ? value : defaultValue;
  };

  // 추가 (2025.06.25) 표시 텍스트 결정 함수
  const getDisplayedGeneratedText = () => {
    const isOriginalAltEmpty = !previous_alt_text || previous_alt_text.trim() === '';
    
    if (isOriginalAltEmpty) {
      return getDefaultValue(ai_generated_alt_text, 'None');
    } else {
      return getDefaultValue(ai_modified_alt_text, 'None');
    }
  };


  // Customized Alt 변경
  const handleCustomizedAltChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateImageAlt(id, 'customized_alt_text', e.target.value);
  };

  // Image Type 변경
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateImageAlt(id, 'image_type', e.target.value);
  };

  // AI-Generated 재생성
  // const handleRegenerateAIGenerated = async () => {
  //   setIsAIGeneratedLoading(true);
  //   try {
  //     const data = await regenerateImage(image_url, '', '');
  //     if (data && data.ai_generated_alt_text) {
  //       updateImageAlt(id, 'ai_generated_alt_text', data.ai_generated_alt_text);
  //     }
  //   } catch (error) {
  //     console.error('Re-generate AI-Generated error:', error);
  //   } finally {
  //     setIsAIGeneratedLoading(false);
  //   }
  // };
// 나중에 구현할 함수 (일단 빈 껍데기)
  const handleRegenerateCultureAware = async () => {
    // 현재 언어 확인
    if (!currentLanguage || currentLanguage === 'en') {
      console.log('English selected or no language - no translation needed');
      return;
    }
    
    setIsCultureAwareLoading(true);
    try {
      // AI-Generated Alt Text를 기준으로 번역
      const englishText = ai_generated_alt_text || '';
      
      if (!englishText.trim()) {
        console.log('No English alt-text available for translation');
        return;
      }
      
      console.log(`Translating to ${currentLanguage}: "${englishText}"`);
      
      const translated = await translateToCultureAware(englishText, currentLanguage);
      
      if (translated) {
        updateImageAlt(id, 'culture_aware_alt_text', translated);
        console.log(`Translation completed: "${translated}"`);
      } else {
        console.error('Translation failed - no result returned');
      }
    } catch (error) {
      console.error('Culture Aware translation error:', error);
    } finally {
      setIsCultureAwareLoading(false);
    }
  };
  
// 기존 함수를 완전히 교체 (2025.06.25)
  const handleRegenerateAIGenerated = async () => {
    setIsAIGeneratedLoading(true);
    try {
      const isOriginalAltEmpty = !previous_alt_text || previous_alt_text.trim() === '';
      
      if (isOriginalAltEmpty) {
        // 기존 alt-text가 없음 → Generate 작업
        const data = await regenerateImage(image_url, '', '');
        if (data && data.ai_generated_alt_text) {
          updateImageAlt(id, 'ai_generated_alt_text', data.ai_generated_alt_text);
        }
      } else {
        // 기존 alt-text가 있음 → Modify 작업  
        const customizedAlt = customized_alt_text || '';
        const originalAlt = getDefaultValue(previous_alt_text, 'None');
        const data = await regenerateImage(image_url, originalAlt, customizedAlt);
        if (data && data.ai_modified_alt_text) {
          updateImageAlt(id, 'ai_modified_alt_text', data.ai_modified_alt_text);
        }
      }
    } catch (error) {
      console.error('Re-generate error:', error);
    } finally {
      setIsAIGeneratedLoading(false);
    }
  };


  // AI-Modified 재생성
  // const handleRegenerateAIModified = async () => {
  //   setIsAIModifiedLoading(true);
  //   try {
  //     const customizedAlt = customized_alt_text || '';
  //     const originalAlt = getDefaultValue(previous_alt_text, 'None');
  //     const data = await regenerateImage(image_url, originalAlt, customizedAlt);
  //     if (data && data.ai_modified_alt_text) {
  //       updateImageAlt(id, 'ai_modified_alt_text', data.ai_modified_alt_text);
  //     }
  //   } catch (error) {
  //     console.error('Re-generate AI-Modified error:', error);
  //   } finally {
  //     setIsAIModifiedLoading(false);
  //   }
  // };

  // "Save" 버튼 클릭
  const handleSave = () => {
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
    }, 2000);
  };

  // Original Alt가 비어있는지 여부
  const isOriginalAltEmpty = !previous_alt_text || previous_alt_text.trim() === '';

  // 언어 코드를 표시용 이름으로 변환
  const getLanguageDisplayName = (langCode?: string) => {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'ko': 'Korean', 
      'zh': 'Chinese',
      'es': 'Spanish'
    };
    return languageNames[langCode || 'en'] || 'English';
  };

  return (
    <>
      <style>
        {`
          @keyframes checkSlide {
            0% {
              transform: translateY(10px);
              opacity: 0;
            }
            20% {
              transform: translateY(0);
              opacity: 1;
            }
            80% {
              transform: translateY(0);
              opacity: 1;
            }
            100% {
              transform: translateY(10px);
              opacity: 0;
            }
          }
          .check-slide {
            animation: checkSlide 1.2s ease-in-out forwards;
          }
        `}
      </style>

      <div className={`relative p-4 rounded-lg flex flex-row gap-6 border-2 ${borderColor} ${bgColor} shadow-lg`}>
        {/* 왼쪽 섹션 */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 bg-white bg-opacity-80 px-2 py-1 rounded shadow-md mb-4">
            <span className="text-xs font-bold text-gray-800">ID: {id}</span>
            <select
              className={`
                text-xs font-bold px-2 py-1 rounded shadow-md
                cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-blue-500
                transition-colors duration-200
                ${typeClass}
              `}
              value={singleType}
              onChange={handleTypeChange}
            >
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center items-center mt-10 w-full h-64">
            <img
              src={image_url}
              alt={getDefaultValue(previous_alt_text, 'No alt text')}
              className="rounded-lg w-80 h-w-80 object-scale-down"
            />
          </div>
        </div>

        {/* 오른쪽 섹션 */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Original Alt Text */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-700">
              Original Alt Text 
              {currentLanguage && currentLanguage !== 'en' && (
                <span className="text-blue-600 ml-1">({getLanguageDisplayName(currentLanguage)})</span>
              )}
            </label>
            <textarea
              value={getDefaultValue(previous_alt_text, 'None')}
              readOnly
              className="border border-gray-300 rounded-md px-3 py-1 bg-gray-50 text-xs h-12 resize-none overflow-y-auto w-full"
            />
          </div>

          {/* AI-Generated Alt Text */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-700">
              AI-Generated Alt Text
              <span className="text-green-600 ml-1">(Based on English)</span>
            </label>
            <div className="flex items-center">
              <textarea
                // value={getDefaultValue(ai_generated_alt_text, 'None')}
                value={getDisplayedGeneratedText()}
                readOnly
                className="border border-gray-300 rounded-md px-3 py-1 bg-gray-50 text-xs h-12 resize-none overflow-y-auto flex-1"
              />
              <button
                onClick={handleRegenerateAIGenerated}
                className="ml-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
                disabled={isAIGeneratedLoading}
              >
                {/* Fixed-size container to prevent size change */}
                <div className="relative w-5 h-5 flex items-center justify-center">
                  {isAIGeneratedLoading ? (
                    // 스피너를 원형으로 표시
                    <div className="animate-spin rounded-full border-4 border-white border-t-transparent w-5 h-5" />
                  ) : (
                    regenerateIcon
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Culture Aware Alt Text */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-700">
              Culture Aware Alt Text
            </label>
            <div className="flex items-center">
              <textarea
                value={getDefaultValue(culture_aware_alt_text, 'None')}
                readOnly
                className="border border-gray-300 rounded-md px-3 py-1 bg-gray-50 text-xs h-12 resize-none overflow-y-auto flex-1"
              />
              <button
                onClick={handleRegenerateCultureAware}
                className="ml-2 p-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors flex items-center justify-center"
                disabled={isCultureAwareLoading}
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  {isCultureAwareLoading ? (
                    <div className="animate-spin rounded-full border-4 border-white border-t-transparent w-5 h-5" />
                  ) : (
                    regenerateIcon
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Customized Alt Text */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-700">
              Customized Alt Text
            </label>
            <textarea
              value={customized_alt_text ?? ''}
              onChange={handleCustomizedAltChange}
              className="border border-gray-300 rounded-md px-3 py-1 bg-white text-xs h-12 resize-none overflow-y-auto w-full"
            />
          </div>

          {/* Save 버튼 & 체크 아이콘 */}
          <div className="flex items-center">
            <button
              onClick={handleSave}
              className={`py-2 px-4 ${btnColor} text-white rounded-md ${hoverColor} transition-colors`}
            >
              Save
            </button>
            {showSaved && (
              <div
                className={`
                  ml-2 
                  w-5 h-5
                  rounded-full 
                  bg-blue-300 
                  text-white 
                  flex 
                  items-center 
                  justify-center 
                  check-slide
                `}
              >
                {checkIcon}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// 재생성 아이콘
const regenerateIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 
         3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 
         0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

// 체크 아이콘
const checkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
