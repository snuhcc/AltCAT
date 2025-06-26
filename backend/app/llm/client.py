import aisuite as ai
from llm.prompt_util import *
import asyncio
import os
import cairosvg
import base64
import logging
import time
import traceback
from fastapi import HTTPException

OPENAI_4O_MINI_MODEL = "openai:gpt-4o-mini"
OPENAI_4O = "openai:gpt-4o"
PROMPT_NAME_IMAGE_CLASSIFICATION = "image_classification"
PROMPT_NAME_ENHACNED_ALT_TEXT = "enhanced_alt_text_generation"
PROMPT_NAME_CULTURE_AWARE_KOREAN = "culture_aware_translation_korean"
PROMPT_NAME_CULTURE_AWARE_SPANISH = "culture_aware_translation_spanish"
PROMPT_NAME_CULTURE_AWARE_CHINESE = "culture_aware_translation_chinese"

DIR_NAME_SVG_DATA = "svg_data_cache"

REQUEST_TIMEOUT = 10

EMPTY_STRING = ""

def convert_svg_to_png(svg_url:str):
    logging.info(f"Converting SVG to PNG: {svg_url}")
    # Step 1: Create "image_data" directory if it doesn't exist
    dir_name = DIR_NAME_SVG_DATA
    if not os.path.exists(dir_name):
        os.makedirs(dir_name)
    
    # Step 2: Get Unique File Name from url
    file_name = svg_url.split("/")[-1]
    logging.info(f"file_name: {file_name}")
    png_filename = file_name.replace(".svg", ".png")

    # Step 3: Convert file
    cairosvg.svg2png(url=svg_url, write_to=os.path.join(dir_name, png_filename))

    # Step 4: Return abs path of the PNG file
    return os.path.abspath(os.path.join(dir_name, png_filename))

def create_messages(prompt_name: str, image_url: str, alt_text: str, image_type:str = "", context:str = ""):
    prompts = load_prompts()
    selected_prompt = get_prompt(prompts, prompt_name)
    messages = None
    if prompt_name == PROMPT_NAME_ENHACNED_ALT_TEXT:
        system_prompt = selected_prompt["system_prompt"]
        user_prompt_template = selected_prompt["user_prompt"]
        variables = {
            "current_alt_text": alt_text,
            "image_url": image_url,
            "image_type": image_type, 
            "context": context
        }
        formatted_user_prompt = user_prompt_template.format(
            current_alt_text=variables["current_alt_text"],
            image_url=variables["image_url"],
            image_type=variables["image_type"],
            context=variables["context"]
        )
        logging.info(formatted_user_prompt)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": formatted_user_prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ]
            }
        ]
        return messages
    elif prompt_name == PROMPT_NAME_IMAGE_CLASSIFICATION:
        system_prompt = selected_prompt["system_prompt"]
        user_prompt_template = selected_prompt["user_prompt"]
        variables = {"image_url": image_url}
        formatted_user_prompt = user_prompt_template.format(
            image_url=variables["image_url"],
        )
        logging.info(formatted_user_prompt)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": formatted_user_prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ]
            }
        ]
        return messages
    else:
        raise HTTPException(status_code=500, detail="프롬프트 이름이 잘못되었습니다.")

def call_api_with_retries(client, model, messages, temperature=0.0, max_retries=3, timeout=5):
    """
    client.chat.completions.create를 최대 max_retries번 시도하고,
    실패 시 예외를 다시 raise 혹은 특정 값을 리턴하여 처리할 수 있게 하는 헬퍼 함수
    """
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                timeout=timeout
            )
            return response
        except Exception as e:  # 실제로는 Timeout 등 필요한 예외를 지정해주는 것이 좋음
            logging.error(f"[{attempt+1}/{max_retries}] API 호출 도중 예외 발생: {e}")
            if attempt < max_retries - 1:
                # 잠깐 쉬었다가 재시도
                time.sleep(1)
                continue
            else:
                # 재시도를 모두 소진한 경우
                raise e 

