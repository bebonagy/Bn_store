// app.js
import { db, appId } from './firebase-config.js';
import { initAuth, checkIsAdmin } from './auth.js';
import './admin.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.checkIsAdmin = checkIsAdmin;
window.sanitizeText = (val, maxLen = 500) => String(val ?? '').replace(/[<>]/g, '').trim().slice(0, maxLen);
const linkify = (text) => text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent-neon); text-decoration: underline;">$1</a>');

window.formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

window.compressImage = (base64Src, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    if (!base64Src) return reject(new Error('لم يتم العثور على صورة المعاينة!'));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width, height = img.height;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('حدث خطأ أثناء معالجة الصورة.'));
    img.src = base64Src; 
  });
};

window.storeState = {
  bannerAr: "", bannerExpiry: "", whatsapp: "201200898990",
  heroConfig: { titleAr: "", titleEn: "", descAr: "", descEn: "", btnTextAr: "Shop Now", btnTextEn: "Shop Now", bgUrl: "" },
  rates: { SAR: 0.077, AED: 0.075, USD: 0.020 }, payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  promos: [], products: [], orders: [], reviews: [], slides: [], users: [],
  categories: [ { id: 'games', name: 'Games' }, { id: 'keys', name: 'Digital Keys' }, { id: 'software', name: 'Software' }, { id: 'subs', name: 'Subscriptions' }, { id: 'gifts', name: 'Gift Cards' }, { id: 'deals', name: 'Deals' } ],
  wishlist: [], cart: []
};

let currentUserProfile = null;
window.editingProductId = null;
window.adminOrdersLimit = 20;
window.currentProductId = null; 
window.currentSelectedVariant = null; 
let activeDiscount = 0;
let unsubscribeOrders = null;
let unsubscribeReviews = null;
let unsubscribeUsers = null;
let countdownInterval = null;
let currentSlideIndex = 0;
let slideInterval = null;
let isDataLoaded = false;
let initialAuthDone = false; 
let currentCategory = 'all';
let currentPlatform = 'all'; // للفلترة المتقدمة
let currentPage = 1;
const itemsPerPage = 12;

window.showToast = (msg, type = 'normal') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};

window.navigate = (view, id = null, pushState = true) => {
    if (view === 'admin' && !window.checkIsAdmin()) {
        window.showToast('غير مصرح لك بالدخول للإدارة', 'error');
        view = 'home';
    }

    const homeView = document.getElementById('homeView');
    const productDetailsView = document.getElementById('productDetailsView');
    const adminView = document.getElementById('adminView');

    if (homeView) homeView.style.display = view === 'home' ? 'block' : 'none';
    if (productDetailsView) productDetailsView.style.display = view === 'details' ? 'block' : 'none';
    if (adminView) adminView.style.display = view === 'admin' ? 'block' : 'none';

    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.main-footer');
    if (view === 'admin') {
        if(header) header.style.display = 'none';
        if(footer) footer.style.display = 'none';
    } else {
        if(header) header.style.display = 'flex';
        if(footer) footer.style.display = 'block';
    }

    if (view === 'home') document.title = 'BN MAX | Digital Marketplace';
    else if (view === 'admin') document.title = 'لوحة التحكم | BN MAX';

    if (pushState) {
        if (view === 'details' && id) { history.pushState({ view: 'details', id }, '', '?product=' + id); } 
        else if (view === 'admin') { history.pushState({ view: 'admin' }, '', '?admin=true'); } 
        else { history.pushState({ view: 'home' }, '', window.location.pathname); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (e.state.view === 'details' && e.state.id) window.openProductDetails(e.state.id, false);
        else if (e.state.view === 'admin') window.navigate('admin', null, false);
        else window.navigate('home', null, false);
    } else {
        handleUrlRouting();
    }
});

const handleUrlRouting = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('product')) window.openProductDetails(params.get('product'), false);
    else if (params.has('admin')) window.navigate('admin', null, false);
    else window.navigate('home', null, false);
};

const translations = {
    ar: {
      nav_home: "الرئيسية", nav_games: "ألعاب", nav_keys: "مفاتيح رقمية", nav_software: "برامج", nav_subs: "اشتراكات", nav_gifts: "بطاقات هدايا", nav_deals: "عروض",
      nav_account: "حسابي", search_placeholder: "ابحث عن ألعاب، مفاتيح، برامج...",
      hero_badge: "🛡️ متجرك الرقمي الموثوق",
      btn_shop_now: "تسوق الآن", hero_stat_1: "تسليم فوري", hero_stat_2: "100% أمان", hero_stat_3: "دعم 24/7",
      cat_all: "⚡ الكل", best_sellers: "🔥 المنتجات المميزة", best_sellers_sub: "منتجاتنا الأكثر مبيعاً",
      sort_default: "الترتيب الافتراضي", sort_cheap: "الأرخص أولاً", sort_expensive: "الأغلى أولاً",
      btn_back: "🔙 رجوع", availability: "التوفر:", faq_title: "💡 أسئلة شائعة", btn_add_to_cart: "🛒 إضافة للسلة",
      btn_buy_now: "⚡ شراء سريع", platform_all: "كل المنصات", must_login: "يجب تسجيل الدخول أولاً!",
      you_may_like: "🔥 قد يعجبك أيضاً", reviews_title: "💬 تقييمات العملاء", add_review: "أضف تقييمك", rating: "التقييم",
      btn_submit_review: "إرسال التقييم", support: "الدعم الفني", cart_title: "🛒 سلة المشتريات", cart_suggestion: "🔥 ضيف ده لطلبك ووفر:",
      total: "الإجمالي:", btn_checkout: "إتمام الشراء الآن", auth_title: "تسجيل الدخول / إنشاء حساب", email: "البريد الإلكتروني",
      password: "كلمة المرور", btn_login: "تسجيل الدخول", forgot_password: "نسيت كلمة المرور؟", no_account: "ليس لديك حساب؟",
      create_account: "إنشاء حساب جديد", full_name: "الاسم الكامل", confirm_password: "تأكيد كلمة المرور", btn_register: "إنشاء الحساب",
      have_account: "لديك حساب بالفعل؟", btn_close: "إغلاق", my_account: "👤 حسابي الشخصي", welcome: "مرحباً بك،",
      tab_orders: "📦 طلباتي", tab_wishlist: "🤍 المفضلة", btn_logout: "تسجيل الخروج", checkout_title: "إتمام الطلب",
      selected_products: "المنتجات المختارة", promo_code: "كود الخصم (اختياري)", btn_apply: "تطبيق", payment_method: "اختر طريقة الدفع",
      transfer_to: "يرجى تحويل المبلغ إلى الحساب التالي:", btn_copy: "نسخ", sender_info: "رقم / حساب التحويل", receive_data: "بيانات الاستلام",
      receipt_img: "صورة إيصال التحويل (سكرين شوت)", btn_confirm_order: "تأكيد الطلب", btn_cancel: "إلغاء",
      out_of_stock: "نفذت الكمية", details_btn: "عرض التفاصيل", available: "متاح", piece: "قطعة", no_products: "لا توجد منتجات مطابقة حالياً.",
      promo_1_sub: "عرض لفترة محدودة", promo_1_title: "خصم يصل إلى 50%", promo_1_desc: "على ألعاب ومفاتيح مختارة",
      promo_2_title: "أحصل على أفضل العروض", promo_2_desc: "عروض حصرية لأعضائنا", btn_join_now: "انضم الآن",
      promo_3_title: "طلبات الجملة؟", promo_3_desc: "للشركات والموزعين", btn_contact: "تواصل معنا",
      ft_about: "من نحن", ft_contact: "اتصل بنا", ft_terms: "الشروط والأحكام", ft_privacy: "سياسة الخصوصية",
      ft_copy: "© 2026 BN MAX. جميع الحقوق محفوظة.", ft_slogan: "عالمك الرقمي... مهمتنا 🚀",
      reset_pass_desc: "أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لاستعادة كلمة المرور مباشرة.",
      btn_send_reset: "إرسال رابط الاستعادة", back_to_login: "رجوع لتسجيل الدخول", google_login: "الدخول بواسطة Google",
      nav_categories: "الأقسام", nav_search: "بحث", nav_wishlist: "المفضلة",
      qi_account: "نوع الحساب", qi_warranty: "الضمان", qi_region: "التفعيل", sys_req: "متطلبات التشغيل", select_variant: "اختر الباقة / النسخة:",
      btn_select_variant: "⚙️ اختيار الباقة"
    },
    en: {
      nav_home: "Home", nav_games: "Games", nav_keys: "Digital Keys", nav_software: "Software", nav_subs: "Subscriptions", nav_gifts: "Gift Cards", nav_deals: "Deals",
      nav_account: "Account", search_placeholder: "Search for games, keys, software...",
      hero_badge: "🛡️ YOUR TRUSTED DIGITAL STORE",
      btn_shop_now: "Shop Now", hero_stat_1: "Instant Delivery", hero_stat_2: "100% Secure", hero_stat_3: "24/7 Support",
      cat_all: "⚡ All", best_sellers: "🔥 Best Sellers", best_sellers_sub: "Our most popular products",
      sort_default: "Default Sorting", sort_cheap: "Lowest Price", sort_expensive: "Highest Price",
      btn_back: "🔙 Back", availability: "Availability:", faq_title: "💡 FAQ", btn_add_to_cart: "🛒 Add to Cart",
      btn_buy_now: "⚡ Buy Now", platform_all: "All Platforms", must_login: "You must login first!",
      you_may_like: "🔥 You May Also Like", reviews_title: "💬 Reviews", add_review: "Add your review", rating: "Rating",
      btn_submit_review: "Submit Review", support: "Support", cart_title: "🛒 Shopping Cart", cart_suggestion: "🔥 Add this and save:",
      total: "Total:", btn_checkout: "Checkout Now", auth_title: "Login / Register", email: "Email",
      password: "Password", btn_login: "Login", forgot_password: "Forgot Password?", no_account: "Don't have an account?",
      create_account: "Create an account", full_name: "Full Name", confirm_password: "Confirm Password", btn_register: "Register",
      have_account: "Already have an account?", btn_close: "Close", my_account: "👤 My Account", welcome: "Welcome,",
      tab_orders: "📦 My Orders", tab_wishlist: "🤍 Wishlist", btn_logout: "Logout", checkout_title: "Checkout",
      selected_products: "Selected Products", promo_code: "Promo Code", btn_apply: "Apply", payment_method: "Payment Method",
      transfer_to: "Please transfer the amount to:", btn_copy: "Copy", sender_info: "Sender Number/Account", receive_data: "Receive Data (ID/Email)",
      receipt_img: "Transfer Receipt", btn_confirm_order: "Confirm Order", btn_cancel: "Cancel",
      out_of_stock: "Sold Out", details_btn: "View Details", available: "Available", piece: "pcs", no_products: "No matching products found.",
      promo_1_sub: "Limited Time Offer", promo_1_title: "Up to 50% OFF", promo_1_desc: "On Selected Games & Keys",
      promo_2_title: "Get the Best Deals", promo_2_desc: "Exclusive offers for our members", btn_join_now: "Join Now",
      promo_3_title: "Bulk Orders?", promo_3_desc: "For Businesses & Resellers", btn_contact: "Contact Us",
      ft_about: "About Us", ft_contact: "Contact", ft_terms: "Terms & Conditions", ft_privacy: "Privacy Policy",
      ft_copy: "© 2026 BN MAX. All rights reserved.", ft_slogan: "Your Digital World... Our Mission 🚀",
      reset_pass_desc: "Enter your registered email and we will send you a password reset link.",
      btn_send_reset: "Send Reset Link", back_to_login: "Back to Login", google_login: "Login with Google",
      nav_categories: "Categories", nav_search: "Search", nav_wishlist: "Wishlist",
      qi_account: "Account Type", qi_warranty: "Warranty", qi_region: "Region", sys_req: "System Requirements", select_variant: "Select Variant:",
      btn_select_variant: "⚙️ Select Variant"
    }
  };

