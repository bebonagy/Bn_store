// app.js
import { db, appId } from './firebase-config.js';
import { initAuth, checkIsAdmin } from './auth.js';
import './admin.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. المتغيرات والدوال العامة (Globals)
// ==========================================
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
  bannerAr: "⚡ عروض الكريسماس والخدمات الرقمية!", bannerExpiry: "", whatsapp: "201200898990",
  rates: { SAR: 0.077, AED: 0.075, USD: 0.020 }, payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  promos: [], products: [], orders: [], reviews: [], slides: [], users: [],
  categories: [ { id: 'games', name: 'Games' }, { id: 'keys', name: 'Digital Keys' }, { id: 'software', name: 'Software' }, { id: 'subs', name: 'Subscriptions' }, { id: 'gifts', name: 'Gift Cards' }, { id: 'deals', name: 'Deals' } ],
  wishlist: [], cart: []
};

let currentUserProfile = null;
window.editingProductId = null;
window.adminOrdersLimit = 20;

window.currentProductId = null; // تم تعديل النطاق ليصبح عاماً لحل مشكلة السلة
window.currentSelectedVariant = null; 
let activeDiscount = 0;
let unsubscribeOrders = null;
let unsubscribeReviews = null;
let unsubscribeUsers = null;
let countdownInterval = null;
let currentSlideIndex = 0;
let slideInterval = null;
let isDataLoaded = false;
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
    nav_categories: "الأقسام", nav_search: "بحث", nav_wishlist: "المفضلة",
    qi_account: "نوع الحساب", qi_warranty: "الضمان", qi_region: "التفعيل", sys_req: "متطلبات التشغيل", select_variant: "اختر الباقة / النسخة:",
    btn_select_variant: "⚙️ اختيار الباقة"
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
  
  window.renderProducts();
  if(window.renderCategoriesBar) window.renderCategoriesBar(); 
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
// 3. السلايدر والعداد (UI Features)
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
  
  if (!window.storeState.slides || window.storeState.slides.length === 0) {
      container.style.display = 'none'; 
      if(heroBanner) heroBanner.style.display = 'flex';
      return;
  }
  
  container.style.display = 'block';
  if(heroBanner) heroBanner.style.display = 'none';
  track.replaceChildren(); dotsContainer.replaceChildren();

  window.storeState.slides.forEach((slide, idx) => {
    const slideDiv = document.createElement('div');
    slideDiv.className = `slider-slide ${idx === 0 ? 'active' : ''}`;
    slideDiv.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('${slide.imgUrl}')`;
    slideDiv.innerHTML = `<div class="slider-content"><h2>${window.sanitizeText(slide.title)}</h2><p>${window.sanitizeText(slide.desc)}</p></div>`;
    track.appendChild(slideDiv);
    const dot = document.createElement('button');
    dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
    dot.onclick = () => { currentSlideIndex = idx; updateSliderPosition(); };
    dotsContainer.appendChild(dot);
  });

  if (slideInterval) clearInterval(slideInterval);
  if (window.storeState.slides.length > 1) { slideInterval = setInterval(() => { currentSlideIndex = (currentSlideIndex + 1) % window.storeState.slides.length; updateSliderPosition(); }, 4500); }
};

const updateSliderPosition = () => {
  const track = document.getElementById('sliderTrack');
  const dots = document.querySelectorAll('.slider-dot');
  if (!track || !window.storeState.slides.length) return;
  track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlideIndex));
};

// ==========================================
// 4. التصنيفات والمنتجات
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
  const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
  const searchVal = searchInput?.value.trim().toLowerCase() || '';
  const sortVal = sortSelect?.value || 'default';
  
  let filtered = window.storeState.products.filter(prod => {
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
    
    let displayPrice = prod.price;
    if(prod.variants && prod.variants.length > 0) displayPrice = prod.variants[0].price;

    const convertedPrice = currency === 'EGP' ? displayPrice.toFixed(0) : (displayPrice / rate).toFixed(2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > displayPrice) ? (currency === 'EGP' ? prod.oldPrice.toFixed(0) : (prod.oldPrice / rate).toFixed(2)) : '';
    
    // فحص المخزون الذكي (يدعم الباقات)
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

    // زر الإضافة للسلة الذكي (يحول لصفحة المنتج لو فيه باقات)
    const btnText = inStock ? (hasVariants ? translations[currentLang].btn_select_variant : translations[currentLang].btn_add_to_cart) : translations[currentLang].out_of_stock;
    const btnAction = inStock ? (hasVariants ? `window.openProductDetails('${prod.id}')` : `window.addToCartDirect('${prod.id}', event)`) : '';

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
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'} ${hasVariants ? 'select-variant-btn' : ''}" onclick="${btnAction}" ${inStock ? '' : 'disabled'}>${btnText}</button>
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

// ==========================================
// 5. التفاصيل والمفضلة والسلة (والتقييمات)
// ==========================================
window.toggleWishlist = (prodId, event) => {
  if (event) event.stopPropagation();
  if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول لإضافة المنتجات للمفضلة!', 'error');

  let wl = window.storeState.wishlist || [];
  if (wl.includes(prodId)) { 
    wl = wl.filter(id => id !== prodId); 
    window.showToast('تم الإزالة من المفضلة 💔', 'normal'); 
  } else { 
    wl.push(prodId); 
    window.showToast('تم الإضافة للمفضلة ❤️', 'success'); 
  }
  
  window.storeState.wishlist = wl; 
  window.renderProducts(); 
  window.updateDetailWishlistBtn();
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

window.openProductDetails = (id) => {
  const prod = window.storeState.products.find(p => p.id === id); if (!prod) return;
  window.currentProductId = id; 
  window.currentSelectedVariant = null; // Reset Variant
  window.updateDetailWishlistBtn();

  const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
  const desc = currentLang === 'ar' ? (prod.descAr || prod.desc) : (prod.descEn || prod.desc);
  const badge = currentLang === 'ar' ? (prod.badgeAr || prod.badge) : (prod.badgeEn || prod.badge);

  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
  let inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);

  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailBadge').textContent = badge;
  
  // 1. نظام الباقات (Variants) وتحديث السعر
  const variantsContainer = document.getElementById('detailVariantsContainer');
  const variantsList = document.getElementById('detailVariants');
  let currentDisplayPrice = prod.price;
  
  if (prod.variants && prod.variants.length > 0) {
      variantsContainer.style.display = 'block';
      variantsList.innerHTML = '';
      
      // اختيار أول باقة متاحة افتراضياً
      const firstAvailable = prod.variants.find(v => v.stockQuantity === undefined || v.stockQuantity > 0) || prod.variants[0];
      window.currentSelectedVariant = firstAvailable; 
      currentDisplayPrice = window.currentSelectedVariant.price;
      
      // تحديث حالة المخزون بناءً على الباقات
      inStock = prod.variants.some(v => v.stockQuantity === undefined || v.stockQuantity > 0);
      
      prod.variants.forEach((v) => {
          const vInStock = v.stockQuantity === undefined || v.stockQuantity > 0;
          const btn = document.createElement('button');
          btn.className = `variant-btn ${window.currentSelectedVariant === v ? 'active' : ''}`;
          btn.textContent = currentLang === 'ar' ? v.nameAr : v.nameEn;
          if (!vInStock) {
              btn.style.opacity = '0.5';
              btn.style.textDecoration = 'line-through';
              btn.title = translations[currentLang].out_of_stock;
          }
          
          btn.onclick = () => {
              if(!vInStock) return;
              document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              window.currentSelectedVariant = v;
              const vPrice = currency === 'EGP' ? v.price.toFixed(0) : (v.price / rate).toFixed(2);
              document.getElementById('detailPrice').textContent = `${vPrice} ${currency}`;
              document.getElementById('detailOldPrice').textContent = ''; 
              
              // تحديث حالة المخزون بالأسفل
              const stockEl = document.getElementById('detailStock');
              if (stockEl) {
                  stockEl.textContent = (v.stockQuantity !== undefined) ? `${v.stockQuantity} ${translations[currentLang].piece}` : translations[currentLang].available; 
                  stockEl.style.color = 'var(--success)';
              }
          };
          variantsList.appendChild(btn);
      });
  } else {
      variantsContainer.style.display = 'none';
  }

  const convertedPrice = currency === 'EGP' ? currentDisplayPrice.toFixed(0) : (currentDisplayPrice / rate).toFixed(2);
  const convertedOld = (!prod.variants || prod.variants.length === 0) && (prod.oldPrice && prod.oldPrice > currentDisplayPrice) ? (currency === 'EGP' ? prod.oldPrice.toFixed(0) : (prod.oldPrice / rate).toFixed(2)) : '';
  document.getElementById('detailPrice').textContent = `${convertedPrice} ${currency}`;
  document.getElementById('detailOldPrice').textContent = convertedOld ? `${convertedOld} ${currency}` : '';

  // 2. منصة اللعبة (Platform)
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
      platformDiv.style.display = 'flex';
      platformLogo.src = platformsData[prod.platform].icon;
      platformName.textContent = platformsData[prod.platform].name;
  } else {
      platformDiv.style.display = 'none';
  }

  // 3. المعلومات السريعة (Quick Info Box)
  const quickInfoBox = document.getElementById('detailQuickInfo');
  if (prod.quickInfo && (prod.quickInfo.accountAr || prod.quickInfo.warrantyAr || prod.quickInfo.regionAr)) {
      quickInfoBox.style.display = 'flex';
      document.getElementById('qiAccountVal').textContent = currentLang === 'ar' ? (prod.quickInfo.accountAr || '-') : (prod.quickInfo.accountEn || '-');
      document.getElementById('qiWarrantyVal').textContent = currentLang === 'ar' ? (prod.quickInfo.warrantyAr || '-') : (prod.quickInfo.warrantyEn || '-');
      document.getElementById('qiRegionVal').textContent = currentLang === 'ar' ? (prod.quickInfo.regionAr || '-') : (prod.quickInfo.regionEn || '-');
  } else {
      quickInfoBox.style.display = 'none';
  }

  // 4. متطلبات التشغيل (Requirements)
  const reqContainer = document.getElementById('detailRequirementsContainer');
  const reqContent = document.getElementById('detailRequirementsContent');
  const reqText = currentLang === 'ar' ? prod.reqAr : prod.reqEn;
  if (prod.category === 'games' && reqText) {
      reqContainer.style.display = 'block';
      reqContent.innerHTML = linkify(reqText).replace(/\n/g, '<br>');
  } else {
      reqContainer.style.display = 'none';
  }

  // الوصف والأسئلة والصور..
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
              faqList.innerHTML += `<div class="faq-item"><button class="faq-question">${window.sanitizeText(q)}</button><div class="faq-answer">${linkify(a)}</div></div>`;
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

  // التوفر وزر الإضافة
  const stockEl = document.getElementById('detailStock'); 
  const addBtn = document.getElementById('detailAddToCartBtn');
  if (stockEl && addBtn) {
    if (inStock) {
      let qtyText = translations[currentLang].available;
      if (window.currentSelectedVariant && window.currentSelectedVariant.stockQuantity !== undefined) {
         qtyText = `${window.currentSelectedVariant.stockQuantity} ${translations[currentLang].piece}`;
      } else if (!window.currentSelectedVariant && prod.stockQuantity !== undefined) {
         qtyText = `${prod.stockQuantity} ${translations[currentLang].piece}`;
      }
      stockEl.textContent = qtyText;
      stockEl.style.color = 'var(--success)';
      addBtn.textContent = translations[currentLang].btn_add_to_cart; addBtn.disabled = false; addBtn.classList.remove('out-of-stock-badge');
    } else {
      stockEl.textContent = translations[currentLang].out_of_stock; stockEl.style.color = 'var(--danger)';
      addBtn.textContent = translations[currentLang].out_of_stock; addBtn.disabled = true; addBtn.classList.add('out-of-stock-badge');
    }
  }
  window.loadProductReviews(id); 
  showView('details');
};

window.updateCartBadge = () => {
  const badge = document.getElementById('cartCountBadge');
  const badgeMobile = document.getElementById('cartCountBadgeMobile');
  if (badge) { badge.textContent = window.storeState.cart.length; badge.style.display = window.storeState.cart.length > 0 ? 'flex' : 'none'; }
  if (badgeMobile) { badgeMobile.textContent = window.storeState.cart.length; badgeMobile.style.display = window.storeState.cart.length > 0 ? 'flex' : 'none'; }
};

// دالة الإضافة للسلة المحدثة لتدعم الباقات والمتغير العام بشكل صحيح
window.addToCartDirect = (prodId, event) => {
  if (event) event.stopPropagation();
  const prod = window.storeState.products.find(p => p.id === prodId);
  
  if (prod && prod.inStock) {
      let cartItem = JSON.parse(JSON.stringify(prod)); 
      cartItem.cartItemId = Date.now() + Math.random(); 
      
      // التعديل: قراءة currentProductId من window، ومقارنته بشكل صحيح
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
      
      window.storeState.cart.push(cartItem); 
      window.updateCartBadge(); 
      window.showToast('🛒 ' + translations[currentLang].btn_add_to_cart, 'success'); 
  }
};

window.addToCartCross = (id) => {
    const p = window.storeState.products.find(x => x.id === id);
    if(p) { window.addToCartDirect(id); window.renderCartModal(); window.showToast('تم إضافة الاقتراح للسلة!', 'success'); }
};

window.removeFromCart = (index) => { window.storeState.cart.splice(index, 1); window.updateCartBadge(); window.renderCartModal(); };

window.renderCartModal = () => {
  const list = document.getElementById('cartItemsList');
  const crossSellSection = document.getElementById('cartCrossSellSection');
  const crossSellList = document.getElementById('cartCrossSellList');
  const totalDisplay = document.getElementById('cartTotalPriceDisplay');
  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
  
  if (!window.storeState.cart.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px 0;">السلة فارغة حالياً.</p>';
    totalDisplay.textContent = `0 ${currency}`;
    document.getElementById('proceedToCheckoutBtn').disabled = true;
    if(crossSellSection) crossSellSection.style.display = 'none';
    return;
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
      let suggestions = [];
      window.storeState.cart.forEach(p => { if (p.crossSellIds) suggestions.push(...p.crossSellIds); });
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

// ==========================================
// 6. لوحة المستخدم ومتتبع الطلبات المرئي
// ==========================================
window.renderUserOrders = () => {
  const list = document.getElementById('userOrdersList'); if (!list) return; list.replaceChildren();
  const myOrders = window.storeState.orders.filter(o => currentUserProfile && o.uid === currentUserProfile.uid);
  if (!myOrders.length) { list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد طلبات سابقة حتى الآن.</p>'; return; }
  
  myOrders.forEach(o => {
     const div = document.createElement('div'); div.style.cssText = 'background: #0b0b12; border: 1px solid var(--border-color); border-radius: 9px; padding: 14px; margin-bottom: 15px;';
     
     const trackerHTML = `
      <div class="order-tracker">
        <div class="tracker-step ${o.status === 'pending' || o.status === 'completed' ? 'active' : ''} ${o.status === 'cancelled' ? 'cancelled' : ''}">
          <span>1</span>
          <div class="tracker-label">مراجعة</div>
        </div>
        <div class="tracker-step ${o.status === 'completed' ? 'completed' : ''} ${o.status === 'cancelled' ? 'cancelled' : ''}">
          <span>2</span>
          <div class="tracker-label">${o.status === 'cancelled' ? 'ملغي' : 'مكتمل'}</div>
        </div>
      </div>
     `;

     div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${o.productName} (${o.finalPrice} ${o.currency || 'EGP'})</strong></div><div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${window.formatDate(o.createdAt)}</div>
     ${trackerHTML}
     ${o.status === 'completed' && o.deliveredCode ? `<div style="background: rgba(0,255,100,.07); border: 1px solid var(--success); padding: 10px; border-radius: 7px; margin-top: 25px; font-family: monospace; color: var(--success); word-break: break-all;">🎁 بيانات التفعيل: <strong>${o.deliveredCode}</strong></div>` : ''}`;
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

// ==========================================
// 7. الشراء وإنهاء الطلب (Checkout - Batch Transaction)
// ==========================================
const updateCheckoutPriceDisplay = () => {
  if (!window.storeState.cart.length) return;
  const currency = document.getElementById('currencySelect').value; 
  const rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
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

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUserProfile || !window.storeState.cart.length) return;
  
  const receiptFileInput = document.getElementById('receiptFileInput');
  if (!receiptFileInput || !receiptFileInput.files[0]) return window.showToast('برجاء إرفاق صورة الإيصال!', 'error');

  const confirmBtn = document.getElementById('confirmOrderBtn'), confirmText = document.getElementById('confirmBtnText'), confirmSpinner = document.getElementById('confirmSpinner');
  confirmText.textContent = 'جاري الإرسال...'; confirmSpinner.style.display = 'inline-block'; confirmBtn.disabled = true;

  try {
    const receiptBase64 = await window.compressImage(document.getElementById('receiptPreview').src);
    const currency = document.getElementById('currencySelect').value, rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
    let totalPrice = 0, productTitles = [], productIds = [];
    
    window.storeState.cart.forEach(p => { 
        const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
        totalPrice += currency === 'EGP' ? p.price : (p.price / rate); productTitles.push(title); productIds.push(p.id);
    });
    
    if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
    totalPrice = Number(totalPrice.toFixed(currency === 'EGP' ? 0 : 2));

    const paymentMethod = document.getElementById('paymentMethod').value;
    const senderInfo = window.sanitizeText(document.getElementById('senderInfo').value);
    const transactionId = window.sanitizeText(document.getElementById('transactionIdInput').value); 
    const customerData = window.sanitizeText(document.getElementById('customerData').value);
    const newOrderRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));

    // التعديل: المعاملة المجمعة لحماية المخزون وإدارته (Variants & Global)
    await runTransaction(db, async (transaction) => {
        const updates = new Map();
        
        for (const p of window.storeState.cart) {
            const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id);
            const sfDoc = await transaction.get(prodRef);
            if (!sfDoc.exists()) throw new Error(`المنتج غير موجود!`);
            
            const data = updates.has(p.id) ? updates.get(p.id) : sfDoc.data();
            
            if (p.variantId && data.variants && data.variants.length > 0) {
                const vIndex = data.variants.findIndex(v => (v.id || v.nameEn) === p.variantId);
                if (vIndex !== -1 && data.variants[vIndex].stockQuantity !== undefined) {
                    const newVStock = data.variants[vIndex].stockQuantity - 1;
                    if (newVStock < 0) throw new Error(`نفذت كمية الباقة لمنتج ${p.titleAr || p.title}!`);
                    data.variants[vIndex].stockQuantity = newVStock;
                }
            } else if (data.stockQuantity !== undefined) {
                const newStock = data.stockQuantity - 1;
                if (newStock < 0) throw new Error(`نفذت الكمية لمنتج ${p.titleAr || p.title}!`);
                data.stockQuantity = newStock;
                data.inStock = newStock > 0;
            }
            updates.set(p.id, data);
        }

        // كتابة جميع التعديلات في قاعدة البيانات دفعة واحدة
        for (const [id, data] of updates.entries()) {
            transaction.update(doc(db, 'artifacts', appId, 'public', 'data', 'products', id), {
                stockQuantity: data.stockQuantity,
                inStock: data.inStock !== undefined ? data.inStock : (data.stockQuantity > 0),
                variants: data.variants || []
            });
        }

        // تسجيل الطلب
        transaction.set(newOrderRef, { 
            uid: currentUserProfile.uid, 
            userEmail: currentUserProfile.email, 
            productIds, 
            productId: productIds[0], 
            productName: productTitles.join(' + '), 
            finalPrice: totalPrice, 
            currency, 
            discountApplied: activeDiscount, 
            promoCodeUsed: activeDiscount > 0 ? document.getElementById('promoCodeInput').value.trim() : "", 
            paymentMethod, 
            senderInfo, 
            transactionId, 
            customerData, 
            receiptImage: receiptBase64, 
            status: 'pending', 
            deliveredCode: '', 
            createdAt: serverTimestamp() 
        });
    });

    window.storeState.cart = []; window.updateCartBadge();
    document.getElementById('checkoutModal').style.display = 'none'; document.getElementById('checkoutForm').reset();
    activeDiscount = 0;
    window.showToast('🎉 تم إرسال طلبك بنجاح! راجع "حسابي" لمتابعة الحالة.', 'success');
    
  } catch (err) { window.showToast(err.message || 'حدث خطأ، تأكد من اتصالك.', 'error'); } 
  finally { confirmText.textContent = translations[currentLang].btn_confirm_order; confirmSpinner.style.display = 'none'; confirmBtn.disabled = false; }
});

