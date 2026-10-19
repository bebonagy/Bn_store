import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
  categories: [ { id: 'games', name: '🎮 ألعاب' }, { id: 'subs', name: '📺 اشتراكات' }, { id: 'ai', name: '✨ ذكاء اصطناعي' }, { id: 'software', name: '💻 برامج' } ],
  wishlist: JSON.parse(localStorage.getItem('bn_store_wishlist')) || [],
  cart: []
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
let adminOrdersLimit = 20; 

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
  track.replaceChildren(); dotsContainer.replaceChildren();

  const slides = storeState.slides && storeState.slides.length > 0 ? storeState.slides : [ { title: "B.n Store العروض الكبرى", desc: "أفضل أسعار شحن الألعاب والخدمات الرقمية", imgUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200" } ];
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
  if (slides.length > 1) { slideInterval = setInterval(() => { currentSlideIndex = (currentSlideIndex + 1) % slides.length; updateSliderPosition(); }, 4500); }
};

const updateSliderPosition = () => {
  const track = document.getElementById('sliderTrack');
  const dots = document.querySelectorAll('.slider-dot');
  if (!track) return;
  track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlideIndex));
};

document.getElementById('nextSlideBtn')?.addEventListener('click', () => { const slides = storeState.slides.length > 0 ? storeState.slides : [1]; currentSlideIndex = (currentSlideIndex + 1) % slides.length; updateSliderPosition(); });
document.getElementById('prevSlideBtn')?.addEventListener('click', () => { const slides = storeState.slides.length > 0 ? storeState.slides : [1]; currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length; updateSliderPosition(); });

let touchStartX = 0, touchEndX = 0;
const sliderTrack = document.getElementById('promoSlider');
sliderTrack?.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
sliderTrack?.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  if (touchEndX < touchStartX - 40) document.getElementById('prevSlideBtn')?.click(); 
  if (touchEndX > touchStartX + 40) document.getElementById('nextSlideBtn')?.click(); 
});

// ==========================================
// 4. التصنيفات وعرض المنتجات
// ==========================================
window.renderCategoriesBar = () => {
  const bar = document.getElementById('categoriesBar');
  const selectCat = document.getElementById('newProdCat');
  if (bar) {
    bar.replaceChildren();
    const allBtn = document.createElement('button'); allBtn.className = 'category-btn active'; allBtn.dataset.cat = 'all'; allBtn.textContent = '⚡ الكل';
    allBtn.onclick = (e) => { document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); window.renderProducts(); };
    bar.appendChild(allBtn);
  }
  if(selectCat) selectCat.replaceChildren();
  const cats = storeState.categories || [];
  cats.forEach(c => {
    if (bar) {
      const btn = document.createElement('button'); btn.className = 'category-btn'; btn.dataset.cat = c.id; btn.textContent = c.name;
      btn.onclick = (e) => { document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); window.renderProducts(); };
      bar.appendChild(btn);
    }
    if(selectCat) { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; selectCat.appendChild(opt); }
  });
};

window.renderSkeletons = () => {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill().map(() => `<div class="skeleton-card skeleton"><div class="skel-img skeleton" style="background: rgba(255,255,255,0.05);"></div><div class="skel-title skeleton" style="background: rgba(255,255,255,0.05);"></div><div class="skel-desc skeleton" style="background: rgba(255,255,255,0.05);"></div><div class="skel-price skeleton" style="background: rgba(255,255,255,0.05);"></div><div class="skel-btn skeleton" style="background: rgba(255,255,255,0.05);"></div></div>`).join('');
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

  if (sortVal === 'price_asc') filtered.sort((a, b) => a.price - b.price);
  if (sortVal === 'price_desc') filtered.sort((a, b) => b.price - a.price);

  if (!filtered.length) { grid.innerHTML = '<div class="empty-products-msg" style="padding: 60px 20px;"><div style="font-size:40px; margin-bottom:10px;">🔍</div><p>لا توجد منتجات مطابقة حالياً.</p></div>'; return; }

  filtered.forEach(prod => {
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
    const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
    const isWished = storeState.wishlist.includes(prod.id);
    
    const card = document.createElement('div'); card.className = 'product-card';
    card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn')) return; window.openProductDetails(prod.id); };
    
    card.innerHTML = `
      <div style="position:relative;">
        <button type="button" class="wishlist-icon-btn ${isWished ? 'active' : ''}" onclick="window.toggleWishlist('${prod.id}', event)">${isWished ? '❤️' : '🤍'}</button>
        <span class="product-badge">${sanitizeText(prod.badge)}</span>
        <div class="product-img" style="background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText)}</div>
        <h3 class="product-title">${sanitizeText(prod.title)}</h3>
        <p class="product-desc">${sanitizeText(prod.desc).substring(0, 60)}...</p>
      </div>
      <div>
        <div class="product-price-box">${convertedOld ? `<span class="old-price">${convertedOld}${currency}</span>` : ''}<span class="product-price">${convertedPrice} ${currency}</span></div>
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'}" ${inStock ? '' : 'disabled'}>${inStock ? 'عرض التفاصيل' : 'نفذت الكمية'}</button>
      </div>
    `;
    grid.appendChild(card);
  });
};

