// Merged JS bundle
// - merged into this file: halvaa-app.js + app.js
// - excluded: explore-canvas.js (kept separate)
// Halvaa App - Main JavaScript

const API_URL = 'api.php';
let tabsSwiper = null;
let memorialSwipers = {};
let memorialData = [];
let currentUser = null;
let homeExtraSwipers = {};
let currentEntitlements = {};
let storeSwipers = {};
let stripeInstance = null;

// Multi-language support
let currentLang = 'en';
let translations = {};
let availableLanguages = [];

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
  await initLanguage();
  initTabsSwiper();
  initBottomNav();
  initAuthTabs();
  initOTPInputs();
  initPhotoUpload();
  initForms();
  initMemorialLinkUI();
  loadMemorials();
  checkAuthState();
  initMobileMenu();
  initFilterChips();
  initGlobalDelegates();
  initStoreSwipers();
  initStripe();
  checkPaymentStatus();
  initHistoryManagement();
  // Check for memorial deep link after data is loaded
  setTimeout(handleMemorialDeepLink, 100);
  // initial state (home)
  updateHomeGradientVisibility(0);
});

// ====== MULTI-LANGUAGE SYSTEM ======

async function initLanguage() {
  // Check if user has saved language preference
  let savedLang = localStorage.getItem('halvaa_lang');
  
  // If no saved preference, detect from IP address
  if (!savedLang) {
    savedLang = await detectLanguageFromIP();
    if (savedLang) {
      localStorage.setItem('halvaa_lang', savedLang);
    }
  }
  
  currentLang = savedLang || 'en';
  
  try {
    // Load available languages
    const langRes = await fetch(`${API_URL}?action=getLanguages`);
    const langData = await langRes.json();
    if (langData.success) {
      availableLanguages = langData.data;
      populateLanguageMenu();
    }
    
    // Load translations for current language
    await loadTranslations(currentLang);
  } catch (error) {
    console.error('Failed to load language data:', error);
    // Continue with English default
  }
}

async function detectLanguageFromIP() {
  try {
    // Use ipapi.co for IP geolocation (free tier: 1000 requests/day)
    const res = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) throw new Error('IP detection failed');
    
    const data = await res.json();
    const countryCode = data.country_code?.toLowerCase();
    
    // Map country codes to languages
    const countryToLang = {
      'ir': 'fa',  // Iran → Persian
      'af': 'fa',  // Afghanistan → Persian
      'tj': 'fa',  // Tajikistan → Persian
      // Add more mappings as needed
    };
    
    const detectedLang = countryToLang[countryCode];
    if (detectedLang) {
      console.log(`Auto-detected language: ${detectedLang} (from ${countryCode.toUpperCase()})`);
      return detectedLang;
    }
    
    return null;
  } catch (error) {
    console.log('Could not detect language from IP, using default');
    return null;
  }
}

async function loadTranslations(langCode) {
  try {
    const res = await fetch(`${API_URL}?action=getTranslations&lang=${encodeURIComponent(langCode)}`);
    const data = await res.json();
    
    if (data.success) {
      translations = data.translations || {};
      currentLang = data.lang || langCode;
      applyTranslations();
      applyLanguageDirection();
      updateLanguageUI();
    }
  } catch (error) {
    console.error('Failed to load translations:', error);
  }
}

function applyTranslations() {
  // Translate all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) {
      el.textContent = translations[key];
    }
  });
  
  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) {
      el.placeholder = translations[key];
    }
  });
  
  // Translate aria-labels
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (translations[key]) {
      el.setAttribute('aria-label', translations[key]);
    }
  });
}

function applyLanguageDirection() {
  const lang = availableLanguages.find(l => l.code === currentLang);
  const direction = lang?.direction || 'ltr';
  
  document.documentElement.setAttribute('dir', direction);
  document.documentElement.setAttribute('lang', currentLang);
  document.body.classList.toggle('rtl-mode', direction === 'rtl');
  
  // Update font family for Persian
  if (currentLang === 'fa') {
    document.body.style.fontFamily = "'Vazirmatn', 'Inter', sans-serif";
  } else {
    document.body.style.fontFamily = '';
  }
}

function updateLanguageUI() {
  const langCodeEl = document.getElementById('currentLangCode');
  const langCodeMobileEl = document.getElementById('currentLangCodeMobile');
  
  const displayCode = currentLang.toUpperCase();
  if (langCodeEl) langCodeEl.textContent = displayCode;
  if (langCodeMobileEl) langCodeMobileEl.textContent = displayCode;
}

function populateLanguageMenu() {
  const menuHtml = availableLanguages.map(lang => `
    <button class="lang-menu-item ${lang.code === currentLang ? 'active' : ''}" onclick="switchLanguage('${lang.code}', event)">
      <span class="lang-name">${escapeHtml(lang.native_name)}</span>
      <span class="lang-code">${escapeHtml(lang.code.toUpperCase())}</span>
    </button>
  `).join('');
  
  // Update both desktop and mobile menus
  const menu = document.getElementById('languageMenu');
  const menuMobile = document.getElementById('languageMenuMobile');
  
  if (menu) menu.innerHTML = menuHtml;
  if (menuMobile) menuMobile.innerHTML = menuHtml;
}

function toggleLanguageMenu(event, context = 'desktop') {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  const menuId = context === 'mobile' ? 'languageMenuMobile' : 'languageMenu';
  const menu = document.getElementById(menuId);
  if (!menu) return;
  
  const isActive = menu.classList.contains('active');
  
  // Close all language menus first
  document.querySelectorAll('.language-menu').forEach(m => m.classList.remove('active'));
  
  if (!isActive) {
    menu.classList.add('active');
    
    // Close on click outside
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        if (!e.target.closest('.language-selector') && !e.target.closest('.language-menu')) {
          menu.classList.remove('active');
          document.removeEventListener('click', handleOutsideClick);
        }
      };
      document.addEventListener('click', handleOutsideClick);
    }, 10);
  }
}

