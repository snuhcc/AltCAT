# 웹드라이버 관련 설정
WEBDRIVER_CONFIG = {
    "timeout": 20,                # 페이지 로딩 대기 시간
    "retry_attempts": 3,          # 재시도 횟수
    "retry_wait": 5,             # 재시도 대기 시간(초)
    "scroll_pause_time": 2,      # 스크롤 후 대기 시간
}

# 크롬 드라이버 옵션
CHROME_OPTIONS = [
            "--headless",
            "--disable-gpu",
            "--log-level=3",
            "start-maximized",
            "--disable-infobars",
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--disable-site-isolation-trials",
            "--memory-pressure-off",
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-browser-side-navigation",
            "--disable-notifications",
            "--blink-settings=imagesEnabled=true",
            "--page-load-strategy=eager"
            ]



# 이미지 처리 관련 설정
IMAGE_CONFIG = {
    "min_width": 5,           # 최소 이미지 너비
    "min_height": 5,          # 최소 이미지 높이
}

# 로깅 설정
LOGGING_CONFIG = {
    "level": "DEBUG",
    "format": "%(asctime)s - %(levelname)s - %(message)s",
    "log_dir": "logs",          # 로그 저장 디렉토리
    "file_prefix": "parser_log_"
}