import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, setDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, limit, orderBy, runTransaction, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. الإعدادات الأساسية (Firebase)
// ==========================================
const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyBkt-5W1vLcGvWgJTv95KbpbrnMf7Rm0JU",
  authDomain: "bn-max.com",
  projectId: "bn-store-4f0c0",
  storageBucket: "bn-store-4f0c0.firebasestorage.app",
  messagingSenderId: "281646513182",
  appId: "1:281646513182:web:002c7b1138fe5b8106c20f"
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "bn-store-main-app";

const ADMIN_UID = "CLdxfaDVBGMzQke9sjBXPIctBFQ2";
const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);
const sanitizeText = (val, maxLen = 500) => String(val ?? '').replace(/[<>]/g, '').trim().slice(0, maxLen);
const linkify = (text) => text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent-neon); text-decoration: underline;">$1</a>');

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const compressImage = (base64Src, maxWidth = 800, quality = 0.7) => {
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

// ==========================================
// 2. نظام اللغات (Localization)
// ==========================================
const translations = {
  ar: {
    nav_home: "الرئيسية", nav_games: "ألعاب", nav_keys: "مفاتيح رقمية", nav_software: "برامج", nav_subs: "اشتراكات", nav_gifts: "بطاقات هدايا", nav_deals: "عروض",
    nav_account: "حسابي", search_placeholder: "ابحث عن ألعاب، مفاتيح، برامج...",
    hero_badge: "🛡️ متجرك الرقمي الموثوق", hero_title: "BN MAX<br>أكثر من <span>مجرد مفاتيح</span>",
    hero_desc: "ألعاب، برامج، بطاقات هدايا، اشتراكات والمزيد...<br>كل شيء في مكان واحد — سريع، آمن، وموثوق.",
    btn_shop_now: "تسوق الآن", hero_stat_1: "تسليم فوري", hero_stat_2: "100% أمان", hero_stat_3: "دعم 24/7",
    cat_all: "⚡ الكل", best_sellers: "🔥 المنتجات المميزة", best_sellers_sub: "منتجاتنا الأكثر مبيعاً",
    sort_default: "الترتيب الافتراضي", sort_cheap: "الأرخص أولاً", sort_expensive: "الأغلى أولاً",
    btn_back: "🔙 رجوع", availability: "التوفر:", faq_title: "💡 أسئلة شائعة", btn_add_to_cart: "🛒 إضافة للسلة",
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
    reset_pass_desc: "أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لاستعادة كلمة المرور مباشرة بتصميم BN MAX.",
    btn_send_reset: "إرسال رابط الاستعادة", back_to_login: "رجوع لتسجيل الدخول", google_login: "الدخول بواسطة Google",
    nav_categories: "الأقسام", nav_search: "بحث", nav_wishlist: "المفضلة"
  },
  en: {
    nav_home: "Home", nav_games: "Games", nav_keys: "Digital Keys", nav_software: "Software", nav_subs: "Subscriptions", nav_gifts: "Gift Cards", nav_deals: "Deals",
    nav_account: "Account", search_placeholder: "Search for games, keys, software...",
    hero_badge: "🛡️ YOUR TRUSTED DIGITAL STORE", hero_title: "BN MAX<br>MORE THAN <span>JUST KEYS</span>",
    hero_desc: "Games, Software, Gift Cards, Subscriptions and More...<br>All in One Place — Fast, Secure, Reliable.",
    btn_shop_now: "Shop Now", hero_stat_1: "Instant Delivery", hero_stat_2: "100% Secure", hero_stat_3: "24/7 Support",
    cat_all: "⚡ All", best_sellers: "🔥 Best Sellers", best_sellers_sub: "Our most popular products",
    sort_default: "Default Sorting", sort_cheap: "Lowest Price", sort_expensive: "Highest Price",
    btn_back: "🔙 Back", availability: "Availability:", faq_title: "💡 FAQ", btn_add_to_cart: "🛒 Add to Cart",
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
    nav_categories: "Categories", nav_search: "Search", nav_wishlist: "Wishlist"
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
  
  window.renderProducts();
  window.renderCategoriesBar(); 
};

document.getElementById('langSwitchBtn')?.addEventListener('click', async () => {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('bn_lang', currentLang);
  applyLanguage();
  if(currentUserProfile) {
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUserProfile.uid), { language: currentLang }); } catch(e){}
  }
});

// ==========================================
// 3. حالة المتجر الأساسية (State)
// ==========================================
let storeState = {
  bannerAr: "⚡ عروض الكريسماس والخدمات الرقمية!",
  bannerExpiry: "", 
  whatsapp: "201200898990",
  rates: { SAR: 0.077, AED: 0.075, USD: 0.020 },
  payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  promoCode: "", promoDiscount: 0, products: [], orders: [], reviews: [], slides: [], users: [],
  categories: [ { id: 'games', name: 'Games' }, { id: 'keys', name: 'Digital Keys' }, { id: 'software', name: 'Software' }, { id: 'subs', name: 'Subscriptions' }, { id: 'gifts', name: 'Gift Cards' }, { id: 'deals', name: 'Deals' } ],
  wishlist: JSON.parse(localStorage.getItem('bn_store_wishlist')) || [],
  cart: []
};

let currentUserProfile = null;
let currentProductId = null;
let editingProductId = null; 
let activeDiscount = 0;
let unsubscribeOrders = null;
let unsubscribeReviews = null;
let unsubscribeUsers = null;
let countdownInterval = null;
let currentSlideIndex = 0;
let slideInterval = null;
let isDataLoaded = false;
let adminOrdersLimit = 20; 

// متغيرات الـ OTP للتسجيل
let tempRegistrationData = null;

let currentCategory = 'all';
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

// ==========================================
// 4. نظام العداد التنازلي والسلايدر
// ==========================================
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

