import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, setDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);
const sanitizeText = (val, maxLen = 500) => String(val ?? '').replace(/[<>]/g, '').trim().slice(0, maxLen);

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ==========================================
// 🌟 دالة ضغط الصور
// ==========================================
const compressImage = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

// ==========================================
// 2. حالة المتجر الأساسية
// ==========================================
let storeState = {
  bannerAr: "⚡ عروض الكريسماس والخدمات الرقمية!",
  bannerExpiry: "", 
  whatsapp: "201200898990",
  rates: { SAR: 0.077, AED: 0.075, USD: 0.020 },
  payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  promoCode: "",
  promoDiscount: 0,
  products: [],
  orders: [],
  reviews: [],
  slides: [],
  categories: [
    { id: 'games', name: '🎮 ألعاب' },
    { id: 'subs', name: '📺 اشتراكات' },
    { id: 'ai', name: '✨ ذكاء اصطناعي' },
    { id: 'software', name: '💻 برامج' }
  ],
  wishlist: JSON.parse(localStorage.getItem('bn_store_wishlist')) || [] // تحميل المفضلة من الجهاز
};

let currentUserProfile = null;
let currentProductId = null;
let editingProductId = null; 
let activeDiscount = 0;
let unsubscribeOrders = null;
let unsubscribeReviews = null;
let countdownInterval = null;
let currentSlideIndex = 0;
let slideInterval = null;
let isDataLoaded = false;

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
// 3. نظام العداد التنازلي والسلايدر
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
  const track = document.getElementById('sliderTrack');
  const dotsContainer = document.getElementById('sliderDots');
  if (!track || !dotsContainer) return;

  track.replaceChildren();
  dotsContainer.replaceChildren();

  const slides = storeState.slides && storeState.slides.length > 0 ? storeState.slides : [
    { title: "B.n Store العروض الكبرى", desc: "أفضل أسعار شحن الألعاب والخدمات الرقمية", imgUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200" }
  ];

  slides.forEach((slide, idx) => {
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
  if (slides.length > 1) {
    slideInterval = setInterval(() => {
      currentSlideIndex = (currentSlideIndex + 1) % slides.length;
      updateSliderPosition();
    }, 4500);
  }
};

const updateSliderPosition = () => {
  const track = document.getElementById('sliderTrack');
  const dots = document.querySelectorAll('.slider-dot');
  if (!track) return;
  track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlideIndex));
};

document.getElementById('nextSlideBtn')?.addEventListener('click', () => {
  const slides = storeState.slides.length > 0 ? storeState.slides : [1];
  currentSlideIndex = (currentSlideIndex + 1) % slides.length;
  updateSliderPosition();
});
document.getElementById('prevSlideBtn')?.addEventListener('click', () => {
  const slides = storeState.slides.length > 0 ? storeState.slides : [1];
  currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
  updateSliderPosition();
});

// ==========================================
// 4. التصنيفات وعرض المنتجات + Skeletons
// ==========================================
window.renderCategoriesBar = () => {
  const bar = document.getElementById('categoriesBar');
  const selectCat = document.getElementById('newProdCat');
  
  if (bar) {
    bar.replaceChildren();
    const allBtn = document.createElement('button');
    allBtn.className = 'category-btn active';
    allBtn.dataset.cat = 'all';
    allBtn.textContent = '⚡ الكل';
    allBtn.onclick = (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      window.renderProducts();
    };
    bar.appendChild(allBtn);
  }

  if(selectCat) selectCat.replaceChildren();

  const cats = storeState.categories || [];
  cats.forEach(c => {
    if (bar) {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.dataset.cat = c.id;
      btn.textContent = c.name;
      btn.onclick = (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        window.renderProducts();
      };
      bar.appendChild(btn);
    }
    if(selectCat) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      selectCat.appendChild(opt);
    }
  });
};

window.renderSkeletons = () => {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill().map(() => `
    <div class="skeleton-card skeleton">
      <div class="skel-img skeleton" style="background: rgba(255,255,255,0.05);"></div>
      <div class="skel-title skeleton" style="background: rgba(255,255,255,0.05);"></div>
      <div class="skel-desc skeleton" style="background: rgba(255,255,255,0.05);"></div>
      <div class="skel-price skeleton" style="background: rgba(255,255,255,0.05);"></div>
      <div class="skel-btn skeleton" style="background: rgba(255,255,255,0.05);"></div>
    </div>
  `).join('');
};