// ==========================================
// 8. أزرار المشاركة (Share API)
// ==========================================
const handleShare = async (title, text, url) => {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); } catch(err) { console.log('Share canceled'); }
  } else { navigator.clipboard.writeText(url); window.showToast('تم نسخ الرابط! 📋', 'success'); }
};
document.getElementById('shareBtn')?.addEventListener('click', () => handleShare('BN MAX Store', 'أفضل متجر للخدمات الرقمية!', window.location.href));
document.getElementById('shareProductBtn')?.addEventListener('click', () => { const title = document.getElementById('detailTitle').textContent; handleShare(title, `شاهد هذا المنتج الرائع على BN MAX: ${title}`, window.location.href); });

// ==========================================
// 9. المزامنة والتشغيل (Initialization)
// ==========================================
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
  
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = []; snap.forEach(doc => products.push({ id: doc.id, ...doc.data() })); window.storeState.products = products; isDataLoaded = true; 
    window.renderProducts(); if(window.checkIsAdmin()) window.renderAdminProducts();
  });

  onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), snap => {
    if (snap.exists()) {
      const data = snap.data(); window.storeState.whatsapp = data.whatsapp || "201200898990";
      if(data.rates) window.storeState.rates = data.rates; window.storeState.payments = data.payments || { instapay: "", vodafone: "", orange: "", crypto: "" };
      window.storeState.bannerAr = data.bannerAr || ""; window.storeState.bannerExpiry = data.bannerExpiry || ""; 
      
      // الكوبونات الديناميكية المتعددة
      window.storeState.promos = data.promos || [];
      // الكوبون القديم (لضمان التوافق)
      if(data.promoCode && data.promoDiscount) {
         window.storeState.promos.push({ code: data.promoCode, discount: data.promoDiscount });
      }

      if(data.slides) window.storeState.slides = data.slides; if(data.categories) window.storeState.categories = data.categories;
      
      loadSeoFromDB(data);
      initCountdown(window.storeState.bannerExpiry); updatePaymentInfoBox(); window.renderPromoSlider(); window.renderCategoriesBar();
      if(isDataLoaded) window.renderProducts(); 
      
      const whatsappBtn = document.getElementById('whatsappBtn'); 
      if(whatsappBtn) whatsappBtn.href = `https://wa.me/${window.storeState.whatsapp}?text=استفسار:`;
      const footerContactBtn = document.getElementById('footerContactBtn');
      if(footerContactBtn) footerContactBtn.href = `https://wa.me/${window.storeState.whatsapp}?text=استفسار من قسم اتصل بنا:`;
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
      loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = 'var(--accent-neon)'; 
      if(document.getElementById('accountUserName')) document.getElementById('accountUserName').textContent = profile.name;
      
      // تحميل المفضلة الخاصة بالحساب
      window.storeState.wishlist = profile.wishlist || [];
      window.updateDetailWishlistBtn();
      window.renderProducts();
      
      if (window.checkIsAdmin()) {
        document.getElementById('adminBtnNav').style.display = 'block';
        if(window.injectAdminDashboard) window.injectAdminDashboard();
        
        let adminBtnInModal = document.getElementById('adminBtnInModal');
        if (!adminBtnInModal) {
           const accountModalContent = document.querySelector('#userAccountModal .modal-content');
           if(accountModalContent) {
             const btn = document.createElement('button'); btn.id = 'adminBtnInModal'; btn.className = 'submit-btn'; btn.style.cssText = 'width:100%; margin-bottom:15px; background:var(--accent-purple); color:#fff; font-size:16px; box-shadow:0 0 15px var(--purple-glow);';
             btn.innerHTML = '⚙️ الدخول للوحة تحكم الإدارة'; btn.onclick = () => { document.getElementById('userAccountModal').style.display = 'none'; document.getElementById('adminModal').style.display = 'flex'; };
             accountModalContent.insertBefore(btn, accountModalContent.querySelector('.user-tabs-container'));
           }
        }

        if(unsubscribeUsers) unsubscribeUsers();
        unsubscribeUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => {
           const usrs = []; snap.forEach(d => usrs.push({id: d.id, ...d.data()})); 
           window.storeState.users = usrs; 
           if(window.renderAdminUsers) window.renderAdminUsers();
        });

      } else { 
        document.getElementById('adminBtnNav').style.display = 'none'; 
      }
      subscribeToOrders(user.uid);
    } else {
      loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = '';
      document.getElementById('adminBtnNav').style.display = 'none';
      if (document.getElementById('adminBtnInModal')) document.getElementById('adminBtnInModal').remove();
      if(unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
      if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; } 
      
      // تفريغ البيانات عند تسجيل الخروج (علاج الثغرة)
      window.storeState.orders = []; 
      window.storeState.cart = [];
      window.storeState.wishlist = [];
      window.renderUserOrders();
      window.renderUserWishlist();
      window.updateCartBadge();
      if(document.getElementById('cartModal')) window.renderCartModal();
      window.renderProducts();
    }
  });

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      const cat = e.target.dataset.cat || 'all';
      e.target.classList.add('active');
      currentCategory = cat; currentPage = 1; window.renderCategoriesBar(); window.renderProducts();
      showView('home');
    });
  });

  document.getElementById('adminBtnNav')?.addEventListener('click', () => { 
      if(window.checkIsAdmin()) document.getElementById('adminModal').style.display = 'flex'; 
  });

  document.getElementById('detailAddToCartBtn')?.addEventListener('click', () => window.addToCartDirect(window.currentProductId));
  document.getElementById('currencySelect')?.addEventListener('change', () => { window.renderProducts(); window.renderCartModal(); });
  document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentInfoBox);
  
  document.getElementById('backToHomeBtn')?.addEventListener('click', () => {
    showView('home');
  });

  const receiptFileInput = document.getElementById('receiptFileInput'), receiptPreview = document.getElementById('receiptPreview');
  if (receiptFileInput && receiptPreview) {
    receiptFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) { const reader = new FileReader(); reader.onload = (ev) => { receiptPreview.src = ev.target.result; receiptPreview.style.display = 'block'; }; reader.readAsDataURL(file); } 
      else { receiptPreview.style.display = 'none'; receiptPreview.src = ''; }
    });
  }

  document.getElementById('proceedToCheckoutBtn')?.addEventListener('click', () => {
    if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول أولاً!', 'error');
    if (!window.storeState.cart.length) return;
    document.getElementById('cartModal').style.display = 'none'; 
    activeDiscount = 0; document.getElementById('promoCodeInput').value = ''; 
    if(document.getElementById('promoMsg')) document.getElementById('promoMsg').textContent = '';
    updateCheckoutPriceDisplay();
    updatePaymentInfoBox();
    document.getElementById('checkoutModal').style.display = 'flex';
  });

  document.getElementById('applyPromoBtn')?.addEventListener('click', () => {
    const input = document.getElementById('promoCodeInput').value.trim().toLowerCase();
    const msgEl = document.getElementById('promoMsg');
    if (!input) return;
    
    // التحقق من مصفوفة الكوبونات الديناميكية
    const promo = window.storeState.promos?.find(p => p.code.toLowerCase() === input);
    
    if (promo && (!promo.expiry || new Date(promo.expiry) > new Date())) {
      activeDiscount = promo.discount; 
      msgEl.textContent = `تم تطبيق خصم ${activeDiscount}% بنجاح! ✅`; 
      msgEl.style.color = 'var(--success)';
    } else { 
      activeDiscount = 0; 
      msgEl.textContent = 'كود الخصم غير صحيح أو منتهي! ❌'; 
      msgEl.style.color = 'var(--danger)'; 
    }
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
      const val = Number(e.target.getAttribute('data-value'));
      document.getElementById('reviewRating').value = val;
      document.querySelectorAll('#interactiveStars .star').forEach(s => {
        if(Number(s.getAttribute('data-value')) <= val) s.classList.add('active');
        else s.classList.remove('active');
      });
    });
  });
};