let currentLang = localStorage.getItem('bn_lang') || 'en';
const applyLanguage = () => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    const switchBtn = document.getElementById('langSwitchBtn');
    if(switchBtn) switchBtn.innerHTML = currentLang === 'ar' ? '🌐 EN ∨' : '🌐 AR ∨';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
    });
    
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.placeholder = translations[currentLang].search_placeholder;
    window.renderPlatformFilters();
    window.renderProducts();
    if(window.renderCategoriesBar) window.renderCategoriesBar(); 
    if(window.renderHeroBannerContent) window.renderHeroBannerContent();
};

document.getElementById('langSwitchBtn')?.addEventListener('click', async () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('bn_lang', currentLang);
    applyLanguage();
    if(currentUserProfile) {
      try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUserProfile.uid), { language: currentLang }); } catch(e){}
    }
});

const initCountdown = (expiryString) => {
    const bannerEl = document.getElementById('flashSaleBanner');
    const timerEl = document.getElementById('countdownTimer');
    if (!bannerEl || !timerEl) return;
    if (countdownInterval) clearInterval(countdownInterval);
    if (!expiryString) { bannerEl.style.display = 'none'; return; }
    const expiryTime = new Date(expiryString).getTime();
    if (isNaN(expiryTime)) { bannerEl.style.display = 'none'; return; }
  
    bannerEl.style.display = 'flex';
    countdownInterval = setInterval(() => {
      const distance = expiryTime - new Date().getTime();
      if (distance <= 0) { clearInterval(countdownInterval); bannerEl.style.display = 'none'; return; }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      let timeString = "⏳ ";
      if (days > 0) timeString += `${days} يوم `;
      timeString += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      timerEl.textContent = timeString;
    }, 1000);
};

// 💡 1. الكافر الثابت كواجهة دائمة
window.renderHeroBannerContent = () => {
  const heroBanner = document.querySelector('.hero-banner-box');
  if (!heroBanner) return;
  const cfg = window.storeState.heroConfig || {};
  const title = currentLang === 'ar' ? (cfg.titleAr || "BN MAX<br>MORE THAN <span>JUST KEYS</span>") : (cfg.titleEn || cfg.titleAr || "BN MAX<br>MORE THAN <span>JUST KEYS</span>");
  const desc = currentLang === 'ar' ? (cfg.descAr || "Games, Software, Gift Cards, Subscriptions and More...<br>All in One Place — Fast, Secure, Reliable.") : (cfg.descEn || cfg.descAr || "Games, Software, Gift Cards, Subscriptions and More...<br>All in One Place — Fast, Secure, Reliable.");
  const btnText = currentLang === 'ar' ? (cfg.btnTextAr || "Shop Now") : (cfg.btnTextEn || cfg.btnTextAr || "Shop Now");
  
  const titleEl = heroBanner.querySelector('.hero-title');
  const descEl = heroBanner.querySelector('.hero-desc');
  const btnEl = heroBanner.querySelector('.hero-btn span');
  
  if(titleEl) titleEl.innerHTML = title;
  if(descEl) descEl.innerHTML = desc;
  if(btnEl) btnEl.textContent = btnText;
  if(cfg.bgUrl) heroBanner.style.backgroundImage = `linear-gradient(rgba(10,10,22,0.85), rgba(20,11,36,0.85)), url('${cfg.bgUrl}')`;
  else heroBanner.style.backgroundImage = 'none';
};

// 💡 2. السلايدر التفاعلي كـ (Banner Style) للعروض فقط
window.renderPromoSlider = () => {
  const container = document.getElementById('promoSlider');
  const track = document.getElementById('sliderTrack');
  const dotsContainer = document.getElementById('sliderDots');
  
  if (!container || !track || !dotsContainer) return;
  
  const hasSlides = window.storeState.slides && window.storeState.slides.length > 0;

  if (hasSlides) {
      container.style.display = 'block';
      track.replaceChildren(); 
      dotsContainer.replaceChildren();

      window.storeState.slides.forEach((slide, idx) => {
        const slideDiv = document.createElement('div');
        slideDiv.className = `slider-slide ${idx === 0 ? 'active' : ''}`;
        slideDiv.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('${slide.imgUrl}')`;
        
        // ربط السلايدر بتوجيه الرابط عند الضغط عليه
        if (slide.link) {
            slideDiv.style.cursor = 'pointer';
            slideDiv.onclick = (e) => {
                if(e.target.tagName !== 'BUTTON') window.location.href = slide.link;
            };
        }

        slideDiv.innerHTML = `<div class="slider-content"><h2>${window.sanitizeText(slide.title)}</h2><p>${window.sanitizeText(slide.desc)}</p></div>`;
        track.appendChild(slideDiv);
        const dot = document.createElement('button');
        dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
        dot.onclick = (e) => { e.stopPropagation(); currentSlideIndex = idx; updateSliderPosition(); };
        dotsContainer.appendChild(dot);
      });

      if (slideInterval) clearInterval(slideInterval);
      if (window.storeState.slides.length > 1) { 
          slideInterval = setInterval(() => { 
              currentSlideIndex = (currentSlideIndex + 1) % window.storeState.slides.length; 
              updateSliderPosition(); 
          }, 4500); 
      }
      
      // Swipe Logic
      let startX = 0;
      track.ontouchstart = (e) => { startX = e.touches[0].clientX; };
      track.ontouchend = (e) => {
          let endX = e.changedTouches[0].clientX;
          if (startX - endX > 50) { 
              currentSlideIndex = (currentSlideIndex + 1) % window.storeState.slides.length;
              updateSliderPosition();
          } else if (endX - startX > 50) { 
              currentSlideIndex = (currentSlideIndex - 1 + window.storeState.slides.length) % window.storeState.slides.length;
              updateSliderPosition();
          }
      };
  } else {
      container.style.display = 'none';
  }
};
  
const updateSliderPosition = () => {
    const track = document.getElementById('sliderTrack');
    const dots = document.querySelectorAll('.slider-dot');
    if (!track || !window.storeState.slides.length) return;
    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlideIndex));
};

// 💡 3. الفلاتر المتقدمة للمنصات (Platform Filters)
window.renderPlatformFilters = () => {
    let platformBar = document.getElementById('platformFiltersBar');
    if (!platformBar) {
        platformBar = document.createElement('div');
        platformBar.id = 'platformFiltersBar';
        platformBar.style.cssText = 'display:flex; gap:10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;';
        
        // وضع الفلاتر أسفل قائمة الأقسام الرئيسية
        const catBar = document.getElementById('categoriesBar');
        if(catBar && catBar.parentNode) {
            catBar.parentNode.insertBefore(platformBar, catBar.nextSibling);
        }
    }
    
    if (currentCategory !== 'games') {
        platformBar.style.display = 'none';
        currentPlatform = 'all';
        return;
    }
    
    platformBar.style.display = 'flex';
    platformBar.innerHTML = '';
    
    const platforms = [
        { id: 'all', name: translations[currentLang].platform_all, icon: '🎮' },
        { id: 'steam', name: 'Steam', icon: '☁️' },
        { id: 'playstation', name: 'PlayStation', icon: '🎮' },
        { id: 'xbox', name: 'Xbox', icon: '🟢' },
        { id: 'epic', name: 'Epic', icon: '🌌' },
        { id: 'ea', name: 'EA App', icon: '🔴' },
        { id: 'ubisoft', name: 'Ubisoft', icon: '🌀' }
    ];
    
    platforms.forEach(p => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${currentPlatform === p.id ? 'active' : ''}`;
        btn.innerHTML = `${p.icon} ${p.name}`;
        btn.style.cssText = `white-space: nowrap; flex-shrink: 0; ${currentPlatform === p.id ? 'background: rgba(0,242,255,0.1); color: var(--accent-neon); border-color: var(--accent-neon); box-shadow: 0 0 15px var(--accent-glow);' : ''}`;
        btn.onclick = () => {
            currentPlatform = p.id;
            currentPage = 1;
            window.renderPlatformFilters();
            window.renderProducts();
        };
        platformBar.appendChild(btn);
    });
};

window.renderCategoriesBar = () => {
    const bar = document.getElementById('categoriesBar');
    const selectCat = document.getElementById('newProdCat');
    if (bar) {
      bar.replaceChildren();
      const allBtn = document.createElement('div');
      allBtn.className = `category-box ${currentCategory === 'all' ? 'active' : ''}`;
      allBtn.dataset.cat = 'all';
      allBtn.innerHTML = `<div class="category-info"><div class="category-icon">⚡</div><div class="category-name">${translations[currentLang].cat_all}</div></div>`;
      allBtn.onclick = () => { currentCategory = 'all'; currentPlatform = 'all'; currentPage = 1; window.renderCategoriesBar(); window.renderPlatformFilters(); window.renderProducts(); document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); };
      bar.appendChild(allBtn);
    }
    
    if(selectCat) selectCat.replaceChildren();
    const getCatIcon = (id) => {
        id = id.toLowerCase();
        if(id.includes('game')) return '🎮';
        if(id.includes('key')) return '🔑';
        if(id.includes('soft')) return '💻';
        if(id.includes('sub')) return '📺';
        if(id.includes('gift')) return '🎁';
        if(id.includes('deal')) return '🔥';
        return '✨';
    };
  
    const cats = window.storeState.categories || [];
    cats.forEach(c => {
      if (bar) {
        const btn = document.createElement('div');
        btn.className = `category-box ${currentCategory === c.id ? 'active' : ''}`;
        btn.dataset.cat = c.id;
        let catName = c.name;
        if (c.id === 'games') catName = translations[currentLang].nav_games;
        if (c.id === 'keys') catName = translations[currentLang].nav_keys;
        if (c.id === 'software') catName = translations[currentLang].nav_software;
        if (c.id === 'subs') catName = translations[currentLang].nav_subs;
        if (c.id === 'gifts') catName = translations[currentLang].nav_gifts;
        if (c.id === 'deals') catName = translations[currentLang].nav_deals;
  
        btn.innerHTML = `<div class="category-info"><div class="category-icon">${getCatIcon(c.id)}</div><div class="category-name">${catName}</div></div>`;
        btn.onclick = () => { currentCategory = c.id; currentPlatform = 'all'; currentPage = 1; window.renderCategoriesBar(); window.renderPlatformFilters(); window.renderProducts(); document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); };
        bar.appendChild(btn);
      }
      if(selectCat) { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; selectCat.appendChild(opt); }
    });
};