window.renderProducts = () => {
  const grid = document.getElementById('productGrid');
  const currencySelect = document.getElementById('currencySelect');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  if(!grid || !currencySelect) return;

  if (!isDataLoaded) return window.renderSkeletons();

  const currency = currencySelect.value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  const searchVal = searchInput?.value.trim().toLowerCase() || '';
  const sortVal = sortSelect?.value || 'default';
  
  grid.replaceChildren();
  
  const activeCatBtn = document.querySelector('.category-btn.active');
  const currentCategory = activeCatBtn ? activeCatBtn.dataset.cat : 'all';

  let filtered = storeState.products.filter(prod => {
    if (currentCategory !== 'all' && prod.category !== currentCategory) return false;
    if (searchVal && !String(prod.title).toLowerCase().includes(searchVal)) return false;
    return true;
  });

  // فلتر الترتيب
  if (sortVal === 'price_asc') filtered.sort((a, b) => a.price - b.price);
  if (sortVal === 'price_desc') filtered.sort((a, b) => b.price - a.price);

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-products-msg" style="padding: 60px 20px;"><div style="font-size:40px; margin-bottom:10px;">🔍</div><p>لا توجد منتجات مطابقة حالياً.</p></div>';
    return;
  }

  filtered.forEach(prod => {
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
    const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
    const isWished = storeState.wishlist.includes(prod.id);
    
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = (e) => {
      if(e.target.classList.contains('wishlist-icon-btn')) return;
      window.openProductDetails(prod.id);
    };
    
    card.innerHTML = `
      <div style="position:relative;">
        <button type="button" class="wishlist-icon-btn ${isWished ? 'active' : ''}" onclick="window.toggleWishlist('${prod.id}', event)">
          ${isWished ? '❤️' : '🤍'}
        </button>
        <span class="product-badge">${sanitizeText(prod.badge)}</span>
        <div class="product-img" style="background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText)}</div>
        <h3 class="product-title">${sanitizeText(prod.title)}</h3>
        <p class="product-desc">${sanitizeText(prod.desc).substring(0, 60)}...</p>
      </div>
      <div>
        <div class="product-price-box">
          ${convertedOld ? `<span class="old-price">${convertedOld}${currency}</span>` : ''}
          <span class="product-price">${convertedPrice} ${currency}</span>
        </div>
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'}" ${inStock ? '' : 'disabled'}>
          ${inStock ? 'عرض التفاصيل' : 'نفذت الكمية'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
};

const showView = (viewName) => {
  const homeView = document.getElementById('homeView');
  const productDetailsView = document.getElementById('productDetailsView');
  if (homeView) homeView.style.display = viewName === 'home' ? 'block' : 'none';
  if (productDetailsView) productDetailsView.style.display = viewName === 'details' ? 'block' : 'none';
  if (viewName === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('logoBtn')?.addEventListener('click', () => showView('home'));
document.getElementById('backToHomeBtn')?.addEventListener('click', () => showView('home'));
document.getElementById('sortSelect')?.addEventListener('change', window.renderProducts);

// ==========================================
// 🌟 5. المفضلة وتفاصيل المنتج
// ==========================================
window.toggleWishlist = (prodId, event) => {
  if (event) event.stopPropagation();
  let wl = storeState.wishlist;
  if (wl.includes(prodId)) {
    wl = wl.filter(id => id !== prodId);
    window.showToast('تم الإزالة من المفضلة 💔', 'normal');
  } else {
    wl.push(prodId);
    window.showToast('تم الإضافة للمفضلة ❤️', 'success');
  }
  storeState.wishlist = wl;
  localStorage.setItem('bn_store_wishlist', JSON.stringify(wl));
  window.renderProducts();
  window.updateDetailWishlistBtn();
  if(document.getElementById('userWishlistSection')?.style.display === 'block') window.renderUserWishlist();
};

window.updateDetailWishlistBtn = () => {
  const btn = document.getElementById('toggleWishlistBtn');
  if(!btn || !currentProductId) return;
  const isWished = storeState.wishlist.includes(currentProductId);
  btn.textContent = isWished ? '❤️' : '🤍';
  btn.style.color = isWished ? 'var(--danger)' : '#fff';
  btn.style.borderColor = isWished ? 'var(--danger)' : 'var(--border-color)';
};

document.getElementById('toggleWishlistBtn')?.addEventListener('click', () => {
  if (currentProductId) window.toggleWishlist(currentProductId);
});

window.openProductDetails = (id) => {
  const prod = storeState.products.find(p => p.id === id);
  if (!prod) return;
  
  currentProductId = id;
  window.updateDetailWishlistBtn();

  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
  const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
  const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);

  document.getElementById('detailTitle').textContent = prod.title;
  document.getElementById('detailPrice').textContent = `${convertedPrice} ${currency}`;
  document.getElementById('detailOldPrice').textContent = convertedOld ? `${convertedOld} ${currency}` : '';
  document.getElementById('detailBadge').textContent = prod.badge;
  
  const descContainer = document.getElementById('detailDescContainer');
  if (descContainer) {
    descContainer.replaceChildren();
    const rawDesc = prod.desc || '';
    const descLines = rawDesc.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (descLines.length > 1 || (descLines.length === 1 && descLines[0].startsWith('-'))) {
      const ul = document.createElement('ul');
      ul.style.cssText = 'padding-right: 20px; line-height: 1.8; color: var(--text-muted);';
      descLines.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line.replace(/^[-*•]\s*/, '');
        ul.appendChild(li);
      });
      descContainer.appendChild(ul);
    } else {
      const p = document.createElement('p');
      p.textContent = rawDesc;
      p.style.cssText = 'color: var(--text-muted); line-height: 1.8;';
      descContainer.appendChild(p);
    }
  }
  
  const imgBox = document.getElementById('detailImageBox');
  if(imgBox) {
    if(prod.imgUrl) { imgBox.style.backgroundImage = `url('${prod.imgUrl}')`; imgBox.style.border = 'none'; imgBox.textContent = ''; }
    else { imgBox.style.backgroundImage = 'none'; imgBox.textContent = prod.imgText || prod.title; }
  }

  const stockEl = document.getElementById('detailStock');
  const buyBtn = document.getElementById('detailBuyBtn');
  
  if (stockEl && buyBtn) {
    if (inStock) {
      stockEl.textContent = (prod.stockQuantity !== undefined) ? `${prod.stockQuantity} قطعة متاحة` : 'متوفر';
      stockEl.style.color = 'var(--success)';
      buyBtn.textContent = 'إتمام الشراء الآن';
      buyBtn.disabled = false;
      buyBtn.classList.remove('out-of-stock-badge');
    } else {
      stockEl.textContent = 'نفذت الكمية (Sold Out)';
      stockEl.style.color = 'var(--danger)';
      buyBtn.textContent = 'غير متوفر حالياً';
      buyBtn.disabled = true;
      buyBtn.classList.add('out-of-stock-badge');
    }
  }

  window.loadProductReviews(id);
  showView('details');
};

const updateCheckoutPriceDisplay = () => {
  if(!currentProductId) return;
  const prod = storeState.products.find(p => p.id === currentProductId);
  if(!prod) return;
  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  
  let price = prod.price * rate;
  if (activeDiscount > 0) price = price - (price * (activeDiscount / 100));
  const finalPrice = price.toFixed(currency === 'EGP' ? 0 : 2);
  const discountText = activeDiscount > 0 ? ` (بعد خصم ${activeDiscount}%)` : '';
  const selectedProductInput = document.getElementById('selectedProduct');
  if(selectedProductInput) selectedProductInput.value = `${prod.title} - (${finalPrice} ${currency})${discountText}`;
};

window.loadProductReviews = (prodId) => {
  if (unsubscribeReviews) unsubscribeReviews();
  const reviewsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
  const q = query(reviewsRef, where('productId', '==', prodId));
  
  unsubscribeReviews = onSnapshot(q, (snap) => {
    const list = document.getElementById('productReviewsList');
    if (!list) return;
    list.replaceChildren();

    const revs = [];
    snap.forEach(d => revs.push({ id: d.id, ...d.data() }));
    revs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const detailBadge = document.getElementById('detailBadge');
    if (revs.length > 0) {
      const totalRating = revs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
      const avgRating = (totalRating / revs.length).toFixed(1);
      if(detailBadge) detailBadge.textContent = `⭐ ${avgRating} (${revs.length} تقييم)`;
    }

    if (!revs.length) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">لا توجد تقييمات لهذا المنتج حتى الآن. كن أول المقيّمين!</p>';
      return;
    }

    revs.forEach(r => {
      const revBox = document.createElement('div');
      revBox.style.cssText = 'background: #14141d; border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; position: relative;';
      const stars = '⭐'.repeat(Number(r.rating) || 5);
      const deleteBtnStr = checkIsAdmin() ? `<button onclick="window.deleteReview('${r.id}')" style="position:absolute; left:10px; top:10px; background:var(--danger); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; z-index:10;">حذف 🗑️</button>` : '';
      
      revBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-left: ${checkIsAdmin() ? '50px' : '0'};">
          <strong style="color: var(--accent-neon);">${sanitizeText(r.userName || 'مستخدم')} <span style="font-size:10px; color:var(--text-muted); font-weight:normal; margin-right:5px;">- ${formatDate(r.createdAt)}</span></strong>
          <span>${stars}</span>
        </div>
        <p style="color: var(--text-main); line-height: 1.5;">${sanitizeText(r.comment)}</p>
        ${deleteBtnStr}
      `;
      list.appendChild(revBox);
    });
  });
};

