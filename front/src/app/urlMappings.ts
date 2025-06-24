// urlMappings.ts - 언어별 URL 매핑 데이터

export type LanguageCode = 'en' | 'ko' | 'zh' | 'es';

export interface LanguageMapping {
  en: string | null;
  ko: string | null; 
  zh: string | null;
  es: string | null;
}

export type URLMappings = Record<string, LanguageMapping>;

interface MappingConfig {
  mappings: URLMappings;
  defaultPatterns: {
    pathBased: Record<LanguageCode, string>;
    subdomainBased: Record<LanguageCode, string>;
  };
}

// JSON 파일에서 로드된 매핑 데이터를 저장할 변수
let mappingConfig: MappingConfig | null = null;
let urlMappings: URLMappings = {};

// JSON 파일 로드 함수
async function loadMappings(): Promise<MappingConfig> {
  if (mappingConfig) return mappingConfig;
  
  try {
    const response = await fetch('/urlMappings.json');
    mappingConfig = await response.json();
    urlMappings = mappingConfig!.mappings;
    return mappingConfig!;
  } catch (error) {
    console.error('Failed to load URL mappings:', error);
    // 기본값으로 빈 매핑 반환
    mappingConfig = {
      mappings: {},
      defaultPatterns: {
        pathBased: { en: '/en', ko: '/ko', zh: '/zh', es: '/es' },
        subdomainBased: { en: '', ko: 'kr.', zh: 'cn.', es: 'es.' }
      }
    };
    urlMappings = {};
    return mappingConfig;
  }
}

// URL 매핑 유틸리티 클래스들
export class URLMappingUtils {
  
  /**
   * JSON 매핑 파일 초기화 (앱 시작 시 호출)
   */
  static async initialize(): Promise<void> {
    await loadMappings();
  }
  
  /**
   * 주어진 URL이 predefined 매핑에 있는지 확인
   */
  static hasPredefinedMapping(url: string): boolean {
    return url in urlMappings;
  }
  
  /**
   * 특정 언어의 URL 가져오기 (자동 null 매핑 생성 포함)
   */
  static async getLanguageUrl(baseUrl: string, languageCode: LanguageCode): Promise<string | null> {
    await loadMappings(); // 매핑이 로드되지 않았으면 로드
    
    // 1. Predefined 매핑이 있는지 확인
    const mapping = urlMappings[baseUrl];
    if (mapping && mapping[languageCode] !== undefined) {
      return mapping[languageCode];
    }
    
    // 2. Predefined 매핑이 없으면 null 매핑 생성
    if (!mapping) {
      const nullMapping: LanguageMapping = {
        en: languageCode === 'en' ? baseUrl : null,
        ko: languageCode === 'ko' ? baseUrl : null,
        zh: languageCode === 'zh' ? baseUrl : null,
        es: languageCode === 'es' ? baseUrl : null
      };
      
      // 선택된 언어만 원본 URL로, 나머지는 null
      await URLMappingUtils.addMapping(baseUrl, nullMapping);
      
      return nullMapping[languageCode];
    }
    
    return null;
  }
  
  /**
   * 자동 매핑 생성 로직 (더 이상 사용하지 않음 - null 매핑으로 대체)
   */
  static async generateAutoMapping(baseUrl: string, languageCode: LanguageCode): Promise<string | null> {
    // 영어인 경우에만 원본 URL 반환, 나머지는 null
    return languageCode === 'en' ? baseUrl : null;
  }
  
  /**
   * 해당 URL에서 지원하는 언어 목록 가져오기
   */
  static async getSupportedLanguages(baseUrl: string): Promise<LanguageCode[]> {
    await loadMappings();
    
    const mapping = urlMappings[baseUrl];
    if (!mapping) {
      // Predefined 매핑이 없으면 영어만 지원한다고 가정 (null 매핑 생성 전)
      return ['en'];
    }
    
    return (Object.keys(mapping) as LanguageCode[]).filter(
      lang => mapping[lang] !== null
    );
  }
  
  /**
   * 특정 언어가 지원되는지 확인
   */
  static async isLanguageSupported(baseUrl: string, languageCode: LanguageCode): Promise<boolean> {
    const supportedLanguages = await URLMappingUtils.getSupportedLanguages(baseUrl);
    return supportedLanguages.includes(languageCode);
  }
  
  /**
   * 새로운 URL 매핑 추가 (런타임에서 동적 추가)
   */
  static async addMapping(baseUrl: string, mapping: LanguageMapping): Promise<void> {
    await loadMappings();
    urlMappings[baseUrl] = mapping;
    console.log(`Added auto-mapping for ${baseUrl}:`, mapping);
  }
  
  /**
   * JSON 파일에 매핑 저장 (클라이언트에서는 localStorage 사용)
   */
  static async saveMappingToStorage(baseUrl: string, mapping: LanguageMapping): Promise<void> {
    try {
      const savedMappings = localStorage.getItem('customUrlMappings');
      const customMappings = savedMappings ? JSON.parse(savedMappings) : {};
      customMappings[baseUrl] = mapping;
      localStorage.setItem('customUrlMappings', JSON.stringify(customMappings));
    } catch (error) {
      console.error('Failed to save mapping to storage:', error);
    }
  }
  
  /**
   * localStorage에서 커스텀 매핑 로드
   */
  static loadCustomMappings(): void {
    try {
      const savedMappings = localStorage.getItem('customUrlMappings');
      if (savedMappings) {
        const customMappings = JSON.parse(savedMappings);
        Object.assign(urlMappings, customMappings);
        console.log('Loaded custom mappings from storage:', customMappings);
      }
    } catch (error) {
      console.error('Failed to load custom mappings:', error);
    }
  }
  
  /**
   * URL 정규화 (프로토콜 제거, www 제거 등)
   */
  static normalizeUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }
  
  /**
   * 베이스 URL 추출 (언어 경로 제거)
   */
  static extractBaseUrl(url: string): string {
    return url
      .replace(/\/(en|ko|kr|zh|cn|es|es-es)(\?.*)?$/, '')
      .replace(/\/(en|ko|kr|zh|cn|es|es-es)\/.*$/, '');
  }
}

// 앱 시작 시 초기화
if (typeof window !== 'undefined') {
  URLMappingUtils.initialize().then(() => {
    URLMappingUtils.loadCustomMappings();
  });
}

// 기본 내보내기
export default urlMappings; 