import logging
import os
import importlib
import fake_useragent
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import parser.config as config

def load_config():
    """설정을 다시 로드하는 함수"""
    importlib.reload(config)
    return {
        "WEBDRIVER_CONFIG": config.WEBDRIVER_CONFIG,
        "CHROME_OPTIONS": config.CHROME_OPTIONS,
        "IMAGE_CONFIG": config.IMAGE_CONFIG,
        "LOGGING_CONFIG": config.LOGGING_CONFIG,
    }

def setup_logging(enable_logging=True):
    """로깅 설정을 초기화하는 함수"""
    if not enable_logging:
        logging.getLogger().setLevel(logging.WARNING)
        return

    configs = load_config()
    root = logging.getLogger()
    if root.handlers:
        for handler in root.handlers[:]:
            root.removeHandler(handler)
            handler.close()

    # Selenium 로거 레벨을 WARNING으로 설정
    selenium_logger = logging.getLogger("selenium")
    selenium_logger.setLevel(logging.WARNING)

    # urllib3 로거 레벨도 WARNING으로 설정
    urllib3_logger = logging.getLogger("urllib3")
    urllib3_logger.setLevel(logging.WARNING)

    readability_logger = logging.getLogger("readability.readability")
    readability_logger.setLevel(logging.WARNING)

    os.makedirs(configs["LOGGING_CONFIG"]["log_dir"], exist_ok=True)
    log_file = os.path.join(
        configs["LOGGING_CONFIG"]["log_dir"],
        f"{configs['LOGGING_CONFIG']['file_prefix']}{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
    )

    logging.basicConfig(
        level=getattr(logging, configs["LOGGING_CONFIG"]["level"]),
        format=configs["LOGGING_CONFIG"]["format"],
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8", mode="w"),
            logging.StreamHandler(),
        ],
    )

def setup_webdriver():
    """웹드라이버를 설정하고 반환하는 함수"""
    configs = load_config()
    options = Options()

    # fake-useragent 설정
    try:
        ua = fake_useragent.UserAgent()
        user_agent = ua.random
        options.add_argument(f'user-agent={user_agent}')
        
    except Exception as e:
        # 기본 User-Agent 설정
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    # 기존 옵션들 추가
    for option in configs["CHROME_OPTIONS"]:
        options.add_argument(option)
    
    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )