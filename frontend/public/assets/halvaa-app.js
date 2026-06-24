// Halvaa App - Main JavaScript

const API_URL = 'api.php';
let tabsSwiper = null;
let memorialSwipers = {};
let memorialData = [];
let currentUser = null;
let homeExtraSwipers = {};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
  initTabsSwiper();
  initBottomNav();
  initAuthTabs();
  initOTPInputs();
  initPhotoUpload();
  initForms();
  loadMemorials();
  checkAuthState();
  initMobileMenu();
  initFilterChips();
  initGlobalDelegates();
  // initial state (home)
  updateHomeGradientVisibility(0);
});

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
  
  // Scroll to top of tab
  const slides = document.querySelectorAll('.tab-slide');
  if (slides[index]) {
    slides[index].scrollTo(0, 0);
  }
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
    { tag: 'Community', title: 'Top contributors this week', subtitle: 'See who’s preserving stories', tone: 'warm' },
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

// Memorial Modal
function openMemorialModal(id) {
  const memorial = memorialData.find(m => m.id === id);
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

  // Contributor info in modal (optional elements)
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
        closeModal('authModal');
        updateProfileUI();
        showToast('Welcome back!', 'success');
      } else {
        showToast(result.message || 'Login failed', 'error');
      }
    } catch (error) {
      // Demo mode
      currentUser = { id: 1, name: 'Demo User', email: email };
      localStorage.setItem('user', JSON.stringify(currentUser));
      closeModal('authModal');
      updateProfileUI();
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
function checkAuthState() {
  const saved = localStorage.getItem('user');
  if (saved) {
    currentUser = JSON.parse(saved);
    updateProfileUI();
  } else {
    updateProfileUI();
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
        <a href="#" class="menu-item" onclick="openStoreSheet(); return false;">
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
}

// Store (placeholder wiring; full credits/payment backend in api.php task)
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
      showToast('Purchased successfully', 'success');
      refreshCredits();
    } else {
      showToast(data.message || 'Purchase failed', 'error');
    }
  } catch (_) {
    showToast('Purchase failed (API not reachable)', 'error');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('user');
  updateProfileUI();
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