window.renderSkeletons = () => {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    grid.innerHTML = Array(4).fill().map(() => `<div class="skeleton-card skeleton" style="height:300px;"><div class="skel-img skeleton" style="background: rgba(255,255,255,0.05); height: 160px; width: 100%;"></div></div>`).join('');
};

window.renderProducts = () => {
    const grid = document.getElementById('productGrid');
    const currencySelect = document.getElementById('currencySelect');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const paginationControls = document.getElementById('paginationControls');
    
    if(!grid || !currencySelect) return;
    if (!isDataLoaded) return window.renderSkeletons();
  
    const currency = currencySelect.value;
    const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    const searchVal = searchInput?.value.trim().toLowerCase() || '';
    const sortVal = sortSelect?.value || 'default';
    
    let filtered = window.storeState.products.filter(prod => {
      if (currentCategory !== 'all' && prod.category !== currentCategory) return false;
      // الفلترة بالمنصات إذا كنا داخل قسم الألعاب
      if (currentCategory === 'games' && currentPlatform !== 'all' && prod.platform !== currentPlatform) return false;
      
      const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
      if (searchVal && !String(title).toLowerCase().includes(searchVal)) return false;
      return true;
    });
  
    if (sortVal === 'price_asc') filtered.sort((a, b) => a.price - b.price);
    if (sortVal === 'price_desc') filtered.sort((a, b) => b.price - a.price);
  
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if(currentPage > totalPages && totalPages > 0) currentPage = 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);
  
    grid.replaceChildren();
  
    if (!paginatedItems.length) { grid.innerHTML = `<div class="empty-products-msg"><div style="font-size:40px; margin-bottom:10px;">🔍</div><p>${translations[currentLang].no_products}</p></div>`; if(paginationControls) paginationControls.innerHTML=''; return; }
  
    paginatedItems.forEach(prod => {
      const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
      const badge = currentLang === 'ar' ? (prod.badgeAr || prod.badge) : (prod.badgeEn || prod.badge);
      
      let displayPrice = prod.price;
      if(prod.variants && prod.variants.length > 0) displayPrice = prod.variants[0].price;
  
      const convertedPrice = currency === 'EGP' ? displayPrice.toFixed(0) : (displayPrice / rate).toFixed(2);
      const convertedOld = (prod.oldPrice && prod.oldPrice > displayPrice) ? (currency === 'EGP' ? prod.oldPrice.toFixed(0) : (prod.oldPrice / rate).toFixed(2)) : '';
      
      const hasVariants = prod.variants && prod.variants.length > 0;
      let inStock = false;
      if (hasVariants) {
         inStock = prod.variants.some(v => v.stockQuantity === undefined || v.stockQuantity > 0);
      } else {
         inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
      }
  
      const isWished = window.storeState.wishlist.includes(prod.id);
      const discountPercent = (prod.oldPrice && prod.oldPrice > displayPrice) ? Math.round(((prod.oldPrice - displayPrice) / prod.oldPrice) * 100) : 0;
      const discountBadgeHTML = discountPercent > 0 ? `<span class="product-discount-badge">-${discountPercent}%</span>` : '';
      
      let ratingVal = 5.0, ratingCount = 0;
      const prodRevs = window.storeState.reviews.filter(r => r.productId === prod.id);
      if(prodRevs.length > 0) {
          ratingVal = (prodRevs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / prodRevs.length).toFixed(1);
          ratingCount = prodRevs.length;
      }
      const ratingHTML = ratingCount > 0 ? `<div class="product-rating">⭐ ${ratingVal} (${ratingCount})</div>` : `<div class="product-rating">⭐ 5.0 (0)</div>`;
  
      const btnText = inStock ? (hasVariants ? translations[currentLang].btn_select_variant : translations[currentLang].btn_add_to_cart) : translations[currentLang].out_of_stock;
      const btnAction = inStock ? (hasVariants ? `window.openProductDetails('${prod.id}')` : `window.addToCartDirect('${prod.id}', event)`) : '';
      
      // 💡 4. إضافة زرار الشراء السريع
      const addToCartBtnHTML = `<button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'} ${hasVariants ? 'select-variant-btn' : ''}" onclick="${btnAction}" ${inStock ? '' : 'disabled'} style="flex: 1;">${btnText}</button>`;
      const buyNowBtnHTML = (inStock && !hasVariants) ? `<button type="button" class="buy-btn" onclick="window.buyNowDirect('${prod.id}', event)" style="flex: 1; background: var(--accent-neon); color: #000; border-color: var(--accent-neon);">${translations[currentLang].btn_buy_now}</button>` : '';

      const card = document.createElement('div'); card.className = 'product-card';
      card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn') || e.target.classList.contains('buy-btn')) return; window.openProductDetails(prod.id); };
      
      card.innerHTML = `
        <div style="position:relative;">
          <button type="button" class="wishlist-icon-btn ${isWished ? 'active' : ''}" onclick="window.toggleWishlist('${prod.id}', event)">${isWished ? '❤️' : '🤍'}</button>
          ${discountBadgeHTML}
          ${badge ? `<span class="product-badge" style="top: ${discountPercent > 0 ? '35px' : '12px'}; right: 12px;">${window.sanitizeText(badge)}</span>` : ''}
          <div class="product-img" style="background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : window.sanitizeText(prod.imgText || title)}</div>
          <h3 class="product-title">${window.sanitizeText(title)}</h3>
          ${ratingHTML}
        </div>
        <div>
          <div class="product-price-box">${convertedOld ? `<span class="old-price">${convertedOld} ${currency}</span>` : ''}<span class="product-price">${convertedPrice} ${currency}</span></div>
          <div style="display:flex; gap:8px;">
            ${addToCartBtnHTML}
            ${buyNowBtnHTML}
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  
    if(paginationControls) {
      paginationControls.innerHTML = '';
      if(totalPages > 1) {
        for(let i=1; i<=totalPages; i++) {
          const btn = document.createElement('button'); btn.textContent = i;
          if(i === currentPage) btn.className = 'active-page';
          btn.onclick = () => { currentPage = i; window.scrollTo({top: document.getElementById('productGrid').offsetTop - 100, behavior:'smooth'}); window.renderProducts(); };
          paginationControls.appendChild(btn);
        }
      }
    }
};

window.toggleWishlist = (prodId, event) => {
    if (event) event.stopPropagation();
    if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول لإضافة المنتجات للمفضلة!', 'error');
  
    let wl = window.storeState.wishlist || [];
    if (wl.includes(prodId)) { wl = wl.filter(id => id !== prodId); window.showToast('تم الإزالة من المفضلة 💔', 'normal'); } 
    else { wl.push(prodId); window.showToast('تم الإضافة للمفضلة ❤️', 'success'); }
    
    window.storeState.wishlist = wl; 
    window.renderProducts(); window.updateDetailWishlistBtn();
    if(document.getElementById('userWishlistSection')?.style.display === 'block') window.renderUserWishlist();
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUserProfile.uid), { wishlist: wl }).catch(()=>{});
};

window.updateDetailWishlistBtn = () => {
    const btn = document.getElementById('toggleWishlistBtn'); if(!btn || !window.currentProductId) return;
    const isWished = window.storeState.wishlist.includes(window.currentProductId);
    btn.textContent = isWished ? '❤️' : '🤍'; btn.style.color = isWished ? 'var(--danger)' : '#fff'; btn.style.borderColor = isWished ? 'var(--danger)' : 'var(--border-color)';
};

window.loadProductReviews = (prodId) => {
    if (unsubscribeReviews) unsubscribeReviews();
    const addReviewBox = document.getElementById('addReviewBox');
    if (addReviewBox) {
      let hasCompletedOrder = false;
      if (currentUserProfile && window.storeState.orders) {
        hasCompletedOrder = window.storeState.orders.some(o => o.uid === currentUserProfile.uid && o.status === 'completed' && (o.productIds?.includes(prodId) || o.productId === prodId));
      }
      addReviewBox.style.display = (hasCompletedOrder || window.checkIsAdmin()) ? 'block' : 'none';
    }
  
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'reviews'), where('productId', '==', prodId));
    unsubscribeReviews = onSnapshot(q, (snap) => {
      const list = document.getElementById('productReviewsList'); if (!list) return; list.replaceChildren();
      const revs = []; snap.forEach(d => revs.push({ id: d.id, ...d.data() }));
      window.storeState.reviews = window.storeState.reviews.filter(r => r.productId !== prodId).concat(revs);
      revs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
      const detailBadge = document.getElementById('detailBadge');
      if (revs.length > 0) { const avgRating = (revs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / revs.length).toFixed(1); if(detailBadge && !detailBadge.textContent) detailBadge.textContent = `⭐ ${avgRating} (${revs.length} تقييم)`; }
      if (!revs.length) { list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">لا توجد تقييمات لهذا المنتج حتى الآن.</p>'; } 
      else { revs.forEach(r => { list.innerHTML += `<div style="background: #0b0b12; border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; position: relative;"><div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-left: ${window.checkIsAdmin() ? '50px' : '0'};"><strong style="color: var(--accent-neon);">${window.sanitizeText(r.userName || 'مستخدم')} <span style="font-size:10px; color:var(--text-muted); font-weight:normal; margin-right:5px;">- ${window.formatDate(r.createdAt)}</span></strong><span>${'⭐'.repeat(Number(r.rating) || 5)}</span></div><p style="color: var(--text-main); line-height: 1.5;">${window.sanitizeText(r.comment)}</p>${window.checkIsAdmin() ? `<button onclick="window.deleteReview('${r.id}')" style="position:absolute; left:10px; top:10px; background:var(--danger); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; z-index:10;">حذف 🗑️</button>` : ''}</div>`; }); }
    });
};