async function switchLanguage(langCode, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  if (langCode === currentLang) {
    // Close menu
    const menu = document.getElementById('languageMenu');
    if (menu) menu.classList.remove('active');
    return;
  }
  
  currentLang = langCode;
  localStorage.setItem('halvaa_lang', langCode);
  
  // Save to user profile if signed in
  if (currentUser) {
    try {
      await fetch(`${API_URL}?action=setUserLanguage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, lang_code: langCode })
      });
    } catch (e) {
      // Ignore error
    }
  }
  
  await loadTranslations(langCode);
  
  // Close all language menus
  document.querySelectorAll('.language-menu').forEach(m => m.classList.remove('active'));
  
  // Reload dynamic content with new language
  initMemorialSwipers();
  initHomeExtras();
  if (currentUser) updateProfileUI();
  
  // Re-populate menus to update active state
  populateLanguageMenu();
  
  showToast(translations['common.loading'] || 'Language changed', 'success');
}

// Helper to get translation
function t(key, fallback = '') {
  return translations[key] || fallback || key;
}

function initGlobalDelegates() {
  // Contributor click (cards + later components)
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('.js-contributor');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const userId = el.dataset.userId;
    const name = el.dataset.userName || 'Contributor';
    const avatar = el.dataset.userAvatar || '';
    openContributorModal({ userId, name, avatar });
  });
}

function initMemorialLinkUI() {
  const copyBtn = document.getElementById('memorialCopyLinkBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const input = document.getElementById('memorialShareLink');
      const url = input?.value || '';
      if (!url) return;
      const ok = await copyToClipboard(url);
      showToast(ok ? 'Link copied' : 'Could not copy link', ok ? 'success' : 'error');
    });
  }
  applyEntitlementsToUI();
}

function applyEntitlementsToUI() {
  const input = document.getElementById('memorialPublicId');
  const upgradeBtn = document.querySelector('.link-upgrade-btn');
  const hasCustom = hasEntitlement('custom_id');

  if (input) {
    input.placeholder = hasCustom ? 'Custom ID (e.g. john-doe) — optional' : 'Auto-generated (7 chars) unless you unlock custom ID';
  }
  if (upgradeBtn) {
    upgradeBtn.style.display = hasCustom ? 'none' : '';
  }
}

function hasEntitlement(sku) {
  const qty = Number(currentEntitlements?.[sku] ?? 0);
  return qty > 0;
}

async function refreshEntitlements() {
  currentEntitlements = {};
  if (!currentUser) {
    applyEntitlementsToUI();
    return;
  }
  try {
    const res = await fetch(`${API_URL}?action=getEntitlements&user_id=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data.success) currentEntitlements = data.entitlements || {};
  } catch (_) {
    currentEntitlements = {};
  }
  applyEntitlementsToUI();
}

function getBasePageUrl() {
  return `${location.origin}${location.pathname}`;
}

function getMemorialShareUrl(publicId) {
  if (!publicId) return '';
  return `${getBasePageUrl()}?m=${encodeURIComponent(publicId)}`;
}

function getQueryParam(name) {
  try {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  } catch (_) {
    return null;
  }
}

// Browser history management for back button support
function initHistoryManagement() {
  // Listen for browser back/forward button
  window.addEventListener('popstate', function(event) {
    const memorialModal = document.getElementById('memorialModal');
    
    if (event.state && event.state.modal === 'memorial') {
      // Forward to memorial - reopen it
      const publicId = event.state.publicId;
      if (publicId) {
        fetchAndOpenMemorial(publicId, true); // true = skip history push
      }
    } else {
      // Back button - close modal if open
      if (memorialModal && memorialModal.classList.contains('active')) {
        closeModalWithoutHistory('memorialModal');
      }
    }
  });
}

async function handleMemorialDeepLink() {
  const publicId = getQueryParam('m');
  if (!publicId) return;
  
  await fetchAndOpenMemorial(publicId);
}

// Fetch memorial from API and open modal
async function fetchAndOpenMemorial(publicId, skipHistoryPush = false) {
  if (!publicId) return;
  
  try {
    const res = await fetch(`${API_URL}?action=getMemorialByPublicId&public_id=${encodeURIComponent(publicId)}`);
    const data = await res.json();
    
    if (data.success && data.data) {
      displayMemorialModal(data.data, skipHistoryPush);
    } else {
      showToast('Memorial not found', 'error');
      // Clean URL if invalid
      if (!skipHistoryPush) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('m');
        history.replaceState({}, '', cleanUrl.toString());
      }
    }
  } catch (error) {
    console.error('Failed to fetch memorial:', error);
    showToast('Failed to load memorial', 'error');
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

function normalizeCustomPublicId(value) {
  let s = String(value ?? '').trim().toLowerCase();
  s = s.replace(/[\s_]+/g, '-');
  s = s.replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  if (s.length < 3) return '';
  if (s.length > 32) s = s.slice(0, 32).replace(/-+$/g, '');
  return s;
}

function generateLocalPublicId7() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const existing = new Set(memorialData.map((m) => String(m.public_id || '')));
  for (let attempt = 0; attempt < 80; attempt++) {
    let out = '';
    for (let i = 0; i < 7; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!existing.has(out)) return out;
  }
  // extremely unlikely fallback
  return `${Date.now().toString(36).toUpperCase()}`.slice(-7).padStart(7, '0');
}

function ensureMemorialPublicIds() {
  memorialData.forEach((m) => {
    if (!m.public_id) m.public_id = generateLocalPublicId7();
  });
}

// Tabs Swiper
function initTabsSwiper() {
  tabsSwiper = new Swiper('#tabsSwiper', {
    slidesPerView: 1,
    spaceBetween: 0,
    // User request: tab swiper should NOT be swipable by touch
    allowTouchMove: false,
    speed: 400,
    on: {
      slideChange: function() {
        updateBottomNav(this.activeIndex);
        updateDesktopNav(this.activeIndex);
        // Activate Explore canvas only on Explore tab to save CPU
        if (window.HalvaaExploreCanvas) {
          window.HalvaaExploreCanvas.setActive(this.activeIndex === 1);
        }
        updateHomeGradientVisibility(this.activeIndex);
        // Refresh store credits when switching to Store tab
        if (this.activeIndex === 3) {
          refreshStoreCredits();
          loadPurchaseHistory();
        }
      }
    }
  });
}

function updateHomeGradientVisibility(activeIndex) {
  // Show bg-gradient only on Home tab
  document.body.classList.toggle('is-home-tab', activeIndex === 0);
}

// Bottom Navigation
function initBottomNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const glider = document.querySelector('.nav-glider');
  
  navItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      switchTab(index);
    });
  });
  
  // Initial glider position
  updateGlider(0);
}