window.deleteReview = async (reviewId) => {
  if (!checkIsAdmin() || !confirm('متأكد إنك عايز تحذف التقييم ده؟')) return;
  try { 
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reviews', reviewId)); 
    window.showToast('تم حذف التقييم بنجاح', 'success'); 
  } catch (e) { window.showToast('فشل حذف التقييم', 'error'); }
};

const updatePaymentInfoBox = () => {
  const methodSelect = document.getElementById('paymentMethod');
  if (!methodSelect) return;
  const method = methodSelect.value;
  const payments = storeState.payments || {};
  let targetVal = "";

  if (method.includes('vodafone') || method === 'vodafone') targetVal = payments.vodafone || "رقم فودافون كاش غير مضاف حالياً";
  else if (method.includes('instapay') || method === 'instapay') targetVal = payments.instapay || "حساب إنستا باي غير مضاف حالياً";
  else if (method.includes('orange') || method === 'orange') targetVal = payments.orange || payments.vodafone || "رقم أورنج كاش غير مضاف حالياً";
  else if (method.includes('crypto') || method === 'crypto') targetVal = payments.crypto || "عنوان محفظة الكريبتو غير مضاف حالياً";
  else targetVal = "اختر وسيلة دفع صحيحة";

  const addressDisplay = document.getElementById('paymentAddressDisplay');
  if (addressDisplay) addressDisplay.textContent = targetVal;
};