const showView = (viewName) => {
  const homeView = document.getElementById('homeView'); const productDetailsView = document.getElementById('productDetailsView');
  if (homeView) homeView.style.display = viewName === 'home' ? 'block' : 'none';
  if (productDetailsView) productDetailsView.style.display = viewName === 'details' ? 'block' : 'none';
  if (viewName === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
};
document.getElementById('logoBtn')?.addEventListener('click', () => showView('home'));
document.getElementById('backToHomeBtn')?.addEventListener('click', () => showView('home'));
document.getElementById('sortSelect')?.addEventListener('change', window.renderProducts);

// ==========================================
// 5. المفضلة، سلة المشتريات، وتفاصيل المنتج (بما فيها معرض الصور)
// ==========================================
window.toggleWishlist = (prodId, event) => {
  if (event) event.stopPropagation();
  let wl = storeState.wishlist;
  if (wl.includes(prodId)) { wl = wl.filter(id => id !== prodId); window.showToast('تم الإزالة من المفضلة 💔', 'normal'); } 
  else { wl.push(prodId); window.showToast('تم الإضافة للمفضلة ❤️', 'success'); }
  storeState.wishlist = wl; localStorage.setItem('bn_store_wishlist', JSON.stringify(wl));
  window.renderProducts(); window.updateDetailWishlistBtn();
  if(document.getElementById('userWishlistSection')?.style.display === 'block') window.renderUserWishlist();
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

window.openProductDetails = (id) => {
  const prod = storeState.products.find(p => p.id === id); if (!prod) return;
  currentProductId = id; window.updateDetailWishlistBtn();

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
    const descLines = (prod.desc || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (descLines.length > 1 || (descLines.length === 1 && descLines[0].startsWith('-'))) {
      const ul = document.createElement('ul'); ul.style.cssText = 'padding-right: 20px; line-height: 1.8; color: var(--text-muted);';
      descLines.forEach(line => { const li = document.createElement('li'); li.innerHTML = linkify(line.replace(/^[-*•]\s*/, '')); ul.appendChild(li); });
      descContainer.appendChild(ul);
    } else {
      const p = document.createElement('p'); p.innerHTML = linkify(prod.desc || ''); p.style.cssText = 'color: var(--text-muted); line-height: 1.8;';
      descContainer.appendChild(p);
    }
  }
  
  const imgBox = document.getElementById('detailImageBox');
  const galleryBox = document.getElementById('detailImageGallery');
  if(imgBox) {
    if(prod.imgUrl) { imgBox.style.backgroundImage = `url('${prod.imgUrl}')`; imgBox.style.border = 'none'; imgBox.textContent = ''; imgBox.style.cursor = 'zoom-in'; }
    else { imgBox.style.backgroundImage = 'none'; imgBox.textContent = prod.imgText || prod.title; imgBox.style.cursor = 'default'; }
  }
  
  // 🖼️ معالجة معرض الصور
  if(galleryBox) {
      galleryBox.replaceChildren();
      const allImages = [];
      if (prod.imgUrl) allImages.push(prod.imgUrl);
      if (prod.gallery && Array.isArray(prod.gallery)) allImages.push(...prod.gallery);
      
      if (allImages.length > 1) {
          allImages.forEach((imgSrc, idx) => {
              const thumb = document.createElement('img');
              thumb.src = imgSrc; thumb.className = `gallery-thumb ${idx === 0 ? 'active-thumb' : ''}`;
              thumb.onclick = () => {
                  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active-thumb'));
                  thumb.classList.add('active-thumb');
                  imgBox.style.backgroundImage = `url('${imgSrc}')`;
              };
              galleryBox.appendChild(thumb);
          });
      }
  }

  const stockEl = document.getElementById('detailStock'); const addBtn = document.getElementById('detailAddToCartBtn');
  if (stockEl && addBtn) {
    if (inStock) {
      stockEl.textContent = (prod.stockQuantity !== undefined) ? `${prod.stockQuantity} قطعة متاحة` : 'متوفر'; stockEl.style.color = 'var(--success)';
      addBtn.textContent = '🛒 إضافة إلى السلة'; addBtn.disabled = false; addBtn.classList.remove('out-of-stock-badge');
    } else {
      stockEl.textContent = 'نفذت الكمية (Sold Out)'; stockEl.style.color = 'var(--danger)';
      addBtn.textContent = 'غير متوفر حالياً'; addBtn.disabled = true; addBtn.classList.add('out-of-stock-badge');
    }
  }
  window.loadProductReviews(id); showView('details');
};

// دوال سلة المشتريات واقتراحات السلة (Cross-Selling)
window.updateCartBadge = () => {
  const badge = document.getElementById('cartCountBadge');
  if (badge) { badge.textContent = storeState.cart.length; badge.style.display = storeState.cart.length > 0 ? 'flex' : 'none'; }
};

document.getElementById('detailAddToCartBtn')?.addEventListener('click', () => {
  if (!currentProductId) return;
  const prod = storeState.products.find(p => p.id === currentProductId);
  if (prod) { storeState.cart.push(prod); window.updateCartBadge(); window.showToast('تم إضافة المنتج للسلة بنجاح 🛒', 'success'); }
});
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
    const itemPrice = p.price * rate; total += itemPrice; currentCartIds.push(p.id);
    list.innerHTML += `<div class="cart-item"><div class="cart-item-info"><div class="cart-item-title">${sanitizeText(p.title)}</div><div class="cart-item-price">${itemPrice.toFixed(currency==='EGP'?0:2)} ${currency}</div></div><button type="button" class="remove-cart-btn" onclick="window.removeFromCart(${idx})" title="حذف من السلة">🗑️</button></div>`;
  });
  totalDisplay.textContent = `${total.toFixed(currency==='EGP'?0:2)} ${currency}`;

  // 🎁 عرض الاقتراحات (Cross-Selling)
  if(crossSellSection && crossSellList) {
      let suggestions = [];
      storeState.cart.forEach(p => { if (p.crossSellIds) suggestions.push(...p.crossSellIds); });
      suggestions = [...new Set(suggestions)].filter(id => !currentCartIds.includes(id)); // إزالة المكرر واللي موجود في السلة
      
      if(suggestions.length > 0) {
          crossSellList.innerHTML = '';
          suggestions.forEach(sId => {
              const sProd = storeState.products.find(x => x.id === sId && x.inStock);
              if(sProd) {
                  const sPrice = (sProd.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
                  crossSellList.innerHTML += `<div class="cross-sell-item"><div class="cross-sell-img" style="background-image:url('${sProd.imgUrl}')"></div><div class="cross-sell-title" title="${sProd.title}">${sProd.title}</div><div class="cross-sell-price">+${sPrice}${currency}</div><button class="add-cross-btn" onclick="window.addToCartCross('${sProd.id}')">إضافة</button></div>`;
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
  storeState.cart.forEach(p => { totalPrice += (p.price * rate); titles.push(p.title); });
  if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
  const finalPrice = totalPrice.toFixed(currency === 'EGP' ? 0 : 2);
  const discountText = activeDiscount > 0 ? ` (بعد خصم ${activeDiscount}%)` : '';
  const selectedProductInput = document.getElementById('selectedProduct');
  if (selectedProductInput) selectedProductInput.value = `${titles.join(' + ')}\nالإجمالي: (${finalPrice} ${currency})${discountText}`;
};

window.loadProductReviews = (prodId) => {
  if (unsubscribeReviews) unsubscribeReviews();
  const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'reviews'), where('productId', '==', prodId));
  unsubscribeReviews = onSnapshot(q, (snap) => {
    const list = document.getElementById('productReviewsList'); if (!list) return; list.replaceChildren();
    const revs = []; snap.forEach(d => revs.push({ id: d.id, ...d.data() }));
    revs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const detailBadge = document.getElementById('detailBadge');
    if (revs.length > 0) { const avgRating = (revs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / revs.length).toFixed(1); if(detailBadge) detailBadge.textContent = `⭐ ${avgRating} (${revs.length} تقييم)`; }
    if (!revs.length) { list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">لا توجد تقييمات لهذا المنتج حتى الآن.</p>'; } 
    else { revs.forEach(r => { list.innerHTML += `<div style="background: #14141d; border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; position: relative;"><div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-left: ${checkIsAdmin() ? '50px' : '0'};"><strong style="color: var(--accent-neon);">${sanitizeText(r.userName || 'مستخدم')} <span style="font-size:10px; color:var(--text-muted); font-weight:normal; margin-right:5px;">- ${formatDate(r.createdAt)}</span></strong><span>${'⭐'.repeat(Number(r.rating) || 5)}</span></div><p style="color: var(--text-main); line-height: 1.5;">${sanitizeText(r.comment)}</p>${checkIsAdmin() ? `<button onclick="window.deleteReview('${r.id}')" style="position:absolute; left:10px; top:10px; background:var(--danger); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; z-index:10;">حذف 🗑️</button>` : ''}</div>`; }); }

    const addReviewBox = document.getElementById('addReviewBox');
    let hasPurchased = false;
    if (currentUserProfile && storeState.orders) {
      hasPurchased = storeState.orders.some(o => o.uid === currentUserProfile.uid && o.status === 'completed' && (o.productId === prodId || (o.productIds && o.productIds.includes(prodId))));
    }
    let placeholderMsg = document.getElementById('reviewPlaceholderMsg');
    if (addReviewBox) {
      if (hasPurchased) { addReviewBox.style.display = 'block'; if (placeholderMsg) placeholderMsg.style.display = 'none'; } 
      else {
        addReviewBox.style.display = 'none';
        if (!placeholderMsg) { placeholderMsg = document.createElement('div'); placeholderMsg.id = 'reviewPlaceholderMsg'; placeholderMsg.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 20px; font-style: italic; border: 1px dashed var(--border-color);'; placeholderMsg.textContent = 'نتطلع لسماع رأيك وإضافة تقييمك بعد شراء وتجربة المنتج! 🤍'; addReviewBox.parentNode.insertBefore(placeholderMsg, addReviewBox); } 
        else placeholderMsg.style.display = 'block';
      }
    }
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
// 6. الأحداث والشراء
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  window.renderSkeletons();
  document.getElementById('searchInput')?.addEventListener('input', window.renderProducts);
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
  document.getElementById('loginBtnNav')?.addEventListener('click', () => { if(currentUserProfile) document.getElementById('userAccountModal').style.display = 'flex'; else document.getElementById('authModal').style.display = 'flex'; });

  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    try { await signInWithEmailAndPassword(auth, email, pass); document.getElementById('authModal').style.display = 'none'; window.showToast('تم تسجيل الدخول بنجاح!', 'success'); } catch (e) { window.showToast('البيانات غير صحيحة!', 'error'); }
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) await signInWithRedirect(auth, provider);
      else {
        const result = await signInWithPopup(auth, provider);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid), { uid: result.user.uid, name: result.user.displayName || 'مستخدم جوجل', email: result.user.email, createdAt: serverTimestamp() }, { merge: true });
        document.getElementById('authModal').style.display = 'none'; window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      }
    } catch (e) { if (e.code !== 'auth/popup-closed-by-user') window.showToast('فشل تسجيل الدخول', 'error'); }
  });
  
  document.getElementById('showRegisterBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'none'; document.getElementById('authViewRegister').style.display = 'block'; document.getElementById('authModalTitle').textContent = 'إنشاء حساب جديد'; });
  document.getElementById('showLoginBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'block'; document.getElementById('authViewRegister').style.display = 'none'; document.getElementById('authModalTitle').textContent = 'تسجيل الدخول'; });

  document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim(), email = document.getElementById('regEmail').value.trim(), pass = document.getElementById('regPass').value;
    if (!name || !email || !pass) return window.showToast('أكمل جميع البيانات!', 'error');
    if (pass !== document.getElementById('regPassConfirm').value) return window.showToast('كلمة المرور غير متطابقة!', 'error');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass); await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { uid: cred.user.uid, name, email, createdAt: serverTimestamp() });
      document.getElementById('authModal').style.display = 'none'; window.showToast('تم إنشاء الحساب بنجاح!', 'success');
    } catch (e) { window.showToast('خطأ! ربما البريد مستخدم مسبقاً.', 'error'); }
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { try { await signOut(auth); document.getElementById('userAccountModal').style.display = 'none'; window.showToast('تم تسجيل الخروج!', 'success'); } catch (e) {} });

  // 🌟 إرسال الطلب (مع دعم السلة وخصم المخزون)
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
      storeState.cart.forEach(p => { totalPrice += (p.price * rate); productTitles.push(p.title); productIds.push(p.id); });
      if (activeDiscount > 0) totalPrice = totalPrice - (totalPrice * (activeDiscount / 100));
      totalPrice = Number(totalPrice.toFixed(currency === 'EGP' ? 0 : 2));

      const paymentMethod = document.getElementById('paymentMethod').value, senderInfo = sanitizeText(document.getElementById('senderInfo').value), customerData = sanitizeText(document.getElementById('customerData').value);
      const newOrderRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'orders')), orderId = newOrderRef.id;

      await setDoc(newOrderRef, { uid: currentUserProfile.uid, userEmail: currentUserProfile.email, productIds, productId: productIds[0], productName: productTitles.join(' + '), finalPrice: totalPrice, currency, discountApplied: activeDiscount, promoCodeUsed: activeDiscount > 0 ? document.getElementById('promoCodeInput').value.trim() : "", paymentMethod, senderInfo, customerData, receiptImage: receiptBase64, status: 'pending', deliveredCode: '', createdAt: serverTimestamp() });

      // خصم المخزون
      for (const p of storeState.cart) {
        if (p.stockQuantity !== undefined && p.stockQuantity > 0) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id), { stockQuantity: p.stockQuantity - 1, inStock: (p.stockQuantity - 1) > 0 });
      }

      storeState.cart = []; window.updateCartBadge();
      document.getElementById('receiptPreview').style.display = 'none'; document.getElementById('receiptPreview').src = ''; document.getElementById('checkoutModal').style.display = 'none'; document.getElementById('checkoutForm').reset(); activeDiscount = 0; 
      
      window.showToast('🎉 تم إرسال طلبك بنجاح! راجع "حسابي" لمتابعة الحالة.', 'success');
      if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00ffcc', '#0099ff', '#ffffff'] });

      // إشعار للإدارة
      if (typeof emailjs !== 'undefined') {
           emailjs.send("service_01wl99f", "template_wxomgzu", { to_name: "الإدارة", to_email: "bebo.nagy97@gmail.com", order_id: orderId, product_name: productTitles.join(' + '), price: totalPrice + ' ' + currency }).catch(err => console.error("Email Error:", err));
      }
    } catch (err) { window.showToast(err.message || 'حدث خطأ، تأكد من اتصالك.', 'error'); } 
    finally { confirmText.textContent = 'تأكيد الطلب'; confirmSpinner.style.display = 'none'; confirmBtn.disabled = false; }
  });
});

