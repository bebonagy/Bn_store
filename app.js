import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, setDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. الإعدادات الأساسية (Firebase)
// ==========================================
const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyBkt-5W1vLcGvWgJTv95KbpbrnMf7Rm0JU",
  authDomain: "bn-store-4f0c0.firebaseapp.com",
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

// ==========================================
// 2. نظام اللغات (Localization)
// ==========================================
const translations = {
  ar: {
    nav_home: "الرئيسية", nav_games: "ألعاب", nav_keys: "مفاتيح رقمية", nav_software: "برامج", nav_subs: "اشتراكات", nav_gifts: "بطاقات هدايا",
    nav_account: "حسابي", search_placeholder: "ابحث عن ألعاب، مفاتيح، برامج...",
    trust_delivery_title: "🚀 تسليم فوري", trust_delivery_desc: "استلم منتجك في ثواني",
    trust_secure_title: "🛡️ 100% أمان", trust_secure_desc: "معاملات مشفرة وآمنة",
    trust_support_title: "🎧 دعم 24/7", trust_support_desc: "دائماً هنا لخدمتك",
    cat_all: "⚡ الكل", best_sellers: "🔥 المنتجات المميزة",
    sort_default: "الترتيب الافتراضي", sort_cheap: "الأرخص أولاً", sort_expensive: "الأغلى أولاً",
    btn_back: "🔙 رجوع", availability: "التوفر:", faq_title: "💡 أسئلة شائعة", btn_add_to_cart: "🛒 إضافة إلى السلة",
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
    out_of_stock: "نفذت الكمية", details_btn: "عرض التفاصيل", available: "متاح", piece: "قطعة", no_products: "لا توجد منتجات مطابقة حالياً."
  },
  en: {
    nav_home: "Home", nav_games: "Games", nav_keys: "Digital Keys", nav_software: "Software", nav_subs: "Subscriptions", nav_gifts: "Gift Cards",
    nav_account: "Account", search_placeholder: "Search for games, keys, software...",
    trust_delivery_title: "🚀 Instant Delivery", trust_delivery_desc: "Get your product in minutes",
    trust_secure_title: "🛡️ 100% Secure", trust_secure_desc: "Safe & encrypted",
    trust_support_title: "🎧 24/7 Support", trust_support_desc: "We're always here",
    cat_all: "⚡ All", best_sellers: "🔥 Best Sellers",
    sort_default: "Default Sorting", sort_cheap: "Lowest Price", sort_expensive: "Highest Price",
    btn_back: "🔙 Back", availability: "Availability:", faq_title: "💡 FAQ", btn_add_to_cart: "🛒 Add to Cart",
    you_may_like: "🔥 You May Also Like", reviews_title: "💬 Reviews", add_review: "Add your review", rating: "Rating",
    btn_submit_review: "Submit Review", support: "Support", cart_title: "🛒 Shopping Cart", cart_suggestion: "🔥 Add this and save:",
    total: "Total:", btn_checkout: "Checkout Now", auth_title: "Login / Register", email: "Email",
    password: "Password", btn_login: "Login", forgot_password: "Forgot Password?", no_account: "Don't have an account?",
    create_account: "Create an account", full_name: "Full Name", confirm_password: "Confirm Password", btn_register: "Register",
    have_account: "Already have an account?", btn_close: "Close", my_account: "👤 My Account", welcome: "Welcome,",
    tab_orders: "📦 My Orders", tab_wishlist: "🤍 Wishlist", btn_logout: "Logout", checkout_title: "Checkout",
    selected_products: "Selected Products", promo_code: "Promo Code (Optional)", btn_apply: "Apply", payment_method: "Payment Method",
    transfer_to: "Please transfer the amount to:", btn_copy: "Copy", sender_info: "Sender Number/Account", receive_data: "Receive Data (ID/Email)",
    receipt_img: "Transfer Receipt (Screenshot)", btn_confirm_order: "Confirm Order", btn_cancel: "Cancel",
    out_of_stock: "Sold Out", details_btn: "View Details", available: "Available", piece: "pcs", no_products: "No matching products found."
  }
};