window.renderPromoSlider = () => {
  const container = document.getElementById('promoSlider');
  const track = document.getElementById('sliderTrack');
  const dotsContainer = document.getElementById('sliderDots');
  const heroBanner = document.querySelector('.hero-banner-box');
  
  if (!container || !track || !dotsContainer) return;
  
  if (!storeState.slides || storeState.slides.length === 0) {
      container.style.display = 'none'; 
      if(heroBanner) heroBanner.style.display = 'flex';
      return;
  }
  
  container.style.display = 'block';
  if(heroBanner) heroBanner.style.display = 'none';
  track.replaceChildren(); dotsContainer.replaceChildren();

  storeState.slides.forEach((slide, idx) => {
    const slideDiv = document.createElement('div');
    slideDiv.className = `slider-slide ${idx === 0 ? 'active' : ''}`;
    slideDiv.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('${slide.imgUrl}')`;
    slideDiv.innerHTML = `<div class="slider-content"><h2>${sanitizeText(slide.title)}</h2><p>${sanitizeText(slide.desc)}</p></div>`;
    track.appendChild(slideDiv);
    const dot = document.createElement('button');
    dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
    dot.onclick = () => { currentSlideIndex = idx; updateSliderPosition(); };
    dotsContainer.appendChild(dot);
  });

  if (slideInterval) clearInterval(slideInterval);
  if (storeState.slides.length > 1) { slideInterval = setInterval(() => { currentSlideIndex = (currentSlideIndex + 1) % storeState.slides.length; updateSliderPosition(); }, 4500); }
};

const updateSliderPosition = () => {
  const track = document.getElementById('sliderTrack');
  const dots = document.querySelectorAll('.slider-dot');
  if (!track || !storeState.slides.length) return;
  track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlideIndex));
};

document.getElementById('nextSlideBtn')?.addEventListener('click', () => { if(storeState.slides.length){ currentSlideIndex = (currentSlideIndex + 1) % storeState.slides.length; updateSliderPosition(); }});
document.getElementById('prevSlideBtn')?.addEventListener('click', () => { if(storeState.slides.length){ currentSlideIndex = (currentSlideIndex - 1 + storeState.slides.length) % storeState.slides.length; updateSliderPosition(); }});

// ==========================================
// 5. التصنيفات والمنتجات
// ==========================================
window.renderCategoriesBar = () => {
  const bar = document.getElementById('categoriesBar');
  const selectCat = document.getElementById('newProdCat');
  
  if (bar) {
    bar.replaceChildren();
    const allBtn = document.createElement('div');
    allBtn.className = `category-box ${currentCategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.cat = 'all';
    allBtn.innerHTML = `<div class="category-info"><div class="category-icon">⚡</div><div class="category-name">${translations[currentLang].cat_all}</div></div>`;
    allBtn.onclick = () => { currentCategory = 'all'; currentPage = 1; window.renderCategoriesBar(); window.renderProducts(); document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); };
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

  const cats = storeState.categories || [];
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
      btn.onclick = () => { currentCategory = c.id; currentPage = 1; window.renderCategoriesBar(); window.renderProducts(); document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); };
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
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  const searchVal = searchInput?.value.trim().toLowerCase() || '';
  const sortVal = sortSelect?.value || 'default';
  
  let filtered = storeState.products.filter(prod => {
    if (currentCategory !== 'all' && prod.category !== currentCategory) return false;
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
    
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
    const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
    const isWished = storeState.wishlist.includes(prod.id);
    
    const discountPercent = (prod.oldPrice && prod.oldPrice > prod.price) ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100) : 0;
    const discountBadgeHTML = discountPercent > 0 ? `<span class="product-discount-badge">-${discountPercent}%</span>` : '';
    
    let ratingVal = 5.0, ratingCount = 0;
    const prodRevs = storeState.reviews.filter(r => r.productId === prod.id);
    if(prodRevs.length > 0) {
        ratingVal = (prodRevs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / prodRevs.length).toFixed(1);
        ratingCount = prodRevs.length;
    }
    const ratingHTML = ratingCount > 0 ? `<div class="product-rating">⭐ ${ratingVal} (${ratingCount})</div>` : `<div class="product-rating">⭐ 5.0 (0)</div>`;

    const card = document.createElement('div'); card.className = 'product-card';
    card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn') || e.target.classList.contains('buy-btn')) return; window.openProductDetails(prod.id); };
    
    card.innerHTML = `
      <div style="position:relative;">
        <button type="button" class="wishlist-icon-btn ${isWished ? 'active' : ''}" onclick="window.toggleWishlist('${prod.id}', event)">${isWished ? '❤️' : '🤍'}</button>
        ${discountBadgeHTML}
        ${badge ? `<span class="product-badge" style="top: ${discountPercent > 0 ? '35px' : '12px'}; right: 12px;">${sanitizeText(badge)}</span>` : ''}
        <div class="product-img" style="background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText || title)}</div>
        <h3 class="product-title">${sanitizeText(title)}</h3>
        ${ratingHTML}
      </div>
      <div>
        <div class="product-price-box">${convertedOld ? `<span class="old-price">${convertedOld} ${currency}</span>` : ''}<span class="product-price">${convertedPrice} ${currency}</span></div>
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'}" onclick="window.addToCartDirect('${prod.id}', event)" ${inStock ? '' : 'disabled'}>${inStock ? translations[currentLang].btn_add_to_cart : translations[currentLang].out_of_stock}</button>
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

const showView = (viewName) => {
  const homeView = document.getElementById('homeView'); const productDetailsView = document.getElementById('productDetailsView');
  if (homeView) homeView.style.display = viewName === 'home' ? 'block' : 'none';
  if (productDetailsView) productDetailsView.style.display = viewName === 'details' ? 'block' : 'none';
  if (viewName === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
};
document.getElementById('logoBtn')?.addEventListener('click', () => { currentCategory = 'all'; currentPage = 1; window.renderCategoriesBar(); window.renderProducts(); showView('home'); document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); });
document.getElementById('backToHomeBtn')?.addEventListener('click', () => showView('home'));
document.getElementById('sortSelect')?.addEventListener('change', window.renderProducts);

// ==========================================
// 6. المفضلة، تفاصيل المنتج، النجوم، والتقييمات
// ==========================================
window.toggleWishlist = (prodId, event) => {
  if (event) event.stopPropagation();
  let wl = storeState.wishlist;
  if (wl.includes(prodId)) { wl = wl.filter(id => id !== prodId); window.showToast('تم الإزالة من المفضلة 💔', 'normal'); } 
  else { wl.push(prodId); window.showToast('تم الإضافة للمفضلة ❤️', 'success'); }
  storeState.wishlist = wl; localStorage.setItem('bn_store_wishlist', JSON.stringify(wl));
  window.renderProducts(); window.updateDetailWishlistBtn();
  if(document.getElementById('userWishlistSection')?.style.display === 'block') window.renderUserWishlist();
  if(currentUserProfile) { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUserProfile.uid), { wishlist: wl }).catch(()=>{}); }
};

window.updateDetailWishlistBtn = () => {
  const btn = document.getElementById('toggleWishlistBtn'); if(!btn || !currentProductId) return;
  const isWished = storeState.wishlist.includes(currentProductId);
  btn.textContent = isWished ? '❤️' : '🤍'; btn.style.color = isWished ? 'var(--danger)' : '#fff'; btn.style.borderColor = isWished ? 'var(--danger)' : 'var(--border-color)';
};
document.getElementById('toggleWishlistBtn')?.addEventListener('click', () => { if (currentProductId) window.toggleWishlist(currentProductId); });

document.getElementById('detailImageBox')?.addEventListener('click', (e) => {
  const bgImg = e.target.style.backgroundImage.slice(4, -1).replace(/"/g, "");
  if (bgImg && bgImg !== 'none') { document.getElementById('lightboxImg').src = bgImg; document.getElementById('lightboxModal').style.display = 'flex'; }
});
document.getElementById('closeLightboxBtn')?.addEventListener('click', () => { document.getElementById('lightboxModal').style.display = 'none'; });
document.getElementById('lightboxModal')?.addEventListener('click', (e) => { if(e.target.id === 'lightboxModal') document.getElementById('lightboxModal').style.display = 'none'; });

document.querySelectorAll('#interactiveStars .star').forEach(star => {
  star.addEventListener('click', (e) => {
    const val = Number(e.target.getAttribute('data-value'));
    document.getElementById('reviewRating').value = val;
    document.querySelectorAll('#interactiveStars .star').forEach(s => {
      if(Number(s.getAttribute('data-value')) <= val) s.classList.add('active');
      else s.classList.remove('active');
    });
  });
});

window.openProductDetails = (id) => {
  const prod = storeState.products.find(p => p.id === id); if (!prod) return;
  currentProductId = id; window.updateDetailWishlistBtn();

  const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
  const desc = currentLang === 'ar' ? (prod.descAr || prod.desc) : (prod.descEn || prod.desc);
  const badge = currentLang === 'ar' ? (prod.badgeAr || prod.badge) : (prod.badgeEn || prod.badge);

  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
  const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
  const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);

  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailPrice').textContent = `${convertedPrice} ${currency}`;
  document.getElementById('detailOldPrice').textContent = convertedOld ? `${convertedOld} ${currency}` : '';
  document.getElementById('detailBadge').textContent = badge;
  
  const badgeEl = document.getElementById('detailDeliveryBadge');
  if (prod.deliveryTime) {
      badgeEl.innerHTML = `<span>⏳ ${sanitizeText(prod.deliveryTime)}</span>`;
      badgeEl.style.display = 'inline-flex';
  } else { badgeEl.style.display = 'none'; }
  
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
              const q = lines[0].replace(/^(سؤال|س|Q):\s*/i, '');
              const a = lines.slice(1).join('<br>').replace(/^(إجابة|ج|جواب|A):\s*/i, '');
              faqList.innerHTML += `<div class="faq-item"><button class="faq-question">${sanitizeText(q)}</button><div class="faq-answer">${linkify(a)}</div></div>`;
          }
      });
      document.querySelectorAll('.faq-question').forEach(btn => {
          btn.onclick = () => { btn.classList.toggle('active'); const ans = btn.nextElementSibling; ans.classList.toggle('open'); };
      });
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
      if (prod.imgUrl) allImages.push(prod.imgUrl);
      if (prod.bannerUrl) allImages.push(prod.bannerUrl);
      if (prod.gallery && Array.isArray(prod.gallery)) allImages.push(...prod.gallery);
      const uniqueImages = [...new Set(allImages)]; 
      
      if (uniqueImages.length > 1) {
          uniqueImages.forEach((imgSrc) => {
              const thumb = document.createElement('img');
              thumb.src = imgSrc; thumb.className = 'gallery-thumb';
              thumb.onclick = () => { document.getElementById('lightboxImg').src = imgSrc; document.getElementById('lightboxModal').style.display = 'flex'; };
              galleryBox.appendChild(thumb);
          });
      }
  }

  const stockEl = document.getElementById('detailStock'); const addBtn = document.getElementById('detailAddToCartBtn');
  if (stockEl && addBtn) {
    if (inStock) {
      stockEl.textContent = (prod.stockQuantity !== undefined) ? `${prod.stockQuantity} ${translations[currentLang].piece}` : translations[currentLang].available; stockEl.style.color = 'var(--success)';
      addBtn.textContent = translations[currentLang].btn_add_to_cart; addBtn.disabled = false; addBtn.classList.remove('out-of-stock-badge');
    } else {
      stockEl.textContent = translations[currentLang].out_of_stock; stockEl.style.color = 'var(--danger)';
      addBtn.textContent = translations[currentLang].out_of_stock; addBtn.disabled = true; addBtn.classList.add('out-of-stock-badge');
    }
  }
  window.loadProductReviews(id); showView('details'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// 7. دوال سلة المشتريات
// ==========================================
window.updateCartBadge = () => {
  const badge = document.getElementById('cartCountBadge');
  const badgeMobile = document.getElementById('cartCountBadgeMobile');
  if (badge) { badge.textContent = storeState.cart.length; badge.style.display = storeState.cart.length > 0 ? 'flex' : 'none'; }
  if (badgeMobile) { badgeMobile.textContent = storeState.cart.length; badgeMobile.style.display = storeState.cart.length > 0 ? 'flex' : 'none'; }
};

document.getElementById('detailAddToCartBtn')?.addEventListener('click', () => {
  if (!currentProductId) return;
  const prod = storeState.products.find(p => p.id === currentProductId);
  if (prod) { storeState.cart.push(prod); window.updateCartBadge(); window.showToast('🛒 ' + translations[currentLang].btn_add_to_cart, 'success'); }
});

window.addToCartDirect = (prodId, event) => {
  if (event) event.stopPropagation();
  const prod = storeState.products.find(p => p.id === prodId);
  if (prod) { 
      if (prod.inStock === false || (prod.stockQuantity !== undefined && prod.stockQuantity <= 0)) {
          return window.showToast(translations[currentLang].out_of_stock, 'error');
      }
      storeState.cart.push(prod); window.updateCartBadge(); window.showToast('🛒 ' + translations[currentLang].btn_add_to_cart, 'success'); 
  }
};

document.getElementById('cartBtnNav')?.addEventListener('click', () => { window.renderCartModal(); document.getElementById('cartModal').style.display = 'flex'; });

window.removeFromCart = (index) => { storeState.cart.splice(index, 1); window.updateCartBadge(); window.renderCartModal(); };

window.addToCartCross = (id) => {
    const p = storeState.products.find(x => x.id === id);
    if(p) { storeState.cart.push(p); window.updateCartBadge(); window.renderCartModal(); window.showToast('تم إضافة الاقتراح للسلة!', 'success'); }
};

window.renderCartModal = () => {
  const list = document.getElementById('cartItemsList');
  const crossSellSection = document.getElementById('cartCrossSellSection');
  const crossSellList = document.getElementById('cartCrossSellList');
  const totalDisplay = document.getElementById('cartTotalPriceDisplay');
  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  
  if (!storeState.cart.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px 0;">السلة فارغة حالياً.</p>';
    totalDisplay.textContent = `0 ${currency}`;
    document.getElementById('proceedToCheckoutBtn').disabled = true;
    if(crossSellSection) crossSellSection.style.display = 'none';
    return;
  }
  
  document.getElementById('proceedToCheckoutBtn').disabled = false;
  list.innerHTML = ''; let total = 0; let currentCartIds = [];
  storeState.cart.forEach((p, idx) => {
    const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
    const itemPrice = p.price * rate; total += itemPrice; currentCartIds.push(p.id);
    list.innerHTML += `<div class="cart-item"><div class="cart-item-info"><div class="cart-item-title">${sanitizeText(title)}</div><div class="cart-item-price">${itemPrice.toFixed(currency==='EGP'?0:2)} ${currency}</div></div><button type="button" class="remove-cart-btn" onclick="window.removeFromCart(${idx})" title="حذف من السلة">🗑️</button></div>`;
  });
  totalDisplay.textContent = `${total.toFixed(currency==='EGP'?0:2)} ${currency}`;

  if(crossSellSection && crossSellList) {
      let suggestions = [];
      storeState.cart.forEach(p => { if (p.crossSellIds) suggestions.push(...p.crossSellIds); });
      suggestions = [...new Set(suggestions)].filter(id => !currentCartIds.includes(id)); 
      if(suggestions.length > 0) {
          crossSellList.innerHTML = '';
          suggestions.forEach(sId => {
              const sProd = storeState.products.find(x => x.id === sId && x.inStock);
              if(sProd) {
                  const sTitle = currentLang === 'ar' ? (sProd.titleAr || sProd.title) : (sProd.titleEn || sProd.title);
                  const sPrice = (sProd.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
                  crossSellList.innerHTML += `<div class="cross-sell-item" style="min-width: 150px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;"><div class="cross-sell-img" style="background-image:url('${sProd.imgUrl}'); height: 60px; background-size: cover; background-position: center; border-radius: 5px; margin-bottom: 5px;"></div><div class="cross-sell-title" style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;">${sTitle}</div><div class="cross-sell-price" style="font-size: 12px; color: var(--accent-neon); font-weight: bold; margin-bottom: 5px;">+${sPrice}${currency}</div><button class="add-cross-btn submit-btn" style="padding: 4px; font-size: 11px;" onclick="window.addToCartCross('${sProd.id}')">إضافة</button></div>`;
              }
          });
          crossSellSection.style.display = crossSellList.innerHTML ? 'block' : 'none';
      } else { crossSellSection.style.display = 'none'; }
  }
};