// ==========================================
// 7. المزامنة والسحب
// ==========================================
const initApp = () => {
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = []; snap.forEach(doc => products.push({ id: doc.id, ...doc.data() })); storeState.products = products; isDataLoaded = true; 
    window.renderProducts(); if(checkIsAdmin()) window.renderAdminProducts();
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
      loginBtn.innerHTML = `👤 <span>حسابي</span>`; loginBtn.style.color = 'var(--accent-neon)'; document.getElementById('accountUserName').textContent = currentUserProfile.name;
      let adminBtnInModal = document.getElementById('adminBtnInModal');
      if (checkIsAdmin()) {
        window.injectAdminDashboard(); window.loadAdminData(); window.renderAdminStats();
        if (!adminBtnInModal) {
           const accountModalContent = document.querySelector('#userAccountModal .modal-content');
           if(accountModalContent) {
             const btn = document.createElement('button'); btn.id = 'adminBtnInModal'; btn.className = 'submit-btn'; btn.style.cssText = 'width:100%; margin-bottom:15px; background:#0099ff; color:#fff; font-size:16px; box-shadow:0 0 15px rgba(0,153,255,0.4);';
             btn.innerHTML = '⚙️ الدخول للوحة تحكم الإدارة'; btn.onclick = () => { document.getElementById('userAccountModal').style.display = 'none'; document.getElementById('adminModal').style.display = 'flex'; };
             accountModalContent.insertBefore(btn, accountModalContent.querySelector('.user-tabs-container'));
           }
        }
      } else { if (adminBtnInModal) adminBtnInModal.remove(); }
      subscribeToOrders(user.uid);
    } else {
      currentUserProfile = null; loginBtn.innerHTML = '👤 <span>تسجيل الدخول</span>'; loginBtn.style.color = '';
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
     const div = document.createElement('div'); div.className = 'my-orders-box';
     const statusColor = o.status === 'completed' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--danger)' : '#ffcc00';
     const statusAr = o.status === 'completed' ? 'مكتمل ✅' : o.status === 'cancelled' ? 'ملغي ❌' : 'قيد المراجعة ⏳';
     div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${o.productName} (${o.finalPrice} ${o.currency || 'EGP'})</strong><span style="color:${statusColor}; font-weight:bold; font-size:13px;">${statusAr}</span></div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${formatDate(o.createdAt)}</div><div style="font-size:12px; color:var(--text-muted);">رقم الاستلام: ${o.customerData} | الدفع: ${o.paymentMethod}</div>${o.status === 'completed' && o.deliveredCode ? `<div class="delivered-code-box">🎁 بيانات التفعيل: <strong>${o.deliveredCode}</strong></div>` : ''}`;
     list.appendChild(div);
  });
};

window.renderUserWishlist = () => {
  const grid = document.getElementById('userWishlistGrid'); if (!grid) return; grid.replaceChildren();
  const wishedProducts = storeState.products.filter(p => storeState.wishlist.includes(p.id));
  if(!wishedProducts.length) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:20px;">لا توجد منتجات في المفضلة.</p>'; return; }
  const currency = document.getElementById('currencySelect').value, rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
  wishedProducts.forEach(prod => {
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2); const card = document.createElement('div'); card.className = 'product-card'; card.style.padding = '15px';
    card.onclick = (e) => { if(e.target.classList.contains('wishlist-icon-btn')) return; document.getElementById('userAccountModal').style.display = 'none'; window.openProductDetails(prod.id); };
    card.innerHTML = `<div style="position:relative;"><button type="button" class="wishlist-icon-btn active" style="top:5px; left:5px; width:25px; height:25px; font-size:12px;" onclick="window.toggleWishlist('${prod.id}', event)">❤️</button><div class="product-img" style="height:100px; background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText)}</div><h3 class="product-title" style="font-size:14px;">${sanitizeText(prod.title)}</h3><div class="product-price" style="font-size:16px;">${convertedPrice} ${currency}</div></div>`;
    grid.appendChild(card);
  });
};

