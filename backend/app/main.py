from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from llm.client import get_ai_generated_alt_text, translate_culture_aware
from parser.parser import parse_page, download_html
from schemas.alt_text import *
from schemas.parser import *
from schemas.translation import *
import logging
import asyncio
import requests


from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


from fastapi.middleware.cors import CORSMiddleware



# .env 파일 로드
load_dotenv()

# FastAPI 인스턴스 생성
app = FastAPI(title="AltAuthor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프론트엔드 도메인으로 제한 가능
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

@app.post("/api/download_html")
async def download_html_endpoint(request: DownloadHTMLRequest):
    """
    주어진 URL로부터 HTML을 다운받아 반환
    (Selenium을 사용)
    """
    try:
        html_code = download_html(request.url, enable_logging=True)
        if html_code is None:
            raise HTTPException(status_code=500, detail="HTML 다운로드에 실패했습니다.")

        return {"html_code": html_code}

    except Exception as e:
        logging.error(f"HTML 다운로드 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update_alt_text")
async def update_alt_text_endpoint(request: UpdateAltTextRequest):
    """
    Receives HTML code and updates the <img> alt text server-side.
    Returns the modified HTML.
    """
    try:
        # 1) Parse the HTML using BeautifulSoup
        soup = BeautifulSoup(request.html_code, "html.parser")
        
        # 2) Find the <img> tag matching image_url
        target_img = soup.find("img", {"src": request.image_url})
        if not target_img:
            raise HTTPException(status_code=404, detail=f"No matching <img> with alt_text: {request.customized_alt_text} found in the HTML.")

        # 3) Update alt attribute
        target_img["alt"] = request.customized_alt_text
        
        # 4) Convert back to string
        updated_html = str(soup)

        return {
            "updated_html": updated_html
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#API Endpoint
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <html>
        <head>
            <title>AltAuthor API</title>
        </head>
        <body>
            <h1>Welcome to AltAuthor API</h1>
            <p>This API provides AI-generated alternative text for images and helps with web page parsing.</p>

            <h2>Useful Links:</h2>
            <ul>
                <li><a href="/docs">Swagger UI</a> - Interactive API documentation</li>
                <li><a href="/redoc">ReDoc</a> - Static API documentation</li>
            </ul>

            <h2>Main Endpoints:</h2>
            <ul>
                <li><a href="/api/get_ai_generated_alt_text">/api/get_ai_generated_alt_text</a> - Generate alternative text for an image</li>
                <li><a href="/api/get_ai_generated_alt_text_list">/api/get_ai_generated_alt_text_list</a> - Generate alternative text for multiple images</li>
                <li><a href="/api/parse_url">/api/parse_url</a> - Parse a web page for images</li>
                <li><a href="/api/parse_url_generate_alt_text">/api/parse_url_generate_alt_text</a> - Parse a page and generate alternative text</li>
            </ul>

            <p>API Version: 0.0.1</p>
            <p>For more information or support, contact: <a href="mailto:artechne@snu.ac.kr">artechne@snu.ac.kr</a></p>
        </body>
    </html>
    """
    return html_content

@app.post("/api/get_ai_generated_alt_text", response_model=AltTextResponse)
async def ai_generated_alt_text_endpoint(request: AltTextRequest):
    image_url, previous_alt_text, image_type, ai_generated_alt_text, ai_modified_alt_text= await get_ai_generated_alt_text(request.image_url, request.alt_text, request.is_button, request.context)
    return AltTextResponse(image_url=image_url, 
                           previous_alt_text=previous_alt_text,
                           image_type=image_type,
                           ai_generated_alt_text=ai_generated_alt_text,
                           ai_modified_alt_text=ai_modified_alt_text)

@app.post("/api/get_ai_generated_alt_text_list", response_model=AltTextListResponse)
async def ai_generated_alt_text_list_endpoint(request: AltTextListRequest):
    tasks = [
        get_ai_generated_alt_text(item.image_url, item.alt_text, item.is_button, item.context) for item in request.images
    ]   
    outputs = await asyncio.gather(*tasks)
    results = [AltTextResponse(image_url=image_url, 
                               previous_alt_text=previous_alt_text,
                               image_type=image_type,
                               ai_generated_alt_text=ai_generated_alt_text,
                               ai_modified_alt_text=ai_modified_alt_text) for image_url, previous_alt_text, image_type, ai_generated_alt_text, ai_modified_alt_text in outputs]
    return AltTextListResponse(results=results)

@app.options("/api/parse_url")
async def options_parse_url_endpoint():
    return {
        "Allow": "OPTIONS, POST",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type"
    }

@app.post("/api/parse_url", response_model=ParserResponse)
async def parse_webpage_endpoint(request: ParserRequest):
    try:
        result = parse_page(
            url=str(request.url),
            container=request.container,
            enable_logging=request.enable_logging
        )
        
        if result is None:
            raise HTTPException(
                status_code=500,
                detail="페이지 파싱 중 오류가 발생했습니다."
            )
            
        return ParserResponse(
            images=result,
        )
        
    except Exception as e:
        logging.error(f"파싱 엔드포인트 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"예상치 못한 오류가 발생했습니다: {str(e)}"
        )
    
@app.post("/api/parse_url_generate_alt_text", response_model=AltTextListResponse)
async def parse_webpage_generate_alt_text_endpoint(request: ParserRequest):
    try:
        result = parse_page(
            url=str(request.url),
            container=request.container,
            enable_logging=request.enable_logging
        )
        
        if result is None:
            raise HTTPException(
                status_code=500,
                detail="페이지 파싱 중 오류가 발생했습니다."
            )
        
        tasks = [
            get_ai_generated_alt_text(item['img_url'], item['alt_text'], item['is_button'], item['context']) for item in result
        ]

        outputs = await asyncio.gather(*tasks)
        results = [AltTextResponse(image_url=image_url, 
                                   previous_alt_text=previous_alt_text,
                                   image_type=image_type,
                                   ai_generated_alt_text=ai_generated_alt_text,
                                   ai_modified_alt_text=ai_modified_alt_text) 
                                   for image_url, previous_alt_text, image_type, ai_generated_alt_text, ai_modified_alt_text in outputs]

        return AltTextListResponse(results=results)

    except Exception as e:
        logging.error(f"파싱 엔드포인트 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"예상치 못한 오류가 발생했습니다: {str(e)}"
        )

@app.post("/api/translate_culture_aware", response_model=CultureAwareTranslationResponse)
async def translate_culture_aware_endpoint(request: CultureAwareTranslationRequest):
    """
    영어 alt-text를 문화적 특성을 고려하여 번역
    """
    try:
        # 지원하는 언어 검증
        supported_languages = ['ko', 'es', 'zh']
        if request.target_language not in supported_languages:
            raise HTTPException(
                status_code=400, 
                detail=f"지원하지 않는 언어입니다. 지원 언어: {supported_languages}"
            )
        
        # 번역 수행
        translated_text = await translate_culture_aware(
            request.english_alt_text,
            request.target_language
        )
        
        return CultureAwareTranslationResponse(
            original_text=request.english_alt_text,
            translated_text=translated_text,
            target_language=request.target_language
        )
    except HTTPException:
        # HTTPException은 그대로 재발생
        raise
    except Exception as e:
        logging.error(f"Culture-aware translation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))