const updateCheckoutPriceDisplay = () => {
  if (!storeState.cart.length) return;
  const currency = document.getElementById('currencySelect').value; const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  let totalPrice = 0, titles = [];
  storeState.cart.forEach(p => { 
    const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
    totalPrice += (p.price * rate); titles.push(title); 
  });
  if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
  const finalPrice = totalPrice.toFixed(currency === 'EGP' ? 0 : 2);
  const discountText = activeDiscount > 0 ? ` (بعد خصم ${activeDiscount}%)` : '';
  const selectedProductInput = document.getElementById('selectedProduct');
  if (selectedProductInput) selectedProductInput.value = `${titles.join(' + ')}\nالإجمالي: (${finalPrice} ${currency})${discountText}`;
};

// 🌟 تحديث شروط التقييم (فقط للمشترين المكتملين)
window.loadProductReviews = (prodId) => {
  if (unsubscribeReviews) unsubscribeReviews();
  
  // التحكم في ظهور صندوق التقييم
  const addReviewBox = document.getElementById('addReviewBox');
  if (addReviewBox) {
    let hasCompletedOrder = false;
    if (currentUserProfile && storeState.orders) {
      hasCompletedOrder = storeState.orders.some(o => o.uid === currentUserProfile.uid && o.status === 'completed' && (o.productIds?.includes(prodId) || o.productId === prodId));
    }
    if (hasCompletedOrder || checkIsAdmin()) {
      addReviewBox.style.display = 'block';
    } else {
      addReviewBox.style.display = 'none';
    }
  }

  const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'reviews'), where('productId', '==', prodId));
  unsubscribeReviews = onSnapshot(q, (snap) => {
    const list = document.getElementById('productReviewsList'); if (!list) return; list.replaceChildren();
    const revs = []; snap.forEach(d => revs.push({ id: d.id, ...d.data() }));
    storeState.reviews = storeState.reviews.filter(r => r.productId !== prodId).concat(revs);
    revs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const detailBadge = document.getElementById('detailBadge');
    if (revs.length > 0) { const avgRating = (revs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / revs.length).toFixed(1); if(detailBadge) detailBadge.textContent = `⭐ ${avgRating} (${revs.length} تقييم)`; }
    if (!revs.length) { list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">لا توجد تقييمات لهذا المنتج حتى الآن.</p>'; } 
    else { revs.forEach(r => { list.innerHTML += `<div style="background: #0b0b12; border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; position: relative;"><div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-left: ${checkIsAdmin() ? '50px' : '0'};"><strong style="color: var(--accent-neon);">${sanitizeText(r.userName || 'مستخدم')} <span style="font-size:10px; color:var(--text-muted); font-weight:normal; margin-right:5px;">- ${formatDate(r.createdAt)}</span></strong><span>${'⭐'.repeat(Number(r.rating) || 5)}</span></div><p style="color: var(--text-main); line-height: 1.5;">${sanitizeText(r.comment)}</p>${checkIsAdmin() ? `<button onclick="window.deleteReview('${r.id}')" style="position:absolute; left:10px; top:10px; background:var(--danger); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; z-index:10;">حذف 🗑️</button>` : ''}</div>`; }); }
  });
};

window.deleteReview = async (reviewId) => {
  if (!checkIsAdmin() || !confirm('متأكد إنك عايز تحذف التقييم ده؟')) return;
  try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId)); window.showToast('تم حذف التقييم بنجاح', 'success'); } catch (e) {}
};

const updatePaymentInfoBox = () => {
  const methodSelect = document.getElementById('paymentMethod'); if (!methodSelect) return;
  const method = methodSelect.value, payments = storeState.payments || {}; let targetVal = "";
  if (method.includes('vodafone') || method === 'vodafone') targetVal = payments.vodafone || "رقم فودافون كاش غير مضاف حالياً";
  else if (method.includes('instapay') || method === 'instapay') targetVal = payments.instapay || "حساب إنستا باي غير مضاف حالياً";
  else if (method.includes('orange') || method === 'orange') targetVal = payments.orange || payments.vodafone || "رقم أورنج كاش غير مضاف حالياً";
  else if (method.includes('crypto') || method === 'crypto') targetVal = payments.crypto || "عنوان محفظة الكريبتو غير مضاف حالياً";
  else targetVal = "اختر وسيلة دفع صحيحة";
  const addressDisplay = document.getElementById('paymentAddressDisplay'); if (addressDisplay) addressDisplay.textContent = targetVal;
};

// ==========================================
// 8. زر المشاركة الحديث (Web Share API)
// ==========================================
const handleShare = async (title, text, url) => {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); } catch(err) { console.log('Share canceled'); }
  } else { navigator.clipboard.writeText(url); window.showToast('تم نسخ الرابط! 📋', 'success'); }
};
document.getElementById('shareBtn')?.addEventListener('click', () => handleShare('BN MAX Store', 'أفضل متجر للخدمات الرقمية!', window.location.href));
document.getElementById('shareProductBtn')?.addEventListener('click', () => { const title = document.getElementById('detailTitle').textContent; handleShare(title, `شاهد هذا المنتج الرائع على BN MAX: ${title}`, window.location.href); });