// ==========================================
// 8. لوحة التحكم للإدارة
// ==========================================
window.initAdminTabs = () => {
  const tabBtns = document.querySelectorAll('#adminTabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => { tabBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('#adminDashboardView .tab-content').forEach(c => c.classList.remove('active-tab')); document.getElementById(btn.dataset.target).classList.add('active-tab'); });
  });
};
window.copyCustomerData = (text) => navigator.clipboard.writeText(text).then(() => window.showToast('تم نسخ بيانات العميل 📋', 'success'));

window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer'); if(!container) return;
  // أضفنا حقول المعرض، الاقتراحات، والخزنة
  container.innerHTML = `
    <div id="tab-dashboard" class="tab-content active-tab">
      <div class="admin-section" style="border-color: var(--accent-neon);"><h4 style="color: var(--accent-neon); margin-bottom: 15px;">📊 إحصائيات المبيعات الدقيقة</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" id="adminStatsGrid"></div></div>
      <div class="admin-section"><h4>⚡ إعدادات العروض</h4><div class="form-group"><label>نص الإعلان</label><input type="text" id="admBannerAr"></div><div class="form-group"><label>موعد انتهاء العرض</label><input type="datetime-local" id="admBannerExpiry" style="background:#0b0b10; color:#fff; padding:10px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة السلايدر</h4><div class="form-group"><label>العنوان</label><input type="text" id="slideTitleInput"></div><div class="form-group"><label>الوصف</label><input type="text" id="slideDescInput"></div><div class="form-group"><label>صورة البانر</label><input type="file" id="slideImgFileInput" accept="image/*" style="background:#0b0b10; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div><button type="button" class="submit-btn" id="saveSlideBtn" style="width:100%; margin-bottom:15px;" onclick="window.addSlide()">➕ إضافة للسلايدر</button><div id="adminSlidesList"></div></div>
    </div>
    <div id="tab-orders" class="tab-content">
      <div class="admin-section"><h4>⏳ طلبات جديدة</h4><div id="adminOrdersPending" style="max-height:350px; overflow-y:auto;"></div></div>
      <div class="admin-section" style="margin-top: 20px; opacity: 0.9;"><h4>🗄️ أرشيف الطلبات</h4><div id="adminOrdersArchived" style="max-height:350px; overflow-y:auto;"></div></div>
    </div>
    <div id="tab-products" class="tab-content">
      <div class="admin-section" id="productFormSection">
        <h4>📦 إضافة أو تعديل منتج</h4>
        <div class="grid-2">
          <div class="form-group"><label>اسم المنتج</label><input type="text" id="newProdTitle"></div>
          <div class="form-group"><label>السعر الأساسي (EGP)</label><input type="number" id="newProdPrice"></div>
          <div class="form-group"><label>السعر المشطوب (EGP)</label><input type="number" id="newProdOldPrice"></div>
          <div class="form-group"><label>القسم</label><select id="newProdCat"></select></div>
          <div class="form-group"><label>الكمية المتاحة</label><input type="number" id="newProdStock"></div>
          <div class="form-group"><label>الشارة (Badge)</label><input type="text" id="newProdBadge" placeholder="تسليم فوري"></div>
        </div>
        <div class="form-group"><label>الصورة الأساسية</label><input type="file" id="newProdImgFileInput" accept="image/*" style="background:#0b0b10; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        
        <!-- 🆕 إضافات الوحش -->
        <div class="form-group"><label>معرض الصور الإضافية (اختر أكثر من صورة معاً)</label><input type="file" id="newProdGallery" multiple accept="image/*" style="background:#0b0b10; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>🛒 اقتراحات السلة (اكتب الـ ID الخاص بالمنتجات وبينهم فاصلة)</label><input type="text" id="newProdCrossSell" placeholder="مثال: 171234, 175678"></div>
        <div class="form-group"><label>🏦 خزنة الأكواد الذكية (كود في كل سطر للتسليم التلقائي)</label><textarea id="newProdVault" class="vault-textarea" rows="3" placeholder="ABCD-1234&#10;EFGH-5678"></textarea></div>
        
        <div class="form-group"><label>وصف المنتج (روابط أو نص)</label><textarea id="newProdDesc" rows="4"></textarea></div>
        <button type="button" class="submit-btn" id="saveProductBtn" style="width:100%;" onclick="window.saveProduct()">➕ حفظ المنتج</button>
        <button type="button" class="cancel-btn" id="cancelEditBtn" style="width:100%; margin-top:10px; display:none;" onclick="window.cancelEdit()">إلغاء التعديل</button>
      </div>
      <div class="admin-section"><h4>📦 المنتجات الحالية</h4><div id="adminProductsList" style="max-height:300px; overflow-y:auto;"></div></div>
      <div class="admin-section"><h4>🏷️ إدارة أقسام المتجر</h4><div class="grid-2"><div class="form-group"><label>معرف القسم</label><input type="text" id="catIdInput"></div><div class="form-group"><label>اسم القسم</label><input type="text" id="catNameInput"></div></div><button type="button" class="submit-btn" style="width:100%; margin-bottom:15px;" onclick="window.addCategory()">➕ إضافة قسم</button><div id="adminCategoriesList"></div></div>
    </div>
    <div id="tab-settings" class="tab-content">
      <div class="admin-section"><h4>🎁 إعدادات كود الخصم</h4><div class="grid-2"><div class="form-group"><label>كود الخصم</label><input type="text" id="admPromoCode"></div><div class="form-group"><label>نسبة الخصم (%)</label><input type="number" id="admPromoDiscount"></div></div></div>
      <div class="admin-section"><h4>💱 أسعار الصرف</h4><div class="grid-2"><div class="form-group"><label>SAR</label><input type="number" step="0.001" id="admRateSAR"></div><div class="form-group"><label>AED</label><input type="number" step="0.001" id="admRateAED"></div><div class="form-group"><label>USD</label><input type="number" step="0.0001" id="admRateUSD"></div></div></div>
      <div class="admin-section"><h4>📢 إعدادات الدفع والواتساب</h4><div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div><div class="grid-2"><div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div><div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div><div class="form-group"><label>USDT</label><input type="text" id="admCrypto"></div></div><button type="button" id="saveConfigBtn" class="submit-btn" style="width:100%; margin-top:15px;" onclick="window.saveGeneralSettings()">💾 حفظ الإعدادات</button></div>
    </div>
  `;
  window.initAdminTabs(); window.renderCategoriesBar();
};

