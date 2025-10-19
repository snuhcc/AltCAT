# AltCAT 🐱

**Alt**ernative Text **C**reation **A**ssistance **T**ool

An AI-powered tool for automatic generation and culture-aware translation of image alternative text to improve web accessibility.

---

## 💡 Project Overview

**AltCAT** automates the creation of image alternative text to comply with Web Content Accessibility Guidelines (WCAG).

### Why is this needed?

- 📊 **Statistics**: Over 70% of websites have missing or inadequate image alternative text
- ♿ **Web Accessibility**: Visually impaired users rely on screen readers that read alt text to understand images
- 🌍 **Multilingual Support**: Global services require appropriate alt text in each language

### How does it solve the problem?

1. **Auto-generation**: Simply enter a URL to analyze all images on the page and automatically generate accessible alt text
2. **AI Classification**: Automatically categorizes images as Informative/Functional/Decorative following W3C guidelines
3. **Culture-aware Translation**: Uses GPT-4.1 Vision API to actually 'see' images and provide culturally contextual translations, not just literal translations
4. **Production Ready**: Download HTML with updated alt text for immediate deployment

### Key Features

- 🤖 **GPT-4.1 Vision API** based image analysis
- 🌍 **Multilingual Support**: English, Korean, Chinese, Spanish
- 🎯 **W3C Guidelines** compliant image type classification
- ✏️ **Real-time editing and comparison** interface
- 📜 **URL History Management** (up to 5 URLs)
- 📥 **HTML Download** for production deployment

---

## 🚀 Quick Start

### 📋 0. Prerequisites

- **Node.js** v23.3.0 or higher
- **Python** 3.11 or higher
- **OpenAI API Key** (for GPT-4.1 Vision API)

### 🛠️ 1. Clone Project

```bash
git clone git@github.com:snuhcc/AltCAT.git
cd AltCAT
```

### 🐍 2. Backend Setup (FastAPI)

#### 2-1. Create Conda Environment (Recommended)

```bash
conda create --name altcat python=3.11
conda activate altcat
```

#### 2-2. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 2-3. Configure API Key

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

#### 2-4. Run Backend Server

```bash
cd backend/app
uvicorn main:app --reload
```

✅ Backend server runs at **http://127.0.0.1:8000**

#### 2-5. Test Backend

- Visit http://127.0.0.1:8000 to see the welcome page
- Visit http://127.0.0.1:8000/docs for Swagger UI
- Click "Try it out" to test API endpoints

### 🎨 3. Frontend Setup (Next.js)

Open a **new terminal** window:

#### 3-1. Install Dependencies

```bash
cd front
npm install
```

#### 3-2. Run Frontend Server

```bash
npm run dev
```

✅ Frontend runs at **http://localhost:3000**

### 🎯 4. Access the Application

Open your browser and navigate to **http://localhost:3000**

---

## 🫠 99. Error Handling

### 🔴 Cairo Library Error (for SVG to PNG conversion)

**Error Message:**
```
ImportError: cannot import name 'cairosvg'
OSError: dlopen() failed to load a library: cairo
```

**Solution (macOS):**

1. **Install Cairo:**
   ```bash
   brew install cairo
   ```

2. **Set Environment Variables:**
   
   Edit your shell configuration file:
   ```bash
   vi ~/.zshrc  # or ~/.bashrc
   ```
   
   Add these lines:
   ```bash
   export PKG_CONFIG_PATH=$(brew --prefix cairo)/lib/pkgconfig:$PKG_CONFIG_PATH
   export PATH=$(brew --prefix cairo)/bin:$PATH
   export DYLD_LIBRARY_PATH=$(brew --prefix cairo)/lib:$DYLD_LIBRARY_PATH
   ```
   
   Apply changes:
   ```bash
   source ~/.zshrc  # or source ~/.bashrc
   ```

3. **Reinstall Python Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

**Solution (Ubuntu/Linux):**
```bash
sudo apt-get install libcairo2-dev
pip install -r requirements.txt
```

**Reference:** https://cairosvg.org/documentation/

---

## 🎯 Demo Presentation Guide

### 📱 Understanding the Interface

When you run the program, you'll see three main areas:

1. **Left Sidebar (Dashboard)**
   - 🙋‍♂️ User Profile (Bob)
   - 📜 URL History (displays up to 5 URLs)
   - 🎨 Current URL is highlighted in **orange**
   - 🚩 Language flags next to each URL showing supported languages (🇺🇸🇰🇷🇨🇳🇪🇸)
   - **< button**: Hide/Show Sidebar

2. **Top Bar**
   - 🔗 URL Input Field
   - 🚩 Language Selection Dropdown (click flag icon)
   - ✅ Submit Button

3. **Main Area**
   - 📋 Image Card List (left, scrollable)
   - 🖼️ Webpage Preview (right)

---

## 🎬 Presentation Scenarios

### ✅ Scenario 1: Analyzing Your First URL (English Page)

1. **Starting Screen**
   ```
   - Default URL is already entered (https://assets25.sigaccess.org/)
   - Language is set to English (🇺🇸)
   ```

2. **Click Submit**
   ```
   ✨ What happens:
   - Loading indicator appears
   - Backend parses the webpage and extracts all images
   - GPT-4.1 Vision API generates alt text for each image
   - When complete, image cards appear on the left
   ```

