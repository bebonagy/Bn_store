// auth.js
import { auth, db, appId, ADMIN_UID } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setDoc, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let currentUserProfile = null;
export const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);

let tempSecurePassword = null;

// تشفير الـ OTP محلياً بشكل معقد لتصعيب الوصول إليه (Dynamic Salt)
const hashOTP = async (otp, email) => {
  const salt = "BN_MAX_SECURE_V2_" + email.length;
  const msgUint8 = new TextEncoder().encode(otp + email + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const initAuth = (translations, getCurrentLang, onUserChangeCallback) => {
  const getLang = () => (typeof getCurrentLang === 'function' ? getCurrentLang() : getCurrentLang) || 'ar';

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      let wishlist = [];
      let dbName = user.displayName || 'مستخدم';
      let language = null;

      try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          wishlist = Array.isArray(uData.wishlist) ? uData.wishlist : [];
          if (uData.name) dbName = uData.name;
          if (uData.language) language = uData.language;
        } else {
          // إنشاء مستند للمستخدم تلقائياً إذا لم يكن موجوداً لضمان عمل المفضلة بدون أخطاء
          await setDoc(userRef, {
            uid: user.uid,
            name: dbName,
            email: user.email || '',
            wishlist: [],
            createdAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.warn("User profile fetch warning:", err);
      }

      currentUserProfile = { 
        uid: user.uid, 
        email: user.email, 
        name: dbName, 
        photoURL: user.photoURL || '',
        wishlist,
        language
      };
      if (onUserChangeCallback) onUserChangeCallback(user, currentUserProfile);
    } else {
      currentUserProfile = null;
      if (onUserChangeCallback) onUserChangeCallback(null, null);
    }
  });

  const authModal = document.getElementById('authModal');
  
  document.getElementById('loginBtnNav')?.addEventListener('click', () => { 
      if (currentUserProfile) { 
          document.getElementById('userAccountModal').style.display = 'flex'; 
      } else { 
          authModal.style.display = 'flex'; 
          
          // فحص وجود جلسة تسجيل معلقة (OTP) لعدم طرد العميل عند الـ Refresh
          if (sessionStorage.getItem('bn_temp_reg')) {
              document.getElementById('authViewLogin').style.display = 'none';
              document.getElementById('authViewRegister').style.display = 'none';
              document.getElementById('authViewReset').style.display = 'none';
              document.getElementById('authViewOTP').style.display = 'block';
              
              if (!tempSecurePassword) {
                  document.getElementById('recoveryPassGroup').style.display = 'block';
                  const msgDisplay = document.getElementById('otpMessageDisplay');
                  if (msgDisplay) {
                      msgDisplay.textContent = 'لأمانك، يرجى تأكيد كلمة المرور لإكمال إنشاء الحساب.';
                      msgDisplay.style.color = 'var(--danger)';
                  }
              }
          } else {
              document.getElementById('authViewLogin').style.display = 'block';
              document.getElementById('authViewRegister').style.display = 'none';
              document.getElementById('authViewReset').style.display = 'none';
              document.getElementById('authViewOTP').style.display = 'none';
          }
      }
  });

  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    const btn = document.getElementById('doLoginBtn');
    const origText = btn.textContent;
    btn.textContent = 'جاري الدخول ⏳...';
    btn.disabled = true;
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
        authModal.style.display = 'none'; 
        window.showToast('تم تسجيل الدخول بنجاح!', 'success'); 
    } catch (e) { 
        window.showToast('البيانات غير صحيحة!', 'error'); 
    } finally {
        btn.textContent = origText;
        btn.disabled = false;
    }
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
    document.getElementById('authModalTitle').textContent = translations[getLang()].auth_title;
  });

  document.getElementById('doSendResetBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmailInput').value.trim();
    if (!email) return window.showToast('أدخل البريد الإلكتروني أولاً!', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      window.showToast('✉️ تم إرسال رابط استعادة كلمة المرور بنجاح!', 'success');
      document.getElementById('authViewReset').style.display = 'none';
      document.getElementById('authViewLogin').style.display = 'block';
      document.getElementById('authModalTitle').textContent = translations[getLang()].auth_title;
    } catch(err) { window.showToast('حدث خطأ، تأكد من صحة البريد.', 'error'); }
  });

  document.getElementById('showRegisterBtn')?.addEventListener('click', (e) => { 
    e.preventDefault();
    document.getElementById('authViewLogin').style.display = 'none'; 
    document.getElementById('authViewRegister').style.display = 'block'; 
    document.getElementById('authModalTitle').textContent = translations[getLang()].create_account; 
  });
  
  document.getElementById('showLoginBtn')?.addEventListener('click', (e) => { 
    e.preventDefault();
    document.getElementById('authViewLogin').style.display = 'block'; 
    document.getElementById('authViewRegister').style.display = 'none'; 
    document.getElementById('authViewOTP').style.display = 'none'; 
    document.getElementById('authModalTitle').textContent = translations[getLang()].btn_login; 
  });
  
  document.getElementById('backToRegFromOTP')?.addEventListener('click', () => { 
    sessionStorage.removeItem('bn_temp_reg'); 
    tempSecurePassword = null; 
    document.getElementById('authViewOTP').style.display = 'none'; 
    document.getElementById('authViewRegister').style.display = 'block'; 
    
    // إعادة إخفاء حقل الاستعادة عند التراجع
    document.getElementById('recoveryPassGroup').style.display = 'none';
    document.getElementById('regPassRecovery').value = '';
    const msgDisplay = document.getElementById('otpMessageDisplay');
    if (msgDisplay) {
        msgDisplay.textContent = 'تم إرسال كود التفعيل (OTP) إلى بريدك الإلكتروني بنجاح. برجاء تفقد صندوق الوارد أو البريد المزعج (Spam).';
        msgDisplay.style.color = 'var(--success)';
    }
  });

  document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim(), email = document.getElementById('regEmail').value.trim(), pass = document.getElementById('regPass').value;
    if (!name || !email || !pass) return window.showToast('أكمل جميع البيانات!', 'error');
    if (pass.length < 6) return window.showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل!', 'error');
    if (pass !== document.getElementById('regPassConfirm').value) return window.showToast('كلمة المرور غير متطابقة!', 'error');
    
    const btn = document.getElementById('doRegisterBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإرسال ⏳...'; btn.disabled = true;
    
    try {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await hashOTP(otpCode, email);
        
        tempSecurePassword = pass;
        sessionStorage.setItem('bn_temp_reg', JSON.stringify({ name, email, otpHash }));
        
        if (typeof emailjs !== 'undefined') {
            const customMessage = `كود التفعيل الخاص بك هو:<div class="otp-box">${otpCode}</div>لا تشارك هذا الكود مع أحد.`;
            await emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: name, to_email: email, custom_message: customMessage });
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

  document.getElementById('doVerifyOTPBtn')?.addEventListener('click', async () => {
    const inputOTP = document.getElementById('regOTP').value.trim();
    if (!inputOTP) return window.showToast('أدخل كود التفعيل!', 'error');
    
    const storedData = sessionStorage.getItem('bn_temp_reg');
    if (!storedData) return window.showToast('انتهت الجلسة، يرجى التسجيل مجدداً.', 'error');
    
    if (!tempSecurePassword) {
        const recoveryInput = document.getElementById('regPassRecovery');
        if (recoveryInput && recoveryInput.value) {
            tempSecurePassword = recoveryInput.value;
        } else {
            document.getElementById('recoveryPassGroup').style.display = 'block';
            const msgDisplay = document.getElementById('otpMessageDisplay');
            if (msgDisplay) {
                msgDisplay.textContent = 'لأمانك، يرجى تأكيد كلمة المرور لإكمال إنشاء الحساب.';
                msgDisplay.style.color = 'var(--danger)';
            }
            return window.showToast('يرجى إدخال كلمة المرور للتأكيد.', 'error');
        }
    }
    
    const tempRegistrationData = JSON.parse(storedData);
    const inputHash = await hashOTP(inputOTP, tempRegistrationData.email);
    
    if (inputHash !== tempRegistrationData.otpHash) {
        if (document.getElementById('recoveryPassGroup').style.display === 'block') {
            tempSecurePassword = null;
            document.getElementById('regPassRecovery').value = '';
        }
        return window.showToast('❌ الكود غير صحيح!', 'error');
    }

    const btn = document.getElementById('doVerifyOTPBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإنشاء ⏳...'; btn.disabled = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempSecurePassword); 
      await updateProfile(cred.user, { displayName: tempRegistrationData.name });
      
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { 
        uid: cred.user.uid, 
        name: tempRegistrationData.name, 
        email: tempRegistrationData.email,
        wishlist: [],
        createdAt: serverTimestamp() 
      });
      
      document.getElementById('authModal').style.display = 'none'; 
      window.showToast('🎉 تم إنشاء الحساب وتفعيله بنجاح!', 'success');
      
      if (typeof emailjs !== 'undefined') {
        const welcomeMessage = `حسابك دلوقتي جاهز ومفعل بنجاح.<br>تقدر تتصفح أحدث العروض، وتضيف منتجاتك المفضلة، وتتابع طلباتك بكل سهولة وأمان.<br><br><div class="btn-container"><a href="https://bn-max.com" class="btn">تصفح العروض الآن 🚀</a></div>`;
        emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: tempRegistrationData.name, to_email: tempRegistrationData.email, custom_message: welcomeMessage }).catch(() => {});
      }
      
      sessionStorage.removeItem('bn_temp_reg'); 
      tempSecurePassword = null;
      document.getElementById('regOTP').value = '';
      document.getElementById('regPassRecovery').value = '';
      document.getElementById('recoveryPassGroup').style.display = 'none';
      
    } catch (e) { 
      window.showToast('خطأ! ربما البريد مستخدم مسبقاً أو كلمة المرور غير صحيحة.', 'error'); 
      if (document.getElementById('recoveryPassGroup').style.display === 'block') {
          tempSecurePassword = null;
      }
    } finally { 
      btn.textContent = origText; btn.disabled = false; 
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => { 
    try { 
      await signOut(auth); 
      document.getElementById('userAccountModal').style.display = 'none'; 
      window.showToast('تم تسجيل الخروج!', 'success'); 
    } catch (e) {} 
  });
};