window.openProductDetails = (id, pushState = true) => {
    const prod = window.storeState.products.find(p => p.id === id); if (!prod) return;
    window.currentProductId = id; 
    window.currentSelectedVariant = null; 
    window.updateDetailWishlistBtn();
  
    const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
    const desc = currentLang === 'ar' ? (prod.descAr || prod.desc) : (prod.descEn || prod.desc);
    const badge = currentLang === 'ar' ? (prod.badgeAr || prod.badge) : (prod.badgeEn || prod.badge);
  
    document.title = `${title} | BN MAX`;

    const currency = document.getElementById('currencySelect').value;
    const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    let inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
  
    document.getElementById('detailTitle').textContent = title;
    document.getElementById('detailBadge').textContent = badge;
    
    const variantsContainer = document.getElementById('detailVariantsContainer');
    const variantsList = document.getElementById('detailVariants');
    const addBtn = document.getElementById('detailAddToCartBtn');
    
    // إزالة زر الشراء السريع القديم إن وجد لتحديثه
    let oldBuyNowBtn = document.getElementById('detailBuyNowBtn');
    if(oldBuyNowBtn) oldBuyNowBtn.remove();

    let currentDisplayPrice = prod.price;
    
    if (prod.variants && prod.variants.length > 0) {
        variantsContainer.style.display = 'block';
        variantsList.innerHTML = '';
        
        inStock = prod.variants.some(v => v.stockQuantity === undefined || v.stockQuantity > 0);
        if (addBtn && inStock) {
            addBtn.disabled = true; 
            addBtn.textContent = '⚙️ الرجاء اختيار الباقة';
            addBtn.style.opacity = '0.6';
            addBtn.style.width = '100%';
        }

        prod.variants.forEach((v) => {
            const vInStock = v.stockQuantity === undefined || v.stockQuantity > 0;
            const btn = document.createElement('button');
            btn.className = `variant-btn`;
            btn.textContent = currentLang === 'ar' ? v.nameAr : v.nameEn;
            if (!vInStock) { btn.style.opacity = '0.5'; btn.style.textDecoration = 'line-through'; btn.title = translations[currentLang].out_of_stock; }
            
            btn.onclick = () => {
                if(!vInStock) return;
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.currentSelectedVariant = v;
                const vPrice = currency === 'EGP' ? v.price.toFixed(0) : (v.price / rate).toFixed(2);
                document.getElementById('detailPrice').textContent = `${vPrice} ${currency}`;
                document.getElementById('detailOldPrice').textContent = ''; 
                
                const stockEl = document.getElementById('detailStock');
                if (stockEl) {
                    stockEl.textContent = (v.stockQuantity !== undefined) ? `${v.stockQuantity} ${translations[currentLang].piece}` : translations[currentLang].available; 
                    stockEl.style.color = 'var(--success)';
                }

                if (addBtn) {
                   addBtn.disabled = false;
                   addBtn.textContent = translations[currentLang].btn_add_to_cart;
                   addBtn.style.opacity = '1';
                   addBtn.style.width = '48%';
                   
                   // إظهار زر الشراء السريع بعد اختيار الباقة
                   if (!document.getElementById('detailBuyNowBtn')) {
                       const buyNowBtn = document.createElement('button');
                       buyNowBtn.id = 'detailBuyNowBtn';
                       buyNowBtn.className = 'buy-btn';
                       buyNowBtn.style.cssText = 'width: 48%; padding: 15px; font-size: 16px; margin-top: 10px; background: var(--accent-neon); color: #000; border-color: var(--accent-neon); margin-right: 4%;';
                       buyNowBtn.textContent = translations[currentLang].btn_buy_now;
                       buyNowBtn.onclick = (e) => window.buyNowDirect(prod.id, e);
                       addBtn.parentNode.insertBefore(buyNowBtn, addBtn.nextSibling);
                   }
                }
            };
            variantsList.appendChild(btn);
        });
    } else { 
        variantsContainer.style.display = 'none'; 
        if (addBtn) addBtn.style.width = inStock ? '48%' : '100%';
        if (inStock) {
            const buyNowBtn = document.createElement('button');
            buyNowBtn.id = 'detailBuyNowBtn';
            buyNowBtn.className = 'buy-btn';
            buyNowBtn.style.cssText = 'width: 48%; padding: 15px; font-size: 16px; margin-top: 10px; background: var(--accent-neon); color: #000; border-color: var(--accent-neon); margin-right: 4%;';
            buyNowBtn.textContent = translations[currentLang].btn_buy_now;
            buyNowBtn.onclick = (e) => window.buyNowDirect(prod.id, e);
            addBtn.parentNode.insertBefore(buyNowBtn, addBtn.nextSibling);
        }
    }
  
    const convertedPrice = currency === 'EGP' ? currentDisplayPrice.toFixed(0) : (currentDisplayPrice / rate).toFixed(2);
    const convertedOld = (!prod.variants || prod.variants.length === 0) && (prod.oldPrice && prod.oldPrice > currentDisplayPrice) ? (currency === 'EGP' ? prod.oldPrice.toFixed(0) : (prod.oldPrice / rate).toFixed(2)) : '';
    document.getElementById('detailPrice').textContent = `${convertedPrice} ${currency}`;
    document.getElementById('detailOldPrice').textContent = convertedOld ? `${convertedOld} ${currency}` : '';
  
    const platformDiv = document.getElementById('detailPlatform');
    const platformLogo = document.getElementById('detailPlatformLogo');
    const platformName = document.getElementById('detailPlatformName');
    const platformsData = {
        steam: { name: 'Steam', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg' },
        epic: { name: 'Epic Games', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg' },
        playstation: { name: 'PlayStation', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/00/PlayStation_logo.svg' },
        xbox: { name: 'Xbox', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Xbox_logo_%282019%29.svg' },
        nintendo: { name: 'Nintendo', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Nintendo.svg' },
        ubisoft: { name: 'Ubisoft', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Ubisoft_logo.svg' },
        ea: { name: 'EA App', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Electronic-Arts-Logo.svg' },
        battlenet: { name: 'Battle.net', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Battle.net_Icon.svg' }
    };
    
    if (prod.platform && platformsData[prod.platform] && prod.category === 'games') {
        platformDiv.style.display = 'flex'; platformLogo.src = platformsData[prod.platform].icon; platformName.textContent = platformsData[prod.platform].name;
    } else { platformDiv.style.display = 'none'; }
  
    const quickInfoBox = document.getElementById('detailQuickInfo');
    if (prod.quickInfo && (prod.quickInfo.accountAr || prod.quickInfo.warrantyAr || prod.quickInfo.regionAr)) {
        quickInfoBox.style.display = 'flex';
        document.getElementById('qiAccountVal').textContent = currentLang === 'ar' ? (prod.quickInfo.accountAr || '-') : (prod.quickInfo.accountEn || '-');
        document.getElementById('qiWarrantyVal').textContent = currentLang === 'ar' ? (prod.quickInfo.warrantyAr || '-') : (prod.quickInfo.warrantyEn || '-');
        document.getElementById('qiRegionVal').textContent = currentLang === 'ar' ? (prod.quickInfo.regionAr || '-') : (prod.quickInfo.regionEn || '-');
    } else { quickInfoBox.style.display = 'none'; }
  
    const reqContainer = document.getElementById('detailRequirementsContainer');
    const reqContent = document.getElementById('detailRequirementsContent');
    const reqText = currentLang === 'ar' ? prod.reqAr : prod.reqEn;
    if (prod.category === 'games' && reqText) { reqContainer.style.display = 'block'; reqContent.innerHTML = linkify(reqText).replace(/\n/g, '<br>'); } 
    else { reqContainer.style.display = 'none'; }
  
    const descContainer = document.getElementById('detailDescContainer');
    if (descContainer) {
      descContainer.replaceChildren();
      const descLines = (desc || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (descLines.length > 1 || (descLines.length === 1 && descLines[0].startsWith('-'))) {
        const ul = document.createElement('ul'); ul.style.cssText = 'padding-right: 20px; line-height: 1.8; color: var(--text-main);';
        descLines.forEach(line => { const li = document.createElement('li'); li.innerHTML = linkify(line.replace(/^[-*•]\s*/, '')); ul.appendChild(li); });
        descContainer.appendChild(ul);
      } else {
        const p = document.createElement('p'); p.innerHTML = linkify(desc || ''); p.style.cssText = 'color: var(--text-main); line-height: 1.8;';
        descContainer.appendChild(p);
      }
    }
  
    const faqContainer = document.getElementById('detailFaqContainer');
    const faqList = document.getElementById('detailFaqList');
    if (prod.faqText && prod.faqText.trim()) {
        faqContainer.style.display = 'block'; faqList.innerHTML = '';
        const blocks = prod.faqText.split(/\n\n+/);
        blocks.forEach(block => {
            const lines = block.split('\n').filter(l => l.trim());
            if (lines.length >= 2) {
                const q = lines[0].replace(/^(سؤال|س|Q):\s*/i, ''); const a = lines.slice(1).join('<br>').replace(/^(إجابة|ج|جواب|A):\s*/i, '');
                faqList.innerHTML += `<div class="faq-item"><button class="faq-question">${window.sanitizeText(q)}</button><div class="faq-answer">${linkify(a)}</div></div>`;
            }
        });
        document.querySelectorAll('.faq-question').forEach(btn => { btn.onclick = () => { btn.classList.toggle('active'); btn.nextElementSibling.classList.toggle('open'); }; });
    } else { faqContainer.style.display = 'none'; }
    
    const imgBox = document.getElementById('detailImageBox');
    const galleryBox = document.getElementById('detailImageGallery');
    const mainImgUrl = prod.bannerUrl || prod.imgUrl;
    
    if(imgBox) {
      if(mainImgUrl) { imgBox.style.backgroundImage = `url('${mainImgUrl}')`; imgBox.style.border = 'none'; imgBox.textContent = ''; }
      else { imgBox.style.backgroundImage = 'none'; imgBox.textContent = prod.imgText || title; imgBox.style.cursor = 'default'; }
    }
    
    if(galleryBox) {
        galleryBox.replaceChildren();
        const allImages = [];
        if (prod.imgUrl) allImages.push(prod.imgUrl); if (prod.bannerUrl) allImages.push(prod.bannerUrl); if (prod.gallery && Array.isArray(prod.gallery)) allImages.push(...prod.gallery);
        const uniqueImages = [...new Set(allImages)]; 
        if (uniqueImages.length > 1) {
            uniqueImages.forEach((imgSrc) => {
                const thumb = document.createElement('img'); thumb.src = imgSrc; thumb.className = 'gallery-thumb';
                thumb.onclick = () => { document.getElementById('lightboxImg').src = imgSrc; document.getElementById('lightboxModal').style.display = 'flex'; };
                galleryBox.appendChild(thumb);
            });
        }
    }
  
    const stockEl = document.getElementById('detailStock'); 
    if (stockEl && addBtn) {
      if (inStock) {
        let qtyText = translations[currentLang].available;
        if (window.currentSelectedVariant && window.currentSelectedVariant.stockQuantity !== undefined) qtyText = `${window.currentSelectedVariant.stockQuantity} ${translations[currentLang].piece}`;
        else if (!window.currentSelectedVariant && prod.stockQuantity !== undefined) qtyText = `${prod.stockQuantity} ${translations[currentLang].piece}`;
        stockEl.textContent = qtyText; stockEl.style.color = 'var(--success)';
        if (!prod.variants || prod.variants.length === 0) {
            addBtn.textContent = translations[currentLang].btn_add_to_cart; addBtn.disabled = false; addBtn.style.opacity = '1';
        }
        addBtn.classList.remove('out-of-stock-badge');
      } else {
        stockEl.textContent = translations[currentLang].out_of_stock; stockEl.style.color = 'var(--danger)';
        addBtn.textContent = translations[currentLang].out_of_stock; addBtn.disabled = true; addBtn.classList.add('out-of-stock-badge');
      }
    }
    window.loadProductReviews(id); 
    window.navigate('details', id, pushState);
};

window.updateCartBadge = () => {
    const badge = document.getElementById('cartCountBadge'); const badgeMobile = document.getElementById('cartCountBadgeMobile');
    if (badge) { badge.textContent = window.storeState.cart.length; badge.style.display = window.storeState.cart.length > 0 ? 'flex' : 'none'; }
    if (badgeMobile) { badgeMobile.textContent = window.storeState.cart.length; badgeMobile.style.display = window.storeState.cart.length > 0 ? 'flex' : 'none'; }

    document.querySelectorAll('#cartBtnNav, .mobile-cart-btn').forEach(btn => {
        btn.classList.remove('cart-bounce');
        void btn.offsetWidth; 
        btn.classList.add('cart-bounce');
    });
};

window.addToCartDirect = (prodId, event) => {
    if (event) event.stopPropagation();
    const prod = window.storeState.products.find(p => p.id === prodId);
    if (prod && prod.inStock) {
        let cartItem = JSON.parse(JSON.stringify(prod)); 
        cartItem.cartItemId = Date.now() + Math.random(); 
        
        if (!event && window.currentSelectedVariant && window.currentProductId === prodId) {
            cartItem.price = window.currentSelectedVariant.price;
            cartItem.titleAr = (prod.titleAr || prod.title) + ` - ${window.currentSelectedVariant.nameAr}`;
            cartItem.titleEn = (prod.titleEn || prod.title) + ` - ${window.currentSelectedVariant.nameEn}`;
            cartItem.variantId = window.currentSelectedVariant.id || window.currentSelectedVariant.nameEn;
        } else if (prod.variants && prod.variants.length > 0) {
            cartItem.price = prod.variants[0].price;
            cartItem.titleAr = (prod.titleAr || prod.title) + ` - ${prod.variants[0].nameAr}`;
            cartItem.titleEn = (prod.titleEn || prod.title) + ` - ${prod.variants[0].nameEn}`;
            cartItem.variantId = prod.variants[0].id || prod.variants[0].nameEn;
        }
        window.storeState.cart.push(cartItem); window.updateCartBadge(); window.showToast('🛒 ' + translations[currentLang].btn_add_to_cart, 'success'); 
    }
};

window.buyNowDirect = (prodId, event) => {
    if(event) event.stopPropagation();
    
    if (!currentUserProfile) {
        window.showToast(translations[currentLang].must_login, 'error');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    
    window.addToCartDirect(prodId, event);
    document.getElementById('cartModal').style.display = 'none';
    activeDiscount = 0; document.getElementById('promoCodeInput').value = ''; 
    if(document.getElementById('promoMsg')) document.getElementById('promoMsg').textContent = '';
    
    updateCheckoutPriceDisplay(); 
    updatePaymentInfoBox(); 
    document.getElementById('checkoutModal').style.display = 'flex';
};

window.addToCartCross = (id) => {
    const p = window.storeState.products.find(x => x.id === id);
    if(p) { window.addToCartDirect(id); window.renderCartModal(); window.showToast('تم إضافة الاقتراح للسلة!', 'success'); }
};

window.removeFromCart = (index) => { window.storeState.cart.splice(index, 1); window.updateCartBadge(); window.renderCartModal(); };

window.renderCartModal = () => {
    const list = document.getElementById('cartItemsList'); const crossSellSection = document.getElementById('cartCrossSellSection'); const crossSellList = document.getElementById('cartCrossSellList'); const totalDisplay = document.getElementById('cartTotalPriceDisplay');
    const currency = document.getElementById('currencySelect').value; const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    
    if (!window.storeState.cart.length) {
      list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px 0;">السلة فارغة حالياً.</p>';
      totalDisplay.textContent = `0 ${currency}`; document.getElementById('proceedToCheckoutBtn').disabled = true;
      if(crossSellSection) crossSellSection.style.display = 'none'; return;
    }
    
    document.getElementById('proceedToCheckoutBtn').disabled = false;
    list.innerHTML = ''; let total = 0; let currentCartIds = [];
    
    window.storeState.cart.forEach((p, idx) => {
      const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
      currentCartIds.push(p.id);
      const itemPrice = currency === 'EGP' ? p.price : (p.price / rate); total += itemPrice;
      list.innerHTML += `<div class="cart-item"><div class="cart-item-info"><div class="cart-item-title">${window.sanitizeText(title)}</div><div class="cart-item-price">${itemPrice.toFixed(currency==='EGP'?0:2)} ${currency}</div></div><button type="button" class="remove-cart-btn" onclick="window.removeFromCart(${idx})" title="حذف">🗑️</button></div>`;
    });
    totalDisplay.textContent = `${total.toFixed(currency==='EGP'?0:2)} ${currency}`;
  
    if(crossSellSection && crossSellList) {
        let suggestions = []; window.storeState.cart.forEach(p => { if (p.crossSellIds) suggestions.push(...p.crossSellIds); });
        suggestions = [...new Set(suggestions)].filter(id => !currentCartIds.includes(id)); 
        if(suggestions.length > 0) {
            crossSellList.innerHTML = '';
            suggestions.forEach(sId => {
                const sProd = window.storeState.products.find(x => x.id === sId && x.inStock);
                if(sProd) {
                    const sTitle = currentLang === 'ar' ? (sProd.titleAr || sProd.title) : (sProd.titleEn || sProd.title);
                    const sPrice = currency === 'EGP' ? sProd.price.toFixed(0) : (sProd.price / rate).toFixed(2);
                    crossSellList.innerHTML += `<div class="cross-sell-item" style="min-width: 150px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;"><div class="cross-sell-img" style="background-image:url('${sProd.imgUrl}'); height: 60px; background-size: cover; background-position: center; border-radius: 5px; margin-bottom: 5px;"></div><div class="cross-sell-title" style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;">${sTitle}</div><div class="cross-sell-price" style="font-size: 12px; color: var(--accent-neon); font-weight: bold; margin-bottom: 5px;">+${sPrice}${currency}</div><button class="add-cross-btn submit-btn" style="padding: 4px; font-size: 11px;" onclick="window.addToCartCross('${sProd.id}')">إضافة</button></div>`;
                }
            });
            crossSellSection.style.display = crossSellList.innerHTML ? 'block' : 'none';
        } else { crossSellSection.style.display = 'none'; }
    }
};

window.renderUserOrders = () => {
    const list = document.getElementById('userOrdersList'); if (!list) return; list.replaceChildren();
    const myOrders = window.storeState.orders.filter(o => currentUserProfile && o.uid === currentUserProfile.uid);
    if (!myOrders.length) { list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد طلبات سابقة حتى الآن.</p>'; return; }
    
    myOrders.forEach(o => {
       const div = document.createElement('div'); div.style.cssText = 'background: #0b0b12; border: 1px solid var(--border-color); border-radius: 9px; padding: 14px; margin-bottom: 15px;';
       const trackerHTML = `<div class="order-tracker"><div class="tracker-step ${o.status === 'pending' || o.status === 'completed' ? 'active' : ''} ${o.status === 'cancelled' ? 'cancelled' : ''}"><span>1</span><div class="tracker-label">مراجعة</div></div><div class="tracker-step ${o.status === 'completed' ? 'completed' : ''} ${o.status === 'cancelled' ? 'cancelled' : ''}"><span>2</span><div class="tracker-label">${o.status === 'cancelled' ? 'ملغي' : 'مكتمل'}</div></div></div>`;
       div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${o.productName} (${o.finalPrice} ${o.currency || 'EGP'})</strong></div><div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${window.formatDate(o.createdAt)}</div>${trackerHTML}${o.status === 'completed' && o.deliveredCode ? `<div style="background: rgba(0,255,100,.07); border: 1px solid var(--success); padding: 10px; border-radius: 7px; margin-top: 25px; font-family: monospace; color: var(--success); word-break: break-all;">🎁 بيانات التفعيل: <strong>${o.deliveredCode}</strong></div>` : ''}`;
       list.appendChild(div);
    });
};

window.renderUserWishlist = () => {
    const grid = document.getElementById('userWishlistGrid'); if (!grid) return; grid.replaceChildren();
    const wishedProducts = window.storeState.products.filter(p => window.storeState.wishlist.includes(p.id));
    if(!wishedProducts.length) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:20px;">لا توجد منتجات في المفضلة.</p>'; return; }
    const currency = document.getElementById('currencySelect').value, rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    wishedProducts.forEach(prod => {
      const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
      const convertedPrice = currency === 'EGP' ? prod.price.toFixed(0) : (prod.price / rate).toFixed(2);
      const card = document.createElement('div'); card.className = 'product-card'; card.style.padding = '15px';
      card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn')) return; document.getElementById('userAccountModal').style.display = 'none'; window.openProductDetails(prod.id); };
      card.innerHTML = `<div style="position:relative;"><button type="button" class="wishlist-icon-btn active" style="top:5px; left:5px; width:25px; height:25px; font-size:12px;" onclick="window.toggleWishlist('${prod.id}', event)">❤️</button><div class="product-img" style="height:100px; background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : window.sanitizeText(prod.imgText || title)}</div><h3 class="product-title" style="font-size:14px;">${window.sanitizeText(title)}</h3><div class="product-price" style="font-size:16px;">${convertedPrice} ${currency}</div></div>`;
      grid.appendChild(card);
    });
};

const updateCheckoutPriceDisplay = () => {
    if (!window.storeState.cart.length) return;
    const currency = document.getElementById('currencySelect').value; const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    let totalPrice = 0, titles = [];
    window.storeState.cart.forEach(p => { 
      const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
      totalPrice += currency === 'EGP' ? p.price : (p.price / rate); titles.push(title);
    });
    if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
    const finalPrice = totalPrice.toFixed(currency === 'EGP' ? 0 : 2);
    const discountText = activeDiscount > 0 ? ` (بعد خصم ${activeDiscount}%)` : '';
    const selectedProductInput = document.getElementById('selectedProduct');
    if (selectedProductInput) selectedProductInput.value = `${titles.join(' + ')}\nالإجمالي: (${finalPrice} ${currency})${discountText}`;
};

const updatePaymentInfoBox = () => {
    const methodSelect = document.getElementById('paymentMethod'); if (!methodSelect) return;
    const method = methodSelect.value, payments = window.storeState.payments || {}; let targetVal = "";
    if (method === 'vodafone') targetVal = payments.vodafone || "رقم فودافون كاش غير مضاف حالياً";
    else if (method === 'instapay') targetVal = payments.instapay || "حساب إنستا باي غير مضاف حالياً";
    else if (method === 'orange') targetVal = payments.orange || payments.vodafone || "رقم أورنج كاش غير مضاف حالياً";
    else if (method === 'crypto') targetVal = payments.crypto || "عنوان محفظة الكريبتو غير مضاف حالياً";
    const addressDisplay = document.getElementById('paymentAddressDisplay'); if (addressDisplay) addressDisplay.textContent = targetVal;
};

// 💡 نظام إتمام الدفع الموحد (العادي + الواتساب) وحماية الأسعار
const processCheckout = async (isWhatsApp) => {
    if (!currentUserProfile || !window.storeState.cart.length) return;
    
    const receiptFileInput = document.getElementById('receiptFileInput');
    if (!isWhatsApp && (!receiptFileInput || !receiptFileInput.files[0])) {
        return window.showToast('برجاء إرفاق صورة الإيصال!', 'error');
    }

    const senderInfo = window.sanitizeText(document.getElementById('senderInfo').value) || (isWhatsApp ? 'غير مسجل' : '');
    const transactionId = window.sanitizeText(document.getElementById('transactionIdInput').value) || (isWhatsApp ? 'غير مسجل' : '');
    const customerData = window.sanitizeText(document.getElementById('customerData').value) || (isWhatsApp ? 'غير مسجل' : '');
    
    if (!isWhatsApp && (!senderInfo || !transactionId || !customerData)) {
         return window.showToast('برجاء إكمال جميع البيانات', 'error');
    }

    const btn = isWhatsApp ? document.getElementById('whatsappCheckoutBtn') : document.getElementById('confirmOrderBtn');
    const origText = btn.innerHTML;
    btn.innerHTML = 'جاري الإرسال ⏳...'; btn.disabled = true;

    try {
        let receiptBase64 = '';
        if (receiptFileInput && receiptFileInput.files[0]) {
            receiptBase64 = await window.compressImage(document.getElementById('receiptPreview').src);
        }

        const currency = document.getElementById('currencySelect').value; 
        const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
        
        // حساب الأسعار وحمايتها من التلاعب (Server-side simulation validation)
        let totalRealPrice = 0;
        let productTitles = [];
        let productIds = [];
        let cartItemsDetails = [];

        for (const p of window.storeState.cart) {
            const dbProd = window.storeState.products.find(x => x.id === p.id);
            if (!dbProd) throw new Error(`المنتج ${p.title} غير متاح حالياً`);
            
            let realPrice = dbProd.price;
            if (p.variantId && dbProd.variants) {
                const dbVar = dbProd.variants.find(v => (v.id || v.nameEn) === p.variantId);
                if (dbVar) realPrice = dbVar.price;
            }
            
            const itemPriceConverted = currency === 'EGP' ? realPrice : (realPrice / rate);
            totalRealPrice += itemPriceConverted;
            
            const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
            productTitles.push(title);
            productIds.push(p.id);
            cartItemsDetails.push({ id: p.id, variantId: p.variantId || null, price: realPrice, title });
        }

        if (activeDiscount > 0) totalRealPrice = totalRealPrice - (totalRealPrice * (activeDiscount / 100));
        totalRealPrice = Number(totalRealPrice.toFixed(currency === 'EGP' ? 0 : 2));

        const paymentMethod = document.getElementById('paymentMethod').value;
        const promoCode = document.getElementById('promoCodeInput').value.trim();
        const newOrderRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));

        await runTransaction(db, async (transaction) => {
            const updates = new Map();
            for (const p of cartItemsDetails) {
                const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id);
                const sfDoc = await transaction.get(prodRef);
                if (!sfDoc.exists()) throw new Error(`المنتج غير موجود!`);
                const data = updates.has(p.id) ? updates.get(p.id) : sfDoc.data();
                
                if (p.variantId && data.variants && data.variants.length > 0) {
                    const vIndex = data.variants.findIndex(v => (v.id || v.nameEn) === p.variantId);
                    if (vIndex !== -1 && data.variants[vIndex].stockQuantity !== undefined) {
                        const newVStock = data.variants[vIndex].stockQuantity - 1;
                        if (newVStock < 0) throw new Error(`نفذت كمية الباقة لمنتج ${p.title}!`);
                        data.variants[vIndex].stockQuantity = newVStock;
                    }
                } else if (data.stockQuantity !== undefined) {
                    const newStock = data.stockQuantity - 1;
                    if (newStock < 0) throw new Error(`نفذت الكمية لمنتج ${p.title}!`);
                    data.stockQuantity = newStock;
                    data.inStock = newStock > 0;
                }
                updates.set(p.id, data);
            }
            for (const [id, data] of updates.entries()) {
                transaction.update(doc(db, 'artifacts', appId, 'public', 'data', 'products', id), {
                    stockQuantity: data.stockQuantity,
                    inStock: data.inStock !== undefined ? data.inStock : (data.stockQuantity > 0),
                    variants: data.variants || []
                });
            }
            transaction.set(newOrderRef, { 
                uid: currentUserProfile.uid, 
                userEmail: currentUserProfile.email, 
                items: cartItemsDetails,
                productIds, productId: productIds[0], productName: productTitles.join(' + '), finalPrice: totalRealPrice, currency, 
                discountApplied: activeDiscount, promoCodeUsed: activeDiscount > 0 ? promoCode : "", 
                paymentMethod, senderInfo, transactionId, customerData, receiptImage: receiptBase64 || '', status: 'pending', deliveredCode: '', createdAt: serverTimestamp() 
            });
        });

        window.storeState.cart = []; window.updateCartBadge();
        document.getElementById('checkoutModal').style.display = 'none'; document.getElementById('checkoutForm').reset();
        activeDiscount = 0;

        if (isWhatsApp) {
            const whatsappNumber = window.storeState.whatsapp || '201200898990';
            const finalPriceText = `${totalRealPrice} ${currency}`;
            const message = `السلام عليكم، لقد قمت بطلب جديد من متجر BN MAX 🚀:\n\n` +
                            `📦 *المنتجات:* ${productTitles.join(' + ')}\n` +
                            `💰 *الإجمالي:* ${finalPriceText}\n` +
                            (activeDiscount > 0 ? `🎟️ *كوبون الخصم:* ${promoCode}\n` : '') +
                            `💳 *طريقة الدفع:* ${paymentMethod}\n` +
                            `🔢 *رقم العملية:* ${transactionId}\n` +
                            `📱 *رقم التحويل:* ${senderInfo}\n` +
                            `👤 *بيانات الاستلام:* ${customerData}\n\n` +
                            `يرجى مراجعة الطلب وتأكيده!`;
            window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
            window.showToast('💬 تم إرسال الطلب وتحويلك للواتساب!', 'success');
        } else {
            window.showToast('🎉 تم إرسال طلبك بنجاح! راجع "حسابي" لمتابعة الحالة.', 'success');
        }

    } catch (err) {
        window.showToast(err.message || 'حدث خطأ، تأكد من اتصالك.', 'error');
    } finally {
        btn.innerHTML = origText; btn.disabled = false;
    }
};

document.getElementById('checkoutForm')?.addEventListener('submit', (e) => { e.preventDefault(); processCheckout(false); });
document.getElementById('whatsappCheckoutBtn')?.addEventListener('click', () => { processCheckout(true); });

const handleShare = async (title, text, url) => {
    if (navigator.share) { try { await navigator.share({ title, text, url }); } catch(err) {} } 
    else { navigator.clipboard.writeText(url); window.showToast('تم نسخ الرابط! 📋', 'success'); }
};
document.getElementById('shareBtn')?.addEventListener('click', () => handleShare('BN MAX Store', 'أفضل متجر للخدمات الرقمية!', window.location.href));
document.getElementById('shareProductBtn')?.addEventListener('click', () => { const title = document.getElementById('detailTitle').textContent; handleShare(title, `شاهد هذا المنتج الرائع على BN MAX: ${title}`, window.location.href); });

window.loadMoreAdminOrders = () => { 
    window.adminOrdersLimit += 20; 
    if(currentUserProfile) {
        const q = window.checkIsAdmin() ? query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('createdAt', 'desc'), limit(window.adminOrdersLimit)) : query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where('uid', '==', currentUserProfile.uid));
        unsubscribeOrders = onSnapshot(q, snap => {
           const ords = []; snap.forEach(d => ords.push({id: d.id, ...d.data()})); window.storeState.orders = ords.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
           window.renderUserOrders(); if(window.checkIsAdmin()) { window.renderAdminOrders(); window.renderAdminStats(); }
        });
    }
};

const loadSeoFromDB = (data) => {
    if(data.seo) {
      if(data.seo.title) { document.getElementById('metaTitle').textContent = data.seo.title; document.getElementById('metaOgTitle').content = data.seo.title; }
      if(data.seo.desc) { document.getElementById('metaDesc').content = data.seo.desc; document.getElementById('metaOgDesc').content = data.seo.desc; }
      if(data.seo.keywords) document.getElementById('metaKeywords').content = data.seo.keywords;
    }
};

const initApp = () => {
    applyLanguage();
    
    // 💡 5. ربط قائمة الترتيب برمجياً عشان تشتغل لما العميل يغير الفلتر
    document.getElementById('sortSelect')?.addEventListener('change', () => {
        currentPage = 1;
        window.renderProducts();
    });

    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
      const products = []; snap.forEach(doc => products.push({ id: doc.id, ...doc.data() })); window.storeState.products = products; isDataLoaded = true; 
      window.renderProducts(); if(window.checkIsAdmin()) window.renderAdminProducts();
    });
  
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), snap => {
      if (snap.exists()) {
        const data = snap.data(); window.storeState.whatsapp = data.whatsapp || "201200898990";
        if(data.rates) window.storeState.rates = data.rates; window.storeState.payments = data.payments || { instapay: "", vodafone: "", orange: "", crypto: "" };
        window.storeState.bannerAr = data.bannerAr || ""; window.storeState.bannerExpiry = data.bannerExpiry || ""; 
        
        window.storeState.heroConfig = data.heroConfig || {};

        window.storeState.promos = data.promos || [];
        if(data.promoCode && data.promoDiscount) window.storeState.promos.push({ code: data.promoCode, discount: data.promoDiscount });
        if(data.slides) window.storeState.slides = data.slides; if(data.categories) window.storeState.categories = data.categories;
        loadSeoFromDB(data);
        initCountdown(window.storeState.bannerExpiry); updatePaymentInfoBox(); 
        
        if (window.renderHeroBannerContent) window.renderHeroBannerContent();
        if (window.renderPromoSlider) window.renderPromoSlider(); 
        
        window.renderCategoriesBar();
        if(isDataLoaded) window.renderProducts(); 
        
        const whatsappBtn = document.getElementById('whatsappBtn'); if(whatsappBtn) whatsappBtn.href = `https://wa.me/${window.storeState.whatsapp}?text=استفسار:`;
        const footerContactBtn = document.getElementById('footerContactBtn'); if(footerContactBtn) footerContactBtn.href = `https://wa.me/${window.storeState.whatsapp}?text=استفسار من قسم اتصل بنا:`;
      }
    });
  
    const subscribeToOrders = (userUid) => {
        if (unsubscribeOrders) unsubscribeOrders();
        const q = window.checkIsAdmin() ? query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('createdAt', 'desc'), limit(window.adminOrdersLimit)) : query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where('uid', '==', userUid));
        unsubscribeOrders = onSnapshot(q, snap => {
           const ords = []; snap.forEach(d => ords.push({id: d.id, ...d.data()})); window.storeState.orders = ords.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
           window.renderUserOrders(); if(window.checkIsAdmin()) { window.renderAdminOrders(); window.renderAdminStats(); }
        });
    };
  
    initAuth(translations, currentLang, (user, profile) => {
      currentUserProfile = profile;
      const loginBtn = document.getElementById('loginBtnNav');
      
      if (user) {
        // 💡 6. عرض صورة بروفايل العميل (جوجل) في الهيدر لو موجودة
        const avatarHtml = profile.avatar 
            ? `<img src="${profile.avatar}" alt="User" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; display: inline-block;">` 
            : `👤`;
        loginBtn.innerHTML = `${avatarHtml} <span>${translations[currentLang].nav_account}</span>`; 
        loginBtn.style.color = 'var(--accent-neon)'; 

        if(document.getElementById('accountUserName')) document.getElementById('accountUserName').textContent = profile.name;
        
        window.storeState.wishlist = profile.wishlist || []; window.updateDetailWishlistBtn(); window.renderProducts();
        
        if (window.checkIsAdmin()) {
          document.getElementById('adminBtnNav').style.display = 'block';
          if(window.injectAdminDashboard) window.injectAdminDashboard();
          
          let adminBtnInModal = document.getElementById('adminBtnInModal');
          if (!adminBtnInModal) {
             const accountModalContent = document.querySelector('#userAccountModal .modal-content');
             if(accountModalContent) {
               const btn = document.createElement('button'); btn.id = 'adminBtnInModal'; btn.className = 'submit-btn'; btn.style.cssText = 'width:100%; margin-bottom:15px; background:var(--accent-purple); color:#fff; font-size:16px; box-shadow:0 0 15px var(--purple-glow);';
               btn.innerHTML = '⚙️ الدخول للوحة تحكم الإدارة'; btn.onclick = () => { document.getElementById('userAccountModal').style.display = 'none'; window.navigate('admin'); };
               accountModalContent.insertBefore(btn, accountModalContent.querySelector('.user-tabs-container'));
             }
          }
          if(unsubscribeUsers) unsubscribeUsers();
          unsubscribeUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => {
             const usrs = []; snap.forEach(d => usrs.push({id: d.id, ...d.data()})); window.storeState.users = usrs; if(window.renderAdminUsers) window.renderAdminUsers();
          });
        } else { document.getElementById('adminBtnNav').style.display = 'none'; }
        subscribeToOrders(user.uid);
      } else {
        loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = '';
        document.getElementById('adminBtnNav').style.display = 'none';
        if (document.getElementById('adminBtnInModal')) document.getElementById('adminBtnInModal').remove();
        if(unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
        if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; } 
        window.storeState.orders = []; window.storeState.cart = []; window.storeState.wishlist = [];
        window.renderUserOrders(); window.renderUserWishlist(); window.updateCartBadge();
        if(document.getElementById('cartModal')) window.renderCartModal(); window.renderProducts();
      }

      if (!initialAuthDone) {
          initialAuthDone = true;
          handleUrlRouting();
      }
    });
  
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
        const cat = e.target.dataset.cat || 'all'; e.target.classList.add('active');
        currentCategory = cat; currentPlatform = 'all'; currentPage = 1; window.renderCategoriesBar(); window.renderPlatformFilters(); window.renderProducts(); window.navigate('home');
      });
    });
  
    document.getElementById('adminBtnNav')?.addEventListener('click', () => { if(window.checkIsAdmin()) window.navigate('admin'); });
    document.getElementById('detailAddToCartBtn')?.addEventListener('click', () => window.addToCartDirect(window.currentProductId));
    document.getElementById('currencySelect')?.addEventListener('change', () => { window.renderProducts(); window.renderCartModal(); });
    document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentInfoBox);
    document.getElementById('backToHomeBtn')?.addEventListener('click', () => window.navigate('home'));
  
    const receiptFileInput = document.getElementById('receiptFileInput'), receiptPreview = document.getElementById('receiptPreview');
    if (receiptFileInput && receiptPreview) { receiptFileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { receiptPreview.src = ev.target.result; receiptPreview.style.display = 'block'; }; reader.readAsDataURL(file); } else { receiptPreview.style.display = 'none'; receiptPreview.src = ''; } }); }
  
    document.getElementById('proceedToCheckoutBtn')?.addEventListener('click', () => {
      if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول أولاً!', 'error');
      if (!window.storeState.cart.length) return;
      document.getElementById('cartModal').style.display = 'none'; activeDiscount = 0; document.getElementById('promoCodeInput').value = ''; 
      if(document.getElementById('promoMsg')) document.getElementById('promoMsg').textContent = '';
      updateCheckoutPriceDisplay(); updatePaymentInfoBox(); document.getElementById('checkoutModal').style.display = 'flex';
    });
  
    document.getElementById('applyPromoBtn')?.addEventListener('click', () => {
      const input = document.getElementById('promoCodeInput').value.trim().toLowerCase(), msgEl = document.getElementById('promoMsg');
      if (!input) return;
      const promo = window.storeState.promos?.find(p => p.code.toLowerCase() === input);
      if (promo && (!promo.expiry || new Date(promo.expiry) > new Date())) { activeDiscount = promo.discount; msgEl.textContent = `تم تطبيق خصم ${activeDiscount}% بنجاح! ✅`; msgEl.style.color = 'var(--success)'; } 
      else { activeDiscount = 0; msgEl.textContent = 'كود الخصم غير صحيح أو منتهي! ❌'; msgEl.style.color = 'var(--danger)'; }
      updateCheckoutPriceDisplay();
    });
  
    document.getElementById('copyBtnText')?.addEventListener('click', () => {
      const addressText = document.getElementById('paymentAddressDisplay')?.textContent;
      if (addressText && addressText.includes('غير مضاف')) return window.showToast('لا يوجد رقم للنسخ حالياً', 'error');
      if (addressText) navigator.clipboard.writeText(addressText).then(() => window.showToast('📋 تم نسخ رقم الحساب بنجاح!', 'success'));
    });
  
    document.getElementById('submitReviewBtn')?.addEventListener('click', async () => {
      if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول لإضافة تقييم!', 'error');
      if (!window.currentProductId) return;
      const comment = window.sanitizeText(document.getElementById('reviewCommentText').value), rating = document.getElementById('reviewRating').value;
      if (!comment) return window.showToast('اكتب تعليقاً أولاً!', 'error');
      const submitBtn = document.getElementById('submitReviewBtn'), origBtnText = submitBtn.textContent;
      submitBtn.textContent = 'جاري الإرسال ⏳...'; submitBtn.disabled = true;
      try {
        await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'reviews')), { productId: window.currentProductId, uid: currentUserProfile.uid, userName: currentUserProfile.name, rating: Number(rating), comment, createdAt: serverTimestamp() });
        document.getElementById('reviewCommentText').value = ''; window.showToast('⭐ تم إضافة تقييمك بنجاح!', 'success');
      } catch (e) { window.showToast('حدث خطأ أثناء إرسال التقييم', 'error'); } finally { submitBtn.textContent = origBtnText; submitBtn.disabled = false; }
    });
  
    document.getElementById('tabBtnOrders')?.addEventListener('click', () => { document.getElementById('tabBtnOrders').classList.add('active'); document.getElementById('tabBtnWishlist').classList.remove('active'); document.getElementById('userOrdersSection').style.display = 'block'; document.getElementById('userWishlistSection').style.display = 'none'; });
    document.getElementById('tabBtnWishlist')?.addEventListener('click', () => { document.getElementById('tabBtnWishlist').classList.add('active'); document.getElementById('tabBtnOrders').classList.remove('active'); document.getElementById('userWishlistSection').style.display = 'block'; document.getElementById('userOrdersSection').style.display = 'none'; window.renderUserWishlist(); });
  
    document.getElementById('shopNowBtn')?.addEventListener('click', () => { document.getElementById('productGrid').scrollIntoView({ behavior: 'smooth' }); });
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));
    document.getElementById('searchInput')?.addEventListener('input', () => { currentPage = 1; window.renderProducts(); });
  
    document.getElementById('detailImageBox')?.addEventListener('click', (e) => {
      const bgImg = e.target.style.backgroundImage.slice(4, -1).replace(/"/g, "");
      if (bgImg && bgImg !== 'none') { document.getElementById('lightboxImg').src = bgImg; document.getElementById('lightboxModal').style.display = 'flex'; }
    });
    document.getElementById('closeLightboxBtn')?.addEventListener('click', () => { document.getElementById('lightboxModal').style.display = 'none'; });
    document.getElementById('lightboxModal')?.addEventListener('click', (e) => { if(e.target.id === 'lightboxModal') document.getElementById('lightboxModal').style.display = 'none'; });
  
    document.querySelectorAll('#interactiveStars .star').forEach(star => {
      star.addEventListener('click', (e) => {
        const val = Number(e.target.getAttribute('data-value')); document.getElementById('reviewRating').value = val;
        document.querySelectorAll('#interactiveStars .star').forEach(s => { if(Number(s.getAttribute('data-value')) <= val) s.classList.add('active'); else s.classList.remove('active'); });
      });
    });
};
  