3. **Review Results**
   ```
   Each image card displays:
   - 🖼️ Image Thumbnail
   - 📝 Original Alt Text: The existing alt text from the webpage
   - 🤖 Image Type: AI-classified image type
     • Informative: Images that convey information
     • Functional: Buttons/links with functional purposes
     • Decorative: Ornamental images
   - ✨ AI Generated: New alt text generated by GPT-4.1
   - 📄 Context: Surrounding text context of the image
   ```

4. **Check Sidebar**
   ```
   - The analyzed URL is added to the left Sidebar
   - Current page is highlighted in orange
   - Supported language flag (🇺🇸) is displayed
   ```

---

### ✅ Scenario 2: Adding a New URL

1. **Change URL**
   ```
   - Enter a new URL in the top input field
   - Or click an existing URL in the Sidebar
   ```

2. **Click Submit**
   ```
   ✨ What happens:
   - Full analysis process repeats for the new URL
   - New URL is added to Sidebar history (maintains up to 5 URLs)
   - Previous URLs turn gray, current URL stays orange
   ```

3. **Switching History**
   ```
   💡 When you click a previous URL in the Sidebar:
   - Instantly switches to that URL's analysis results
   - Shows cached data without re-analysis
   - Enables quick comparison between multiple pages
   ```

---

### ✅ Scenario 3: Using Multilingual Translation

1. **Analyzing Same Page in Different Language**
   ```
   Example: When you want to translate an English page to Korean
   
   a) Keep the same URL
   b) Click flag icon at the top → Select 🇰🇷 Korean
   c) Click Submit
   ```

2. **Check Results**
   ```
   ✨ What happens:
   - Parses the Korean version of the same URL
   - Original Alt Text displays in Korean
   - AI Generated remains in English (master data)
   ```

3. **What If the Language Page Doesn't Exist?**
   ```
   🔍 If there's no Korean version of the webpage:
   - The system automatically falls back to English page
   - Original Alt Text remains in English
   - You can still use AI translation to generate Korean alt text
   - Language flag for that URL in Sidebar shows only 🇺🇸 (no 🇰🇷)
   ```

4. **Culture-Aware Translation**
   ```
   🌍 Click "Translate to Korean" button:
   - "Culture Aware Alt Text" section appears on each image card
   - Provides culturally contextual translation, not literal translation
   - Example: US Flag image
     • Literal: "Flag of the United States"
     • Culture-aware: "Stars and Stripes (US National Flag)"
   ```

5. **Sidebar Language Display**
   ```
   - Language flags appear next to each analyzed URL
   - Example: https://example.com 🇺🇸🇰🇷 
     → This page has been analyzed in both English and Korean
   - Example: https://example2.com 🇺🇸 
     → This page only has English version (Korean page doesn't exist)
   ```

---

### ✅ Scenario 4: Editing Alt Text and Downloading

1. **Direct Editing**
   ```
   - Click "Customized Alt Text" input field on each image card
   - Modify to your desired alt text
   - Changes are automatically saved
   ```

2. **Language-Specific Editing**
   ```
   💡 Important: Edits apply only to the current language
   
   Example:
   - Edit in English (🇺🇸) mode → Saves to English version only
   - Switch to Korean (🇰🇷) mode and edit → Saves to Korean version only
   - Manage different alt text for each language independently
   ```

3. **Download HTML**
   ```
   - Click "Download Updated HTML" button at the bottom
   - Downloads HTML file with your updated alt text
   - Ready for production deployment
   ```

---

### ✅ Scenario 5: Comparing Multiple Pages

1. **Analyze Multiple URLs**
   ```
   - Enter URL 1 → Submit → Review results
   - Enter URL 2 → Submit → Review results
   - Enter URL 3 → Submit → Review results
   ```

2. **Quick Switching in Sidebar**
   ```
   - Sidebar displays up to 5 URL history
   - Switch between pages with a single click
   - Each page's analysis results are cached for instant display
   ```

3. **Identifying Current Page**
   ```
   - Current page is highlighted in orange
   - Prevents confusion when working with multiple pages
   ```

---

## 💡 Presentation Tips

### 🎤 Key Points to Emphasize

1. **Automation Convenience**
   ```
   "Simply enter a URL and the system automatically analyzes all images on the page"
   ```

2. **AI Accuracy**
   ```
   "GPT-4.1 Vision API actually 'sees' the images and generates 
    contextually appropriate alt text"
   ```

3. **Cultural Context Consideration**
   ```
   "Provides natural translations that reflect cultural characteristics,
    not just literal translations"
   ```

4. **Production Ready**
   ```
   "Download updated HTML and immediately deploy to your actual website"
   ```

### ⚠️ Important Notes During Presentation

1. **Loading Time**
   ```
   - Pages with many images take time to analyze
   - May take 30 seconds to 1 minute due to multiple API calls
   - Explain: "AI is analyzing each image individually"
   ```

2. **Language Selection Timing**
   ```
   ⚠️ Important: Select language BEFORE clicking Submit
   - Wrong order: Submit → Change language (❌)
   - Correct order: Select language → Submit (✅)
   ```

3. **CORS Errors**
   ```
   - Some websites cannot display iframe due to security policies
   - Explain: "Webpage preview may not display due to security policies,
     but the important part is the image analysis results on the left, 
     which work perfectly"
   ```

4. **When Language Version Doesn't Exist**
   ```
   - If selecting Korean for an English-only website:
   - System automatically falls back to English page
   - Explain: "This website only has an English version. 
     The Original Alt Text remains in English, but we can still use 
     AI translation to generate culturally appropriate Korean alt text"
   - Check Sidebar: Only 🇺🇸 flag appears (no 🇰🇷)
   ```