initApp();

// ربط زرار فتح السلة للملف الشخصي والهيدر بكل دقة
document.getElementById('cartBtnNav')?.addEventListener('click', () => {
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.style.display = 'flex';
    window.renderCartModal();
  }
});

// كود زرار الواتساب للطلبات الفورية
document.getElementById('whatsappCheckoutBtn')?.addEventListener('click', () => {
  if (!window.storeState.cart.length) return window.showToast('السلة فارغة!', 'error');
  
  const senderInfo = document.getElementById('senderInfo')?.value.trim() || 'غير مسجل';
  const transactionId = document.getElementById('transactionIdInput')?.value.trim() || 'غير مسجل';
  const customerData = document.getElementById('customerData')?.value.trim() || 'غير مسجل';
  const paymentMethod = document.getElementById('paymentMethod')?.value || 'غير محدد';
  
  const currency = document.getElementById('currencySelect').value;
  let totalPrice = 0;
  let productTitles = [];
  
  window.storeState.cart.forEach(p => {
    const title = currentLang === 'ar' ? (p.titleAr || p.title) : (p.titleEn || p.title);
    totalPrice += Number(p.price || 0);
    productTitles.push(title);
  });
  
  const finalPriceText = `${totalPrice} ${currency}`;
  const whatsappNumber = window.storeState.whatsapp || '201200898990';
  
  const message = `السلام عليكم، لقد قمت بطلب جديد من متجر BN MAX 🚀:\n\n` +
                  `📦 *المنتجات:* ${productTitles.join(' + ')}\n` +
                  `💰 *الإجمالي:* ${finalPriceText}\n` +
                  `💳 *طريقة الدفع:* ${paymentMethod}\n` +
                  `🔢 *رقم العملية:* ${transactionId}\n` +
                  `📱 *رقم التحويل:* ${senderInfo}\n` +
                  `👤 *بيانات الاستلام:* ${customerData}\n\n` +
                  `يرجى مراجعة الطلب وتأكيده!`;
                  
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
  
  window.open(whatsappURL, '_blank');
  window.showToast('💬 تم تحويلك للواتساب لإرسال تفاصيل الطلب!', 'success');
});
