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
  
  // 🔥 추가: 언어별 customization 데이터
  const [languageCustomizations, setLanguageCustomizations] = useState<Record<LanguageCode, Record<string, string>>>({
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
  console.log('languageCustomizations:', languageCustomizations); // 🔥 추가
  console.log('multiLanguageCache:', multiLanguageCache);

  /**
   * 현재 언어에 맞게 표시할 이미지 데이터 업데이트 (최적화)
   */
  const updateDisplayImages = useCallback(() => {
    const currentLanguageData = languageAltTexts[currentLanguage] || {};
    const currentCustomizations = languageCustomizations[currentLanguage] || {}; // 🔥 추가
    
    setParsedImages(prevImages => 
      prevImages.map(img => {
        // 🔥 AI-Generated Alt Text는 항상 마스터 데이터에서만 가져오기
        // 마스터 데이터가 없으면 기존 값 유지 (오염 방지)
        const preservedAiGenerated = masterAltTexts[img.image_url] || img.ai_generated_alt_text;
        
        // 🔥 Original Alt Text 로직: 기존 값 우선 유지
        // 새로운 언어 데이터가 확실히 있을 때만 업데이트
        const baseUrl = URLMappingUtils.extractBaseUrl(currentUrl);
        const isLanguageParsed = multiLanguageCache[baseUrl]?.[currentLanguage] === true;
        
        // 🔥 상태 안정성 개선: 기존 값이 있으면 최대한 유지
        let newPreviousAlt = img.previous_alt_text;
        if (isLanguageParsed && currentLanguageData[img.image_url] !== undefined) {
          // 파싱이 완료되고 새로운 데이터가 확실히 있을 때만 업데이트
          newPreviousAlt = currentLanguageData[img.image_url];
        }
        
        // 🔥 Customization 언어별 처리
        const currentCustomization = currentCustomizations[img.image_url] || '';
        
        // 🔥 해당 이미지의 언어별 customization 객체 생성
        const imageCustomizations: Record<string, string> = {};
        Object.keys(languageCustomizations).forEach(lang => {
          imageCustomizations[lang] = languageCustomizations[lang as LanguageCode][img.image_url] || '';
        });
        
        // 🔥 Culture Aware Alt Text 언어별 처리
        let newCultureAwareAlt = img.culture_aware_alt_text;
        if (currentLanguage === 'en') {
          // 영어인 경우 비움
          newCultureAwareAlt = '';
        }
        // 다른 언어인 경우 기존 값 유지 (번역이 완료되면 자동으로 업데이트됨)
        
        return {
          ...img,
          previous_alt_text: newPreviousAlt,
          ai_generated_alt_text: preservedAiGenerated,
          culture_aware_alt_text: newCultureAwareAlt,
          customized_alt_text: currentCustomization, // 🔥 현재 언어의 customization 적용
          customized_alt_texts: imageCustomizations // 🔥 해당 이미지의 언어별 customization
        };
      })
    );
  }, [
    currentLanguage, 
    languageAltTexts, 
    languageCustomizations, // 🔥 추가 의존성
    masterAltTexts, 
    currentUrl, 
    multiLanguageCache
  ]); // 🔥 수정: 의존성 배열 명시적으로 정리하여 안정성 향상

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
          // 🔥 실제로 생성된 AI 텍스트를 마스터 데이터로 저장
          const actualAIText = img.ai_generated_alt_text || img.ai_modified_alt_text || '';
          masterData[imageKey] = actualAIText;
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

  // 🔥 수정: 언어 변경 시에만 화면 업데이트하도록 최적화
  useEffect(() => {
    updateDisplayImages();
  }, [currentLanguage]); // 🔥 updateDisplayImages 의존성 제거하여 무한 루프 방지

  // 🔥 추가: 언어별 데이터나 마스터 데이터가 변경될 때만 화면 업데이트
  useEffect(() => {
    updateDisplayImages();
  }, [languageAltTexts, languageCustomizations, masterAltTexts, multiLanguageCache]); // 🔥 실제 데이터 변경 시에만 업데이트

  // 언어 변경 시 화면 업데이트
  // 🚫 더 이상 사용하지 않음 - 위에서 최적화된 useEffect로 대체
  // useEffect(() => {
  //   updateDisplayImages();
  // }, [updateDisplayImages]);

  // 🔥 새로 추가: parsedImages 업데이트 후 자동 Culture Aware 번역 수행
  useEffect(() => {
    const performAutoTranslation = async () => {
      // 🔥 조건을 더 엄격하게: 영어가 아니고, 이미지가 있고, 로딩 중이 아니고, 실제로 번역할 이미지가 있을 때만 실행
      if (currentLanguage !== 'en' && parsedImages.length > 0 && !loading) {
        // 번역이 필요한 이미지가 실제로 있는지 먼저 확인
        const needsTranslation = parsedImages.some(image => {
          const actualAIText = image.ai_generated_alt_text || image.ai_modified_alt_text || '';
          const hasEnglishText = actualAIText.trim() !== '';
          const hasTranslation = (image.culture_aware_alt_text || '').trim() !== '';
          return hasEnglishText && !hasTranslation;
        });
        
        if (needsTranslation) {
          console.log(`Auto-translating to ${currentLanguage} for ${parsedImages.length} images`);
          await performAutoCultureAwareTranslation(currentLanguage, parsedImages);
        }
      }
    };

    // 🔥 디바운스 효과: 약간의 지연을 두어 연속 실행 방지
    const timeoutId = setTimeout(performAutoTranslation, 300);
    return () => clearTimeout(timeoutId);
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
    
    // 🔥 캐시 키를 baseUrl로 통일
    const baseUrl = URLMappingUtils.extractBaseUrl(currentUrl);
    
    // 이미 캐시된 데이터가 있는지 확인
    if (StateUtils.isLanguageCached(baseUrl, languageCode)) {
      console.log(`Using cached data for ${languageCode}`);
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
      // 🔥 실제로 생성된 AI 텍스트 확인 (generate 또는 modify)
      const actualAIText = image.ai_generated_alt_text || image.ai_modified_alt_text || '';
      const hasEnglishText = actualAIText.trim() !== '';
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
      // 🔥 실제로 생성된 AI 텍스트 사용
      const englishText = image.ai_generated_alt_text || image.ai_modified_alt_text || '';
      
      try {
        const translated = await translateToCultureAware(englishText, targetLanguage);
        if (translated) {
          // updateImageAlt 함수를 통해 상태 업데이트
          updateImageAlt(image.id, 'culture_aware_alt_text', translated);
          console.log(`Auto-translated image ${image.id}: "${englishText}" -> "${translated}"`);
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
    const englishUrl = await URLMappingUtils.getLanguageUrl(baseUrl, 'en');
    
    // 🔥 수정: 영어 URL이 명시적으로 null인 경우 처리
    if (englishUrl === null) {
      console.log(`English not supported for ${baseUrl} - cannot perform main parsing`);
      // 영어가 지원되지 않는 경우 빈 데이터로 설정
      setParsedImages([]);
      setLanguageAltTexts(prev => ({
        ...prev,
        en: {}
      }));
      StateUtils.setCacheStatus(baseUrl, 'en', true); // 빈 데이터도 캐시로 표시
      return;
    }
    
    // fallback으로 baseUrl 사용 (predefined 매핑이 없는 경우)
    const finalEnglishUrl = englishUrl || baseUrl;
    
    console.log(`Input URL: ${url} → Base URL: ${baseUrl} → English URL: ${finalEnglishUrl}`);
    
    // 이미 캐시된 데이터가 있는지 확인 (베이스 URL 기준)
    if (StateUtils.isLanguageCached(baseUrl, 'en')) {
      console.log('Using cached English data');
      return;
    }
    
    try {
      setLoading(true);
      setParsedImages([]);
      
      console.log('Fetching main parsing for:', finalEnglishUrl);
      
      // 기존 fetchImages 함수 사용 (파싱 + AI 생성)
      const newImages = await new Promise<ParsedImage[]>((resolve) => {
        fetchImages(finalEnglishUrl, setLoading, (data) => resolve(data));
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
      const html = await downloadHtml(finalEnglishUrl);
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
      return; // updateDisplayImages는 의존성으로 자동 호출됨
    }

    // 이미 캐시된 데이터가 있는지 확인 (베이스 URL 기준)
    if (StateUtils.isLanguageCached(baseUrl, languageCode)) {
      console.log(`Using cached data for ${languageCode}`);
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
      
      // 🔥 추가: 언어별 HTML도 다운로드
      const languageHtml = await downloadHtml(languageUrl);
      
      // 캐시 상태 업데이트 (베이스 URL 기준)
      StateUtils.setCacheStatus(baseUrl, languageCode, true);
      
      // 다국어 캐시 데이터 업데이트 (베이스 URL 기준)
      setParsedImagesMap(prev => {
        const currentData = prev[baseUrl] || { htmlCode: '', images: [] };
        return {
          ...prev,
          [baseUrl]: {
            ...currentData,
            // 🔥 추가: 언어별 HTML 저장
            htmlCodes: {
              ...currentData.htmlCodes,
              [languageCode]: languageHtml || ''
            },
            multiLanguageData: {
              ...currentData.multiLanguageData,
              [languageCode]: {
                language: languageCode,
                images: altTexts,
                htmlCode: languageHtml || '' // 🔥 추가: 언어별 HTML도 저장
              }
            }
          }
        };
      });
      
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
      
      // 🔥 캐시된 데이터에서 상태 복원
      const cachedData = parsedImagesMap[baseUrl];
      if (cachedData.images.length > 0) {
        // 영어 데이터가 있으면 마스터 데이터 복원
        StateUtils.syncImageData(cachedData.images, 'en');
        
        // 다국어 데이터가 있으면 복원
        if (cachedData.multiLanguageData) {
          Object.entries(cachedData.multiLanguageData).forEach(([lang, data]) => {
            if (data && typeof data === 'object' && 'images' in data) {
              setLanguageAltTexts(prev => ({
                ...prev,
                [lang as LanguageCode]: data.images
              }));
              StateUtils.setCacheStatus(baseUrl, lang as LanguageCode, true);
              
              // 🔥 추가: customization 데이터도 복원
              if (data.customizations) {
                setLanguageCustomizations(prev => ({
                  ...prev,
                  [lang as LanguageCode]: {
                    ...prev[lang as LanguageCode],
                    ...data.customizations
                  }
                }));
                console.log(`Restored ${lang} customizations:`, data.customizations);
              }
            }
          });
        }
      }
      
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
    // 새로운 파싱 후에는 updateDisplayImages가 의존성으로 자동 호출됨
  };

  /**
   * 이미지 ALT 텍스트 수정 시 => 현재 페이지 및 캐시에 반영 (언어별 customization 지원)
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

    // 🔥 추가: customized_alt_text 언어별 처리
    if (field === 'customized_alt_text') {
      const targetImage = parsedImages.find(img => img.id === id);
      if (targetImage) {
        // 현재 언어의 customization 업데이트
        setLanguageCustomizations(prev => ({
          ...prev,
          [currentLanguage]: {
            ...prev[currentLanguage],
            [targetImage.image_url]: value
          }
        }));
        
        console.log(`Updated ${currentLanguage} customization for image ${id}: "${value}"`);
      }
    }

    // 🔥 캐시 데이터도 baseUrl 기준으로 수정
    const baseUrl = URLMappingUtils.extractBaseUrl(currentUrl);
    setParsedImagesMap((prevMap) => {
      const currentData = prevMap[baseUrl];
      if (!currentData) return prevMap;

      const updatedImages = currentData.images.map((img) =>
        img.id === id ? { ...img, [field]: value } : img
      );

      // 🔥 추가: 언어별 customization을 multiLanguageData에도 저장
      let updatedMultiLanguageData = currentData.multiLanguageData;
      if (field === 'customized_alt_text') {
        const targetImage = parsedImages.find(img => img.id === id);
        if (targetImage && updatedMultiLanguageData && updatedMultiLanguageData[currentLanguage]) {
          updatedMultiLanguageData = {
            ...updatedMultiLanguageData,
            [currentLanguage]: {
              ...updatedMultiLanguageData[currentLanguage],
              customizations: {
                ...updatedMultiLanguageData[currentLanguage].customizations,
                [targetImage.image_url]: value
              }
            }
          };
        }
      }

      return {
        ...prevMap,
        [baseUrl]: {
          ...currentData,
          images: updatedImages,
          multiLanguageData: updatedMultiLanguageData
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

            // 🔥 수정: 현재 언어의 HTML 전달
            downloadedHtml={(() => {
              const baseUrl = URLMappingUtils.extractBaseUrl(currentUrl);
              const websiteData = parsedImagesMap[baseUrl];
              if (!websiteData) return '';
              
              // 현재 언어의 HTML이 있으면 사용, 없으면 기본 HTML 사용
              if (websiteData.htmlCodes && websiteData.htmlCodes[currentLanguage]) {
                return websiteData.htmlCodes[currentLanguage];
              }
              if (websiteData.multiLanguageData && websiteData.multiLanguageData[currentLanguage]?.htmlCode) {
                return websiteData.multiLanguageData[currentLanguage].htmlCode;
              }
              return websiteData.htmlCode; // fallback to default HTML
            })()}
            setParsedImagesMap={setParsedImagesMap}
          />
        </div>
      </div>
    </div>
  );
}