// ==========================================
// 6. الأحداث والشراء
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  window.renderSkeletons(); // إظهار السكيلتون في البداية
  
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.addEventListener('input', window.renderProducts);

  const currencySelectEl = document.getElementById('currencySelect');
  if (currencySelectEl) currencySelectEl.addEventListener('change', window.renderProducts);
  
  const paymentMethodEl = document.getElementById('paymentMethod');
  if (paymentMethodEl) paymentMethodEl.addEventListener('change', updatePaymentInfoBox);

  // معاينة الإيصال وتصفيرها
  const receiptFileInput = document.getElementById('receiptFileInput');
  const receiptPreview = document.getElementById('receiptPreview');
  if (receiptFileInput && receiptPreview) {
    receiptFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { receiptPreview.src = ev.target.result; receiptPreview.style.display = 'block'; };
        reader.readAsDataURL(file);
      } else {
        receiptPreview.style.display = 'none'; receiptPreview.src = '';
      }
    });
  }

  const copyBtn = document.getElementById('copyBtnText');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const addressText = document.getElementById('paymentAddressDisplay')?.textContent;
      if (addressText && addressText.includes('غير مضاف')) return window.showToast('لا يوجد رقم للنسخ حالياً', 'error');
      if (addressText) {
        navigator.clipboard.writeText(addressText).then(() => window.showToast('📋 تم نسخ رقم الحساب بنجاح!', 'success'));
      }
    });
  }

  const submitReviewBtn = document.getElementById('submitReviewBtn');
  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', async () => {
      if (!currentUserProfile) return window.showToast('يجب تسجيل الدخول لإضافة تقييم!', 'error');
      if (!currentProductId) return;
      const commentInput = document.getElementById('reviewCommentText');
      const ratingInput = document.getElementById('reviewRating');
      const comment = sanitizeText(commentInput.value);
      const rating = ratingInput.value;
      if (!comment) return window.showToast('اكتب تعليقاً أولاً!', 'error');

      const originalBtnText = submitReviewBtn.textContent;
      submitReviewBtn.textContent = 'جاري الإرسال ⏳...';
      submitReviewBtn.disabled = true;

      try {
        const reviewRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'reviews'));
        await setDoc(reviewRef, { productId: currentProductId, uid: currentUserProfile.uid, userName: currentUserProfile.name, rating: Number(rating), comment, createdAt: serverTimestamp() });
        commentInput.value = '';
        window.showToast('⭐ تم إضافة تقييمك بنجاح!', 'success');
      } catch (e) { window.showToast('حدث خطأ أثناء إرسال التقييم', 'error'); }
      finally { submitReviewBtn.textContent = originalBtnText; submitReviewBtn.disabled = false; }
    });
  }

  const detailBuyBtn = document.getElementById('detailBuyBtn');
  if (detailBuyBtn) {
    detailBuyBtn.addEventListener('click', () => {
      if(currentProductId) {
        activeDiscount = 0; 
        document.getElementById('promoCodeInput').value = '';
        document.getElementById('promoMsg').textContent = '';
        document.getElementById('receiptPreview').style.display = 'none'; // تصفير المعاينة
        document.getElementById('receiptPreview').src = '';
        document.getElementById('checkoutForm').reset();
        
        updateCheckoutPriceDisplay();
        updatePaymentInfoBox();
        document.getElementById('checkoutModal').style.display = 'flex';
      }
    });
  }

  const applyPromoBtn = document.getElementById('applyPromoBtn');
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener('click', () => {
      const input = document.getElementById('promoCodeInput').value.trim();
      const msgEl = document.getElementById('promoMsg');
      if (!input) return;
      if (storeState.promoCode && input.toLowerCase() === storeState.promoCode.toLowerCase() && storeState.promoDiscount > 0) {
        activeDiscount = storeState.promoDiscount;
        msgEl.textContent = `تم تطبيق خصم ${activeDiscount}% بنجاح! ✅`;
        msgEl.style.color = 'var(--success)';
      } else {
        activeDiscount = 0;
        msgEl.textContent = 'كود الخصم غير صحيح أو منتهي! ❌';
        msgEl.style.color = 'var(--danger)';
      }
      updateCheckoutPriceDisplay();
    });
  }

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));
  });

  // تبويبات حساب العميل (الطلبات والمفضلة)
  document.getElementById('tabBtnOrders')?.addEventListener('click', () => {
    document.getElementById('tabBtnOrders').classList.add('active');
    document.getElementById('tabBtnWishlist').classList.remove('active');
    document.getElementById('userOrdersSection').style.display = 'block';
    document.getElementById('userWishlistSection').style.display = 'none';
  });
  
  document.getElementById('tabBtnWishlist')?.addEventListener('click', () => {
    document.getElementById('tabBtnWishlist').classList.add('active');
    document.getElementById('tabBtnOrders').classList.remove('active');
    document.getElementById('userWishlistSection').style.display = 'block';
    document.getElementById('userOrdersSection').style.display = 'none';
    window.renderUserWishlist();
  });

  const loginBtnNav = document.getElementById('loginBtnNav');
  if (loginBtnNav) {
    loginBtnNav.addEventListener('click', () => {
      if(currentUserProfile) document.getElementById('userAccountModal').style.display = 'flex'; 
      else document.getElementById('authModal').style.display = 'flex'; 
    });
  }

  // المصادقة
  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      document.getElementById('authModal').style.display = 'none';
      window.showToast('تم تسجيل الدخول بنجاح!', 'success');
    } catch (e) { window.showToast('البيانات غير صحيحة!', 'error'); }
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) await signInWithRedirect(auth, provider);
      else {
        const result = await signInWithPopup(auth, provider);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid), {
          uid: result.user.uid, name: result.user.displayName || 'مستخدم جوجل', email: result.user.email, createdAt: serverTimestamp()
        }, { merge: true });
        document.getElementById('authModal').style.display = 'none';
        window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      }
    } catch (e) { if (e.code !== 'auth/popup-closed-by-user') window.showToast('فشل تسجيل الدخول بـ Google', 'error'); }
  });
  
  document.getElementById('showRegisterBtn')?.addEventListener('click', () => {
    document.getElementById('authViewLogin').style.display = 'none';
    document.getElementById('authViewRegister').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'إنشاء حساب جديد';
  });
  document.getElementById('showLoginBtn')?.addEventListener('click', () => {
    document.getElementById('authViewLogin').style.display = 'block';
    document.getElementById('authViewRegister').style.display = 'none';
    document.getElementById('authModalTitle').textContent = 'تسجيل الدخول';
  });

  document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    if (!name || !email || !pass) return window.showToast('أكمل جميع البيانات!', 'error');
    if (pass !== document.getElementById('regPassConfirm').value) return window.showToast('كلمة المرور غير متطابقة!', 'error');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { uid: cred.user.uid, name, email, createdAt: serverTimestamp() });
      document.getElementById('authModal').style.display = 'none';
      window.showToast('تم إنشاء الحساب بنجاح!', 'success');
    } catch (e) { window.showToast('خطأ! ربما البريد مستخدم مسبقاً.', 'error'); }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await signOut(auth); document.getElementById('userAccountModal').style.display = 'none'; window.showToast('تم تسجيل الخروج!', 'success'); } catch (e) {}
  });

  // إرسال الطلب + زر التأكيد الذكي
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUserProfile || !currentProductId) return;

      const prod = storeState.products.find(p => p.id === currentProductId);
      if (!prod || !prod.inStock || prod.stockQuantity <= 0) return window.showToast('الكمية نفذت!', 'error');

      const paymentMethod = document.getElementById('paymentMethod').value;
      const senderInfo = sanitizeText(document.getElementById('senderInfo').value);
      const customerData = sanitizeText(document.getElementById('customerData').value);
      const receiptFileInput = document.getElementById('receiptFileInput');
      if (!receiptFileInput || !receiptFileInput.files[0]) return window.showToast('برجاء إرفاق صورة إيصال التحويل!', 'error');

      const confirmBtn = document.getElementById('confirmOrderBtn');
      const originalBtnText = confirmBtn.textContent;
      confirmBtn.textContent = 'جاري الإرسال ⏳...';
      confirmBtn.disabled = true;

      try {
        const receiptBase64 = await compressImage(receiptFileInput.files[0]);
        const currency = document.getElementById('currencySelect').value;
        const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
        let finalPrice = prod.price * rate;
        if (activeDiscount > 0) finalPrice = finalPrice - (finalPrice * (activeDiscount / 100));
        finalPrice = Number(finalPrice.toFixed(currency === 'EGP' ? 0 : 2));

        await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'orders')), {
          uid: currentUserProfile.uid, userEmail: currentUserProfile.email, productId: prod.id, productName: prod.title,
          priceEGP: prod.price, finalPrice: finalPrice, currency: currency, discountApplied: activeDiscount,
          promoCodeUsed: activeDiscount > 0 ? document.getElementById('promoCodeInput').value.trim() : "",
          paymentMethod, senderInfo, customerData, receiptImage: receiptBase64, status: 'pending', deliveredCode: '', createdAt: serverTimestamp()
        });

        document.getElementById('receiptPreview').style.display = 'none';
        document.getElementById('receiptPreview').src = '';
        document.getElementById('checkoutModal').style.display = 'none';
        checkoutForm.reset();
        activeDiscount = 0; 
        window.showToast('🎉 تم إرسال طلبك بنجاح! راجع "حسابي" لمتابعة الحالة.', 'success');
      } catch (err) {
        window.showToast('حدث خطأ أثناء إرسال الطلب، تأكد من اتصالك.', 'error');
      } finally {
        confirmBtn.textContent = originalBtnText; confirmBtn.disabled = false;
      }
    });
  }
});

