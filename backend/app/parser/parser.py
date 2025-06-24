import logging
import time
import requests
import html
import re
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException,
    TimeoutException,
    NoSuchElementException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from readability.readability import Document
from retrying import retry

from parser.utils import load_config, setup_webdriver, setup_logging  # utils의 함수들을 명시적으로 import

logger = logging.getLogger(__name__)

@retry(
    stop_max_attempt_number=3,
    wait_fixed=2000,
    retry_on_exception=lambda e: isinstance(e, (WebDriverException, TimeoutException))
)
def make_img_src_absolute(html_code: str, base_url: str) -> str:
    soup = BeautifulSoup(html_code, 'html.parser')
    for img_tag in soup.find_all('img'):
        src = img_tag.get('src')
        if src:
            absolute_src = urljoin(base_url, src)
            img_tag['src'] = absolute_src
    return str(soup)


def download_html(url, enable_logging=True):
    """
    Selenium으로 주어진 URL을 열고 최종 렌더링된 HTML을 반환하며, HTML 코드를 파일로 저장할 수 있는 함수

    Args:
        url (str): 대상 페이지 URL
        enable_logging (bool): 로깅 활성화 여부
        output_file (str): 저장할 HTML 파일 경로 (예: 'output.html')

    Returns:
        str: 최종 렌더링된 HTML (page_source)
    """
    setup_logging(enable_logging)
    logger.info(f"HTML 다운로드 시작: {url}")

    driver = None
    try:
        # 1) WebDriver 세팅
        driver = setup_webdriver()

        # 2) 페이지 접속
        driver.get(url)

        # 3) 페이지 로딩 대기
        wait_for_page_load(driver)

        # 4) 광고 제거 등 필요시 추가 작업
        remove_ads(driver)

        # 5) 최종 page_source 획득
        html_content = driver.page_source
        
        # 절대 경로로 변환
        html_code = make_img_src_absolute(html_content, url)

        logger.info("HTML 다운로드 완료")
        return html_code

    except WebDriverException as e:
        logger.error(f"WebDriver 오류: {e}")
        return None
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}", exc_info=True)
        return None
    finally:
        if driver:
            driver.quit()

        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)


def parse_page(url, container=None, enable_logging=True):
    """
    웹 페이지를 파싱하여 이미지와 콘텐츠를 추출하는 메인 함수
    
    Args:
        url: 파싱할 웹 페이지 URL
        container: 특정 컨테이너 내의 콘텐츠만 파싱하고 싶을 때 사용할 CSS 선택자
        enable_logging: 로깅 활성화 여부 (기본값: True)
        
    Returns:
        dict: 이미지 데이터와 콘텐츠를 포함하는 딕셔너리
    """
    setup_logging(enable_logging)
    logger.info(f"페이지 파싱 시작: {url}")
    
    driver = None
    try:
        driver = setup_webdriver()
        driver.get(url)
        base_url = driver.current_url
        
        # 페이지 로딩 대기
        wait_for_page_load(driver)
        wait_for_images(driver)
        remove_ads(driver)
        
        # 이미지 크기 정보 수집
        image_sizes = get_image_sizes(driver)
        
        # HTML 파싱
        soup = BeautifulSoup(driver.page_source, "html.parser")
        
        # 콘텐츠 추출
        context = extract_content(soup)
        
        # 이미지 처리
        images = process_images(soup, driver, context, image_sizes, base_url, container)
        

        
        logger.info(f"이미지 {len(images)}개 추출 완료")
        if enable_logging:
            logger.debug(f"선택된 이미지 데이터: {images}")
        
        return images
        
    except WebDriverException as e:
        logger.error(f"WebDriver 오류: {e}")
        return None
        
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}", exc_info=True)
        return None
        
    finally:
        if driver:
            driver.quit()
            
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)


def wait_for_page_load(driver):
    """페이지 로딩을 기다리는 함수"""
    configs = load_config()
    wait = WebDriverWait(driver, configs["WEBDRIVER_CONFIG"]["timeout"])
    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def wait_for_images(driver):
    """이미지 로딩을 기다리는 최적화된 함수"""
    configs = load_config()
    try:
        wait = WebDriverWait(driver, configs["WEBDRIVER_CONFIG"]["timeout"])
        wait.until(lambda d: len(d.find_elements(By.TAG_NAME, "img")) > 0)
        driver.execute_script(
            """
            const style = document.createElement('style');
            style.innerHTML = `
                .braze-slideup, .popup-class-name, .ad-banner {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
            """
        )
        # Lazy Load 이미지 로드 강제화
        driver.execute_script("""
            Array.from(document.querySelectorAll('img[loading="lazy"]')).forEach(img => {
                img.loading = 'eager';
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
        """)

        # 스크롤 처리 개선
        script = """
            function getScrollHeight() {
                return Math.max(
                    document.documentElement.scrollHeight,
                    document.body.scrollHeight,
                    document.documentElement.offsetHeight,
                    document.body.offsetHeight
                );
            }
            return getScrollHeight();
        """
        
        total_height = driver.execute_script(script)
        current_height = 0
        step = 1000  
        while current_height < total_height:
            # 스크롤 실행
            driver.execute_script(f"""
                window.scrollTo({{
                    top: {current_height + step},
                    behavior: 'smooth'
                }});
            """)
            
            # 스크롤 후 잠시 대기
            time.sleep(0.5)
            
            # 새로운 이미지 로딩 처리
            driver.execute_script("""
                Array.from(document.querySelectorAll('img[loading="lazy"]')).forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.top <= window.innerHeight) {
                        img.loading = 'eager';
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                        }
                    }
                });
            """)
            
            # 새로운 높이 계산
            new_height = driver.execute_script(script)
            if new_height == total_height and current_height >= total_height - step:
                break
                
            current_height += step
            total_height = new_height
            
        # 맨 위로 스크롤
        driver.execute_script("window.scrollTo({ top: 0, behavior: 'smooth' });")
        time.sleep(configs["WEBDRIVER_CONFIG"]["scroll_pause_time"])

        # 모든 이미지 로드 확인
        driver.execute_script("""
            return Promise.all(Array.from(document.images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
            }));
        """)

    except TimeoutException:
        logger.error("이미지 로딩 시간 초과")
        return False

    return True