def make_request(image_url: str, alt_text: str, is_button: bool = False, context: str = ""):
    client = ai.Client()
    
    # Download svg image and convert to png
    logging.info(f"image_url: {image_url}")
    if image_url.strip().lower().endswith('.svg'):
        image_path = convert_svg_to_png(image_url)
        image_url = f"data:image/png;base64,{base64.b64encode(open(image_path, 'rb').read()).decode('utf-8')}"

    logging.info(f"image_url: {image_url}")

    image_type = ""
    #TODO: Temporary disable for demo
    if True:
    # if not is_button:
        messages = create_messages(PROMPT_NAME_IMAGE_CLASSIFICATION, image_url, alt_text, "", context)
        try:
            response = call_api_with_retries(
                client=client,
                model=OPENAI_4O_MINI_MODEL,
                messages=messages,
                temperature=0.0,
                timeout=REQUEST_TIMEOUT
            )
            image_type = response.choices[0].message.content
        except Exception as e:
            # 최종적으로 실패한 경우 처리
            logging.error(f"image_type 생성 중 타임아웃 혹은 오류: {e}")
            return "TimeoutError", "", ""
    else:
        logging.info("is_button is True")
        image_type = "Controls, Form Elements, and Links"

    # 🔥 로직 변경: Original alt text 유무에 따라 generate 또는 modify 중 하나만 수행
    if alt_text == EMPTY_STRING:
        # Original alt text가 없음 → Generate 작업만 수행
        logging.info("No original alt-text found. Performing GENERATE operation.")
        messages = create_messages(PROMPT_NAME_ENHACNED_ALT_TEXT, image_url, "", image_type, context)
        try:
            response = call_api_with_retries(
                client=client,
                model=OPENAI_4O_MINI_MODEL,
                messages=messages,
                temperature=0.1,
                timeout=REQUEST_TIMEOUT
            )
            ai_generated_alt_text = response.choices[0].message.content
            ai_modified_alt_text = EMPTY_STRING  # 수행하지 않음
        except Exception as e:
            logging.error(f"ai_generated_alt_text 생성 중 타임아웃 혹은 오류: {e}")
            return image_type, "TimeoutError", ""
    else:
        # Original alt text가 있음 → Modify 작업만 수행
        logging.info(f"Original alt-text found: '{alt_text}'. Performing MODIFY operation.")
        messages = create_messages(PROMPT_NAME_ENHACNED_ALT_TEXT, image_url, alt_text, image_type, context)
        try:
            response = call_api_with_retries(
                client=client,
                model=OPENAI_4O_MINI_MODEL,
                messages=messages,
                temperature=0.1,
                timeout=REQUEST_TIMEOUT
            )
            ai_generated_alt_text = EMPTY_STRING  # 수행하지 않음
            ai_modified_alt_text = response.choices[0].message.content
        except Exception as e:
            logging.error(f"ai_modified_alt_text 생성 중 타임아웃 혹은 오류: {e}")
            return image_type, "", "TimeoutError"

    return image_type, ai_generated_alt_text, ai_modified_alt_text

async def get_ai_generated_alt_text(image_url: str, alt_text: str, is_button:bool = False, context: str = ""):
    try:
        loop = asyncio.get_event_loop()
        image_type, ai_generated_alt_text, ai_modified_alt_text = await loop.run_in_executor(None, lambda: make_request(image_url, alt_text, is_button, context))
        logging.info(f"image_type:{image_type}")
        logging.info(f"ai_generated_alt_text:{ai_generated_alt_text}")
        logging.info(f"ai_modified_alt_text:{ai_modified_alt_text}")
        return image_url, alt_text, image_type, ai_generated_alt_text, ai_modified_alt_text
    except Exception as e:
        # 에러 발생한 함수명과 에러 메시지 출력
        error_trace = traceback.format_exc()  # 전체 스택 트레이스
        print(f"Error in function '{get_ai_generated_alt_text.__name__}': {e}")
        print("Full traceback:")
        print(error_trace)
        raise HTTPException(status_code=500, detail=f"Error in {get_ai_generated_alt_text.__name__}: {str(e)}")