window.renderAdminStats = () => {
  const statsGrid = document.getElementById('adminStatsGrid'); if (!statsGrid) return;
  const orders = storeState.orders || [];
  const totalOrders = orders.length, pendingOrders = orders.filter(o => o.status === 'pending').length, completedOrders = orders.filter(o => o.status === 'completed').length;
  
  // 💰 حساب المبيعات المكتملة وتفنيط العملات
  let totalRevenueEGP = 0; let currTotals = { EGP: 0, SAR: 0, AED: 0, USD: 0 };
  orders.forEach(o => { 
    if (o.status === 'completed') {
      let price = Number(o.finalPrice || 0), currency = o.currency || 'EGP', rate = currency === 'EGP' ? 1 : (storeState.rates[currency] || 1);
      totalRevenueEGP += (price / rate);
      if(currTotals[currency] !== undefined) currTotals[currency] += price;
    } 
  });

  statsGrid.innerHTML = `
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--accent-neon);">${totalOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معروضة</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: #ffcc00;">${pendingOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معلقة ⏳</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--success);">${completedOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات مكتملة ✅</div></div>
    <div style="background: #14141d; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 16px; font-weight: bold; color: var(--accent-neon);">${totalRevenueEGP.toFixed(0)} EGP</div><div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">(≈ إجمالي المحول)</div></div>
    <div style="grid-column: 1 / -1; background: rgba(0,255,204,0.05); padding: 8px; border-radius: 8px; border: 1px dashed var(--accent-neon); font-size: 12px; text-align: center; color: #fff;"><strong>تفصيل المبيعات بالعملات:</strong> ${currTotals.EGP} ج.م | ${currTotals.SAR.toFixed(2)} ر.س | ${currTotals.AED.toFixed(2)} د.إ | ${currTotals.USD.toFixed(2)} $</div>
  `;
};