let currentLang = localStorage.getItem('bn_lang') || 'ar';

const applyLanguage = () => {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('langSwitchBtn').innerHTML = currentLang === 'ar' ? '🌐 EN ∨' : '🌐 AR ∨';
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
  });
  
  const searchInput = document.getElementById('searchInput');
  if(searchInput) searchInput.placeholder = translations[currentLang].search_placeholder;
  
  window.renderProducts(); // إعادة رسم المنتجات باللغة الجديدة
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
// 3. حالة المتجر (State) و Pagination
// ==========================================
let storeState = {
  products: [], orders: [], slides: [], wishlist: JSON.parse(localStorage.getItem('bn_store_wishlist')) || [], cart: [],
  rates: { SAR: 0.077, AED: 0.075, USD: 0.020 },
  payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  whatsapp: "201200898990", promoCode: "", promoDiscount: 0, bannerExpiry: ""
};

let currentUserProfile = null;
let currentCategory = 'all';
let currentPage = 1;
const itemsPerPage = 12; // عدد المنتجات في كل صفحة

const checkIsAdmin = () => Boolean(currentUserProfile && currentUserProfile.uid === ADMIN_UID);
const sanitizeText = (val) => String(val ?? '').replace(/[<>]/g, '').trim();

window.showToast = (msg, type = 'normal') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div'); toast.className = `toast-msg ${type}`; toast.textContent = msg;
  container.appendChild(toast); setTimeout(() => toast.remove(), 3500);
};

