"""
Main Translator Pipeline Implementation

POC 검증된 로직을 그대로 사용:
1. LangChain AgentExecutor + Tavily 검색 도구
2. 이미지 비전 포맷 지원  
3. StateGraph로 3단계 파이프라인 관리
"""

import os
import yaml
import json
import logging
import asyncio
import base64
import cairosvg  # 🔥 SVG 변환을 위해 추가
from typing import Dict, Any, Optional, List, TypedDict
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import HumanMessage


class GraphState(TypedDict):
    """그래프의 전체 상태를 정의 (POC와 동일)"""
    # 입력
    original_alt_text: str
    language: str
    image_type: str
    image_url: str
    
    # 생성 과정
    on_the_fly_guidelines: Optional[List[str]]
    generated_alt_text: Optional[str]
    
    # 평가 과정
    feedback: Optional[str]
    accessibility_score: Optional[int]
    cultural_score: Optional[int]
    
    # 에러 처리
    error: Optional[str]


class OnTheFlyGuidelines(BaseModel):
    """Guideline Agent의 출력을 위한 Pydantic 모델 (POC와 동일)"""
    on_the_fly_guidelines: List[str] = Field(description="A list of 2-3 specific, on-the-fly cultural guidelines.")


class Evaluation(BaseModel):
    """Evaluator의 출력을 위한 Pydantic 모델 (POC와 동일)"""
    accessibility_score: int = Field(description="The score for accessibility (1-5).")
    cultural_score: int = Field(description="The score for cultural appropriateness (1-5).")
    feedback: str = Field(description="If EITHER score is lower than 4, provide feedback. Otherwise, 'None'.")


