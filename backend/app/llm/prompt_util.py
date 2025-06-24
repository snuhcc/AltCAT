from fastapi import HTTPException
import yaml

# prompts.yaml 로드 함수
def load_prompts():
    try:
        with open("llm/prompts.yaml", "r", encoding="utf-8") as file:
            prompts = yaml.safe_load(file)
            return prompts
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="prompts.yaml 파일을 찾을 수 없습니다.")
    except yaml.YAMLError:
        raise HTTPException(status_code=500, detail="prompts.yaml 파일 파싱 에러")
    
# 특정 프롬프트 찾기
def get_prompt(prompts, name):
    for prompt in prompts["prompts"]:
        if prompt["name"] == name:
            return prompt
    return None