// ==========================================
// 9. الأحداث والشراء
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  window.renderSkeletons();
  document.getElementById('currencySelect')?.addEventListener('change', () => { window.renderProducts(); window.renderCartModal(); });
  document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentInfoBox);
  
  const receiptFileInput = document.getElementById('receiptFileInput'), receiptPreview = document.getElementById('receiptPreview');
  if (receiptFileInput && receiptPreview) {
    receiptFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) { const reader = new FileReader(); reader.onload = (ev) => { receiptPreview.src = ev.target.result; receiptPreview.style.display = 'block'; }; reader.readAsDataURL(file); } 
      else { receiptPreview.style.display = 'none'; receiptPreview.src = ''; }
    });
  }
  document.getElementById('copyBtnText')?.addEventListener('click', () => {
    const addressText = document.getElementById('paymentAddressDisplay')?.textContent;
    if (addressText && addressText.includes('غير مضاف')) return window.showToast('لا يوجد رقم للنسخ حالياً', 'error');
    if (addressText) navigator.clipboard.writeText(addressText).then(() => window.showToast('📋 تم نسخ رقم الحساب بنجاح!', 'success'));
  });

  document.getElementById('submitReviewBtn')?.addEventListener('click', async () => {
    if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول لإضافة تقييم!', 'error');
    if (!currentProductId) return;
    
    const comment = sanitizeText(document.getElementById('reviewCommentText').value), rating = document.getElementById('reviewRating').value;
    if (!comment) return window.showToast('اكتب تعليقاً أولاً!', 'error');
    const submitBtn = document.getElementById('submitReviewBtn'), origBtnText = submitBtn.textContent;
    submitBtn.textContent = 'جاري الإرسال ⏳...'; submitBtn.disabled = true;
    try {
      await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'reviews')), { productId: currentProductId, uid: currentUserProfile.uid, userName: currentUserProfile.name, rating: Number(rating), comment, createdAt: serverTimestamp() });
      document.getElementById('reviewCommentText').value = ''; window.showToast('⭐ تم إضافة تقييمك بنجاح!', 'success');
    } catch (e) { window.showToast('حدث خطأ أثناء إرسال التقييم', 'error'); } finally { submitBtn.textContent = origBtnText; submitBtn.disabled = false; }
  });

  document.getElementById('proceedToCheckoutBtn')?.addEventListener('click', () => {
    if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول أولاً!', 'error');
    if (!storeState.cart.length) return;
    document.getElementById('cartModal').style.display = 'none'; activeDiscount = 0; 
    document.getElementById('promoCodeInput').value = ''; document.getElementById('promoMsg').textContent = '';
    document.getElementById('receiptPreview').style.display = 'none'; document.getElementById('receiptPreview').src = ''; document.getElementById('checkoutForm').reset();
    updateCheckoutPriceDisplay(); updatePaymentInfoBox(); document.getElementById('checkoutModal').style.display = 'flex';
  });

  document.getElementById('applyPromoBtn')?.addEventListener('click', () => {
    const input = document.getElementById('promoCodeInput').value.trim(), msgEl = document.getElementById('promoMsg');
    if (!input) return;
    if (storeState.promoCode && input.toLowerCase() === storeState.promoCode.toLowerCase() && storeState.promoDiscount > 0) {
      activeDiscount = storeState.promoDiscount; msgEl.textContent = `تم تطبيق خصم ${activeDiscount}% بنجاح! ✅`; msgEl.style.color = 'var(--success)';
    } else { activeDiscount = 0; msgEl.textContent = 'كود الخصم غير صحيح أو منتهي! ❌'; msgEl.style.color = 'var(--danger)'; }
    updateCheckoutPriceDisplay();
  });

  document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));
  document.getElementById('tabBtnOrders')?.addEventListener('click', () => { document.getElementById('tabBtnOrders').classList.add('active'); document.getElementById('tabBtnWishlist').classList.remove('active'); document.getElementById('userOrdersSection').style.display = 'block'; document.getElementById('userWishlistSection').style.display = 'none'; });
  document.getElementById('tabBtnWishlist')?.addEventListener('click', () => { document.getElementById('tabBtnWishlist').classList.add('active'); document.getElementById('tabBtnOrders').classList.remove('active'); document.getElementById('userWishlistSection').style.display = 'block'; document.getElementById('userOrdersSection').style.display = 'none'; window.renderUserWishlist(); });
  
  // 🌟 نظام المصادقة ونافذة استعادة الباسورد و الـ OTP
  const authModal = document.getElementById('authModal');
  document.getElementById('loginBtnNav')?.addEventListener('click', () => { if(currentUserProfile) document.getElementById('userAccountModal').style.display = 'flex'; else authModal.style.display = 'flex'; });

  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    try { await signInWithEmailAndPassword(auth, email, pass); authModal.style.display = 'none'; window.showToast('تم تسجيل الدخول بنجاح!', 'success'); } catch (e) { window.showToast('البيانات غير صحيحة!', 'error'); }
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) await signInWithRedirect(auth, provider);
      else {
        const result = await signInWithPopup(auth, provider);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid), { uid: result.user.uid, name: result.user.displayName || 'مستخدم جوجل', email: result.user.email, createdAt: serverTimestamp() }, { merge: true });
        authModal.style.display = 'none'; window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      }
    } catch (e) { if (e.code !== 'auth/popup-closed-by-user') window.showToast('فشل تسجيل الدخول', 'error'); }
  });
  
  document.getElementById('resetPassBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('authViewLogin').style.display = 'none';
    document.getElementById('authViewRegister').style.display = 'none';
    document.getElementById('authViewReset').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'استعادة كلمة المرور | BN MAX';
  });
  document.getElementById('backToLoginFromReset')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('authViewReset').style.display = 'none';
    document.getElementById('authViewLogin').style.display = 'block';
    document.getElementById('authModalTitle').textContent = translations[currentLang].auth_title;
  });
  document.getElementById('doSendResetBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmailInput').value.trim();
    if (!email) return window.showToast('أدخل البريد الإلكتروني أولاً!', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      window.showToast('✉️ تم إرسال رابط استعادة كلمة المرور بنجاح!', 'success');
      document.getElementById('authViewReset').style.display = 'none';
      document.getElementById('authViewLogin').style.display = 'block';
      document.getElementById('authModalTitle').textContent = translations[currentLang].auth_title;
    } catch(err) { window.showToast('حدث خطأ، تأكد من صحة البريد.', 'error'); }
  });

  document.getElementById('showRegisterBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'none'; document.getElementById('authViewRegister').style.display = 'block'; document.getElementById('authModalTitle').textContent = translations[currentLang].create_account; });
  document.getElementById('showLoginBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'block'; document.getElementById('authViewRegister').style.display = 'none'; document.getElementById('authViewOTP').style.display = 'none'; document.getElementById('authModalTitle').textContent = translations[currentLang].btn_login; });
  document.getElementById('backToRegFromOTP')?.addEventListener('click', () => { document.getElementById('authViewOTP').style.display = 'none'; document.getElementById('authViewRegister').style.display = 'block'; });

  // 🌟 نظام الـ OTP للتسجيل (المرحلة الأولى: إرسال الكود)
  document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim(), email = document.getElementById('regEmail').value.trim(), pass = document.getElementById('regPass').value;
    if (!name || !email || !pass) return window.showToast('أكمل جميع البيانات!', 'error');
    if (pass !== document.getElementById('regPassConfirm').value) return window.showToast('كلمة المرور غير متطابقة!', 'error');
    
    const btn = document.getElementById('doRegisterBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإرسال ⏳...'; btn.disabled = true;
    
    try {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        tempRegistrationData = { name, email, pass, otp: otpCode };
        
        if (typeof emailjs !== 'undefined') {
            const customMessage = `كود التفعيل الخاص بك هو:<div class="otp-box">${otpCode}</div>لا تشارك هذا الكود مع أحد.`;
            await emailjs.send("service_01wl99f", "Template_gx1ra8k", { to_name: name, to_email: email, custom_message: customMessage });
        }
        document.getElementById('authViewRegister').style.display = 'none';
        document.getElementById('authViewOTP').style.display = 'block';
        window.showToast('✉️ تم إرسال كود التفعيل إلى بريدك!', 'success');
    } catch(e) {
        window.showToast('حدث خطأ أثناء إرسال الكود، حاول مرة أخرى.', 'error');
    } finally {
        btn.textContent = origText; btn.disabled = false;
    }
  });

  // 🌟 المرحلة الثانية: تأكيد الـ OTP وإنشاء الحساب النهائي
  document.getElementById('doVerifyOTPBtn')?.addEventListener('click', async () => {
    const inputOTP = document.getElementById('regOTP').value.trim();
    if (!inputOTP) return window.showToast('أدخل كود التفعيل!', 'error');
    if (!tempRegistrationData || inputOTP !== tempRegistrationData.otp) return window.showToast('❌ الكود غير صحيح!', 'error');

    const btn = document.getElementById('doVerifyOTPBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإنشاء ⏳...'; btn.disabled = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.pass); 
      await updateProfile(cred.user, { displayName: tempRegistrationData.name });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { uid: cred.user.uid, name: tempRegistrationData.name, email: tempRegistrationData.email, createdAt: serverTimestamp() });
      
      authModal.style.display = 'none'; window.showToast('🎉 تم إنشاء الحساب وتفعيله بنجاح!', 'success');
      
      if (typeof emailjs !== 'undefined') {
        const welcomeMessage = `حسابك دلوقتي جاهز ومفعل بنجاح.<br>تقدر تتصفح أحدث العروض، وتضيف منتجاتك المفضلة، وتتابع طلباتك بكل سهولة وأمان.<br><br><div class="btn-container"><a href="https://bn-max.com" class="btn">تصفح العروض الآن 🚀</a></div>`;
        emailjs.send("service_01wl99f", "Template_gx1ra8k", { to_name: tempRegistrationData.name, to_email: tempRegistrationData.email, custom_message: welcomeMessage }).catch(err => console.log("Welcome Email Error"));
      }
      tempRegistrationData = null; document.getElementById('regOTP').value = '';
    } catch (e) { window.showToast('خطأ! ربما البريد مستخدم مسبقاً.', 'error'); } 
    finally { btn.textContent = origText; btn.disabled = false; }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => { try { await signOut(auth); document.getElementById('userAccountModal').style.display = 'none'; window.showToast('تم تسجيل الخروج!', 'success'); } catch (e) {} });

  // 🌟 نظام إتمام الطلب المحدث (Transactions لحل أزمة المخزون)
  document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserProfile || !storeState.cart.length) return;
    const receiptFileInput = document.getElementById('receiptFileInput');
    if (!receiptFileInput || !receiptFileInput.files[0]) return window.showToast('برجاء إرفاق صورة إيصال التحويل!', 'error');
    if (receiptFileInput.files[0].size > 4 * 1024 * 1024) return window.showToast('حجم الإيصال كبير جداً (أقصى حد 4 ميجا).', 'error');

    const confirmBtn = document.getElementById('confirmOrderBtn'), confirmText = document.getElementById('confirmBtnText'), confirmSpinner = document.getElementById('confirmSpinner');
    confirmText.textContent = 'جاري الإرسال...'; confirmSpinner.style.display = 'inline-block'; confirmBtn.disabled = true;

    try {
      const receiptBase64 = await compressImage(document.getElementById('receiptPreview').src);
      const currency = document.getElementById('currencySelect').value, rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
      let totalPrice = 0, productTitles = [], productIds = [];
      storeState.cart.forEach(p => { 
          const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
          totalPrice += (p.price * rate); productTitles.push(title); productIds.push(p.id); 
      });
      if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
      totalPrice = Number(totalPrice.toFixed(currency === 'EGP' ? 0 : 2));

      const paymentMethod = document.getElementById('paymentMethod').value;
      const senderInfo = sanitizeText(document.getElementById('senderInfo').value);
      const transactionId = sanitizeText(document.getElementById('transactionIdInput').value); // الحقل الجديد
      const customerData = sanitizeText(document.getElementById('customerData').value);
      const newOrderRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'orders')), orderId = newOrderRef.id;

      // تحديث المخزون الآمن باستخدام Firebase Transaction لمنع التعارض
      for (const p of storeState.cart) {
        if (p.stockQuantity !== undefined) {
           const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id);
           await runTransaction(db, async (transaction) => {
               const sfDoc = await transaction.get(prodRef);
               if (!sfDoc.exists()) throw "المنتج غير موجود!";
               const newStock = sfDoc.data().stockQuantity - 1;
               if (newStock < 0) throw "نفذت الكمية أثناء إتمام الطلب!";
               transaction.update(prodRef, { stockQuantity: newStock, inStock: newStock > 0 });
           });
        }
      }

      await setDoc(newOrderRef, { uid: currentUserProfile.uid, userEmail: currentUserProfile.email, productIds, productId: productIds[0], productName: productTitles.join(' + '), finalPrice: totalPrice, currency, discountApplied: activeDiscount, promoCodeUsed: activeDiscount > 0 ? document.getElementById('promoCodeInput').value.trim() : "", paymentMethod, senderInfo, transactionId, customerData, receiptImage: receiptBase64, status: 'pending', deliveredCode: '', createdAt: serverTimestamp() });

      storeState.cart = []; window.updateCartBadge();
      document.getElementById('receiptPreview').style.display = 'none'; document.getElementById('receiptPreview').src = ''; document.getElementById('checkoutModal').style.display = 'none'; document.getElementById('checkoutForm').reset(); activeDiscount = 0; 
      
      window.showToast('🎉 تم إرسال طلبك بنجاح! راجع "حسابي" لمتابعة الحالة.', 'success');
      if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f2ff', '#b500ff', '#ffffff'] });

      if (typeof emailjs !== 'undefined') {
           const confirmMsg = `لقد استلمنا طلبك بنجاح وجاري مراجعته.<br>تفاصيل الطلب: <strong>${productTitles.join(' + ')}</strong><br>الإجمالي: <strong>${totalPrice} ${currency}</strong><br><br>يمكنك متابعة حالة الطلب من قسم "طلباتي" في حسابك.`;
           emailjs.send("service_01wl99f", "Template_gx1ra8k", { 
             to_name: currentUserProfile.name, 
             to_email: currentUserProfile.email, 
             custom_message: confirmMsg 
           }).catch(err => console.error("Email Error:", err));
      }
    } catch (err) { window.showToast(err.message || 'حدث خطأ، تأكد من اتصالك.', 'error'); } 
    finally { confirmText.textContent = translations[currentLang].btn_confirm_order; confirmSpinner.style.display = 'none'; confirmBtn.disabled = false; }
  });
  
  // 🌟 نظام التنقل والفلترة في الهيدر والبار
  document.getElementById('searchInput')?.addEventListener('input', () => { currentPage = 1; window.renderProducts(); });
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      const cat = e.target.dataset.cat || 'all';
      e.target.classList.add('active');
      currentCategory = cat; currentPage = 1; window.renderCategoriesBar(); window.renderProducts();
      showView('home');
    });
  });
  
  document.getElementById('shopNowBtn')?.addEventListener('click', () => {
      document.getElementById('productGrid').scrollIntoView({ behavior: 'smooth' });
  });
});