function updateBottomNav(index) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
  updateGlider(index);
}

function updateGlider(index) {
  const glider = document.querySelector('.nav-glider');
  if (glider) {
    glider.style.transform = `translateX(${index * 100}%)`;
  }
}

function updateDesktopNav(index) {
  const navLinks = document.querySelectorAll('.nav-left a');
  navLinks.forEach((link, i) => {
    link.classList.toggle('active', i === index);
  });
}

function switchTab(index) {
  if (tabsSwiper) {
    tabsSwiper.slideTo(index);
  }
  updateBottomNav(index);
  
  // Scroll to top of tab content (important for long pages)
  requestAnimationFrame(() => {
    const slides = document.querySelectorAll('.tab-slide');
    if (slides[index]) {
      slides[index].scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Also scroll the tab-content-inner to top
    const innerContent = slides[index]?.querySelector('.tab-content-inner');
    if (innerContent) {
      innerContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

// Memorial Carousels
function initMemorialSwipers() {
  const swiperConfigs = [
    { id: 'recentSwiper', data: [...memorialData].sort((a, b) => new Date(b.death_date) - new Date(a.death_date)).slice(0, 20) },
    { id: 'lovingSwiper', data: memorialData.slice(0, 20) },
    { id: 'todaySwiper', data: shuffleArray([...memorialData]).slice(0, 20) },
    { id: 'anniversarySwiper', data: shuffleArray([...memorialData]).slice(0, 20) }
  ];

  swiperConfigs.forEach(config => {
    const element = document.getElementById(config.id);
    if (element) {
      const wrapper = element.querySelector('.swiper-wrapper');
      wrapper.innerHTML = '';
      
      config.data.forEach(memorial => {
        wrapper.innerHTML += createMemorialSlide(memorial);
      });

      memorialSwipers[config.id] = new Swiper(`#${config.id}`, {
        slidesPerView: 'auto',
        spaceBetween: 16,
        freeMode: true,
        grabCursor: true,
        pagination: {
          el: `#${config.id} .swiper-pagination`,
          clickable: true,
          dynamicBullets: true,
          dynamicMainBullets: 3,
        }
      });
    }
  });
}

function createMemorialSlide(memorial) {
  const birthYear = new Date(memorial.birth_date).getFullYear();
  const deathYear = new Date(memorial.death_date).getFullYear();
  const bio = memorial.biography ? memorial.biography.substring(0, 110) + '...' : '';
  const image = memorial.image || `https://i.pravatar.cc/400?u=${memorial.id}`;
  const contributorName = memorial.contributor_name || 'Anonymous';
  const contributorAvatar = memorial.contributor_avatar || `https://i.pravatar.cc/100?u=c${memorial.id}`;
  const occupation = memorial.occupation || '';
  const resided = memorial.resided_place || '';
  const born = memorial.birth_place || '';
  const userId = memorial.user_id || '';
  
  return `
    <div class="swiper-slide">
      <div class="memorial-card" onclick="openMemorialModal(${memorial.id})">
        <div class="memorial-image-container">
          <img src="${image}" alt="${memorial.name}" class="memorial-image" loading="lazy">
        </div>
        <div class="memorial-card-content">
          <h3 class="memorial-card-name">${memorial.name}</h3>
          <p class="memorial-card-dates">${birthYear} - ${deathYear}</p>
          <div class="memorial-meta">
            ${occupation ? `<span class="meta-chip">${escapeHtml(occupation)}</span>` : ''}
            ${(born || resided) ? `<span class="meta-chip meta-chip-muted">${escapeHtml(resided || born)}</span>` : ''}
          </div>
          <p class="memorial-card-bio">${bio}</p>
          <div class="contributor-profile js-contributor" data-user-id="${userId}" data-user-name="${escapeAttr(contributorName)}" data-user-avatar="${escapeAttr(contributorAvatar)}">
            <img src="${contributorAvatar}" alt="${contributorName}" class="contributor-avatar">
            <div class="contributor-info">
              <div class="contributor-label">Submitted by</div>
              <div class="contributor-name">${escapeHtml(contributorName)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Load Memorials from API
async function loadMemorials() {
  try {
    const response = await fetch(`${API_URL}?action=getMemorials`);
    const result = await response.json();
    
    if (result.success) {
      memorialData = result.data;
      ensureMemorialPublicIds();
      initMemorialSwipers();
      initHomeExtras();
      populateExploreGrid();
      initExploreCanvas();
    } else {
      // Load sample data if API fails
      loadSampleData();
    }
  } catch (error) {
    console.log('API not available, loading sample data');
    loadSampleData();
  }
}

function loadSampleData() {
  memorialData = [
    { id: 1, name: "Sarah Johnson", birth_date: "1945-03-12", death_date: "2024-11-01", birth_place: "Boston, MA", resided_place: "Portland, OR", occupation: "Teacher", biography: "A beloved educator who touched the lives of thousands of students over her 40-year career.", epitaph: "She taught us more than lessons; she taught us how to live with grace.", contributor_name: "Emily Johnson" },
    { id: 2, name: "Michael Chen", birth_date: "1960-07-22", death_date: "2024-10-28", birth_place: "San Francisco, CA", resided_place: "Seattle, WA", occupation: "Software Engineer", biography: "A pioneer in technology who contributed to groundbreaking innovations.", epitaph: "In code we trust, in memory we cherish.", contributor_name: "Lisa Chen" },
    { id: 3, name: "Maria Garcia", birth_date: "1952-11-08", death_date: "2024-10-25", birth_place: "Mexico City", resided_place: "Los Angeles, CA", occupation: "Chef", biography: "An award-winning chef who brought authentic Mexican cuisine to countless hearts.", epitaph: "She flavored our lives with love and laughter.", contributor_name: "Carlos Garcia" },
    { id: 4, name: "David Thompson", birth_date: "1938-05-15", death_date: "2024-10-20", birth_place: "Chicago, IL", resided_place: "Denver, CO", occupation: "Veteran", biography: "A decorated veteran who served his country with honor.", epitaph: "A life of service, a legacy of honor.", contributor_name: "Sarah Thompson" },
    { id: 5, name: "Emily Roberts", birth_date: "1975-09-30", death_date: "2024-10-15", birth_place: "Nashville, TN", resided_place: "Austin, TX", occupation: "Musician", biography: "A talented singer-songwriter whose music touched souls around the world.", epitaph: "Her song continues in the hearts of those who loved her.", contributor_name: "James Roberts" },
    { id: 6, name: "Robert Williams", birth_date: "1950-02-18", death_date: "2024-10-10", birth_place: "New York, NY", resided_place: "Miami, FL", occupation: "Doctor", biography: "A dedicated physician who spent his career caring for underserved communities.", epitaph: "He healed bodies and touched hearts.", contributor_name: "Michelle Williams" },
    { id: 7, name: "Jennifer Lee", birth_date: "1968-12-05", death_date: "2024-11-05", birth_place: "Seoul, South Korea", resided_place: "San Diego, CA", occupation: "Artist", biography: "A visionary artist whose work explored themes of identity, culture, and belonging.", epitaph: "Through her art, she painted a better world.", contributor_name: "David Lee" },
    { id: 8, name: "James Miller", birth_date: "1955-06-28", death_date: "2024-10-30", birth_place: "Detroit, MI", resided_place: "Phoenix, AZ", occupation: "Coach", biography: "A high school basketball coach who mentored hundreds of young athletes.", epitaph: "He taught us to play the game of life with integrity.", contributor_name: "Rebecca Miller" },
    { id: 9, name: "Patricia Anderson", birth_date: "1942-08-14", death_date: "2024-11-10", birth_place: "Philadelphia, PA", resided_place: "Atlanta, GA", occupation: "Nurse", biography: "A compassionate nurse who dedicated 50 years to patient care.", epitaph: "An angel on earth, now an angel in heaven.", contributor_name: "Tom Anderson" },
    { id: 10, name: "William Davis", birth_date: "1948-03-22", death_date: "2024-11-03", birth_place: "Houston, TX", resided_place: "Dallas, TX", occupation: "Firefighter", biography: "A heroic firefighter who saved countless lives over 30 years of service.", epitaph: "A hero in life, a legend in memory.", contributor_name: "Karen Davis" },
    { id: 11, name: "Linda Martinez", birth_date: "1963-11-30", death_date: "2024-10-22", birth_place: "San Antonio, TX", resided_place: "Phoenix, AZ", occupation: "Social Worker", biography: "A dedicated social worker who changed the lives of countless families.", epitaph: "She made the world a better place, one family at a time.", contributor_name: "Miguel Martinez" },
    { id: 12, name: "Richard Brown", birth_date: "1957-06-15", death_date: "2024-10-18", birth_place: "Baltimore, MD", resided_place: "Washington, DC", occupation: "Professor", biography: "A brilliant professor of history who inspired generations of students.", epitaph: "He taught us to think, to question, to grow.", contributor_name: "Susan Brown" }
  ];

  ensureMemorialPublicIds();
  initMemorialSwipers();
  initHomeExtras();
  populateExploreGrid();
  initExploreCanvas();
}

function initHomeExtras() {
  initNewsSwiper();
  initContributorsSwiper();
}

function initNewsSwiper() {
  const el = document.getElementById('newsSwiper');
  if (!el || typeof Swiper === 'undefined') return;
  const wrapper = el.querySelector('.swiper-wrapper');
  if (!wrapper) return;

  const items = [
    { tag: 'Feature', title: 'Create memorials with contributors', subtitle: 'Profiles, tributes, and stories', tone: 'warm' },
    { tag: 'Update', title: 'Explore canvas is live', subtitle: 'Drag & tap to open profiles', tone: 'soft' },
    { tag: 'Tip', title: 'Add places & occupation', subtitle: 'Better discovery in Explore', tone: 'neutral' },
    { tag: 'Community', title: 'Top contributors this week', subtitle: 'See whoâ€™s preserving stories', tone: 'warm' },
  ];

  wrapper.innerHTML = items.map((x) => `
    <div class="swiper-slide">
      <div class="news-card news-${x.tone}">
        <div class="news-tag">${escapeHtml(x.tag)}</div>
        <div class="news-title">${escapeHtml(x.title)}</div>
        <div class="news-subtitle">${escapeHtml(x.subtitle)}</div>
      </div>
    </div>
  `).join('');

  if (homeExtraSwipers.news) homeExtraSwipers.news.destroy(true, true);
  homeExtraSwipers.news = new Swiper('#newsSwiper', {
    slidesPerView: 'auto',
    spaceBetween: 16,
    freeMode: true,
    grabCursor: true,
  });
}

function initContributorsSwiper() {
  const el = document.getElementById('contributorsSwiper');
  if (!el || typeof Swiper === 'undefined') return;
  const wrapper = el.querySelector('.swiper-wrapper');
  if (!wrapper) return;

  // Group by contributor
  const byUser = new Map();
  memorialData.forEach((m) => {
    const key = String(m.user_id || m.contributor_name || 'anon');
    if (!byUser.has(key)) {
      byUser.set(key, {
        user_id: m.user_id || '',
        name: m.contributor_name || 'Anonymous',
        avatar: m.contributor_avatar || `https://i.pravatar.cc/100?u=c${m.id}`,
        memorials: 0,
      });
    }
    byUser.get(key).memorials += 1;
  });

  const contributors = Array.from(byUser.values())
    .sort((a, b) => b.memorials - a.memorials)
    .slice(0, 12);

  wrapper.innerHTML = contributors.map((c) => `
    <div class="swiper-slide">
      <div class="contributor-card js-contributor" data-user-id="${c.user_id}" data-user-name="${escapeAttr(c.name)}" data-user-avatar="${escapeAttr(c.avatar)}">
        <img class="contributor-card-avatar" src="${c.avatar}" alt="${escapeAttr(c.name)}" loading="lazy" />
        <div class="contributor-card-name">${escapeHtml(c.name)}</div>
        <div class="contributor-card-meta">${c.memorials} memorial${c.memorials === 1 ? '' : 's'}</div>
      </div>
    </div>
  `).join('');

  if (homeExtraSwipers.contributors) homeExtraSwipers.contributors.destroy(true, true);
  homeExtraSwipers.contributors = new Swiper('#contributorsSwiper', {
    slidesPerView: 'auto',
    spaceBetween: 16,
    freeMode: true,
    grabCursor: true,
  });
}

