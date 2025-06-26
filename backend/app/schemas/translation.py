from pydantic import BaseModel
from typing import Optional

class CultureAwareTranslationRequest(BaseModel):
    english_alt_text: str
    target_language: str  # 'ko', 'es', 'zh'
    image_url: Optional[str] = None  # 이미지 URL (없으면 기본값 사용)
    image_type: Optional[str] = "informative"  # 이미지 타입 (기본값: informative)

class CultureAwareTranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    target_language: str
    guidelines: Optional[list] = None  # 생성된 문화적 가이드라인
    evaluation: Optional[dict] = None  # 평가 결과 