// ==========================================
// 10. المزامنة والتشغيل (Initialization)
// ==========================================
const initApp = () => {
  applyLanguage();
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = []; snap.forEach(doc => products.push({ id: doc.id, ...doc.data() })); storeState.products = products; isDataLoaded = true; 
    window.renderProducts(); if(checkIsAdmin()) window.renderAdminProducts();
  });

  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'reviews'), snap => {
     const revs = []; snap.forEach(doc => revs.push({ id: doc.id, ...doc.data() })); storeState.reviews = revs; window.renderProducts();
  });

  onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), snap => {
    if (snap.exists()) {
      const data = snap.data(); storeState.whatsapp = data.whatsapp || "201200898990";
      if(data.rates) storeState.rates = data.rates; storeState.payments = data.payments || { instapay: "", vodafone: "", orange: "", crypto: "" };
      storeState.bannerAr = data.bannerAr || "⚡ عروض الكريسماس والخدمات الرقمية!"; storeState.bannerExpiry = data.bannerExpiry || ""; 
      storeState.promoCode = data.promoCode || ""; storeState.promoDiscount = data.promoDiscount || 0;
      if(data.slides) storeState.slides = data.slides; if(data.categories) storeState.categories = data.categories;
      const flashBannerText = document.getElementById('flashBannerText'); if(flashBannerText) flashBannerText.textContent = storeState.bannerAr;
      initCountdown(storeState.bannerExpiry); updatePaymentInfoBox(); window.renderPromoSlider(); window.renderCategoriesBar();
      const whatsappBtn = document.getElementById('whatsappBtn'); if(whatsappBtn) whatsappBtn.href = `https://wa.me/${storeState.whatsapp}?text=استفسار:`;
      if(isDataLoaded) window.renderProducts(); if(checkIsAdmin()) { window.loadAdminData(); window.renderAdminStats(); }
    }
  });

  const subscribeToOrders = (userUid) => {
      if (unsubscribeOrders) unsubscribeOrders();
      const q = checkIsAdmin() ? query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('createdAt', 'desc'), limit(adminOrdersLimit)) : query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where('uid', '==', userUid));
      unsubscribeOrders = onSnapshot(q, snap => {
         const ords = []; snap.forEach(d => ords.push({id: d.id, ...d.data()})); storeState.orders = ords.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
         window.renderUserOrders(); if(checkIsAdmin()) { window.renderAdminOrders(); window.renderAdminStats(); }
      });
  };
  window.loadMoreAdminOrders = () => { adminOrdersLimit += 20; if(currentUserProfile) subscribeToOrders(currentUserProfile.uid); };

  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtnNav'); if(!loginBtn) return;
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'مستخدم' };
      loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = 'var(--accent-neon)'; document.getElementById('accountUserName').textContent = currentUserProfile.name;
      
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (docSnap) => {
          if(docSnap.exists()) {
              const data = docSnap.data();
              if(data.language && data.language !== currentLang) { currentLang = data.language; localStorage.setItem('bn_lang', currentLang); applyLanguage(); }
              if(data.wishlist) { storeState.wishlist = data.wishlist; localStorage.setItem('bn_store_wishlist', JSON.stringify(data.wishlist)); window.renderProducts(); }
          }
      });
      
      let adminBtnInModal = document.getElementById('adminBtnInModal');
      if (checkIsAdmin()) {
        document.getElementById('adminBtnNav').style.display = 'block';
        window.injectAdminDashboard(); window.loadAdminData(); window.renderAdminStats();
        
        // جلب قائمة المستخدمين للأدمن
        if(unsubscribeUsers) unsubscribeUsers();
        unsubscribeUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => {
           const usrs = []; snap.forEach(d => usrs.push({id: d.id, ...d.data()})); storeState.users = usrs; window.renderAdminUsers();
        });

        if (!adminBtnInModal) {
           const accountModalContent = document.querySelector('#userAccountModal .modal-content');
           if(accountModalContent) {
             const btn = document.createElement('button'); btn.id = 'adminBtnInModal'; btn.className = 'submit-btn'; btn.style.cssText = 'width:100%; margin-bottom:15px; background:var(--accent-purple); color:#fff; font-size:16px; box-shadow:0 0 15px var(--purple-glow);';
             btn.innerHTML = '⚙️ الدخول للوحة تحكم الإدارة'; btn.onclick = () => { document.getElementById('userAccountModal').style.display = 'none'; document.getElementById('adminModal').style.display = 'flex'; };
             accountModalContent.insertBefore(btn, accountModalContent.querySelector('.user-tabs-container'));
           }
        }
      } else { document.getElementById('adminBtnNav').style.display = 'none'; if (adminBtnInModal) adminBtnInModal.remove(); }
      subscribeToOrders(user.uid);
    } else {
      currentUserProfile = null; loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = '';
      document.getElementById('adminBtnNav').style.display = 'none';
      if (document.getElementById('adminBtnInModal')) document.getElementById('adminBtnInModal').remove();
      if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; } storeState.orders = []; window.renderUserOrders();
    }
  });
};