// ==========================================
// 7. المزامنة والسحب
// ==========================================
const initApp = () => {
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = [];
    snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    storeState.products = products;
    isDataLoaded = true; // تم التحميل، نوقف الـ Skeleton
    window.renderProducts();
    if(checkIsAdmin()) window.renderAdminProducts();
  });

  onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      storeState.whatsapp = data.whatsapp || "201200898990";
      if(data.rates) storeState.rates = data.rates; 
      storeState.payments = data.payments || { instapay: "", vodafone: "", orange: "", crypto: "" };
      storeState.bannerAr = data.bannerAr || "⚡ عروض الكريسماس والخدمات الرقمية!";
      storeState.bannerExpiry = data.bannerExpiry || ""; 
      storeState.promoCode = data.promoCode || "";
      storeState.promoDiscount = data.promoDiscount || 0;
      if(data.slides) storeState.slides = data.slides;
      if(data.categories) storeState.categories = data.categories;

      const flashBannerText = document.getElementById('flashBannerText');
      if(flashBannerText) flashBannerText.textContent = storeState.bannerAr;
      
      initCountdown(storeState.bannerExpiry); 
      updatePaymentInfoBox();
      window.renderPromoSlider();
      window.renderCategoriesBar();

      const whatsappBtn = document.getElementById('whatsappBtn');
      if(whatsappBtn) whatsappBtn.href = `https://wa.me/${storeState.whatsapp}?text=استفسار:`;
      
      if(isDataLoaded) window.renderProducts(); 
      if(checkIsAdmin()) { window.loadAdminData(); window.renderAdminStats(); }
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtnNav');
    if(!loginBtn) return;
    
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'مستخدم' };
      loginBtn.textContent = `👤 حسابي`;
      loginBtn.style.color = 'var(--accent-neon)';
      document.getElementById('accountUserName').textContent = currentUserProfile.name;

      let adminBtnInModal = document.getElementById('adminBtnInModal');
      if (checkIsAdmin()) {
        window.injectAdminDashboard();
        window.loadAdminData();
        window.renderAdminStats();
        if (!adminBtnInModal) {
           const accountModalContent = document.querySelector('#userAccountModal .modal-content');
           if(accountModalContent) {
             const btn = document.createElement('button');
             btn.id = 'adminBtnInModal';
             btn.className = 'submit-btn';
             btn.style.cssText = 'width:100%; margin-bottom:15px; background:#0099ff; color:#fff; font-size:16px; box-shadow:0 0 15px rgba(0,153,255,0.4);';
             btn.innerHTML = '⚙️ الدخول للوحة تحكم الإدارة';
             btn.onclick = () => {
                document.getElementById('userAccountModal').style.display = 'none';
                document.getElementById('adminModal').style.display = 'flex';
             };
             accountModalContent.insertBefore(btn, accountModalContent.querySelector('.user-tabs-container'));
           }
        }
      } else { if (adminBtnInModal) adminBtnInModal.remove(); }

      if (unsubscribeOrders) unsubscribeOrders();
      const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      const q = checkIsAdmin() ? query(ordersRef, orderBy('createdAt', 'desc'), limit(200)) : query(ordersRef, where('uid', '==', user.uid));
      
      unsubscribeOrders = onSnapshot(q, snap => {
         const ords = [];
         snap.forEach(d => ords.push({id: d.id, ...d.data()}));
         storeState.orders = ords.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
         window.renderUserOrders();
         if(checkIsAdmin()) { window.renderAdminOrders(); window.renderAdminStats(); }
      });

    } else {
      currentUserProfile = null;
      loginBtn.textContent = '👤 تسجيل الدخول';
      loginBtn.style.color = '';
      if (document.getElementById('adminBtnInModal')) document.getElementById('adminBtnInModal').remove();
      if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
      storeState.orders = [];
      window.renderUserOrders();
    }
  });
};

window.renderUserOrders = () => {
  const list = document.getElementById('userOrdersList');
  if (!list) return;
  list.replaceChildren();
  const myOrders = storeState.orders.filter(o => currentUserProfile && o.uid === currentUserProfile.uid);
  if (!myOrders.length) { list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد طلبات سابقة حتى الآن.</p>'; return; }
  
  myOrders.forEach(o => {
     const div = document.createElement('div');
     div.className = 'my-orders-box';
     const statusColor = o.status === 'completed' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--danger)' : '#ffcc00';
     const statusAr = o.status === 'completed' ? 'مكتمل ✅' : o.status === 'cancelled' ? 'ملغي ❌' : 'قيد المراجعة ⏳';
     div.innerHTML = `
       <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
         <strong>${o.productName} (${o.finalPrice} ${o.currency || 'EGP'})</strong>
         <span style="color:${statusColor}; font-weight:bold; font-size:13px;">${statusAr}</span>
       </div>
       <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${formatDate(o.createdAt)}</div>
       <div style="font-size:12px; color:var(--text-muted);">رقم الاستلام: ${o.customerData} | الدفع: ${o.paymentMethod}</div>
       ${o.status === 'completed' && o.deliveredCode ? `<div class="delivered-code-box">🎁 كود التفعيل: <strong>${o.deliveredCode}</strong></div>` : ''}
     `;
     list.appendChild(div);
  });
};

window.renderUserWishlist = () => {
  const grid = document.getElementById('userWishlistGrid');
  if (!grid) return;
  grid.replaceChildren();
  
  const wishedProducts = storeState.products.filter(p => storeState.wishlist.includes(p.id));
  if(!wishedProducts.length) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:20px;">لا توجد منتجات في المفضلة.</p>'; return; }

  const currency = document.getElementById('currencySelect').value;
  const rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);

  wishedProducts.forEach(prod => {
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.padding = '15px';
    card.onclick = (e) => {
      if(e.target.classList.contains('wishlist-icon-btn')) return;
      document.getElementById('userAccountModal').style.display = 'none';
      window.openProductDetails(prod.id);
    };
    card.innerHTML = `
      <div style="position:relative;">
        <button type="button" class="wishlist-icon-btn active" style="top:5px; left:5px; width:25px; height:25px; font-size:12px;" onclick="window.toggleWishlist('${prod.id}', event)">❤️</button>
        <div class="product-img" style="height:100px; background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText)}</div>
        <h3 class="product-title" style="font-size:14px;">${sanitizeText(prod.title)}</h3>
        <div class="product-price" style="font-size:16px;">${convertedPrice} ${currency}</div>
      </div>
    `;
    grid.appendChild(card);
  });
};

// ==========================================
// 8. لوحة التحكم للإدارة
// ==========================================
window.initAdminTabs = () => {
  const tabBtns = document.querySelectorAll('#adminTabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#adminDashboardView .tab-content').forEach(c => c.classList.remove('active-tab'));
      document.getElementById(btn.dataset.target).classList.add('active-tab');
    });
  });
};

window.copyCustomerData = (text) => navigator.clipboard.writeText(text).then(() => window.showToast('تم نسخ بيانات العميل 📋', 'success'));