# def wait_for_images(driver):
#     """이미지 로딩을 기다리는 함수"""
#     configs = load_config()
#     try:
#         wait = WebDriverWait(driver, configs["WEBDRIVER_CONFIG"]["timeout"])
#         wait.until(lambda d: len(d.find_elements(By.TAG_NAME, "img")) > 0)

#         driver.execute_script(
#             """
#             return Promise.all(
#                 Array.from(document.images)
#                     .filter(img => !img.complete)
#                     .map(img => new Promise(resolve => {
#                         if (img.complete) {
#                             resolve();
#                         } else {
#                             img.onload = img.onerror = resolve;
#                         }
#                     }))
#             ).then(() => true).catch(() => false);
#             """
#         )

#         # 스크롤
#         total_height = driver.execute_script("return document.body.scrollHeight")
#         current_height = 0
#         step = 500  # 한 번에 스크롤할 픽셀

#         while current_height < total_height:
#             driver.execute_script(f"window.scrollTo(0, {current_height + step});")
#             time.sleep(1)

#             new_height = driver.execute_script("return document.body.scrollHeight")
#             if new_height == total_height:
#                 break

#             current_height += step
#             total_height = new_height

#         # 맨 위로 스크롤
#         driver.execute_script("window.scrollTo(0, 0);")
#         time.sleep(configs["WEBDRIVER_CONFIG"]["scroll_pause_time"])

#     except TimeoutException:
#         logger.error("이미지 로딩 시간 초과")
#         return False

#     return True

def get_image_sizes(driver):
    """
    현재 웹 페이지의 모든 이미지 태그(<img>)에서 URL과 크기를 추출
    """
    size_dict = driver.execute_script(
        """
        return Array.from(document.getElementsByTagName('img')).reduce((acc, img) => {
            acc[img.src] = {
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
            };
            return acc;
        }, {});
        """
    )
    return size_dict

def select_container(soup, container):
    """원하는 container 선택"""
    container_elem = soup.select_one(container)

    if container_elem is None:
        raise NoSuchElementException(f"컨테이너를 찾을 수 없습니다: {container}")

    logger.info(f"컨테이너 선택 완료: {container}")
    return container_elem

def is_button_element(element, filter_classes):
    """
    요소가 버튼 역할을 하는지 확인하는 헬퍼 함수
    """
    return (
        element.name == "button"  # <button> 태그인지 확인
        or element.get("role") == "button"  # role="button" 속성 확인
        or (element.name == "a" and element.get("href"))  # <a> 태그와 href 속성
        or element.get("onclick")  # onclick 이벤트 속성 확인
        or any(
            cls in element.get("class", []) for cls in filter_classes
        )  # 커스텀 클래스 포함
    )

def check_button(soup, element, filter_classes=None, max_depth=10):
    """이미지 요소가 버튼의 일부인지 확인하는 함수"""
    if filter_classes is None:
        filter_classes = ["btn"]

    current = element
    depth = 0

    while current and current != soup and depth < max_depth:
        if is_button_element(current, filter_classes):
            return True

        current = current.parent
        depth += 1

    return False

def check_image_rendered(driver, partial_src):

    ESA_PATHS = [
        "/var/esa/storage/images/esa_multimedia/images/2012/03/europe_seen_by_andre_kuipers_onboard_the_iss/9251267-7-eng-GB/Europe_seen_by_Andre_Kuipers_onboard_the_ISS_pillars.jpg",
        "/var/esa/storage/images/esa_multimedia/images/2018/10/from_mission_control_to_mercury/17835462-5-eng-GB/From_mission_control_to_Mercury_pillars.jpg"
    ]

    if partial_src in ESA_PATHS:
        return True


    
    script = """
    const partial = arguments[0];
    // 부분 매칭으로 img 요소를 찾음
    const img = document.querySelector('img[src*="' + partial + '"]');
    if (!img) return false;

    // 이미지가 로딩 완료됐는지 체크
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        return false;
    }

    function isActuallyVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !(
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity) === 0 ||
            (rect.width === 0 && rect.height === 0)
        );
    }
    
    let element = img;
    while (element && element !== document.body) {
        if (!isActuallyVisible(element)) {
            return false;
        }
        element = element.parentElement;
    }
    
    return true;
    """

    return driver.execute_script(script, partial_src)

