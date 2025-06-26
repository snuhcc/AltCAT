// api.ts
import axios from 'axios';
import { ParsedImage, DownloadHtmlResponse } from './types';

/**
 * URL에서 이미지를 파싱하고 Alt Text를 생성하는 API
 */
export const fetchImages = async (
  url: string,
  setLoading: (loading: boolean) => void,
  setParsedImages: (images: ParsedImage[]) => void
) => {
  setLoading(true);
  const param = {
    url: url,
    container: "",
    enable_logging: true,
  };

  try {
    console.log('Request:', JSON.stringify(param));
    const response = await axios.post("http://127.0.0.1:8000/api/parse_url_generate_alt_text", param);
    console.log('Response:', response.data);

    // 각 이미지를 순회하며 id(1부터 시작)를 매핑
    const imagesWithId = response.data.results.map((img: any, index: number) => ({
      ...img,
      id: index + 1,
    }));

    setParsedImages(imagesWithId);
  } catch (error) {
    console.error('Failed to fetch images:', error);
  } finally {
    setLoading(false);
  }
};

/**
 * URL에서 alt-text만 파싱하는 API (AI 생성 없음)
 * 다국어 페이지 파싱시 사용
 */
export const fetchAltTextsOnly = async (url: string): Promise<Record<string, string> | null> => {
  const param = {
    url: url,
    container: "",
    enable_logging: true,
  };

  try {
    console.log('Request (alt-text only):', JSON.stringify(param));
    const response = await axios.post("http://127.0.0.1:8000/api/parse_url", param);
    console.log('Response (alt-text only):', response.data);

    // 응답에서 alt-text 정보만 추출하여 간단한 형태로 변환
    const altTexts: Record<string, string> = {};
    
    if (response.data.images && Array.isArray(response.data.images)) {
      response.data.images.forEach((img: any) => {
        if (img.img_url && typeof img.alt_text === 'string') {
          altTexts[img.img_url] = img.alt_text;
        }
      });
    }

    return altTexts;
  } catch (error) {
    console.error('Failed to fetch alt texts:', error);
    return null;
  }
};

export const regenerateImage = async (
  url: string,
  original_alt_text: string,
  customized_alt_text: string,
) => {

  const param = {
    image_url: url,
    alt_text: original_alt_text,
    context: customized_alt_text,
  };

  try {
    console.log('Request:', JSON.stringify(param));
    const response = await axios.post("http://127.0.0.1:8000/api/get_ai_generated_alt_text", param);
    console.log('Response:', response.data);

    // 여기서 response.data가 다음과 같이 생겼다고 가정:
    // {
    //   "image_url": "...",
    //   "previous_alt_text": "...",
    //   "image_type": "...",
    //   "ai_generated_alt_text": "...",
    //   "ai_modified_alt_text": "..."
    // }

    // 서버 응답의 실제 JSON 데이터를 반환
    return response.data;

  } catch (error) {
    console.error('Failed to regenerate alt text:', error);
    // 에러 발생 시 null 또는 빈 객체 등 적절한 값을 반환할 수 있음
    return null;
  }
};

async function saveCustomizedAlt(
  htmlCode: string,
  imageUrl: string,
  customizedAltText: string
) {
  try {
    const response = await fetch("http://localhost:8000/api/update_alt_text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html_code: htmlCode,
        image_url: imageUrl,
        customized_alt_text: customizedAltText,
      }),
    });
    if (!response.ok) {
      throw new Error("Update alt text failed");
    }
    const data = await response.json();
    // data.updated_html now contains the updated HTML
    console.log("Updated HTML:", data.updated_html);
  } catch (error) {
    console.error(error);
  }
}

/**
 * 백엔드에 URL을 보내서 해당 페이지의 HTML을 다운받아옴
 */
export async function downloadHtml(url: string): Promise<string | null> {
  try {
    const response = await axios.post<DownloadHtmlResponse>(
      'http://localhost:8000/api/download_html',
      { url }
    );
    return response.data.html_code;
  } catch (err) {
    console.error('[fetchSeleniumHtml] 에러:', err);
    return null;
  }
}

/**
 * 영어 alt-text를 문화적 특성을 고려하여 번역
 */
export const translateToCultureAware = async (
  englishAltText: string, 
  targetLanguage: string,
  imageUrl?: string,
  imageType?: string
): Promise<string | null> => {
  try {
    console.log('Culture-aware translation request:', { 
      englishAltText, 
      targetLanguage,
      imageUrl,
      imageType
    });
    
    const requestBody: any = {
      english_alt_text: englishAltText,
      target_language: targetLanguage
    };
    
    // image_url과 image_type이 있으면 추가
    if (imageUrl) {
      requestBody.image_url = imageUrl;
    }
    if (imageType) {
      requestBody.image_type = imageType;
    }
    
    const response = await axios.post("http://127.0.0.1:8000/api/translate_culture_aware", requestBody);
    
    console.log('Culture-aware translation response:', response.data);
    
    return response.data.translated_text;
  } catch (error) {
    console.error('Culture-aware translation failed:', error);
    return null;
  }
};