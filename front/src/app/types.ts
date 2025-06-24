// types.ts

// 수정 (2025.06.25)
export interface ParsedImage {
  id: number;
  image_url: string;
  previous_alt_text?: string | null;
  ai_generated_alt_text?: string | null;
  ai_modified_alt_text?: string | null;
  image_type?: string | null;
  customized_alt_text?: string | null;
  culture_aware_alt_text?: string | null;  //추가
}

// 다국어 지원을 위한 새로운 인터페이스들
export interface MultiLanguageImageData {
  imageUrl: string;
  masterAltText: string; // 영어 기준 AI 생성 alt-text
  languageAltTexts: Record<string, string>; // 언어별 original alt-text
  customizedAltText?: string;
  imageType?: string;
}

export interface LanguageSpecificData {
  language: string;
  images: Record<string, string>; // image_url -> alt_text 매핑
  htmlCode?: string;
}

export interface WebsiteData {
  /** URL에 대응하는 HTML 코드 (백엔드에서 다운로드해 캐싱) */
  htmlCode: string;
  /** 이미지 목록 */
  images: ParsedImage[];
  /** 다국어 데이터 */
  multiLanguageData?: Record<string, LanguageSpecificData>;
}

/** URL을 key로 하고, 해당 URL의 HTML + 이미지 정보를 묶어서 저장 */
export type ParsedImagesMap = Record<string, WebsiteData>;

export interface DownloadHtmlResponse {
  html_code: string;
}

export type AltTextField = 'originalAlt' | 'aiAlt' | 'aiMod' | 'customAlt';