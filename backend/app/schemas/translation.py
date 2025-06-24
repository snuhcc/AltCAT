from pydantic import BaseModel
from typing import Optional

class CultureAwareTranslationRequest(BaseModel):
    english_alt_text: str
    target_language: str  # 'ko', 'es', 'zh'

class CultureAwareTranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    target_language: str 