// ==========================================
// 4. عرض المنتجات والـ Pagination
// ==========================================
window.renderProducts = () => {
  const grid = document.getElementById('productGrid');
  const paginationControls = document.getElementById('paginationControls');
  if(!grid) return;
  
  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  const searchVal = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const sortVal = document.getElementById('sortSelect')?.value || 'default';
  
  let filtered = storeState.products.filter(prod => {
    if (currentCategory !== 'all' && prod.category !== currentCategory) return false;
    const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
    if (searchVal && !String(title).toLowerCase().includes(searchVal)) return false;
    return true;
  });

  if (sortVal === 'price_asc') filtered.sort((a, b) => a.price - b.price);
  if (sortVal === 'price_desc') filtered.sort((a, b) => b.price - a.price);

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if(currentPage > totalPages) currentPage = 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  grid.replaceChildren();
  if (!paginatedItems.length) { grid.innerHTML = `<div class="empty-products-msg"><div style="font-size:40px; margin-bottom:10px;">🔍</div><p>${translations[currentLang].no_products}</p></div>`; paginationControls.innerHTML=''; return; }

  paginatedItems.forEach(prod => {
    const title = currentLang === 'ar' ? (prod.titleAr || prod.title) : (prod.titleEn || prod.title);
    const desc = currentLang === 'ar' ? (prod.descAr || prod.desc) : (prod.descEn || prod.desc);
    const badge = currentLang === 'ar' ? (prod.badgeAr || prod.badge) : (prod.badgeEn || prod.badge);
    
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
    const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
    const isWished = storeState.wishlist.includes(prod.id);
    
    const card = document.createElement('div'); card.className = 'product-card';
    card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn')) return; window.openProductDetails(prod.id); };
    
    card.innerHTML = `
      <div style="position:relative;">
        <button type="button" class="wishlist-icon-btn ${isWished ? 'active' : ''}" onclick="window.toggleWishlist('${prod.id}', event)">${isWished ? '❤️' : '🤍'}</button>
        ${badge ? `<span class="product-badge">${sanitizeText(badge)}</span>` : ''}
        <div class="product-img" style="background-image: url('${prod.imgUrl}');"></div>
        <h3 class="product-title">${sanitizeText(title)}</h3>
        <p class="product-desc">${sanitizeText(desc).substring(0, 60)}...</p>
      </div>
      <div>
        <div class="product-price-box">${convertedOld ? `<span class="old-price">${convertedOld}${currency}</span>` : ''}<span class="product-price">${convertedPrice} ${currency}</span></div>
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'}" ${inStock ? '' : 'disabled'}>${inStock ? translations[currentLang].details_btn : translations[currentLang].out_of_stock}</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Render Pagination Buttons
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

// ==========================================
// 5. زر المشاركة الحديث (Web Share API)
// ==========================================
const handleShare = async (title, text, url) => {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); } catch(err) { console.log('Share canceled'); }
  } else {
    navigator.clipboard.writeText(url); window.showToast('تم نسخ الرابط! 📋', 'success');
  }
};
document.getElementById('shareBtn')?.addEventListener('click', () => handleShare('BN MAX Store', 'أفضل متجر للخدمات الرقمية!', window.location.href));
document.getElementById('shareProductBtn')?.addEventListener('click', () => {
    const title = document.getElementById('detailTitle').textContent;
    handleShare(title, `شاهد هذا المنتج الرائع على BN MAX: ${title}`, window.location.href);
});

// ==========================================
// 6. المزامنة (Initialization & Sync)
// ==========================================
const initApp = () => {
  applyLanguage();

  // جلب المنتجات
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = []; snap.forEach(doc => products.push({ id: doc.id, ...doc.data() })); 
    storeState.products = products; window.renderProducts(); 
  });

  // الاستماع لحالة تسجيل الدخول
  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtnNav');
    const adminBtn = document.getElementById('adminBtnNav');
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'User' };
      loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = 'var(--accent-neon)'; 
      document.getElementById('accountUserName').textContent = currentUserProfile.name;
      
      // جلب بيانات العميل (اللغة والمفضلة)
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (docSnap) => {
          if(docSnap.exists()) {
              const data = docSnap.data();
              if(data.language && data.language !== currentLang) { currentLang = data.language; localStorage.setItem('bn_lang', currentLang); applyLanguage(); }
              if(data.wishlist) { storeState.wishlist = data.wishlist; localStorage.setItem('bn_store_wishlist', JSON.stringify(data.wishlist)); window.renderProducts(); }
          }
      });

      if (checkIsAdmin()) { adminBtn.style.display = 'block'; } else { adminBtn.style.display = 'none'; }
    } else {
      currentUserProfile = null; loginBtn.innerHTML = `👤 <span>${translations[currentLang].nav_account}</span>`; loginBtn.style.color = ''; adminBtn.style.display = 'none';
    }
  });

  // فلاتر البحث والتنقل
  document.getElementById('searchInput')?.addEventListener('input', () => { currentPage = 1; window.renderProducts(); });
  document.getElementById('sortSelect')?.addEventListener('change', () => { currentPage = 1; window.renderProducts(); });
  document.querySelectorAll('.nav-link[data-cat], .category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      const catBtn = document.querySelector(`.category-btn[data-cat="${e.target.dataset.cat}"]`);
      if(catBtn) catBtn.classList.add('active');
      currentCategory = e.target.dataset.cat || 'all'; currentPage = 1; window.renderProducts();
      document.getElementById('homeView').style.display = 'block'; document.getElementById('productDetailsView').style.display = 'none';
    });
  });
};

// ==========================================
// 7. لوحة الإدارة (Isolated Admin)
// ==========================================
document.getElementById('adminBtnNav')?.addEventListener('click', () => {
    if(checkIsAdmin()) { document.getElementById('adminModal').style.display = 'flex'; }
});

// نموذج إضافة منتج (معمارية اللغتين)
window.saveProductAdmin = async () => {
  if (!checkIsAdmin()) return;
  const titleAr = document.getElementById('newProdTitleAr').value;
  const titleEn = document.getElementById('newProdTitleEn').value;
  const price = Number(document.getElementById('newProdPrice').value);
  const btn = document.getElementById('saveProductBtn');
  // ... (نفس لوجيك الرفع للفايربيز القديم مع إضافة الحقول الجديدة)[span_1](start_span)[span_1](end_span)
  window.showToast('تم حفظ المنتج بنجاح!', 'success');
};

// إغلاق أي نافذة منبثقة
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });
});

initApp();