function initExploreCanvas() {
  if (!window.HalvaaExploreCanvas) return;
  window.HalvaaExploreCanvas.init({
    memorials: memorialData.map(m => ({
      id: m.id,
      name: m.name,
      image: m.image || `https://i.pravatar.cc/300?u=${m.id}`,
      // Keep extra fields for modal usage (openMemorialModal uses memorialData lookup by id)
    })),
    onPersonClick: (person) => {
      // Reuse the existing memorial modal
      openMemorialModal(person.id);
    },
    onDragStateChange: (dragging) => {
      // Prevent canvas drag from swiping tabs
      if (tabsSwiper && window.innerWidth < 769) {
        tabsSwiper.allowTouchMove = !dragging;
      }
    }
  });
}

function openContributorModal({ userId, name, avatar }) {
  const modal = document.getElementById('contributorModal');
  if (!modal) return;
  const img = modal.querySelector('#contribAvatar');
  const n = modal.querySelector('#contribName');
  const meta = modal.querySelector('#contribMeta');
  const countEl = modal.querySelector('#contribCount');

  if (img) img.src = avatar || `https://i.pravatar.cc/100?u=${userId || name}`;
  if (n) n.textContent = name || 'Contributor';

  const count = memorialData.filter((m) => String(m.user_id || '') === String(userId || '') || (!userId && (m.contributor_name || '') === name)).length;
  if (countEl) countEl.textContent = String(count);
  if (meta) meta.textContent = 'Contributor';

  openModal('contributorModal');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(str) {
  // safe for HTML attributes in template literals
  return escapeHtml(str).replaceAll('`', '&#096;');
}

function populateExploreGrid() {
  const grid = document.getElementById('exploreGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  memorialData.forEach(memorial => {
    const image = memorial.image || `https://i.pravatar.cc/400?u=${memorial.id}`;
    const birthYear = new Date(memorial.birth_date).getFullYear();
    const deathYear = new Date(memorial.death_date).getFullYear();
    
    grid.innerHTML += `
      <div class="memorial-card" onclick="openMemorialModal(${memorial.id})">
        <div class="memorial-image-container">
          <img src="${image}" alt="${memorial.name}" class="memorial-image" loading="lazy">
        </div>
        <div class="memorial-card-content">
          <h3 class="memorial-card-name">${memorial.name}</h3>
          <p class="memorial-card-dates">${birthYear} - ${deathYear}</p>
        </div>
      </div>
    `;
  });
}

