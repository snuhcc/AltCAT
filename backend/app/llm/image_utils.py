"""
이미지 처리 유틸리티 함수들
- 로컬 이미지 base64 변환
- SVG → PNG 변환
- 이미지 압축
"""

import os
import base64
import logging
import cairosvg
from PIL import Image
import io

# 프로젝트 루트 경로
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# SVG 캐시 디렉토리
SVG_CACHE_DIR = os.path.join(PROJECT_ROOT, "backend", "app", "svg_data_cache")

# 로컬 이미지 매핑 (URL에 포함된 파일명 → 로컬 경로)
LOCAL_IMAGES = {
    "denver-cropped.png": os.path.join(PROJECT_ROOT, "images", "denver-cropped.png"),
    "jenny-teaser.png": os.path.join(PROJECT_ROOT, "images", "jenny-teaser.png")
}


def sanitize_image_url_for_logging(image_url: str) -> str:
    """base64 이미지 URL을 로깅용으로 축약"""
    if image_url.startswith("data:image"):
        # data:image/png;base64,... 형식
        parts = image_url.split(",", 1)
        if len(parts) == 2:
            return f"{parts[0]},<base64_data_length:{len(parts[1])}>"
        return "<base64_image>"
    return image_url


def compress_image(image_path: str, max_size: int = 1024) -> bytes:
    """이미지를 압축하여 바이트로 반환 (최대 크기: max_size px)"""
    with Image.open(image_path) as img:
        # RGBA를 RGB로 변환 (PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        
        # 비율 유지하며 리사이징
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # JPEG로 압축 (품질 92 - 디테일 유지)
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=92, optimize=True)
        return buffer.getvalue()


def convert_svg_to_png_base64(svg_url: str) -> str:
    """
    SVG URL을 PNG로 변환하고 base64 데이터 URL로 반환
    """
    logging.info(f"Converting SVG to PNG: {svg_url}")
    
    # SVG 캐시 디렉토리 생성
    if not os.path.exists(SVG_CACHE_DIR):
        os.makedirs(SVG_CACHE_DIR)
    
    # 파일명 생성
    file_name = svg_url.split("/")[-1]
    png_filename = file_name.replace(".svg", ".png")
    png_path = os.path.join(SVG_CACHE_DIR, png_filename)
    
    # SVG를 PNG로 변환
    cairosvg.svg2png(url=svg_url, write_to=png_path)
    
    # PNG 파일을 base64로 인코딩
    with open(png_path, 'rb') as png_file:
        png_data = base64.b64encode(png_file.read()).decode('utf-8')
    
    # 캐시된 PNG 파일 삭제 (메모리 관리)
    try:
        os.remove(png_path)
    except Exception as e:
        logging.warning(f"Failed to remove cached PNG file: {e}")
    
    return f"data:image/png;base64,{png_data}"


def process_image_url(image_url: str) -> str:
    """
    이미지 URL을 처리하여 OpenAI Vision API가 사용할 수 있는 형태로 변환
    
    처리 순서:
    1. 로컬 하드코딩 이미지 체크 (denver, jenny)
    2. SVG 체크 및 변환
    3. 그대로 반환 (외부 URL)
    
    Args:
        image_url: 원본 이미지 URL
        
    Returns:
        처리된 이미지 URL (base64 또는 원본)
    """
    # 1. 로컬 이미지 체크
    for img_name, img_path in LOCAL_IMAGES.items():
        if img_name in image_url:
            if os.path.exists(img_path):
                # 이미지 압축 (1024px 이하, JPEG 품질 92)
                compressed_data = compress_image(img_path, max_size=1024)
                base64_url = f"data:image/jpeg;base64,{base64.b64encode(compressed_data).decode('utf-8')}"
                logging.info(f"✅ Converted {img_name} to compressed base64 (size: {len(compressed_data)} bytes)")
                return base64_url
            else:
                logging.error(f"❌ Local file not found: {img_path}")
            break
    
    # 2. SVG 체크
    if image_url.strip().lower().endswith('.svg'):
        logging.info(f"SVG detected, converting to PNG: {image_url}")
        return convert_svg_to_png_base64(image_url)
    
    # 3. 그대로 반환
    return image_url

