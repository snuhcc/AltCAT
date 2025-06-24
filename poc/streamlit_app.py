import streamlit as st
from datasets import load_dataset
from itertools import islice
from PIL import Image
from io import BytesIO
import base64
from dotenv import load_dotenv
import os
import json
import aisuite as ai
import yaml
import concurrent.futures

HUGGING_FACE_DATASET_CACHE_FILE = "cached_data.json"
READ_DATA_LIMIT = 10

# YAML 파일 읽기
def load_yaml(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    return data
# 특정 프롬프트 찾기
def get_prompt(data, name):
    for prompt in data["prompts"]:
        if prompt["name"] == name:
            return prompt
    return None

def get_response(client, model, messages, temperature=0.0):
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.0,
    )
    return model, response.choices[0].message.content

def encode_image(image_obj):
    if isinstance(image_obj, str):  # 파일 경로인 경우
        with open(image_obj, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
    else:  # 이미지 객체인 경우
        buffered = BytesIO()
        image_obj.save(buffered, format="PNG")  # 객체를 PNG 형식으로 저장
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
    
def decode_image(image_str):
    return base64.b64decode(image_str)

# 데이터 로드 함수
def load_and_cache_data(dataset_id, split="train", limit=2):
    """
    데이터셋을 로드하고 JSON 캐시 파일에 저장. 캐시가 존재하면 로드하지 않음.
    """
    if os.path.exists(HUGGING_FACE_DATASET_CACHE_FILE):
        # 캐시된 데이터 로드
        with open(HUGGING_FACE_DATASET_CACHE_FILE, "r", encoding="utf-8") as f:
            cached_data = json.load(f)
        print("Loaded data from cache.")
    else:
        # Hugging Face 데이터셋 로드 및 캐싱
        dataset = load_dataset(dataset_id, streaming=True)
        input_data = []
        for data in islice(dataset[split], limit):
            filtered_data = {
                "image_id": data.get("image_id"),
                "image": encode_image(data.get("image")),
                "alt_text": data.get("alt_text"),
                "gpt_alt_text": data.get("gpt_alt_text"),
            }
            input_data.append(filtered_data)

        # 캐시 파일 저장
        with open(HUGGING_FACE_DATASET_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(input_data, f, ensure_ascii=False, indent=4)
        cached_data = input_data
        print("Data loaded and cached.")

    return cached_data
# 캐시 클리어 함수
def clear_cache():
    """
    캐시 파일 삭제.
    """
    if os.path.exists(HUGGING_FACE_DATASET_CACHE_FILE):
        os.remove(HUGGING_FACE_DATASET_CACHE_FILE)
        st.success("Cache cleared successfully.")
    else:
        st.warning("No cache file found.")

def on_change_image_id():
    selected_value = st.session_state["select_box_image_id"]
    print(selected_value)
    display_image_and_alt_text(selected_value)
    pass

def display_image_and_alt_text(image_id):
    # image_col, text_col = st.columns([1, 1])
    selected_data = next((data for data in input_data if data["image_id"] == image_id), None)

    openai_messages = create_messages(system_prompt, user_prompt, selected_data["image"])
    llama_messages = create_messages(None, user_prompt, selected_data["image"])
    # print(MODEL_GPT_4O)
    # print(selected_data["image_id"])
    # print(selected_data["alt_text"])

    ## llama-3.2-vision-preview doesn't support system prompt + Image input
    models = ["openai:gpt-4o", 
              "openai:gpt-4o-mini", 
              "groq:llama-3.2-90b-vision-preview", 
              "groq:llama-3.2-11b-vision-preview",
              "huggingface:Qwen/Qwen2-VL-7B-Instruct",
              "huggingface:Qwen/Qwen2-VL-2B-Instruct"]

    if selected_data is None:
        st.error("No data found")
        return
    
    with image_col:
        st.image(decode_image(selected_data["image"]), caption=f"Image id:{image_id}", use_container_width=True)
        pass
    with text_col:
        st.write(f"🤗 alt_text: {selected_data['alt_text']}")
        st.write(f"🤗 gpt_alt_text: {selected_data['gpt_alt_text']}")
        st.divider()

        with st.spinner("wait for it..."):
            with concurrent.futures.ThreadPoolExecutor() as executor:
                # 병렬 실행
                futures = [executor.submit(get_response, client, model, openai_messages if 'openai' in model else llama_messages) for model in models]
                
                # 결과 출력
                for future in concurrent.futures.as_completed(futures):
                    model, revised_alt_text = future.result()
                    st.markdown(f"❗ <span style='color:blue; font-weight:bold;'>{model}</span> : {revised_alt_text}", unsafe_allow_html=True)
                    # st.write(f"❗ {model} revised alt-text: {revised_alt_text}")
                    # st.divider()

def create_messages(system_prompt, user_prompt, encoded_image):
    """
    메시지 구조를 생성하는 함수.

    Parameters:
    - system_prompt (str): 시스템 프롬프트 내용.
    - user_prompt (str): 사용자 프롬프트 내용.
    - encoded_image (str): Base64로 인코딩된 이미지.

    Returns:
    - list: 메시지 구조.
    """
    if system_prompt is None:
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_prompt,
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{encoded_image}"
                        },
                    },
                ],
            },
        ]
        return messages

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": user_prompt,
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{encoded_image}"
                    },
                },
            ],
        },
    ]
    return messages

load_dotenv()
# clear_cache()
# YAML 파일 로드
yaml_file = "prompts.yaml"
prompts_data = load_yaml(yaml_file)

# 'alt_text_verification' 프롬프트 가져오기
prompt_name = "alt_text_verification"
selected_prompt = get_prompt(prompts_data, prompt_name)
system_prompt = selected_prompt["system_prompt"]
user_prompt = selected_prompt["user_prompt"]

input_data = load_and_cache_data("Mozilla/alt-text-validation", split="train", limit=READ_DATA_LIMIT)
MODEL_GPT_4O = "gpt-4o"
print(len(input_data))

image_ids = []
for data in input_data:
    image_ids.append(data["image_id"])

print(image_ids)

client = ai.Client()

st.set_page_config(page_title="AltAuthor", layout="centered", page_icon="🧑‍🏫")
st.title("🧑‍🏫 HI! I'm AltAuthor")
st.subheader("I help you generate and modify alt-text for images.")
st.selectbox(
    label = "", 
    index = None,
    options=image_ids,
    key="select_box_image_id",
    placeholder="Select an image id",
    on_change=on_change_image_id,
    )
st.divider()
image_col, text_col = st.columns([1, 1])
st.divider()