// Open memorial modal by ID (from card clicks)
async function openMemorialModal(id) {
  try {
    const res = await fetch(`${API_URL}?action=getMemorial&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    
    if (data.success && data.data) {
      displayMemorialModal(data.data);
    } else {
      // Fallback to local data
      const memorial = memorialData.find(m => m.id === id);
      if (memorial) {
        displayMemorialModal(memorial);
      } else {
        showToast('Memorial not found', 'error');
      }
    }
  } catch (error) {
    // Fallback to local data in demo mode
    const memorial = memorialData.find(m => m.id === id);
    if (memorial) {
      displayMemorialModal(memorial);
    } else {
      showToast('Failed to load memorial', 'error');
    }
  }
}

// Display memorial modal with data
function displayMemorialModal(memorial, skipHistoryPush = false) {
  if (!memorial) return;

  const birthDate = new Date(memorial.birth_date);
  const deathDate = new Date(memorial.death_date);
  const age = deathDate.getFullYear() - birthDate.getFullYear();
  const image = memorial.image || `https://i.pravatar.cc/400?u=${memorial.id}`;

  document.getElementById('modalImage').src = image;
  document.getElementById('modalName').textContent = memorial.name;
  document.getElementById('modalDates').textContent = `${formatDate(birthDate)} - ${formatDate(deathDate)}`;
  document.getElementById('modalAge').textContent = `Age ${age}`;
  document.getElementById('modalBirthPlace').textContent = memorial.birth_place || 'Unknown';
  document.getElementById('modalResidedPlace').textContent = memorial.resided_place || 'Unknown';
  document.getElementById('modalOccupation').textContent = memorial.occupation || 'Unknown';
  const bio = memorial.biography || '';
  const extra = bio.length < 140 ? `\n\n${memorial.name} is remembered for the moments, relationships, and everyday details that made their life meaningful. Share a tribute to help preserve their legacy for family and friends.` : '';
  document.getElementById('modalBiography').textContent = bio + extra;
  document.getElementById('modalEpitaph').textContent = memorial.epitaph ? `"${memorial.epitaph}"` : '';

  // Share link (public memorial URL)
  const pid = memorial.public_id || '';
  const shareUrl = getMemorialShareUrl(pid);
  const shareWrap = document.getElementById('memorialShare');
  const shareInput = document.getElementById('memorialShareLink');
  const shareId = document.getElementById('memorialShareId');
  if (shareWrap) shareWrap.style.display = pid ? '' : 'none';
  if (shareInput) shareInput.value = shareUrl || '';
  if (shareId) shareId.textContent = pid || '';

  // Contributor info in modal
  const cn = document.getElementById('modalContributorName');
  const ca = document.getElementById('modalContributorAvatar');
  const cwrap = document.getElementById('modalContributor');
  const contributorName = memorial.contributor_name || 'Anonymous';
  const contributorAvatar = memorial.contributor_avatar || `https://i.pravatar.cc/100?u=c${memorial.id}`;
  const userId = memorial.user_id || '';
  if (cn) cn.textContent = contributorName;
  if (ca) ca.src = contributorAvatar;
  if (cwrap) {
    cwrap.dataset.userId = userId;
    cwrap.dataset.userName = contributorName;
    cwrap.dataset.userAvatar = contributorAvatar;
    cwrap.classList.add('js-contributor');
  }

  // Push history state for back button (unless already from history navigation)
  if (pid && !skipHistoryPush) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('m', pid);
    history.pushState({ modal: 'memorial', publicId: pid }, '', newUrl.toString());
  }

  openModal('memorialModal');
}

async function refreshCredits() {
  const el = document.getElementById('creditsBalance');
  if (!el) return;
  if (!currentUser) {
    el.textContent = '0';
    return;
  }
  try {
    const res = await fetch(`${API_URL}?action=getCredits&user_id=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data.success) el.textContent = String(data.credits || 0);
  } catch (_) {
    el.textContent = '0';
  }
}

// Modal Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  // Handle history for memorial modal
  if (modalId === 'memorialModal') {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('m')) {
      // Go back in history to remove the memorial parameter
      history.back();
    }
  }
}

// Close modal without touching history (used by popstate handler)
function closeModalWithoutHistory(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Auth Modal
function showAuthModal() {
  openModal('authModal');
}

function initAuthTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.auth;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      forms.forEach(form => {
        form.classList.remove('active');
        if (form.id === `${target}Form`) {
          form.classList.add('active');
        }
      });
    });
  });
}

function showOTPForm() {
  document.getElementById('signinForm').classList.remove('active');
  document.getElementById('otpForm').classList.add('active');
}

function hideOTPForm() {
  document.getElementById('otpForm').classList.remove('active');
  document.getElementById('signinForm').classList.add('active');
}

function requestOTP() {
  const phone = document.getElementById('otpPhone').value;
  if (phone) {
    document.getElementById('otpSection').style.display = 'block';
    document.querySelector('.otp-input').focus();
    showToast('OTP sent to your phone', 'success');
  }
}

function initOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });
}

// Forms
function initForms() {
  // Sign In Form
  document.getElementById('signinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;
    
    try {
      const response = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      
      if (result.success) {
        currentUser = result.user;
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Switch to user's preferred language
        if (result.user.preferred_lang && result.user.preferred_lang !== currentLang) {
          await switchLanguage(result.user.preferred_lang);
        }
        
        closeModal('authModal');
        updateProfileUI();
        refreshEntitlements();
        showToast(t('auth.welcome_back', 'Welcome back!'), 'success');
      } else {
        showToast(result.message || 'Login failed', 'error');
      }
    } catch (error) {
      // Demo mode
      currentUser = { id: 1, name: 'Demo User', email: email };
      localStorage.setItem('user', JSON.stringify(currentUser));
      closeModal('authModal');
      updateProfileUI();
      refreshEntitlements();
      showToast('Welcome back!', 'success');
    }
  });
  
  // Sign Up Form
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    
    if (password !== confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast('Account created! Please sign in.', 'success');
        document.querySelector('[data-auth="signin"]').click();
      } else {
        showToast(result.message || 'Registration failed', 'error');
      }
    } catch (error) {
      showToast('Account created! Please sign in.', 'success');
      document.querySelector('[data-auth="signin"]').click();
    }
  });
  
  // OTP Form
  document.getElementById('otpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
    if (otp.length === 6) {
      currentUser = { id: 1, name: 'Phone User', phone: document.getElementById('otpPhone').value };
      localStorage.setItem('user', JSON.stringify(currentUser));
      closeModal('authModal');
      updateProfileUI();
      refreshEntitlements();
      showToast('Welcome!', 'success');
    }
  });
  
  // Memorial Form
  document.getElementById('memorialForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      showAuthModal();
      showToast('Please sign in to create a memorial', 'error');
      return;
    }
    
    const customPublicIdRaw = (document.getElementById('memorialPublicId')?.value || '').trim();
    const formData = {
      name: document.getElementById('fullName').value,
      birth_date: document.getElementById('birthDate').value,
      death_date: document.getElementById('passDate').value,
      birth_place: document.getElementById('birthPlace').value,
      resided_place: document.getElementById('residedPlace').value,
      occupation: document.getElementById('occupation').value,
      biography: document.getElementById('biography').value,
      epitaph: document.getElementById('epitaph').value,
      user_id: currentUser.id
    };

    if (customPublicIdRaw) {
      if (!hasEntitlement('custom_id')) {
        showToast('Unlock Custom Memorial ID in the Store to choose your own link', 'error');
        return;
      }
      const normalized = normalizeCustomPublicId(customPublicIdRaw);
      if (!normalized) {
        showToast('Custom ID is invalid. Use letters/numbers and hyphens (min 3 chars).', 'error');
        return;
      }
      formData.public_id = normalized;
    }
    
    try {
      const response = await fetch(`${API_URL}?action=createMemorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      
      if (result.success) {
        showToast('Memorial created successfully!', 'success');
        document.getElementById('memorialForm').reset();
        loadMemorials();
        switchTab(0);
      } else {
        showToast(result.message || 'Failed to create memorial', 'error');
      }
    } catch (error) {
      // Demo mode
      const newMemorial = {
        id: memorialData.length + 1,
        ...formData,
        public_id: formData.public_id || generateLocalPublicId7(),
        contributor_name: currentUser.name
      };
      memorialData.unshift(newMemorial);
      initMemorialSwipers();
      populateExploreGrid();
      showToast('Memorial created successfully!', 'success');
      document.getElementById('memorialForm').reset();
      switchTab(0);
    }
  });
}