class TranslatorPipeline:
    """
    POC 검증된 3단계 번역 파이프라인을 백엔드에 통합
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        초기화 - POC와 동일한 구조
        """
        if config_path is None:
            config_path = Path(__file__).parent / "translator.yaml"
        
        self.config_path = config_path
        self.config = self._load_config()
        
        # SVG 캐시 디렉토리 설정
        self.svg_cache_dir = "svg_data_cache"
        
        # LangChain 모델 초기화 (POC와 동일)
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, streaming=True)
        self.agent_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        
        # Tavily 검색 도구 초기화 (POC와 동일)
        self.tavily_tool = TavilySearchResults(max_results=3)
        self.tools = [self.tavily_tool]
        
        # 체인들 초기화
        self._init_agents_and_chains()
        
        logging.info("TranslatorPipeline initialized with POC logic")
    
    def _load_config(self) -> Dict[str, Any]:
        """translator.yaml 설정 파일 로드"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logging.info(f"Config loaded from {self.config_path}")
            return config
        except Exception as e:
            logging.error(f"Failed to load config from {self.config_path}: {e}")
            raise
    
    def _convert_svg_to_png_base64(self, svg_url: str) -> str:
        """
        SVG URL을 PNG로 변환하고 base64 데이터 URL로 반환
        """
        logging.info(f"Converting SVG to PNG: {svg_url}")
        
        # SVG 캐시 디렉토리 생성
        if not os.path.exists(self.svg_cache_dir):
            os.makedirs(self.svg_cache_dir)
        
        # 파일명 생성
        file_name = svg_url.split("/")[-1]
        png_filename = file_name.replace(".svg", ".png")
        png_path = os.path.join(self.svg_cache_dir, png_filename)
        
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
    
    def _process_image_url(self, image_url: str) -> str:
        """
        이미지 URL을 처리하여 OpenAI Vision API가 사용할 수 있는 형태로 변환
        """
        if image_url.strip().lower().endswith('.svg'):
            logging.info(f"SVG detected, converting to PNG: {image_url}")
            return self._convert_svg_to_png_base64(image_url)
        return image_url
    
    def _init_agents_and_chains(self):
        """POC와 동일한 Agent 및 Chain 초기화"""
        # Guideline Agent 생성 (POC와 동일)
        guideline_agent_prompt = ChatPromptTemplate.from_messages([
            ("system", self.config['guideline_synthesizer']['system']),
            ("user", [
                {"type": "text", "text": self.config['guideline_synthesizer']['user']},
                {"type": "image_url", "image_url": {"url": "{image_url}"}}
            ]),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        guideline_agent = create_openai_tools_agent(self.agent_llm, self.tools, guideline_agent_prompt)
        self.guideline_agent_executor = AgentExecutor(agent=guideline_agent, tools=self.tools, verbose=True)
        
        # Generator Chain 생성 - culture_guidelines 제거
        generator_system_prompt = self.config['generator']['system'].format(
            alt_text_guidelines=self.config['alt_text_guidelines'],
            on_the_fly_guidelines="{on_the_fly_guidelines}"
        )
        
        self.generation_prompt_template = ChatPromptTemplate.from_messages([
            ("system", generator_system_prompt),
            ("user", [
                {"type": "text", "text": self.config['generator']['user']},
                {"type": "image_url", "image_url": {"url": "{image_url}"}}
            ])
        ])
        self.generation_chain = self.generation_prompt_template | self.llm
        
        # Evaluator Chain 생성 - culture_guidelines 추가
        evaluator_system_prompt = self.config['evaluator']['system'].format(
            alt_text_guidelines=self.config['alt_text_guidelines'],
            culture_guidelines=self.config['culture_guidelines']
        )
        
        evaluator_prompt = ChatPromptTemplate.from_messages([
            ("system", evaluator_system_prompt),
            ("user", [
                {"type": "text", "text": self.config['evaluator']['user']},
                {"type": "image_url", "image_url": {"url": "{image_url}"}}
            ])
        ])
        self.evaluation_chain = evaluator_prompt | self.agent_llm.with_structured_output(Evaluation)
    
    async def translate(
        self,
        original_alt_text: str,
        target_language_name: str,
        image_url: str,
        image_type: str = "informative"
    ) -> Dict[str, Any]:
        """
        메인 번역 함수 - POC의 StateGraph 로직 사용
        """
        logging.info(f"Starting translation pipeline: '{original_alt_text}' -> {target_language_name}")
        
        try:
            # POC와 동일한 StateGraph 구성
            workflow = StateGraph(GraphState)
            
            # 노드 추가 (POC와 동일)
            workflow.add_node("guideline_agent", self._guideline_agent_node)
            workflow.add_node("generation_node", self._generation_node)
            workflow.add_node("evaluator", self._evaluator_node)
            
            # 엣지 연결 (POC와 동일)
            workflow.set_entry_point("guideline_agent")
            workflow.add_edge("guideline_agent", "generation_node")
            workflow.add_edge("generation_node", "evaluator")
            workflow.add_conditional_edges(
                "evaluator",
                self._should_continue,
                {"end": END, "generation_node": "generation_node"}
            )
            
            app = workflow.compile()
            
            # 입력 데이터 구성
            inputs = {
                "original_alt_text": original_alt_text,
                "language": target_language_name,
                "image_type": image_type,
                "image_url": self._process_image_url(image_url)
            }
            
            # 그래프 실행 (POC와 동일)
            final_state = {}
            for event in app.stream(inputs, {"recursion_limit": 50}):
                for key, value in event.items():
                    if key != "__end__":
                        final_state.update(value)
            
            return {
                "original_text": original_alt_text,
                "translated_text": final_state.get('generated_alt_text', original_alt_text),
                "target_language_name": target_language_name,
                "guidelines": final_state.get('on_the_fly_guidelines', []),
                "evaluation": {
                    "accessibility_score": final_state.get('accessibility_score'),
                    "cultural_score": final_state.get('cultural_score'),
                    "feedback": final_state.get('feedback')
                },
                "success": final_state.get('error') is None
            }
            
        except Exception as e:
            logging.error(f"Translation pipeline failed: {e}")
            return {
                "original_text": original_alt_text,
                "translated_text": original_alt_text,
                "target_language_name": target_language_name,
                "error": str(e),
                "success": False
            }
    
    def _guideline_agent_node(self, state: GraphState) -> GraphState:
        """Phase 1: 자율적인 에이전트가 이미지를 분석하고, 웹 검색을 통해 맞춤 가이드라인을 생성 (POC와 동일)"""
        logging.info("Step 1: Generating cultural guidelines with search")
        try:
            agent_vars = {
                "language": state["language"],
                "original_alt_text": state["original_alt_text"],
                "image_url": state["image_url"],  # 🔥 이미 처리된 이미지 URL 사용
            }
            result = self.guideline_agent_executor.invoke(agent_vars)
            
            # 에이전트의 출력에서 JSON 부분만 안전하게 추출 (POC와 동일)
            json_str = result['output'][result['output'].find('{'):result['output'].rfind('}')+1]
            guideline_json = json.loads(json_str)
            
            # Pydantic으로 유효성 검사 및 데이터 추출 (POC와 동일)
            on_the_fly_guidelines = OnTheFlyGuidelines(**guideline_json).on_the_fly_guidelines
            logging.info(f"Generated {len(on_the_fly_guidelines)} cultural guidelines")
            
            return {"on_the_fly_guidelines": on_the_fly_guidelines, "error": None}

        except Exception as e:
            logging.error(f"Guidelines generation failed: {e}")
            return {"error": str(e)}
    
    def _generation_node(self, state: GraphState) -> GraphState:
        """Phase 2: 생성된 가이드라인에 따라 최종 Alt Text를 생성 (POC와 동일)"""
        logging.info("Step 2: Generating translation with vision")
        try:
            g_vars = {
                "on_the_fly_guidelines": "\n".join([f"- {g}" for g in state["on_the_fly_guidelines"]]),
                "language": state["language"],
                "image_type": state["image_type"],
                "image_url": state["image_url"],  # 🔥 이미 처리된 이미지 URL 사용
                "original_alt_text": state["original_alt_text"],
                "previous_attempt": state.get("generated_alt_text", "N/A"),
                "feedback": state.get("feedback", "N/A")
            }

            # Vision 입력을 포함한 멀티모달 프롬프트 생성 (POC와 동일)
            prompt_with_vision = self.generation_prompt_template.invoke(g_vars)
            final_alt_text = self.llm.invoke(prompt_with_vision).content
            logging.info(f"Translation generated: '{final_alt_text}'")

            return {"generated_alt_text": final_alt_text, "error": None}

        except Exception as e:
            logging.error(f"Translation generation failed: {e}")
            return {"error": str(e)}
    
    def _evaluator_node(self, state: GraphState) -> GraphState:
        """생성된 Alt Text를 Vision을 사용하여 평가 (POC와 동일)"""
        logging.info("Step 3: Evaluating translation with vision")
        try:
            e_vars = {
                "image_url": state["image_url"],  # 🔥 이미 처리된 이미지 URL 사용
                "generated_alt_text": state["generated_alt_text"],
                "image_type": state["image_type"],
                "language": state["language"]
            }
            evaluation = self.evaluation_chain.invoke(e_vars)

            logging.info(f"Evaluation - Accessibility: {evaluation.accessibility_score}, Cultural: {evaluation.cultural_score}")

            return {
                "accessibility_score": evaluation.accessibility_score,
                "cultural_score": evaluation.cultural_score,
                "feedback": evaluation.feedback,
                "error": None
            }
        except Exception as e:
            logging.error(f"Translation evaluation failed: {e}")
            return {"error": str(e)}
    
    def _should_continue(self, state: GraphState) -> str:
        """평가 점수에 따라 다음 단계를 결정 (POC와 동일)"""
        logging.info("Checking quality threshold")
        if state.get("error"):
            logging.error(f"Error detected: {state['error']}, ending graph")
            return "end"
        
        if state.get("accessibility_score") is None or state.get("cultural_score") is None:
            logging.warning("Scores not found, ending graph to prevent loop")
            return "end"

        if state["accessibility_score"] < 4 or state["cultural_score"] < 4:
            logging.info(f"Threshold failed (A:{state['accessibility_score']}, C:{state['cultural_score']}). Looping back")
            return "generation_node"  # 피드백을 가지고 generation_node로 돌아감
        else:
            logging.info(f"Threshold passed (A:{state['accessibility_score']}, C:{state['cultural_score']})")
            return "end"


# 편의 함수들
async def translate_with_pipeline(
    original_alt_text: str,
    target_language_name: str,
    image_url: str,
    image_type: str = "informative"
) -> Dict[str, Any]:
    """
    전체 번역 파이프라인 실행 - 전체 결과 딕셔너리 반환
    """
    translator = TranslatorPipeline()
    result = await translator.translate(
        original_alt_text=original_alt_text,
        target_language_name=target_language_name,
        image_url=image_url,
        image_type=image_type
    )
    return result 