window.renderAdminOrders = () => {
  const pendingList = document.getElementById('adminOrdersPending'), archivedList = document.getElementById('adminOrdersArchived');
  if (!pendingList || !archivedList) return; pendingList.replaceChildren(); archivedList.replaceChildren();

  const orders = storeState.orders || [], pendingOrders = orders.filter(o => o.status === 'pending'), archivedOrders = orders.filter(o => o.status !== 'pending');
  if (!pendingOrders.length) pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">لا توجد طلبات جديدة حالياً.</p>';
  if (!archivedOrders.length) archivedList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">الأرشيف فارغ.</p>';

  const createOrderHTML = (o, isArchived) => {
    const discountBadge = o.discountApplied > 0 ? `<span style="color:var(--success); font-weight:bold;">[خصم ${o.discountApplied}%]</span>` : '';
    const receiptView = o.receiptImage ? `<div style="margin-top:8px;"><a href="${o.receiptImage}" target="_blank" style="color:var(--accent-neon); text-decoration:underline; font-weight:bold; display:inline-flex; align-items:center; gap:5px;">📄 عرض الإيصال</a></div>` : '';
    const deleteBtn = isArchived ? `<button onclick="window.deleteAdminOrder('${o.id}')" style="position:absolute; bottom:10px; left:10px; background:rgba(255,68,68,0.2); color:var(--danger); border:1px solid var(--danger); padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">حذف نهائي 🗑️</button>` : '';

    let html = `<div class="admin-item-row" style="flex-direction:column; align-items:flex-start; position:relative; padding-bottom: ${isArchived ? '35px' : '10px'}"><span style="position:absolute; top:10px; left:10px; font-size:11px; color:var(--text-muted);">${formatDate(o.createdAt)}</span><div style="width:100%; margin-bottom:8px; line-height:1.6; padding-left: 100px;"><strong>الطلب:</strong> <span style="color:var(--accent-neon);">${o.productName}</span> | <strong>الإيميل:</strong> ${o.userEmail}<br><small><strong>السعر:</strong> <span style="color:var(--accent-neon);">${o.finalPrice} ${o.currency || 'EGP'}</span> ${discountBadge}</small><br><small><strong>محول من:</strong> ${o.senderInfo} <br><strong style="color:var(--accent-neon);">بيانات الاستلام:</strong> ${o.customerData} <button onclick="window.copyCustomerData('${o.customerData}')" style="background:var(--accent-neon); color:#000; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">نسخ</button></small><br>${receiptView}<small style="display:block; margin-top:5px;"><strong>الحالة:</strong> <span style="color:${o.status==='completed'?'var(--success)':o.status==='cancelled'?'var(--danger)':'#ffcc00'}">${o.status}</span></small>${isArchived && o.deliveredCode ? `<small style="display:block; color:var(--success);"><strong>الكود المُسلم:</strong> ${o.deliveredCode}</small>` : ''}</div>${deleteBtn}`;
    if (!isArchived) html += `<div style="display:flex; gap:8px; width:100%; flex-wrap:wrap; margin-top:5px; border-top:1px dashed var(--border-color); padding-top:10px;"><input type="text" id="code_${o.id}" placeholder="اكتب كود التفعيل هنا (أو اتركه فارغاً للسحب من الخزنة تلقائياً)..." value="${o.deliveredCode || ''}" style="flex:1; padding:8px; border-radius:5px; background:#0b0b10; color:#fff; border:1px solid var(--border-color);"><button class="submit-btn" style="padding:8px 12px; flex:0;" onclick="window.updateOrderStatus('${o.id}', 'completed')">إكمال ✅</button><button class="cancel-btn" style="padding:8px 12px; flex:0; border-color:var(--danger); color:var(--danger);" onclick="window.updateOrderStatus('${o.id}', 'cancelled')">إلغاء ❌</button></div>`;
    html += `</div>`; return html;
  };

  pendingOrders.forEach(o => pendingList.insertAdjacentHTML('beforeend', createOrderHTML(o, false)));
  archivedOrders.forEach(o => archivedList.insertAdjacentHTML('beforeend', createOrderHTML(o, true)));
  if(orders.length >= adminOrdersLimit) archivedList.insertAdjacentHTML('beforeend', `<button type="button" class="load-more-btn" onclick="window.loadMoreAdminOrders()">عرض المزيد من الطلبات ⬇️</button>`);
};