// Photo Upload
function initPhotoUpload() {
  const placeholder = document.getElementById('photoPlaceholder');
  const input = document.getElementById('memorialPhoto');
  
  if (placeholder && input) {
    placeholder.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
          placeholder.innerHTML = `<img src="${event.target.result}" alt="Photo">`;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
  }
}

// Auth State
async function checkAuthState() {
  const saved = localStorage.getItem('user');
  if (saved) {
    currentUser = JSON.parse(saved);
    
    // Load user's preferred language if available
    if (currentUser.preferred_lang && currentUser.preferred_lang !== currentLang) {
      await switchLanguage(currentUser.preferred_lang);
    }
    
    updateProfileUI();
    refreshEntitlements();
  } else {
    updateProfileUI();
    refreshEntitlements();
  }
}

function updateProfileUI() {
  const profileContent = document.getElementById('profileContent');
  if (!profileContent) return;
  
  if (currentUser) {
    profileContent.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h2 class="profile-name">${currentUser.name || 'User'}</h2>
        <p class="profile-email">${currentUser.email || currentUser.phone || ''}</p>
      </div>
      
      <div class="profile-stats">
        <div class="stat-box">
          <div class="stat-value">0</div>
          <div class="stat-label">Memorials</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">0</div>
          <div class="stat-label">Tributes</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">0</div>
          <div class="stat-label">Following</div>
        </div>
      </div>
      
      <div class="profile-menu">
        <a href="#" class="menu-item" onclick="openCreateMemorialSheet(); return false;">
          <span>Create Memorial</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <a href="#" class="menu-item" onclick="switchTab(3); return false;">
          <span>Store</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <a href="#" class="menu-item">
          <span>My Memorials</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <a href="#" class="menu-item">
          <span>Settings</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <a href="#" class="menu-item">
          <span>Help & Support</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <a href="#" class="menu-item danger" onclick="logout(); return false;">
          <span>Sign Out</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      </div>
    `;
  } else {
    profileContent.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <h3>Welcome to Halvaa</h3>
        <p>Sign in to create memorials and connect with others</p>
        <button class="btn-primary" onclick="showAuthModal()" style="margin-top: 20px;">Sign In</button>
      </div>
    `;
  }
}

