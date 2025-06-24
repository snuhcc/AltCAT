'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MainContent from './components/MainContent';
import { ParsedImage, ParsedImagesMap, MultiLanguageImageData } from './types';
import { fetchImages, downloadHtml, fetchAltTextsOnly, translateToCultureAware } from './api';
import { LanguageCode, URLMappingUtils } from './urlMappings';

export default function Page() {
  const [currentUrl, setCurrentUrl] = useState<string>('https://www.google.com/');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en'); // 현재 선택된 언어
  const [parsedImagesMap, setParsedImagesMap] = useState<ParsedImagesMap>({});
  const [parsedImages, setParsedImages] = useState<ParsedImage[]>([]);
  
  // 영어 기준 AI 생성 데이터 (마스터 데이터)
  const [masterAltTexts, setMasterAltTexts] = useState<Record<string, string>>({});
  
  // 언어별 original alt-text 데이터
  const [languageAltTexts, setLanguageAltTexts] = useState<Record<LanguageCode, Record<string, string>>>({
    en: {},
    ko: {},
    zh: {},
    es: {}
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [urls, setUrls] = useState<string[]>([]);
  
  // 캐시된 다국어 데이터
  const [multiLanguageCache, setMultiLanguageCache] = useState<Record<string, Record<LanguageCode, boolean>>>({});

  console.log('parsedImagesMap:', parsedImagesMap);
  console.log('currentLanguage:', currentLanguage);
  console.log('masterAltTexts:', masterAltTexts);
  console.log('languageAltTexts:', languageAltTexts);
  console.log('multiLanguageCache:', multiLanguageCache);

  /**
   * 현재 언어에 맞게 표시할 이미지 데이터 업데이트 (최적화)
   */
  const updateDisplayImages = useCallback(() => {
    const currentLanguageData = languageAltTexts[currentLanguage] || {};
    
    setParsedImages(prevImages => 
      prevImages.map(img => ({
        ...img,
        previous_alt_text: currentLanguageData[img.image_url] || '',
        ai_generated_alt_text: masterAltTexts[img.image_url] || img.ai_generated_alt_text
      }))
    );
  }, [currentLanguage, masterAltTexts, languageAltTexts]);

  /**
   * 상태 동기화 헬퍼 함수들
   */
  const StateUtils = useMemo(() => ({
    
    /**
     * 언어별 데이터가 이미 캐시되었는지 확인
     */
    isLanguageCached: (url: string, language: LanguageCode): boolean => {
      return multiLanguageCache[url]?.[language] === true;
    },

    /**
     * 언어 캐시 상태 업데이트
     */
    setCacheStatus: (url: string, language: LanguageCode, status: boolean) => {
      setMultiLanguageCache(prev => ({
        ...prev,
        [url]: {
          ...prev[url],
          [language]: status
        }
      }));
    },

    /**
     * 마스터 데이터와 언어별 데이터를 동기화
     */
    syncImageData: (images: ParsedImage[], language: LanguageCode) => {
      const masterData: Record<string, string> = {};
      const languageData: Record<string, string> = {};
      
      images.forEach((img) => {
        const imageKey = img.image_url;
        if (language === 'en') {
          masterData[imageKey] = img.ai_generated_alt_text || '';
        }
        languageData[imageKey] = img.previous_alt_text || '';
      });
      
      if (language === 'en') {
        setMasterAltTexts(prev => ({ ...prev, ...masterData }));
      }
      
      setLanguageAltTexts(prev => ({
        ...prev,
        [language]: { ...prev[language], ...languageData }
      }));
    },

    /**
     * 특정 URL의 모든 언어 데이터 정리
     */
    clearUrlData: (url: string) => {
      // 해당 URL과 관련된 이미지들의 데이터만 선별적으로 제거
      const urlImages = parsedImagesMap[url]?.images || [];
      const imageUrls = urlImages.map(img => img.image_url);
      
      // 마스터 데이터에서 제거
      setMasterAltTexts(prev => {
        const newData = { ...prev };
        imageUrls.forEach(imageUrl => delete newData[imageUrl]);
        return newData;
      });
      
      // 언어별 데이터에서 제거
      setLanguageAltTexts(prev => {
        const newData = { ...prev };
        Object.keys(newData).forEach(lang => {
          imageUrls.forEach(imageUrl => delete newData[lang as LanguageCode][imageUrl]);
        });
        return newData;
      });
      
      // 캐시 상태 제거
      setMultiLanguageCache(prev => {
        const newCache = { ...prev };
        delete newCache[url];
        return newCache;
      });
    },

    /**
     * 메모리 사용량 최적화를 위한 오래된 데이터 정리
     */
    cleanupOldData: () => {
      const maxCacheSize = 5; // 최대 5개 URL까지만 캐시 유지
      const currentUrls = Object.keys(parsedImagesMap);
      
      if (currentUrls.length > maxCacheSize) {
        const urlsToRemove = currentUrls.slice(0, currentUrls.length - maxCacheSize);
        urlsToRemove.forEach(url => {
          StateUtils.clearUrlData(url);
          setParsedImagesMap(prev => {
            const newMap = { ...prev };
            delete newMap[url];
            return newMap;
          });
        });
      }
    }

  }), [multiLanguageCache, parsedImagesMap]);

  // 언어 변경 시 화면 업데이트
  useEffect(() => {
    updateDisplayImages();
  }, [updateDisplayImages]);

  // 🔥 새로 추가: parsedImages 업데이트 후 자동 Culture Aware 번역 수행
  useEffect(() => {
    const performAutoTranslation = async () => {
      // 영어가 아니고, 이미지가 있고, 로딩 중이 아닐 때만 실행
      if (currentLanguage !== 'en' && parsedImages.length > 0 && !loading) {
        console.log(`Auto-translating to ${currentLanguage} for ${parsedImages.length} images`);
        await performAutoCultureAwareTranslation(currentLanguage, parsedImages);
      }
    };

    performAutoTranslation();
  }, [parsedImages, currentLanguage, loading]); // parsedImages가 변경될 때마다 실행

  // 메모리 정리 (컴포넌트 언마운트 시)
  useEffect(() => {
    return () => {
      StateUtils.cleanupOldData();
    };
  }, [StateUtils]);

  // 컴포넌트 첫 렌더 시, currentUrl에 대해 데이터 가져오기
  useEffect(() => {
    handleFetchData(currentUrl);
  }, []);

  // Sidebar에서 URL 선택 시
  const handleUrlChange = (newUrl: string) => {
    handleFetchData(newUrl);
  };

  // TopBar에서 Submit 시
  const handleFetchImages = (url: string) => {
    if (!url.trim()) return;
    handleFetchData(url);
  };

  // TopBar에서 언어 변경 시
  const handleLanguageChange = async (languageCode: LanguageCode) => {
    console.log('Language changed to:', languageCode);
    setCurrentLanguage(languageCode);
    
    // 이미 캐시된 데이터가 있는지 확인
    if (StateUtils.isLanguageCached(currentUrl, languageCode)) {
      console.log(`Using cached data for ${languageCode}`);
      updateDisplayImages();
      return;
    }
    
    if (languageCode === 'en') {
      // 영어인 경우: 메인 파싱 + AI 생성 (predefined 여부 상관없이)
      await handleMainParsing(currentUrl);
    } else {
      // 다른 언어인 경우: 해당 언어 페이지 파싱 시도
      await handleLanguageParsing(currentUrl, languageCode);
    }
  };

  /**
   * 자동 Culture Aware 번역 수행 (개선된 버전)
   */
  const performAutoCultureAwareTranslation = async (targetLanguage: LanguageCode, images: ParsedImage[]) => {
    if (targetLanguage === 'en') {
      console.log('English selected - no translation needed');
      return;
    }

    // 번역이 필요한 이미지만 필터링 (이미 번역된 것은 제외)
    const imagesToTranslate = images.filter(image => {
      const hasEnglishText = (masterAltTexts[image.image_url] || image.ai_generated_alt_text || '').trim() !== '';
      const hasTranslation = (image.culture_aware_alt_text || '').trim() !== '';
      return hasEnglishText && !hasTranslation;
    });

    if (imagesToTranslate.length === 0) {
      console.log('No images need translation');
      return;
    }

    console.log(`Performing auto culture-aware translation to ${targetLanguage} for ${imagesToTranslate.length} images`);
    
    // 필터링된 이미지 목록에 대해 번역 수행
    const translationPromises = imagesToTranslate.map(async (image) => {
      const englishText = masterAltTexts[image.image_url] || image.ai_generated_alt_text || '';
      
      try {
        const translated = await translateToCultureAware(englishText, targetLanguage);
        if (translated) {
          // updateImageAlt 함수를 통해 상태 업데이트
          updateImageAlt(image.id, 'culture_aware_alt_text', translated);
          console.log(`Auto-translated image ${image.id}: "${translated}"`);
        }
      } catch (error) {
        console.error(`Auto-translation failed for image ${image.id}:`, error);
      }
    });

    // 모든 번역이 완료될 때까지 대기
    await Promise.all(translationPromises);
    console.log(`Auto culture-aware translation completed for ${targetLanguage}`);
  };

  /**
   * 메인 파싱 (영어 기준) - 파싱 + AI 생성 (개선된 버전)
   */
  const handleMainParsing = async (url: string) => {
    // 🔥 핵심 수정: 입력 URL에서 베이스 URL 추출 후 영어 URL 찾기
    const baseUrl = URLMappingUtils.extractBaseUrl(url);
    const englishUrl = await URLMappingUtils.getLanguageUrl(baseUrl, 'en') || baseUrl;
    
    console.log(`Input URL: ${url} → Base URL: ${baseUrl} → English URL: ${englishUrl}`);
    
    // 이미 캐시된 데이터가 있는지 확인 (베이스 URL 기준)
    if (StateUtils.isLanguageCached(baseUrl, 'en')) {
      console.log('Using cached English data');
      updateDisplayImages();
      return;
    }
    
    try {
      setLoading(true);
      setParsedImages([]);
      
      console.log('Fetching main parsing for:', englishUrl);
      
      // 기존 fetchImages 함수 사용 (파싱 + AI 생성)
      const newImages = await new Promise<ParsedImage[]>((resolve) => {
        fetchImages(englishUrl, setLoading, (data) => resolve(data));
      });

      const enrichedImages = newImages.map((img) => ({
        ...img,
        customized_alt_text: img.customized_alt_text || "",
      }));

      // StateUtils를 사용하여 데이터 동기화
      StateUtils.syncImageData(enrichedImages, 'en');
      
      // 캐시 상태 업데이트 (베이스 URL 기준)
      StateUtils.setCacheStatus(baseUrl, 'en', true);

      setParsedImages(enrichedImages);
      
      // HTML 코드도 가져오기
      const html = await downloadHtml(englishUrl);
      setParsedImagesMap((prev) => ({
        ...prev,
        [baseUrl]: {  // 베이스 URL로 저장
          htmlCode: html || "",
          images: enrichedImages,
          multiLanguageData: {
            en: {
              language: 'en',
              images: enrichedImages.reduce((acc, img) => {
                acc[img.image_url] = img.previous_alt_text || '';
                return acc;
              }, {} as Record<string, string>),
              htmlCode: html || ""
            }
          }
        },
      }));

      // 메모리 정리
      StateUtils.cleanupOldData();

    } catch (error) {
      console.error('Error in main parsing:', error);
      StateUtils.setCacheStatus(baseUrl, 'en', false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 언어별 파싱 - alt-text만 수집 (개선된 버전)
   */
  const handleLanguageParsing = async (inputUrl: string, languageCode: LanguageCode) => {
    // 베이스 URL 추출
    const baseUrl = URLMappingUtils.extractBaseUrl(inputUrl);
    const languageUrl = await URLMappingUtils.getLanguageUrl(baseUrl, languageCode);
    
    console.log(`Language parsing - Input: ${inputUrl} → Base: ${baseUrl} → Language URL: ${languageUrl}`);
    
    if (!languageUrl) {
      console.log(`No URL mapping for language: ${languageCode}`);
      // 해당 언어가 지원되지 않는 경우
      setLanguageAltTexts(prev => ({
        ...prev,
        [languageCode]: {}
      }));
      StateUtils.setCacheStatus(baseUrl, languageCode, true); // 빈 데이터도 캐시로 표시
      updateDisplayImages();
      return;
    }

    // 이미 캐시된 데이터가 있는지 확인 (베이스 URL 기준)
    if (StateUtils.isLanguageCached(baseUrl, languageCode)) {
      console.log(`Using cached data for ${languageCode}`);
      updateDisplayImages();
      return;
    }

    try {
      setLoading(true);
      
      console.log(`Fetching ${languageCode} parsing for:`, languageUrl);
      
      // 새로운 API 사용: alt-text만 파싱
      const altTexts = await fetchAltTextsOnly(languageUrl);
      
      if (!altTexts) {
        console.error(`Failed to fetch alt-texts for ${languageCode}`);
        StateUtils.setCacheStatus(baseUrl, languageCode, false);
        return;
      }

      // 언어별 alt-text 데이터 업데이트
      setLanguageAltTexts(prev => ({
        ...prev,
        [languageCode]: altTexts
      }));
      
      // 캐시 상태 업데이트 (베이스 URL 기준)
      StateUtils.setCacheStatus(baseUrl, languageCode, true);
      
      // 다국어 캐시 데이터 업데이트 (베이스 URL 기준)
      setParsedImagesMap(prev => {
        const currentData = prev[baseUrl] || { htmlCode: '', images: [] };
        return {
          ...prev,
          [baseUrl]: {
            ...currentData,
            multiLanguageData: {
              ...currentData.multiLanguageData,
              [languageCode]: {
                language: languageCode,
                images: altTexts
              }
            }
          }
        };
      });
      
      // 화면 업데이트
      updateDisplayImages();
      
    } catch (error) {
      console.error(`Error in ${languageCode} parsing:`, error);
      StateUtils.setCacheStatus(baseUrl, languageCode, false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * URL에 맞는 이미지를 가져오고, 캐시에 저장하는 함수 (기존 로직 유지)
   */
  const handleFetchData = async (url: string) => {
    // 베이스 URL 추출
    const baseUrl = URLMappingUtils.extractBaseUrl(url);
    
    console.log(`Fetch data - Input URL: ${url} → Base URL: ${baseUrl}`);
    
    // 만약 이미 캐시에 있다면 => 기존에 받아둔 데이터 즉시 사용 (베이스 URL 기준)
    if (parsedImagesMap[baseUrl]) {
      setCurrentUrl(url);  // 사용자 입력 URL 유지
      setParsedImages(parsedImagesMap[baseUrl].images);
      setUrls((prev) => (prev.includes(url) ? prev : [url, ...prev]));
      console.log('Using cached data for base URL:', baseUrl);
      updateDisplayImages();  // 현재 언어에 맞게 화면 업데이트
      return;
    }

    // 새 URL 설정
    setCurrentUrl(url);  // 사용자 입력 URL 유지
    setUrls((prev) => (prev.includes(url) ? prev : [url, ...prev]));
    
    // 🔥 핵심 수정: 영어 데이터 먼저 확보 (AI 생성을 위한 기준)
    if (!StateUtils.isLanguageCached(baseUrl, 'en')) {
      console.log('English data not cached, fetching...');
      await handleMainParsing(url);
    } else {
      console.log('Using cached English data');
    }
    
    // 현재 선택된 언어가 영어가 아니면 해당 언어 처리
    if (currentLanguage !== 'en') {
      console.log(`Current language is ${currentLanguage}, fetching language-specific data...`);
      await handleLanguageParsing(url, currentLanguage);
    }
    
    // 화면 업데이트 (현재 언어에 맞게)
    updateDisplayImages();
  };

  /**
   * 이미지 ALT 텍스트 수정 시 => 현재 페이지 및 캐시에 반영
   */
  const updateImageAlt = (
    id: number,
    field:
      | 'previous_alt_text'
      | 'ai_generated_alt_text'
      | 'ai_modified_alt_text'
      | 'culture_aware_alt_text' // 추가 (2025.06.25)
      | 'customized_alt_text'
      | 'image_type',
    value: string
  ) => {
    // 현재 화면에 표시되는 이미지 목록 업데이트
    setParsedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, [field]: value } : img))
    );

    // 특정 필드의 경우 별도 상태도 업데이트
    if (field === 'ai_generated_alt_text') {
      const targetImage = parsedImages.find(img => img.id === id);
      if (targetImage) {
        setMasterAltTexts(prev => ({
          ...prev,
          [targetImage.image_url]: value
        }));
      }
    }

    if (field === 'previous_alt_text') {
      const targetImage = parsedImages.find(img => img.id === id);
      if (targetImage) {
        setLanguageAltTexts(prev => ({
          ...prev,
          [currentLanguage]: {
            ...prev[currentLanguage],
            [targetImage.image_url]: value
          }
        }));
      }
    }

    // 캐시 데이터도 수정
    setParsedImagesMap((prevMap) => {
      const currentData = prevMap[currentUrl];
      if (!currentData) return prevMap;

      const updatedImages = currentData.images.map((img) =>
        img.id === id ? { ...img, [field]: value } : img
      );

      return {
        ...prevMap,
        [currentUrl]: {
          ...currentData,
          images: updatedImages,
        },
      };
    });
  };

  return (
    <div className="flex h-screen font-sans">
      {/* 좌측 사이드바 */}
      <Sidebar
        currentUrl={currentUrl}
        onSelectUrl={handleUrlChange}
        urls={urls}
      />

      {/* 우측 메인 레이아웃 */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 상단 TopBar */}
        <TopBar
          currentUrl={currentUrl}
          currentLanguage={currentLanguage}
          onUrlChange={handleUrlChange}
          onSubmit={handleFetchImages}
          onLanguageChange={handleLanguageChange}
        />

        {/* MainContent */}
        <div className="flex flex-1 overflow-hidden">
          <MainContent
            parsedImages={parsedImages}
            currentLanguage={currentLanguage}
            updateImageAlt={updateImageAlt}
            currentUrl={currentUrl}
            loading={loading}
            setLoading={setLoading}

            // 추가: Download 시 필요
            downloadedHtml={parsedImagesMap[currentUrl]?.htmlCode || ''}
            setParsedImagesMap={setParsedImagesMap}
          />
        </div>
      </div>
    </div>
  );
}