window.deleteAdminOrder = async (orderId) => { if (!checkIsAdmin() || !confirm('تأكيد الحذف النهائي؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId)); window.showToast('🗑️ تم الحذف', 'success'); } catch(e) {} };

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
    // 🏦 سحب أوتوماتيك من الخزنة
    else if (status === 'completed' && !codeToDeliver && order && order.productIds && order.productIds.length > 0) {
        const prod = storeState.products.find(p => p.id === order.productIds[0]);
        if (prod && prod.vaultCodes) {
            let codes = prod.vaultCodes.split('\n').map(c => c.trim()).filter(c => c);
            if (codes.length > 0) {
                codeToDeliver = codes.shift();
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { vaultCodes: codes.join('\n') });
            }
        }
    }

    await updateDoc(orderRef, { status, deliveredCode: codeToDeliver, updatedAt: serverTimestamp() });
    
    // 📧 إرسال الإيميل أوتوماتيك للعميل
    if (status === 'completed' && codeToDeliver && typeof emailjs !== 'undefined' && order) {
        emailjs.send("service_01wl99f", "template_wxomgzu", {
            to_name: order.userEmail.split('@')[0],
            to_email: order.userEmail,
            order_id: order.id,
            product_name: order.productName,
            delivered_code: codeToDeliver
        }).catch(err => console.error("Auto-Email Error:", err));
    }
    window.showToast('تم التحديث!', 'success');
  } catch(e) { window.showToast('خطأ في التحديث', 'error'); }
};

