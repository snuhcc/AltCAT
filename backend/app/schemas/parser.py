from pydantic import BaseModel, HttpUrl
from typing import List, Optional

# 요청 모델 정의
class ParserRequest(BaseModel):
    url: HttpUrl
    container: Optional[str] = None
    enable_logging: Optional[bool] = True

# 응답 모델 정의
class ParserResponse(BaseModel):
    images: list
    
class UpdateAltTextRequest(BaseModel):
    html_code: str              # The HTML to be modified
    image_url: str              # The <img> source or another unique key
    customized_alt_text: str    # The user's new alt text
    
class DownloadHTMLRequest(BaseModel):
    url: str