window.renderUserOrders = () => {
  const list = document.getElementById('userOrdersList'); if (!list) return; list.replaceChildren();
  const myOrders = storeState.orders.filter(o => currentUserProfile && o.uid === currentUserProfile.uid);
  if (!myOrders.length) { list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد طلبات سابقة حتى الآن.</p>'; return; }
  myOrders.forEach(o => {
     const div = document.createElement('div'); div.style.cssText = 'background: #0b0b12; border: 1px solid var(--border-color); border-radius: 9px; padding: 14px; margin-bottom: 12px;';
     const statusColor = o.status === 'completed' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--danger)' : '#ffcc00';
     const statusAr = o.status === 'completed' ? 'مكتمل ✅' : o.status === 'cancelled' ? 'ملغي ❌' : 'قيد المراجعة ⏳';
     div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${o.productName} (${o.finalPrice} ${o.currency || 'EGP'})</strong><span style="color:${statusColor}; font-weight:bold; font-size:13px;">${statusAr}</span></div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${formatDate(o.createdAt)}</div><div style="font-size:12px; color:var(--text-muted);">رقم العملية: ${o.transactionId || 'غير متوفر'} | الدفع: ${o.paymentMethod}</div>${o.status === 'completed' && o.deliveredCode ? `<div style="background: rgba(0,255,100,.07); border: 1px solid var(--success); padding: 10px; border-radius: 7px; margin-top: 10px; font-family: monospace; color: var(--success); word-break: break-all;">🎁 بيانات التفعيل: <strong>${o.deliveredCode}</strong></div>` : ''}`;
     list.appendChild(div);
  });
};

window.renderUserWishlist = () => {
  const grid = document.getElementById('userWishlistGrid'); if (!grid) return; grid.replaceChildren();
  const wishedProducts = storeState.products.filter(p => storeState.wishlist.includes(p.id));
  if(!wishedProducts.length) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:20px;">لا توجد منتجات في المفضلة.</p>'; return; }
  const currency = document.getElementById('currencySelect').value, rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  wishedProducts.forEach(prod => {
    const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2); const card = document.createElement('div'); card.className = 'product-card'; card.style.padding = '15px';
    card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn')) return; document.getElementById('userAccountModal').style.display = 'none'; window.openProductDetails(prod.id); };
    card.innerHTML = `<div style="position:relative;"><button type="button" class="wishlist-icon-btn active" style="top:5px; left:5px; width:25px; height:25px; font-size:12px;" onclick="window.toggleWishlist('${prod.id}', event)">❤️</button><div class="product-img" style="height:100px; background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText || title)}</div><h3 class="product-title" style="font-size:14px;">${sanitizeText(title)}</h3><div class="product-price" style="font-size:16px;">${convertedPrice} ${currency}</div></div>`;
    grid.appendChild(card);
  });
};

// ==========================================
// 11. لوحة تحكم الإدارة بالكامل (Admin)
// ==========================================
window.initAdminTabs = () => {
  const tabBtns = document.querySelectorAll('#adminTabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => { tabBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('#adminDashboardView .tab-content').forEach(c => c.classList.remove('active-tab')); document.getElementById(btn.dataset.target).classList.add('active-tab'); });
  });
};
window.copyCustomerData = (text) => navigator.clipboard.writeText(text).then(() => window.showToast('تم النسخ 📋', 'success'));
document.getElementById('adminBtnNav')?.addEventListener('click', () => { if(checkIsAdmin()) document.getElementById('adminModal').style.display = 'flex'; });

window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer'); if(!container) return;
  container.innerHTML = `
    <div id="tab-dashboard" class="tab-content active-tab">
      <div class="admin-section" style="border-color: var(--accent-neon);"><h4 style="color: var(--accent-neon); margin-bottom: 15px;">📊 إحصائيات المبيعات الدقيقة</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" id="adminStatsGrid"></div></div>
      <div class="admin-section"><h4>⚡ إعدادات العروض</h4><div class="form-group"><label>نص الإعلان</label><input type="text" id="admBannerAr"></div><div class="form-group"><label>موعد انتهاء العرض</label><input type="datetime-local" id="admBannerExpiry" style="background:#0b0b12; color:#fff; padding:10px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة السلايدر</h4><div class="form-group"><label>العنوان</label><input type="text" id="slideTitleInput"></div><div class="form-group"><label>الوصف</label><input type="text" id="slideDescInput"></div><div class="form-group"><label>صورة البانر</label><input type="file" id="slideImgFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div><button type="button" class="submit-btn" id="saveSlideBtn" style="width:100%; margin-bottom:15px;" onclick="window.addSlide()">➕ إضافة للسلايدر</button><div id="adminSlidesList"></div></div>
    </div>
    <div id="tab-orders" class="tab-content">
      <div class="admin-section"><h4>⏳ طلبات جديدة</h4><div id="adminOrdersPending" style="max-height:350px; overflow-y:auto;"></div></div>
      <div class="admin-section" style="margin-top: 20px; opacity: 0.9;"><h4>🗄️ أرشيف الطلبات</h4><div id="adminOrdersArchived" style="max-height:350px; overflow-y:auto;"></div></div>
    </div>
    <div id="tab-products" class="tab-content">
      <div class="admin-section" id="productFormSection">
        <h4>📦 إضافة أو تعديل منتج (يدعم لغتين)</h4>
        <div class="grid-2">
          <div class="form-group"><label>اسم المنتج (عربي)</label><input type="text" id="newProdTitleAr"></div>
          <div class="form-group"><label>اسم المنتج (إنجليزي)</label><input type="text" id="newProdTitleEn"></div>
          <div class="form-group"><label>السعر الأساسي (EGP)</label><input type="number" id="newProdPrice"></div>
          <div class="form-group"><label>السعر المشطوب (EGP)</label><input type="number" id="newProdOldPrice"></div>
          <div class="form-group"><label>القسم</label><select id="newProdCat"></select></div>
          <div class="form-group"><label>الكمية المتاحة</label><input type="number" id="newProdStock"></div>
          <div class="form-group"><label>الشارة (عربي)</label><input type="text" id="newProdBadgeAr" placeholder="تسليم فوري"></div>
          <div class="form-group"><label>الشارة (إنجليزي)</label><input type="text" id="newProdBadgeEn" placeholder="Instant Delivery"></div>
        </div>
        
        <div class="form-group"><label>صورة الغلاف</label><input type="file" id="newProdImgFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>الصورة الداخلية (البانر)</label><input type="file" id="newProdBannerFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>معرض الصور الإضافية</label><input type="file" id="newProdGallery" multiple accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        
        <div class="grid-2">
           <div class="form-group"><label>مؤشر وقت التسليم</label><input type="text" id="newProdDeliveryTime" placeholder="مثال: ⚡ تسليم فوري"></div>
           <div class="form-group"><label>🛒 اقتراحات السلة (ID)</label><input type="text" id="newProdCrossSell" placeholder="مثال: 171234, 175678"></div>
        </div>
        
        <div class="form-group"><label>❓ الأسئلة الشائعة</label><textarea id="newProdFaq" rows="2"></textarea></div>
        <div class="form-group"><label>🏦 خزنة الأكواد الذكية (كود في كل سطر)</label><textarea id="newProdVault" style="font-family: monospace; direction: ltr;" rows="3"></textarea></div>
        <div class="form-group"><label>الوصف (عربي)</label><textarea id="newProdDescAr" rows="3"></textarea></div>
        <div class="form-group"><label>الوصف (إنجليزي)</label><textarea id="newProdDescEn" rows="3"></textarea></div>
        
        <button type="button" class="submit-btn" id="saveProductBtn" style="width:100%;" onclick="window.saveProduct()">➕ حفظ المنتج</button>
        <button type="button" class="cancel-btn" id="cancelEditBtn" style="width:100%; margin-top:10px; display:none;" onclick="window.cancelEdit()">إلغاء التعديل</button>
      </div>
      <div class="admin-section"><h4>📦 المنتجات الحالية</h4><div id="adminProductsList" style="max-height:300px; overflow-y:auto;"></div></div>
    </div>
    <div id="tab-users" class="tab-content">
      <div class="admin-section"><h4>👥 قائمة المستخدمين</h4><div id="adminUsersList" style="max-height:400px; overflow-y:auto;"></div></div>
    </div>
    <div id="tab-settings" class="tab-content">
      <div class="admin-section"><h4>🎁 إعدادات كود الخصم</h4><div class="grid-2"><div class="form-group"><label>كود الخصم</label><input type="text" id="admPromoCode"></div><div class="form-group"><label>نسبة الخصم (%)</label><input type="number" id="admPromoDiscount"></div></div></div>
      <div class="admin-section"><h4>💱 أسعار الصرف</h4><div class="grid-2"><div class="form-group"><label>SAR</label><input type="number" step="0.001" id="admRateSAR"></div><div class="form-group"><label>AED</label><input type="number" step="0.001" id="admRateAED"></div><div class="form-group"><label>USD</label><input type="number" step="0.0001" id="admRateUSD"></div></div></div>
      <div class="admin-section"><h4>📢 إعدادات الدفع والواتساب</h4><div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div><div class="grid-2"><div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div><div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div><div class="form-group"><label>USDT</label><input type="text" id="admCrypto"></div></div><button type="button" id="saveConfigBtn" class="submit-btn" style="width:100%; margin-top:15px;" onclick="window.saveGeneralSettings()">💾 حفظ الإعدادات</button></div>
    </div>
  `;
  // إضافة زر المستخدمين لقائمة الأدمن
  const adminTabs = document.getElementById('adminTabs');
  if(adminTabs && !adminTabs.innerHTML.includes('tab-users')) {
      adminTabs.innerHTML += `<button class="tab-btn" data-target="tab-users">👥 المستخدمين</button>`;
  }
  window.initAdminTabs(); window.renderCategoriesBar();
};