window.addSlide = async () => { /* ... (نفس الدالة السابقة بدون تغيير) ... */ 
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

window.addCategory = async () => { /* ... */ }; // (نفس الدالة السابقة)
window.deleteCategory = async (id) => { /* ... */ }; // (نفس الدالة السابقة)
window.renderAdminCategories = () => { const list = document.getElementById('adminCategoriesList'); if(list) list.innerHTML = (storeState.categories||[]).map(c => `<div class="admin-item-row"><span style="flex:1;">${c.name} (${c.id})</span>${['games','subs','ai','software'].includes(c.id)?'<span style="font-size:11px;">أساسي</span>':`<button class="delete-btn" onclick="window.deleteCategory('${c.id}')">حذف</button>`}</div>`).join(''); };

window.loadAdminData = () => {
  ['admBannerAr','admBannerExpiry','admWhatsapp','admInstapay','admVodafone','admCrypto','admPromoCode','admPromoDiscount'].forEach(id => { const el = document.getElementById(id); if(el) el.value = storeState[id.replace('adm','').charAt(0).toLowerCase() + id.replace('adm','').slice(1)] || (id==='admPromoDiscount'?0:'') || (storeState.payments?.[id.replace('adm','').toLowerCase()] || ''); });
  if(document.getElementById('admRateSAR')) document.getElementById('admRateSAR').value = storeState.rates.SAR;
  if(document.getElementById('admRateAED')) document.getElementById('admRateAED').value = storeState.rates.AED;
  if(document.getElementById('admRateUSD')) document.getElementById('admRateUSD').value = storeState.rates.USD;
  window.renderAdminProducts(); window.renderAdminOrders(); window.renderAdminSlides(); window.renderAdminCategories(); window.renderAdminStats();
};

window.saveGeneralSettings = async () => { /* ... */ }; // (نفس الدالة السابقة للحفظ)

window.saveProduct = async () => {
  if (!checkIsAdmin()) return;
  const title = document.getElementById('newProdTitle').value, price = Number(document.getElementById('newProdPrice').value), oldPrice = Number(document.getElementById('newProdOldPrice')?.value) || 0, stockQuantity = Number(document.getElementById('newProdStock')?.value) || 0, category = document.getElementById('newProdCat')?.value || 'games', badge = document.getElementById('newProdBadge')?.value || 'متوفر', desc = document.getElementById('newProdDesc')?.value || '';
  
  const crossSellStr = document.getElementById('newProdCrossSell')?.value || '';
  let crossSellIds = crossSellStr.split(',').map(id => id.trim()).filter(id => id);
  
  const vaultCodes = document.getElementById('newProdVault')?.value || '';
  
  const fileInput = document.getElementById('newProdImgFileInput');
  const galleryInput = document.getElementById('newProdGallery');
  const btn = document.getElementById('saveProductBtn');

  if (!title || price <= 0) return window.showToast('تأكد من اسم المنتج والسعر!', 'error');
  const origText = btn.textContent; btn.textContent = 'جاري الحفظ ⏳...'; btn.disabled = true;

  try {
    let imgUrl = '';
    if (fileInput && fileInput.files[0]) { 
        imgUrl = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await compressImage(e.target.result)); r.readAsDataURL(fileInput.files[0]); });
    } else if (editingProductId) { imgUrl = storeState.products.find(p => p.id === editingProductId)?.imgUrl || ''; }

    // معالجة صور المعرض المتعددة 🖼️
    let gallery = editingProductId ? (storeState.products.find(p => p.id === editingProductId)?.gallery || []) : [];
    if (galleryInput && galleryInput.files.length > 0) {
        gallery = []; // استبدال القديم بالجديد لو تم اختيار صور
        for (let i = 0; i < galleryInput.files.length; i++) {
            const base64 = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await compressImage(e.target.result)); r.readAsDataURL(galleryInput.files[i]); });
            gallery.push(base64);
        }
    }

    const prodData = { title, desc, price, oldPrice, category, badge, imgUrl, gallery, crossSellIds, vaultCodes, inStock: stockQuantity > 0, stockQuantity };

    if (editingProductId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProductId), prodData); window.showToast('✏️ تم التعديل!', 'success'); } 
    else { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', Date.now().toString()), prodData); window.showToast('📦 تمت الإضافة!', 'success'); }
    window.cancelEdit();
  } catch (e) { window.showToast('فشل العملية', 'error'); } finally { btn.textContent = origText; btn.disabled = false; }
};

window.editProduct = (id) => {
  const p = storeState.products.find(x => x.id === id); if(!p) return;
  document.getElementById('newProdTitle').value = p.title || ''; document.getElementById('newProdPrice').value = p.price || ''; document.getElementById('newProdOldPrice').value = p.oldPrice || ''; document.getElementById('newProdCat').value = p.category || 'games'; document.getElementById('newProdStock').value = p.stockQuantity !== undefined ? p.stockQuantity : ''; document.getElementById('newProdBadge').value = p.badge || ''; document.getElementById('newProdDesc').value = p.desc || '';
  
  document.getElementById('newProdCrossSell').value = p.crossSellIds ? p.crossSellIds.join(', ') : '';
  document.getElementById('newProdVault').value = p.vaultCodes || '';
  
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
    let html = `<div class="admin-item-row"><span style="flex:1; line-height:1.6;">${p.title} - ${p.price}EGP (ID: <strong>${p.id}</strong>) <br><small><strong>${statusText}</strong></small></span><div style="display:flex; gap:8px;"><button class="submit-btn" style="padding:6px 12px; font-size:12px; flex:0;" onclick="window.editProduct('${p.id}')">تعديل</button><button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button></div></div>`;
    list.insertAdjacentHTML('beforeend', html);
  });
};

window.deleteProduct = async (id) => { if (!checkIsAdmin() || !confirm('تأكيد الحذف؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); window.showToast('تم الحذف', 'success'); } catch (e) {} };

initApp();