function openCreateMemorialSheet() {
  openModal('createMemorialSheet');
}

function openStoreSheet() {
  openModal('storeSheet');
  refreshCredits();
  refreshEntitlements();
}

// Store (uses credits for upgrades; full credits/payment via Stripe)
async function purchaseItem(sku) {
  if (!currentUser) {
    showAuthModal();
    showToast('Please sign in to use the Store', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}?action=purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, sku })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Purchased successfully! Feature unlocked.', 'success');
      refreshCredits();
      refreshStoreCredits();
      refreshEntitlements();
      loadPurchaseHistory();
    } else {
      showToast(data.message || 'Purchase failed', 'error');
    }
  } catch (_) {
    // Demo mode: simulate purchase
    const skuCosts = { 'extra_slots': 10, 'custom_id': 25, 'featured_7d': 40, 'premium_theme': 30 };
    const cost = skuCosts[sku] || 10;
    if (currentUser.credits >= cost) {
      currentUser.credits -= cost;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showToast('Demo: Feature unlocked!', 'success');
      refreshCredits();
      refreshStoreCredits();
    } else {
      showToast('Not enough credits. Buy more in the Store tab!', 'error');
    }
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('user');
  updateProfileUI();
  refreshEntitlements();
  showToast('Signed out successfully', 'success');
}

function socialLogin(provider) {
  showToast(`${provider} login coming soon!`, 'success');
  // In production, implement OAuth
}

// Mobile Menu
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const closeElements = document.querySelectorAll('[data-close-menu]');
  
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.add('is-open');
      mobileMenu.setAttribute('aria-hidden', 'false');
    });
    
    closeElements.forEach(el => {
      el.addEventListener('click', closeMobileMenu);
    });
  }
}

function closeMobileMenu() {
  const mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }
}

// Filter Chips
function initFilterChips() {
  const chips = document.querySelectorAll('.filter-chip');
  
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      // Add filtering logic here
    });
  });
}

// Utilities
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Click outside modal to close
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    const modal = e.target.closest('.modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
});

// ESC key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
});

// Search functionality
const exploreSearch = document.getElementById('exploreSearch');
if (exploreSearch) {
  exploreSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = memorialData.filter(m => 
      m.name.toLowerCase().includes(query) ||
      (m.biography && m.biography.toLowerCase().includes(query)) ||
      (m.occupation && m.occupation.toLowerCase().includes(query))
    );
    
    const grid = document.getElementById('exploreGrid');
    grid.innerHTML = '';
    filtered.forEach(memorial => {
      const image = memorial.image || `https://i.pravatar.cc/400?u=${memorial.id}`;
      const birthYear = new Date(memorial.birth_date).getFullYear();
      const deathYear = new Date(memorial.death_date).getFullYear();
      
      grid.innerHTML += `
        <div class="memorial-card" onclick="openMemorialModal(${memorial.id})">
          <div class="memorial-image-container">
            <img src="${image}" alt="${memorial.name}" class="memorial-image" loading="lazy">
          </div>
          <div class="memorial-card-content">
            <h3 class="memorial-card-name">${memorial.name}</h3>
            <p class="memorial-card-dates">${birthYear} - ${deathYear}</p>
          </div>
        </div>
      `;
    });
  });
}

// ====== STORE TAB & STRIPE INTEGRATION ======

function initStoreSwipers() {
  if (typeof Swiper === 'undefined') return;

  // Credit Packs Swiper
  if (document.getElementById('creditPacksSwiper')) {
    storeSwipers.creditPacks = new Swiper('#creditPacksSwiper', {
      slidesPerView: 'auto',
      spaceBetween: 16,
      freeMode: true,
      grabCursor: true,
    });
  }

  // Upgrades Swiper
  if (document.getElementById('upgradesSwiper')) {
    storeSwipers.upgrades = new Swiper('#upgradesSwiper', {
      slidesPerView: 'auto',
      spaceBetween: 16,
      freeMode: true,
      grabCursor: true,
    });
  }

  // Gift Cards Swiper
  if (document.getElementById('giftCardsSwiper')) {
    storeSwipers.giftCards = new Swiper('#giftCardsSwiper', {
      slidesPerView: 'auto',
      spaceBetween: 16,
      freeMode: true,
      grabCursor: true,
    });
  }
}

async function initStripe() {
  try {
    const res = await fetch(`${API_URL}?action=getStripeConfig`);
    const data = await res.json();
    if (data.success && data.publishableKey && !data.publishableKey.includes('YOUR_')) {
      stripeInstance = Stripe(data.publishableKey);
    }
  } catch (e) {
    console.log('Stripe not configured, using demo mode');
  }
}