# =============================================================================
# 🚫 DEPRECATED: 기존 번역 로직 (새로운 translator 모듈로 대체 예정)
# =============================================================================

# def create_translation_messages(prompt_name: str, english_alt_text: str):
#     """
#     Culture-aware translation을 위한 메시지 생성
#     """
#     prompts = load_prompts()
#     selected_prompt = get_prompt(prompts, prompt_name)
    
#     system_prompt = selected_prompt["system_prompt"]
#     user_prompt_template = selected_prompt["user_prompt"]
    
#     formatted_user_prompt = user_prompt_template.format(
#         english_alt_text=english_alt_text
#     )
    
#     logging.info(f"Translation prompt: {formatted_user_prompt}")
    
#     messages = [
#         {"role": "system", "content": system_prompt},
#         {"role": "user", "content": formatted_user_prompt}
#     ]
    
#     return messages

# def translate_culture_aware_sync(english_alt_text: str, target_language: str):
#     """
#     영어 alt-text를 문화적 특성을 고려하여 번역하는 동기 함수
#     """
#     client = ai.Client()
    
#     # 언어별 프롬프트 매핑
#     prompt_mapping = {
#         'ko': PROMPT_NAME_CULTURE_AWARE_KOREAN,
#         'es': PROMPT_NAME_CULTURE_AWARE_SPANISH,
#         'zh': PROMPT_NAME_CULTURE_AWARE_CHINESE
#     }
    
#     prompt_name = prompt_mapping.get(target_language)
#     if not prompt_name:
#         logging.warning(f"Unsupported language: {target_language}")
#         return english_alt_text  # 지원하지 않는 언어면 원본 반환
    
#     messages = create_translation_messages(prompt_name, english_alt_text)
    
#     try:
#         response = call_api_with_retries(
#             client=client,
#             model=OPENAI_4O_MINI_MODEL,
#             messages=messages,
#             temperature=0.3,  # 창의성과 일관성의 균형
#             timeout=REQUEST_TIMEOUT
#         )
#         translated_text = response.choices[0].message.content.strip()
#         logging.info(f"Translation result - {target_language}: {translated_text}")
#         return translated_text
#     except Exception as e:
#         logging.error(f"Culture-aware translation failed: {e}")
#         return english_alt_text  # 실패 시 원본 반환

# async def translate_culture_aware(english_alt_text: str, target_language: str):
#     """
#     영어 alt-text를 문화적 특성을 고려하여 번역하는 비동기 함수
#     """
#     try:
#         loop = asyncio.get_event_loop()
#         translated_text = await loop.run_in_executor(
#             None, 
#             lambda: translate_culture_aware_sync(english_alt_text, target_language)
#         )
#         logging.info(f"Culture-aware translation completed: {english_alt_text} -> {translated_text}")
#         return translated_text
#     except Exception as e:
#         error_trace = traceback.format_exc()
#         logging.error(f"Error in function '{translate_culture_aware.__name__}': {e}")
#         logging.error(f"Full traceback: {error_trace}")
#         raise HTTPException(status_code=500, detail=f"Error in {translate_culture_aware.__name__}: {str(e)}")

# =============================================================================
# 🔥 새로운 번역 시스템은 translator 모듈에서 구현 예정
# =============================================================================

# 임시로 기존 함수 호출을 유지하기 위한 스텁 함수
async def translate_culture_aware(english_alt_text: str, target_language: str):
    """
    임시 스텁 함수 - 새로운 translator 모듈로 대체 예정
    """
    return f"[PLACEHOLDER] Translation of '{english_alt_text}' to {target_language}"