window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer');
  if(!container) return;
  container.innerHTML = `
    <div id="tab-dashboard" class="tab-content active-tab">
      <div class="admin-section" style="border-color: var(--accent-neon);"><h4 style="color: var(--accent-neon); margin-bottom: 15px;">📊 إحصائيات المبيعات السريعة</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" id="adminStatsGrid"></div></div>
      <div class="admin-section"><h4>⚡ إعدادات شريط العروض والعداد التنازلي</h4><div class="form-group"><label>نص الإعلان (البانر)</label><input type="text" id="admBannerAr"></div><div class="form-group"><label>موعد انتهاء العرض (التاريخ والوقت)</label><input type="datetime-local" id="admBannerExpiry" style="background:#0b0b10; color:#fff; padding:10px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة سلايدر البانرات الإعلانية</h4><div class="form-group"><label>عنوان البانر</label><input type="text" id="slideTitleInput"></div><div class="form-group"><label>وصف البانر</label><input type="text" id="slideDescInput"></div><div class="form-group"><label>صورة البانر</label><input type="file" id="slideImgFileInput" accept="image/*" style="background:#0b0b10; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div><button type="button" class="submit-btn" id="saveSlideBtn" style="width:100%; margin-bottom:15px;" onclick="window.addSlide()">➕ إضافة بانر جديد للسلايدر</button><div id="adminSlidesList"></div></div>
    </div>
    <div id="tab-orders" class="tab-content">
      <div class="admin-section"><h4>⏳ طلبات جديدة (تحتاج إجراء)</h4><div id="adminOrdersPending" style="max-height:350px; overflow-y:auto;"></div></div>
      <div class="admin-section" style="margin-top: 20px; opacity: 0.9;"><h4>🗄️ أرشيف الطلبات (مكتمل / ملغي)</h4><div id="adminOrdersArchived" style="max-height:300px; overflow-y:auto;"></div></div>
    </div>
    <div id="tab-products" class="tab-content">
      <div class="admin-section" id="productFormSection">
        <h4>📦 إضافة أو تعديل منتج</h4>
        <div class="grid-2">
          <div class="form-group"><label>اسم المنتج</label><input type="text" id="newProdTitle"></div>
          <div class="form-group"><label>السعر الأساسي (EGP)</label><input type="number" id="newProdPrice"></div>
          <div class="form-group"><label>السعر المشطوب (EGP)</label><input type="number" id="newProdOldPrice"></div>
          <div class="form-group"><label>القسم</label><select id="newProdCat"></select></div>
          <div class="form-group"><label>الكمية المتاحة (قطع)</label><input type="number" id="newProdStock"></div>
          <div class="form-group"><label>الشارة (Badge)</label><input type="text" id="newProdBadge" placeholder="تسليم فوري"></div>
        </div>
        <div class="form-group"><label>صورة المنتج</label><input type="file" id="newProdImgFileInput" accept="image/*" style="background:#0b0b10; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>وصف المنتج (نقطة لكل سطر)</label><textarea id="newProdDesc" rows="4"></textarea></div>
        <button type="button" class="submit-btn" id="saveProductBtn" style="width:100%;" onclick="window.saveProduct()">➕ إضافة المنتج</button>
        <button type="button" class="cancel-btn" id="cancelEditBtn" style="width:100%; margin-top:10px; display:none;" onclick="window.cancelEdit()">إلغاء التعديل</button>
      </div>
      <div class="admin-section"><h4>📦 المنتجات الحالية</h4><div id="adminProductsList" style="max-height:300px; overflow-y:auto;"></div></div>
      <div class="admin-section"><h4>🏷️ إدارة أقسام المتجر</h4><div class="grid-2"><div class="form-group"><label>معرف القسم</label><input type="text" id="catIdInput"></div><div class="form-group"><label>اسم القسم</label><input type="text" id="catNameInput"></div></div><button type="button" class="submit-btn" style="width:100%; margin-bottom:15px;" onclick="window.addCategory()">➕ إضافة قسم جديد</button><div id="adminCategoriesList"></div></div>
    </div>
    <div id="tab-settings" class="tab-content">
      <div class="admin-section"><h4>🎁 إعدادات كود الخصم</h4><div class="grid-2"><div class="form-group"><label>كود الخصم</label><input type="text" id="admPromoCode"></div><div class="form-group"><label>نسبة الخصم (%)</label><input type="number" id="admPromoDiscount"></div></div></div>
      <div class="admin-section"><h4>💱 أسعار الصرف</h4><div class="grid-2"><div class="form-group"><label>SAR</label><input type="number" step="0.001" id="admRateSAR"></div><div class="form-group"><label>AED</label><input type="number" step="0.001" id="admRateAED"></div><div class="form-group"><label>USD</label><input type="number" step="0.0001" id="admRateUSD"></div></div></div>
      <div class="admin-section"><h4>📢 إعدادات الدفع والواتساب</h4><div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div><div class="grid-2"><div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div><div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div><div class="form-group"><label>USDT</label><input type="text" id="admCrypto"></div></div><button type="button" id="saveConfigBtn" class="submit-btn" style="width:100%; margin-top:15px;" onclick="window.saveGeneralSettings()">💾 حفظ كل إعدادات المتجر</button></div>
    </div>
  `;
  window.initAdminTabs();
  window.renderCategoriesBar();
};

window.renderAdminStats = () => {
  const statsGrid = document.getElementById('adminStatsGrid');
  if (!statsGrid) return;
  const orders = storeState.orders || [];
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  let totalRevenue = 0;
  orders.forEach(o => { if (o.status === 'completed') totalRevenue += Number(o.finalPrice || 0); });

  statsGrid.innerHTML = `
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--accent-neon);">${totalOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">إجمالي الطلبات</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: #ffcc00;">${pendingOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معلقة ⏳</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--success);">${completedOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات مكتملة ✅</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 16px; font-weight: bold; color: var(--accent-neon);">${totalRevenue.toFixed(0)} EGP</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">إجمالي المبيعات 💰</div></div>
  `;
};