function checkPaymentStatus() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    showToast('Payment successful! Credits added to your account.', 'success');
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    // Refresh credits
    if (currentUser) {
      refreshCredits();
      refreshStoreCredits();
    }
  } else if (params.get('payment') === 'cancelled') {
    showToast('Payment was cancelled', '');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

async function buyCredits(packId) {
  if (!currentUser) {
    showAuthModal();
    showToast('Please sign in to purchase credits', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}?action=createCheckoutSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        type: 'credits',
        pack_id: packId
      })
    });
    const data = await res.json();

    if (data.success) {
      if (stripeInstance && data.sessionId) {
        // Redirect to Stripe Checkout
        await stripeInstance.redirectToCheckout({ sessionId: data.sessionId });
      } else if (data.url) {
        // Fallback: redirect to Stripe URL directly
        window.location.href = data.url;
      } else {
        // Demo mode: simulate purchase
        demoAddCredits(packId);
      }
    } else {
      showToast(data.message || 'Failed to create checkout session', 'error');
    }
  } catch (e) {
    // Demo mode fallback
    demoAddCredits(packId);
  }
}

function demoAddCredits(packId) {
  const packs = {
    'starter': { credits: 50, bonus: 0 },
    'popular': { credits: 150, bonus: 25 },
    'premium': { credits: 500, bonus: 100 },
    'ultimate': { credits: 1000, bonus: 300 }
  };
  const pack = packs[packId];
  if (!pack) return;

  const total = pack.credits + pack.bonus;
  
  // Simulate adding credits locally
  if (currentUser) {
    currentUser.credits = (currentUser.credits || 0) + total;
    localStorage.setItem('user', JSON.stringify(currentUser));
    refreshCredits();
    refreshStoreCredits();
    showToast(`Demo: ${total} credits added to your account!`, 'success');
  }
}

async function buyGiftCard(value) {
  if (!currentUser) {
    showAuthModal();
    showToast('Please sign in to purchase gift cards', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}?action=createCheckoutSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        type: 'gift_card',
        pack_id: String(value)
      })
    });
    const data = await res.json();

    if (data.success) {
      if (stripeInstance && data.sessionId) {
        await stripeInstance.redirectToCheckout({ sessionId: data.sessionId });
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Gift card purchase coming soon!', 'success');
      }
    } else {
      showToast(data.message || 'Failed to create checkout', 'error');
    }
  } catch (e) {
    showToast('Gift card purchase coming soon! (Demo mode)', 'success');
  }
}

function refreshStoreCredits() {
  const el = document.getElementById('storeCreditsValue');
  if (!el) return;
  
  if (currentUser && currentUser.credits !== undefined) {
    el.textContent = String(currentUser.credits);
  } else if (currentUser) {
    // Fetch from API
    fetch(`${API_URL}?action=getCredits&user_id=${encodeURIComponent(currentUser.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          el.textContent = String(data.credits || 0);
          currentUser.credits = data.credits || 0;
        }
      })
      .catch(() => {
        el.textContent = '0';
      });
  } else {
    el.textContent = '0';
  }
}

async function loadPurchaseHistory() {
  const container = document.getElementById('purchaseHistory');
  if (!container || !currentUser) return;

  try {
    const res = await fetch(`${API_URL}?action=getPurchaseHistory&user_id=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();

    if (data.success && data.data && data.data.length > 0) {
      container.innerHTML = data.data.map(p => `
        <div class="purchase-item">
          <div class="purchase-info">
            <div class="purchase-sku">${formatSkuName(p.sku)}</div>
            <div class="purchase-date">${formatPurchaseDate(p.created_at)}</div>
          </div>
          <div class="purchase-credits">+${p.amount_credits} credits</div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="empty-state small"><p>No purchases yet</p></div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state small"><p>No purchases yet</p></div>';
  }
}

function formatSkuName(sku) {
  const names = {
    'credits_starter': 'Starter Pack',
    'credits_popular': 'Popular Pack',
    'credits_premium': 'Premium Pack',
    'credits_ultimate': 'Ultimate Pack',
    'extra_slots': 'Extra Memorial Slots',
    'custom_id': 'Custom Memorial ID',
    'featured_7d': 'Featured Memorial',
    'premium_theme': 'Premium Theme'
  };
  return names[sku] || sku;
}

function formatPurchaseDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Update refreshCredits to also update store display
const originalRefreshCredits = typeof refreshCredits === 'function' ? refreshCredits : async function() {};

async function refreshCredits() {
  const el = document.getElementById('creditsBalance');
  if (!el) return;
  if (!currentUser) {
    el.textContent = '0';
    return;
  }
  try {
    const res = await fetch(`${API_URL}?action=getCredits&user_id=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data.success) {
      el.textContent = String(data.credits || 0);
      currentUser.credits = data.credits || 0;
      refreshStoreCredits();
    }
  } catch (_) {
    el.textContent = '0';
  }
}

// ===== BEGIN: legacy app.js (safe-guarded) =====// Swipers for Latest section
(() => {
  if (typeof Swiper === 'undefined') return;

  // Free mode black & white list
  if (document.querySelector('.latest-free')) new Swiper('.latest-free', {
    slidesPerView: 'auto',
    spaceBetween: 16,
    freeMode: true,
  });

  // Responsive featured slider: 1 on mobile, 2 on desktop, no arrows
  if (document.querySelector('.latest-responsive')) new Swiper('.latest-responsive', {
    slidesPerView: 1,
    spaceBetween: 18,
    pagination: {
      el: '.latest-responsive .swiper-pagination',
      clickable: true,
    },
    breakpoints: {
      980: {
        slidesPerView: 2,
      },
    },
  });

  // Free mode list for Books & Articles
  if (document.querySelector('.books-free')) new Swiper('.books-free', {
    slidesPerView: 'auto',
    spaceBetween: 14,
    freeMode: true,
  });

  // Free mode list for Courses
  if (document.querySelector('.courses-free')) new Swiper('.courses-free', {
    slidesPerView: 'auto',
    spaceBetween: 16,
    freeMode: true,
  });
})();

// Animated counter for stats section
(() => {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statNumbers.length) return;

  const animateCounter = (element) => {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const updateCounter = () => {
      current += increment;
      if (current < target) {
        element.textContent = Math.floor(current).toLocaleString();
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target.toLocaleString();
      }
    };

    updateCounter();
  };

  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const statNumber = entry.target;
        if (!statNumber.classList.contains('animated')) {
          statNumber.classList.add('animated');
          animateCounter(statNumber);
        }
      }
    });
  }, observerOptions);

  statNumbers.forEach(stat => {
    observer.observe(stat);
  });
})();

// ===== END: legacy app.js (safe-guarded) =====
