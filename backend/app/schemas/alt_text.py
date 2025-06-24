from pydantic import BaseModel
from typing import List, Optional

# 요청 모델 정의
class AltTextRequest(BaseModel):
    image_url: str
    alt_text: str
    is_button: Optional[bool] = False
    context: Optional[str] = ""

class AltTextListRequest(BaseModel):
    images: List[AltTextRequest]

# 응답 모델 정의
class AltTextResponse(BaseModel):
    image_url: str
    previous_alt_text: str
    image_type: str
    ai_generated_alt_text: str
    ai_modified_alt_text: str
    
class AltTextListResponse(BaseModel):
    results: List[AltTextResponse]