window.renderAdminUsers = () => {
    const list = document.getElementById('adminUsersList'); if(!list) return;
    list.innerHTML = storeState.users.map(u => `<div class="admin-item-row" style="display:flex; justify-content:space-between;"><div><strong style="color:var(--accent-neon);">${sanitizeText(u.name)}</strong><br><small style="color:var(--text-muted);">${sanitizeText(u.email)}</small></div><small style="color:var(--text-muted);">${formatDate(u.createdAt)}</small></div>`).join('');
};

window.renderAdminStats = () => {
  const statsGrid = document.getElementById('adminStatsGrid'); if (!statsGrid) return;
  const orders = storeState.orders || [];
  const totalOrders = orders.length, pendingOrders = orders.filter(o => o.status === 'pending').length, completedOrders = orders.filter(o => o.status === 'completed').length;
  let totalRevenueEGP = 0; let currTotals = { EGP: 0, SAR: 0, AED: 0, USD: 0 };
  orders.forEach(o => { 
    if (o.status === 'completed') {
      let price = Number(o.finalPrice || 0), currency = o.currency || 'EGP', rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
      totalRevenueEGP += (price / rate);
      if(currTotals[currency] !== undefined) currTotals[currency] += price;
    } 
  });
  statsGrid.innerHTML = `
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--accent-neon);">${totalOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معروضة</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: #ffcc00;">${pendingOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معلقة ⏳</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--success);">${completedOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات مكتملة ✅</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 16px; font-weight: bold; color: var(--accent-neon);">${totalRevenueEGP.toFixed(0)} EGP</div><div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">(≈ إجمالي المحول)</div></div>
  `;
};

window.renderAdminOrders = () => {
  const pendingList = document.getElementById('adminOrdersPending'), archivedList = document.getElementById('adminOrdersArchived');
  if (!pendingList || !archivedList) return; pendingList.replaceChildren(); archivedList.replaceChildren();

  const orders = storeState.orders || [], pendingOrders = orders.filter(o => o.status === 'pending'), archivedOrders = orders.filter(o => o.status !== 'pending');
  if (!pendingOrders.length) pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">لا توجد طلبات جديدة.</p>';
  if (!archivedOrders.length) archivedList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">الأرشيف فارغ.</p>';

  const createOrderHTML = (o, isArchived) => {
    const discountBadge = o.discountApplied > 0 ? `<span style="color:var(--success); font-weight:bold;">[خصم ${o.discountApplied}%]</span>` : '';
    const receiptView = o.receiptImage ? `<div style="margin-top:8px;"><a href="${o.receiptImage}" target="_blank" style="color:var(--accent-neon); text-decoration:underline;">📄 عرض الإيصال</a></div>` : '';
    const deleteBtn = isArchived ? `<button onclick="window.deleteAdminOrder('${o.id}')" style="position:absolute; bottom:10px; left:10px; background:rgba(255,68,68,0.2); color:var(--danger); border:1px solid var(--danger); padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">حذف نهائي 🗑️</button>` : '';

    let html = `<div class="admin-item-row" style="flex-direction:column; align-items:flex-start; position:relative; padding-bottom: ${isArchived ? '35px' : '10px'}"><span style="position:absolute; top:10px; left:10px; font-size:11px; color:var(--text-muted);">${formatDate(o.createdAt)}</span><div style="width:100%; margin-bottom:8px; line-height:1.6; padding-left: 100px;"><strong>الطلب:</strong> <span style="color:var(--accent-neon);">${o.productName}</span> | <strong>الإيميل:</strong> ${o.userEmail}<br><small><strong>السعر:</strong> <span style="color:var(--accent-neon);">${o.finalPrice} ${o.currency || 'EGP'}</span> ${discountBadge}</small><br><small><strong>محول من:</strong> ${o.senderInfo} | <strong style="color:var(--accent-neon);">رقم العملية:</strong> ${o.transactionId || 'غير مسجل'}<br><strong style="color:var(--accent-neon);">بيانات الاستلام:</strong> ${o.customerData} <button onclick="window.copyCustomerData('${o.customerData}')" style="background:var(--accent-neon); color:#000; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">نسخ</button></small><br>${receiptView}<small style="display:block; margin-top:5px;"><strong>الحالة:</strong> <span style="color:${o.status==='completed'?'var(--success)':o.status==='cancelled'?'var(--danger)':'#ffcc00'}">${o.status}</span></small>${isArchived && o.deliveredCode ? `<small style="display:block; color:var(--success);"><strong>الكود المُسلم:</strong> ${o.deliveredCode}</small>` : ''}</div>${deleteBtn}`;
    if (!isArchived) html += `<div style="display:flex; gap:8px; width:100%; flex-wrap:wrap; margin-top:5px; border-top:1px dashed var(--border-color); padding-top:10px;"><input type="text" id="code_${o.id}" placeholder="اكتب كود التفعيل هنا..." value="${o.deliveredCode || ''}" style="flex:1; padding:8px; border-radius:5px; background:#0b0b12; color:#fff; border:1px solid var(--border-color);"><button class="submit-btn" style="padding:8px 12px; flex:0;" onclick="window.updateOrderStatus('${o.id}', 'completed')">إكمال ✅</button><button class="cancel-btn" style="padding:8px 12px; flex:0; border-color:var(--danger); color:var(--danger);" onclick="window.updateOrderStatus('${o.id}', 'cancelled')">إلغاء ❌</button></div>`;
    html += `</div>`; return html;
  };
  pendingOrders.forEach(o => pendingList.insertAdjacentHTML('beforeend', createOrderHTML(o, false)));
  archivedOrders.forEach(o => archivedList.insertAdjacentHTML('beforeend', createOrderHTML(o, true)));
  if(orders.length >= adminOrdersLimit) archivedList.insertAdjacentHTML('beforeend', `<button type="button" class="load-more-btn" style="width:100%; padding:10px; background:transparent; color:var(--accent-neon); border:1px dashed var(--accent-neon); cursor:pointer;" onclick="window.loadMoreAdminOrders()">عرض المزيد ⬇️</button>`);
};

window.deleteAdminOrder = async (orderId) => { if (!checkIsAdmin() || !confirm('تأكيد الحذف النهائي؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId)); window.showToast('🗑️ تم الحذف', 'success'); } catch(e) {} };

// 🌟 تحديث قوي في نظام تسليم الأكواد المتعددة (Vault)
window.updateOrderStatus = async (orderId, status) => {
  const codeInput = document.getElementById(`code_${orderId}`); if(!codeInput) return;
  try {
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    let codeToDeliver = codeInput.value.trim();
    const order = storeState.orders.find(o => o.id === orderId);
    
    if (status === 'cancelled') {
      if (order && order.productIds) {
        for (const pid of order.productIds) { const prod = storeState.products.find(p => p.id === pid); if (prod && prod.stockQuantity !== undefined) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { stockQuantity: prod.stockQuantity + 1, inStock: true }); }
      }
    } 
    else if (status === 'completed' && !codeToDeliver && order && order.productIds && order.productIds.length > 0) {
        // سحب كود ذكي من الخزنة (Vault) لكل المنتجات اللي في الطلب مش منتج واحد بس!
        let multiCodesArr = [];
        for (const pid of order.productIds) {
            const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', pid);
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(prodRef);
                if (!sfDoc.exists()) return;
                const data = sfDoc.data();
                if (data.vaultCodes) {
                    let codes = data.vaultCodes.split('\n').map(c => c.trim()).filter(c => c);
                    if (codes.length > 0) {
                        let extractedCode = codes.shift();
                        multiCodesArr.push(`${data.titleAr || data.title}: ${extractedCode}`);
                        transaction.update(prodRef, { vaultCodes: codes.join('\n') });
                    }
                }
            });
        }
        if (multiCodesArr.length > 0) codeToDeliver = multiCodesArr.join(' || ');
    }
    
    await updateDoc(orderRef, { status, deliveredCode: codeToDeliver, updatedAt: serverTimestamp() });
    
    // إرسال إيميل بإكمال الطلب وتوصيل الكود
    if (status === 'completed' && typeof emailjs !== 'undefined' && order) {
        const confirmMsg = `تهانينا! لقد تم اكتمال طلبك بنجاح.<br><strong>المنتجات:</strong> ${order.productName}<br><strong>تفاصيل الاستلام/الأكواد:</strong><br><div class="highlight-box"><p>${codeToDeliver || 'تم التنفيذ مباشرة في حسابك.'}</p></div>`;
        emailjs.send("service_01wl99f", "Template_gx1ra8k", { to_name: order.userEmail.split('@')[0], to_email: order.userEmail, custom_message: confirmMsg }).catch(err => console.log("Delivery Email Error"));
    }

    window.showToast('تم التحديث!', 'success');
  } catch(e) { window.showToast('خطأ في التحديث', 'error'); }
};

