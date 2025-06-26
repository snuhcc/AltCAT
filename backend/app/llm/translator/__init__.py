"""
AltCAT Translator Module

3단계 번역 파이프라인:
1. Guideline Agent: 문화적 가이드라인 생성
2. Generator: 가이드라인 기반 번역
3. Evaluator: 번역 품질 평가

Usage:
    from llm.translator import TranslatorPipeline, translate_with_pipeline
    
    # 클래스 사용
    translator = TranslatorPipeline()
    result = await translator.translate(
        original_alt_text="USCIS logo",
        target_language="ko",
        image_url="https://example.com/image.png"
    )
    
    # 편의 함수 사용
    result = await translate_with_pipeline(
        original_alt_text="USCIS logo",
        target_language="ko",
        image_url="https://example.com/image.png"
    )
"""

from .translator import TranslatorPipeline, translate_with_pipeline

__all__ = ["TranslatorPipeline", "translate_with_pipeline"] 