def process_images(soup, driver, context, image_sizes, base_url, container=None):
    """
    페이지 내의 이미지들을 처리하는 함수
    
    Args:
        soup: BeautifulSoup 객체
        driver: Selenium WebDriver 객체
        image_sizes: 이미지 크기 정보 딕셔너리
        base_url: 기본 URL
        container: 컨테이너 선택자 (선택사항)
        
    Returns:
        list: 처리된 이미지 정보 리스트
    """
    configs = load_config()
    image_data = []
    small_image_data = []

    logger = logging.getLogger(__name__)

    if container:
        soup = select_container(soup, container)
    
    for img in soup.find_all("img"):
        print(img)

        original_src = img.get("src")
        
        if (
            not original_src  # src가 없는 경우 스킵
            # or img.get("alt") == None # alt 속성이 없는 경우 스킵
            or any(i["original_url"] == original_src for i in image_data)      # 이미 추출된 이미지인 경우 스킵
        ):
            continue

        if not check_image_rendered(driver, original_src):
            logger.info(f"화면에 존재하지 않는 이미지: {original_src}")
            continue

        src = original_src
        
        # 쿼리 파라미터 제거
        
        ESA_PATHS = [
            "/var/esa/storage/images/esa_multimedia/images/2012/03/europe_seen_by_andre_kuipers_onboard_the_iss/9251267-7-eng-GB/Europe_seen_by_Andre_Kuipers_onboard_the_ISS_pillars.jpg",
            "/var/esa/storage/images/esa_multimedia/images/2018/10/from_mission_control_to_mercury/17835462-5-eng-GB/From_mission_control_to_Mercury_pillars.jpg"
        ]

        if src in ESA_PATHS:
            src = "https://www.esa.int" + src
        elif src.startswith("//"):
            src = "https:" + src
        else:
            src = urljoin(base_url, src)

        # URL에 프로토콜이 없는 경우 https 추가
        if not src.startswith(('http://', 'https://')):
            src = 'https://' + src.lstrip('/')

        size_info = image_sizes.get(src, {"width": None, "height": None})
        width = size_info.get("width")
        height = size_info.get("height")

        # 디버깅을 위한 로그
        logger.debug(f"이미지 처리 중: URL={src}, 크기={size_info}")

        try:
            if (
                width
                and height  # None이 아닌지 확인
                and isinstance(width, (int, float))  # 숫자 타입인지 확인
                and isinstance(height, (int, float))
                and width >= configs["IMAGE_CONFIG"]["min_width"]
                and height >= configs["IMAGE_CONFIG"]["min_height"]
            ):
                if width <= 32 and height <= 32:
                    small_image_data.append(
                        {
                            "alt_text": img.get("alt") or "",  # alt가 없으면 빈 문자열
                            "img_url": src,
                            "original_url": original_src,
                            "is_button": check_button(soup, img),
                            "context": context
                        }
                    )
                else:
                    image_data.append(
                        {
                            "alt_text": img.get("alt") or "",  # alt가 없으면 빈 문자열
                            "img_url": src,
                            "original_url": original_src,
                            "is_button": check_button(soup, img),
                            "context": context
                        }
                    )
            else:
                logger.info(f"이미지 크기가 너무 작음: {src}, 크기={size_info}")
        except Exception as e:
            logger.error(f"이미지 처리 중 오류 발생: {e}, 이미지={src}")
            continue
    
    image_data.extend(small_image_data)  # 작은 이미지 데이터가 뒤에 위치하도록 결합

    return image_data

def extract_content(soup):
    """콘텐츠 추출 함수"""
    doc = Document(str(soup))
    title = clean_html(doc.title())
    content = clean_html(doc.summary())
    return f"title: {title}, context: {content}"


def clean_html(text):
    no_tags = re.sub(r'<[^>]*>', '', text)
    no_tags = html.unescape(no_tags)
    cleaned_text = no_tags.replace('\n', ' ').replace('\xa0', ' ')
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    return cleaned_text

def remove_ads(driver):
    """광고를 숨기거나 DOM에서 완전히 제거하는 함수"""
    try:
        # 광고 요소 탐색
        ads = driver.find_elements(By.CSS_SELECTOR, "ins.adsbygoogle, #aswift_2_host, iframe#aswift_2")
        for ad in ads:
            # DOM에서 광고 요소 제거
            driver.execute_script("arguments[0].parentNode.removeChild(arguments[0]);", ad)
            logger.info(f"광고 제거됨: {ad}")
    except Exception as e:
        logger.error(f"광고 제거 실패: {e}")