window.renderAdminOrders = () => {
  const pendingList = document.getElementById('adminOrdersPending');
  const archivedList = document.getElementById('adminOrdersArchived');
  if (!pendingList || !archivedList) return;
  pendingList.replaceChildren(); archivedList.replaceChildren();

  const orders = storeState.orders || [];
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const archivedOrders = orders.filter(o => o.status !== 'pending');

  if (!pendingOrders.length) pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">لا توجد طلبات جديدة حالياً.</p>';
  if (!archivedOrders.length) archivedList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">الأرشيف فارغ.</p>';

  const createOrderHTML = (o, isArchived) => {
    const discountBadge = o.discountApplied > 0 ? `<span style="color:var(--success); font-weight:bold;">[خصم ${o.discountApplied}% بكود ${o.promoCodeUsed}]</span>` : '';
    const receiptView = o.receiptImage ? `<div style="margin-top:8px;"><a href="${o.receiptImage}" target="_blank" style="color:var(--accent-neon); text-decoration:underline; font-weight:bold; display:inline-flex; align-items:center; gap:5px;">📄 عرض صورة إيصال التحويل</a></div>` : '';
    const customerDataRow = `<strong style="color:var(--accent-neon);">بيانات الاستلام:</strong> <span style="user-select:all;">${o.customerData}</span> <button onclick="window.copyCustomerData('${o.customerData}')" style="background:var(--accent-neon); color:#000; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer; margin-right:5px;">نسخ</button>`;

    let html = `<div class="admin-item-row" style="flex-direction:column; align-items:flex-start; position:relative;"><span style="position:absolute; top:10px; left:10px; font-size:11px; color:var(--text-muted);">${formatDate(o.createdAt)}</span><div style="width:100%; margin-bottom:8px; line-height:1.6; padding-left: 100px;"><strong>الطلب:</strong> ${o.productName} | <strong>الإيميل:</strong> ${o.userEmail}<br><small><strong>السعر:</strong> <span style="color:var(--accent-neon);">${o.finalPrice} ${o.currency || 'EGP'}</span> ${discountBadge}</small><br><small><strong>المحفظة المحول منها:</strong> ${o.senderInfo} <br> ${customerDataRow}</small><br>${receiptView}<small style="display:block; margin-top:5px;"><strong>الحالة:</strong> <span style="color:${o.status==='completed'?'var(--success)':o.status==='cancelled'?'var(--danger)':'#ffcc00'}">${o.status}</span></small>${isArchived && o.deliveredCode ? `<small style="display:block; color:var(--success);"><strong>الكود المُسلم:</strong> ${o.deliveredCode}</small>` : ''}</div>`;
    if (!isArchived) html += `<div style="display:flex; gap:8px; width:100%; flex-wrap:wrap; margin-top:5px; border-top:1px dashed var(--border-color); padding-top:10px;"><input type="text" id="code_${o.id}" placeholder="اكتب كود التفعيل للعميل هنا..." value="${o.deliveredCode || ''}" style="flex:1; padding:8px; border-radius:5px; background:#0b0b10; color:#fff; border:1px solid var(--border-color);"><button class="submit-btn" style="padding:8px 12px; flex:0;" onclick="window.updateOrderStatus('${o.id}', 'completed')">إكمال ✅</button><button class="cancel-btn" style="padding:8px 12px; flex:0; border-color:var(--danger); color:var(--danger);" onclick="window.updateOrderStatus('${o.id}', 'cancelled')">إلغاء ❌</button></div>`;
    html += `</div>`; return html;
  };

  pendingOrders.forEach(o => pendingList.insertAdjacentHTML('beforeend', createOrderHTML(o, false)));
  archivedOrders.forEach(o => archivedList.insertAdjacentHTML('beforeend', createOrderHTML(o, true)));
};

window.updateOrderStatus = async (orderId, status) => {
  const codeInput = document.getElementById(`code_${orderId}`);
  if(!codeInput) return;
  try {
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    if (status === 'cancelled') {
      const order = storeState.orders.find(o => o.id === orderId);
      if (order && order.productId) {
        const prod = storeState.products.find(p => p.id === order.productId);
        if (prod) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { stockQuantity: prod.stockQuantity + 1, inStock: true });
      }
    }
    await updateDoc(orderRef, { status, deliveredCode: codeInput.value, updatedAt: serverTimestamp() });
    window.showToast('تم تحديث الطلب ونقله للأرشيف!', 'success');
  } catch(e) { window.showToast('خطأ في التحديث', 'error'); }
};

window.addSlide = async () => {
  if (!checkIsAdmin()) return;
  const title = document.getElementById('slideTitleInput').value.trim();
  const desc = document.getElementById('slideDescInput').value.trim();
  const fileInput = document.getElementById('slideImgFileInput');
  const btn = document.getElementById('saveSlideBtn');
  
  if (!title || !fileInput || !fileInput.files[0]) return window.showToast('أدخل عنوان البانر واختر صورة!', 'error');

  const origText = btn.textContent; btn.textContent = 'جاري الإضافة ⏳...'; btn.disabled = true;

  try {
    const imgBase64 = await compressImage(fileInput.files[0]);
    const slides = storeState.slides ? [...storeState.slides] : [];
    slides.push({ title, desc, imgUrl: imgBase64 });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true });
    document.getElementById('slideTitleInput').value = ''; document.getElementById('slideDescInput').value = ''; fileInput.value = '';
    window.showToast('🖼️ تم إضافة البانر!', 'success');
  } catch(e) { window.showToast('فشل الإضافة', 'error'); } 
  finally { btn.textContent = origText; btn.disabled = false; }
};

window.deleteSlide = async (index) => {
  if (!checkIsAdmin()) return;
  const slides = [...storeState.slides]; slides.splice(index, 1);
  try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true }); window.showToast('تم حذف البانر', 'success'); } catch(e) {}
};

window.renderAdminSlides = () => {
  const list = document.getElementById('adminSlidesList');
  if(!list) return; list.replaceChildren();
  const slides = storeState.slides || [];
  if(!slides.length) { list.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">لا توجد بانرات.</p>'; return; }
  slides.forEach((s, idx) => {
    const row = document.createElement('div'); row.className = 'admin-item-row';
    row.innerHTML = `<span style="flex:1; font-size:13px;">${s.title}</span><button class="delete-btn" onclick="window.deleteSlide(${idx})">حذف</button>`;
    list.appendChild(row);
  });
};

window.addCategory = async () => {
  if (!checkIsAdmin()) return;
  const id = document.getElementById('catIdInput').value.trim().toLowerCase();
  const name = document.getElementById('catNameInput').value.trim();
  if (!id || !name) return window.showToast('أدخل معرف القسم واسمه!', 'error');
  const categories = storeState.categories ? [...storeState.categories] : [];
  if(categories.some(c => c.id === id)) return window.showToast('القسم موجود مسبقاً!', 'error');
  categories.push({ id, name });
  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { categories }, { merge: true });
    document.getElementById('catIdInput').value = ''; document.getElementById('catNameInput').value = ''; window.showToast('تم إضافة القسم!', 'success');
  } catch(e) {}
};

window.deleteCategory = async (catId) => {
  if (!checkIsAdmin()) return;
  if(['games', 'subs', 'ai', 'software'].includes(catId)) return window.showToast('لا يمكن حذف الأقسام الأساسية!', 'error');
  const categories = storeState.categories.filter(c => c.id !== catId);
  try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { categories }, { merge: true }); window.showToast('تم الحذف', 'success'); } catch(e) {}
};