window.addSlide = async () => { 
  const title = document.getElementById('slideTitleInput').value.trim(), desc = document.getElementById('slideDescInput').value.trim(), fileInput = document.getElementById('slideImgFileInput'), btn = document.getElementById('saveSlideBtn');
  if (!title || !fileInput || !fileInput.files[0]) return window.showToast('أدخل البيانات!', 'error');
  const origText = btn.textContent; btn.textContent = 'جاري الإضافة ⏳...'; btn.disabled = true;
  try {
    const imgBase64 = await compressImage(fileInput.files[0].src || await new Promise(res=>{ const r = new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(fileInput.files[0]) }));
    const slides = storeState.slides ? [...storeState.slides] : []; slides.push({ title, desc, imgUrl: imgBase64 });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true });
    window.showToast('🖼️ تم إضافة البانر!', 'success');
  } catch(e) {} finally { btn.textContent = origText; btn.disabled = false; }
};
window.deleteSlide = async (idx) => { const slides = [...storeState.slides]; slides.splice(idx, 1); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true }); window.renderAdminSlides(); };
window.renderAdminSlides = () => { const list = document.getElementById('adminSlidesList'); if(list) list.innerHTML = (storeState.slides||[]).map((s,i) => `<div class="admin-item-row"><span style="flex:1;">${s.title}</span><button class="delete-btn" onclick="window.deleteSlide(${i})">حذف</button></div>`).join(''); };

window.loadAdminData = () => {
  ['admBannerAr','admBannerExpiry','admWhatsapp','admInstapay','admVodafone','admCrypto','admPromoCode','admPromoDiscount'].forEach(id => { const el = document.getElementById(id); if(el) el.value = storeState[id.replace('adm','').charAt(0).toLowerCase() + id.replace('adm','').slice(1)] || (id==='admPromoDiscount'?0:'') || (storeState.payments?.[id.replace('adm','').toLowerCase()] || ''); });
  if(document.getElementById('admRateSAR')) document.getElementById('admRateSAR').value = storeState.rates.SAR;
  if(document.getElementById('admRateAED')) document.getElementById('admRateAED').value = storeState.rates.AED;
  if(document.getElementById('admRateUSD')) document.getElementById('admRateUSD').value = storeState.rates.USD;
  window.renderAdminProducts(); window.renderAdminOrders(); window.renderAdminSlides(); window.renderAdminStats();
};

window.saveGeneralSettings = async () => {
    try {
        const rates = { SAR: Number(document.getElementById('admRateSAR').value), AED: Number(document.getElementById('admRateAED').value), USD: Number(document.getElementById('admRateUSD').value) };
        const payments = { instapay: document.getElementById('admInstapay').value, vodafone: document.getElementById('admVodafone').value, crypto: document.getElementById('admCrypto').value };
        const promoCode = document.getElementById('admPromoCode').value;
        const promoDiscount = Number(document.getElementById('admPromoDiscount').value);
        const whatsapp = document.getElementById('admWhatsapp').value;
        const bannerAr = document.getElementById('admBannerAr').value;
        const bannerExpiry = document.getElementById('admBannerExpiry').value;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { rates, payments, promoCode, promoDiscount, whatsapp, bannerAr, bannerExpiry }, { merge: true });
        window.showToast('تم حفظ الإعدادات!', 'success');
    } catch(e) { window.showToast('خطأ في الحفظ', 'error'); }
};

window.saveProduct = async () => {
  if (!checkIsAdmin()) return;
  const titleAr = document.getElementById('newProdTitleAr').value, titleEn = document.getElementById('newProdTitleEn').value;
  const price = Number(document.getElementById('newProdPrice').value), oldPrice = Number(document.getElementById('newProdOldPrice')?.value) || 0;
  const stockQuantity = Number(document.getElementById('newProdStock')?.value) || 0;
  const category = document.getElementById('newProdCat')?.value || 'games';
  const badgeAr = document.getElementById('newProdBadgeAr')?.value || '', badgeEn = document.getElementById('newProdBadgeEn')?.value || '';
  const descAr = document.getElementById('newProdDescAr')?.value || '', descEn = document.getElementById('newProdDescEn')?.value || '';
  const deliveryTime = document.getElementById('newProdDeliveryTime')?.value || '';
  const faqText = document.getElementById('newProdFaq')?.value || '';
  const crossSellStr = document.getElementById('newProdCrossSell')?.value || '';
  const vaultCodes = document.getElementById('newProdVault')?.value || '';
  let crossSellIds = crossSellStr.split(',').map(id => id.trim()).filter(id => id);
  
  const coverInput = document.getElementById('newProdImgFileInput'), bannerInput = document.getElementById('newProdBannerFileInput'), galleryInput = document.getElementById('newProdGallery');
  const btn = document.getElementById('saveProductBtn');

  if (!titleAr || price <= 0) return window.showToast('تأكد من الاسم والسعر!', 'error');
  const origText = btn.textContent; btn.textContent = 'جاري الحفظ ⏳...'; btn.disabled = true;

  try {
    let imgUrl = ''; if (coverInput && coverInput.files[0]) { imgUrl = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await compressImage(e.target.result)); r.readAsDataURL(coverInput.files[0]); }); } else if (editingProductId) { imgUrl = storeState.products.find(p => p.id === editingProductId)?.imgUrl || ''; }
    let bannerUrl = ''; if (bannerInput && bannerInput.files[0]) { bannerUrl = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await compressImage(e.target.result)); r.readAsDataURL(bannerInput.files[0]); }); } else if (editingProductId) { bannerUrl = storeState.products.find(p => p.id === editingProductId)?.bannerUrl || ''; }
    let gallery = editingProductId ? (storeState.products.find(p => p.id === editingProductId)?.gallery || []) : [];
    if (galleryInput && galleryInput.files.length > 0) { gallery = []; for (let i = 0; i < galleryInput.files.length; i++) { const base64 = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await compressImage(e.target.result)); r.readAsDataURL(galleryInput.files[i]); }); gallery.push(base64); } }

    const prodData = { titleAr, titleEn, descAr, descEn, price, oldPrice, category, badgeAr, badgeEn, imgUrl, bannerUrl, gallery, deliveryTime, faqText, crossSellIds, vaultCodes, inStock: stockQuantity > 0, stockQuantity };

    if (editingProductId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProductId), prodData); window.showToast('✏️ تم التعديل!', 'success'); } 
    else { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', Date.now().toString()), prodData); window.showToast('📦 تمت الإضافة!', 'success'); }
    window.cancelEdit();
  } catch (e) { window.showToast('فشل العملية', 'error'); } finally { btn.textContent = origText; btn.disabled = false; }
};

window.editProduct = (id) => {
  const p = storeState.products.find(x => x.id === id); if(!p) return;
  document.getElementById('newProdTitleAr').value = p.titleAr || p.title || ''; document.getElementById('newProdTitleEn').value = p.titleEn || p.title || '';
  document.getElementById('newProdPrice').value = p.price || ''; document.getElementById('newProdOldPrice').value = p.oldPrice || '';
  document.getElementById('newProdCat').value = p.category || 'games'; document.getElementById('newProdStock').value = p.stockQuantity !== undefined ? p.stockQuantity : '';
  document.getElementById('newProdBadgeAr').value = p.badgeAr || p.badge || ''; document.getElementById('newProdBadgeEn').value = p.badgeEn || p.badge || '';
  document.getElementById('newProdDescAr').value = p.descAr || p.desc || ''; document.getElementById('newProdDescEn').value = p.descEn || p.desc || '';
  document.getElementById('newProdDeliveryTime').value = p.deliveryTime || ''; document.getElementById('newProdFaq').value = p.faqText || '';
  document.getElementById('newProdCrossSell').value = p.crossSellIds ? p.crossSellIds.join(', ') : ''; document.getElementById('newProdVault').value = p.vaultCodes || '';
  
  editingProductId = id; document.getElementById('saveProductBtn').innerHTML = '💾 حفظ التعديلات'; document.getElementById('cancelEditBtn').style.display = 'block'; document.getElementById('productFormSection').scrollIntoView({behavior: 'smooth'});
};

window.cancelEdit = () => {
  editingProductId = null; document.getElementById('saveProductBtn').innerHTML = '➕ إضافة المنتج'; document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('#productFormSection input, #productFormSection textarea').forEach(el => { if(el.id.startsWith('newProd')) el.value = ''; });
};

window.renderAdminProducts = () => {
  const list = document.getElementById('adminProductsList'); if (!list) return; list.replaceChildren();
  storeState.products.forEach(p => {
    const statusText = p.inStock && p.stockQuantity > 0 ? `متاح ✅ (${p.stockQuantity} قطعة)` : 'نفذت الكمية ⛔';
    const title = p.titleAr || p.title || '';
    let html = `<div class="admin-item-row"><span style="flex:1; line-height:1.6;">${title} - ${p.price}EGP (ID: <strong>${p.id}</strong>) <br><small><strong>${statusText}</strong></small></span><div style="display:flex; gap:8px;"><button class="submit-btn" style="padding:6px 12px; font-size:12px; flex:0;" onclick="window.editProduct('${p.id}')">تعديل</button><button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button></div></div>`;
    list.insertAdjacentHTML('beforeend', html);
  });
};
window.deleteProduct = async (id) => { if (!checkIsAdmin() || !confirm('تأكيد الحذف؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); window.showToast('تم الحذف', 'success'); } catch (e) {} };

initApp();