initApp();
document.getElementById('cartBtnNav')?.addEventListener('click', () => { const cartModal = document.getElementById('cartModal'); if (cartModal) { cartModal.style.display = 'flex'; window.renderCartModal(); } });
```eof

### 📋 تقرير التعديلات للملف `app.js`:

1.  **فصل الكافر والسلايدر بشكل نهائي:** تم إنشاء دالة `renderHeroBannerContent` لتعمل بشكل دائم كواجهة رئيسية، بينما دالة `renderPromoSlider` ستعمل فقط إذا كان هناك صور في لوحة الإدارة وسيتم عرض السلايدر في أسفل الصفحة.
2.  **زر الشراء السريع (Buy Now):** تم برمجته ليعمل في كروت المنتجات الخارجية وصفحة تفاصيل المنتج، وإذا كان المنتج به باقات، لن يعمل إلا بعد اختيار الباقة.
3.  **فلاتر المنصات الذكية (Platform Filters):** تم إضافة نظام فلاتر جديد متطور يعرض أيقونات المنصات (Steam, PS, Xbox) بمجرد دخول العميل على قسم الألعاب، ويقوم بفلترة الألعاب فوراً.
4.  **إصلاح فلتر الأسعار:** تم دمج الـ `addEventListener` للـ `sortSelect` عشان يعيد ترتيب الألعاب من الأرخص للأغلى أو العكس فوراً عند الاختيار.
5.  **الصورة الشخصية (Avatar):** تم تعديل كود `initAuth` لعرض صورة العميل (من جوجل) بجانب كلمة "حسابي" في هيدر الموقع.

عشان الملفات تشتغل بشكل متكامل ومنظم، ناقص بس ملف الـ `index.html` عشان نشيل منه السلايدر ونحطه تحت الأقسام، ونعدل الـ `CSP`.
أبعتلك ملف `index.html` ولا جاهز تنسخه؟ 🚀