window.renderAdminCategories = () => {
  const list = document.getElementById('adminCategoriesList');
  if(!list) return; list.replaceChildren();
  const cats = storeState.categories || [];
  cats.forEach(c => {
    const row = document.createElement('div'); row.className = 'admin-item-row';
    const isDefault = ['games', 'subs', 'ai', 'software'].includes(c.id);
    row.innerHTML = `<span style="flex:1; font-size:13px;">${c.name} (${c.id})</span>${!isDefault ? `<button class="delete-btn" onclick="window.deleteCategory('${c.id}')">حذف</button>` : '<span style="font-size:11px;">أساسي</span>'}`;
    list.appendChild(row);
  });
};

window.loadAdminData = () => {
  document.getElementById('admBannerAr').value = storeState.bannerAr || '';
  document.getElementById('admBannerExpiry').value = storeState.bannerExpiry || '';
  document.getElementById('admWhatsapp').value = storeState.whatsapp || '';
  document.getElementById('admInstapay').value = storeState.payments?.instapay || '';
  document.getElementById('admVodafone').value = storeState.payments?.vodafone || '';
  document.getElementById('admCrypto').value = storeState.payments?.crypto || '';
  document.getElementById('admRateSAR').value = storeState.rates.SAR || 0.077;
  document.getElementById('admRateAED').value = storeState.rates.AED || 0.075;
  document.getElementById('admRateUSD').value = storeState.rates.USD || 0.020;
  document.getElementById('admPromoCode').value = storeState.promoCode || '';
  document.getElementById('admPromoDiscount').value = storeState.promoDiscount || 0;
  window.renderAdminProducts(); window.renderAdminOrders(); window.renderAdminSlides(); window.renderAdminCategories(); window.renderAdminStats();
};

window.saveGeneralSettings = async () => {
  if (!checkIsAdmin()) return;
  const btn = document.getElementById('saveConfigBtn');
  const origText = btn.textContent; btn.textContent = 'جاري الحفظ ⏳...'; btn.disabled = true;

  const config = {
    bannerAr: document.getElementById('admBannerAr').value, bannerExpiry: document.getElementById('admBannerExpiry').value, whatsapp: document.getElementById('admWhatsapp').value,
    promoCode: document.getElementById('admPromoCode').value.trim(), promoDiscount: Number(document.getElementById('admPromoDiscount').value) || 0,
    rates: { SAR: Number(document.getElementById('admRateSAR').value) || 0.077, AED: Number(document.getElementById('admRateAED').value) || 0.075, USD: Number(document.getElementById('admRateUSD').value) || 0.020 },
    payments: { instapay: document.getElementById('admInstapay').value, vodafone: document.getElementById('admVodafone').value, crypto: document.getElementById('admCrypto').value }
  };
  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), config, { merge: true });
    window.showToast('💾 تم حفظ الإعدادات بنجاح!', 'success');
  } catch (e) { window.showToast('فشل الحفظ', 'error'); }
  finally { btn.textContent = origText; btn.disabled = false; }
};

window.saveProduct = async () => {
  if (!checkIsAdmin()) return;
  const title = document.getElementById('newProdTitle').value;
  const price = Number(document.getElementById('newProdPrice').value);
  const oldPrice = Number(document.getElementById('newProdOldPrice')?.value) || 0;
  const stockQuantity = Number(document.getElementById('newProdStock')?.value) || 0;
  const category = document.getElementById('newProdCat')?.value || 'games';
  const badge = document.getElementById('newProdBadge')?.value || 'متوفر';
  const desc = document.getElementById('newProdDesc')?.value || '';
  const fileInput = document.getElementById('newProdImgFileInput');
  const btn = document.getElementById('saveProductBtn');

  if (!title || price <= 0) return window.showToast('تأكد من اسم المنتج والسعر!', 'error');

  const origText = btn.textContent; btn.textContent = 'جاري الحفظ ⏳...'; btn.disabled = true;

  try {
    let imgUrl = '';
    if (fileInput && fileInput.files[0]) { imgUrl = await compressImage(fileInput.files[0]); } 
    else if (editingProductId) { const existing = storeState.products.find(p => p.id === editingProductId); if (existing) imgUrl = existing.imgUrl || ''; }

    const prodData = { title, desc, price, oldPrice, category, badge, imgUrl, inStock: stockQuantity > 0, stockQuantity };

    if (editingProductId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProductId), prodData);
      window.showToast('✏️ تم التعديل!', 'success');
    } else {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', Date.now().toString()), prodData);
      window.showToast('📦 تمت الإضافة!', 'success');
    }
    window.cancelEdit();
  } catch (e) { window.showToast('فشل العملية', 'error'); }
  finally { btn.textContent = origText; btn.disabled = false; }
};

window.editProduct = (id) => {
  const p = storeState.products.find(x => x.id === id); if(!p) return;
  document.getElementById('newProdTitle').value = p.title || ''; document.getElementById('newProdPrice').value = p.price || '';
  document.getElementById('newProdOldPrice').value = p.oldPrice || ''; document.getElementById('newProdCat').value = p.category || 'games';
  document.getElementById('newProdStock').value = p.stockQuantity !== undefined ? p.stockQuantity : '';
  document.getElementById('newProdBadge').value = p.badge || ''; document.getElementById('newProdDesc').value = p.desc || '';
  editingProductId = id; document.getElementById('saveProductBtn').innerHTML = '💾 حفظ التعديلات';
  document.getElementById('cancelEditBtn').style.display = 'block'; document.getElementById('productFormSection').scrollIntoView({behavior: 'smooth'});
};

window.cancelEdit = () => {
  editingProductId = null; document.getElementById('saveProductBtn').innerHTML = '➕ إضافة المنتج'; document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('#productFormSection input, #productFormSection textarea').forEach(el => { if(el.id.startsWith('newProd')) el.value = ''; });
};

window.renderAdminProducts = () => {
  const list = document.getElementById('adminProductsList');
  if (!list) return; list.replaceChildren();
  storeState.products.forEach(p => {
    const row = document.createElement('div'); row.className = 'admin-item-row';
    const statusText = p.inStock && p.stockQuantity > 0 ? `متاح ✅ (${p.stockQuantity} قطعة)` : 'نفذت الكمية ⛔';
    row.innerHTML = `<span style="flex:1; line-height:1.6;">${p.title} - ${p.price}EGP <br><small><strong>${statusText}</strong></small></span><div style="display:flex; gap:8px;"><button class="submit-btn" style="padding:6px 12px; font-size:12px; flex:0;" onclick="window.editProduct('${p.id}')">تعديل</button><button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button></div>`;
    list.appendChild(row);
  });
};

window.deleteProduct = async (id) => {
  if (!checkIsAdmin() || !confirm('تأكيد الحذف؟')) return;
  try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); window.showToast('تم الحذف', 'success'); } catch (e) { window.showToast('فشل الحذف', 'error'); }
};

initApp();
