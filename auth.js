// auth.js
import { auth, db, appId, ADMIN_UID, googleProvider } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let currentUserProfile = null;
export const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);

let tempSecurePassword = null;

const hashOTP = async (otp, email) => {
  const msgUint8 = new TextEncoder().encode(otp + email + "BN_MAX_SECURE");
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const initAuth = (translations, currentLang, onUserChangeCallback) => {
  
  // التعديل هنا: تحسين التقاط نتيجة تسجيل الدخول بعد التحويل (Redirect)
  getRedirectResult(auth).then(async (result) => {
    if (result && result.user) {
      const user = result.user;
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'مستخدم جوجل', photoURL: user.photoURL || '' };
      
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { 
        uid: user.uid, 
        name: user.displayName || 'مستخدم جوجل', 
        email: user.email, 
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp() 
      }, { merge: true });

      if (window.showToast) window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      if (onUserChangeCallback) onUserChangeCallback(user, currentUserProfile);
      
      // إغلاق نافذة التسجيل لو لسه مفتوحة
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.style.display = 'none';
    }
  }).catch((error) => {
    console.error("Redirect Auth Error:", error);
    if (window.showToast) window.showToast('حدث خطأ أثناء العودة من جوجل: ' + error.message, 'error');
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'مستخدم', photoURL: user.photoURL || '' };
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
          
          // التعديل: فحص وجود جلسة تسجيل معلقة (OTP) لعدم طرد العميل عند الـ Refresh
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
          }
      }
  });

  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
        authModal.style.display = 'none'; 
        window.showToast('تم تسجيل الدخول بنجاح!', 'success'); 
    } catch (e) { 
        window.showToast('البيانات غير صحيحة!', 'error'); 
    }
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { 
        uid: user.uid, 
        name: user.displayName || 'مستخدم جوجل', 
        email: user.email, 
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp() 
      }, { merge: true });

      if (authModal) authModal.style.display = 'none';
      if (window.showToast) window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      
    } catch (e) { 
      console.warn("Popup blocked, switching to redirect:", e);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        console.error("Redirect Error:", redirectErr);
        if (window.showToast) window.showToast('تعذر تسجيل الدخول بواسطة جوجل.', 'error');
      }
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
    
    // التعديل: التعامل مع الباسورد المفقود بدلاً من طرد العميل
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
        // لو الكود غلط وهو في وضع الاستعادة، نمسح الباسورد اللي دخله عشان يدخله تاني صح
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
        photoURL: '', 
        createdAt: serverTimestamp() 
      });
      
      document.getElementById('authModal').style.display = 'none'; 
      window.showToast('🎉 تم إنشاء الحساب وتفعيله بنجاح!', 'success');
      
      if (typeof emailjs !== 'undefined') {
        const welcomeMessage = `حسابك دلوقتي جاهز ومفعل بنجاح.<br>تقدر تتصفح أحدث العروض، وتضيف منتجاتك المفضلة، وتتابع طلباتك بكل سهولة وأمان.<br><br><div class="btn-container"><a href="https://bn-max.com" class="btn">تصفح العروض الآن 🚀</a></div>`;
        emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: tempRegistrationData.name, to_email: tempRegistrationData.email, custom_message: welcomeMessage }).catch(err => console.log("Welcome Email Error"));
      }
      
      sessionStorage.removeItem('bn_temp_reg'); 
      tempSecurePassword = null;
      document.getElementById('regOTP').value = '';
      document.getElementById('regPassRecovery').value = '';
      document.getElementById('recoveryPassGroup').style.display = 'none';
      
    } catch (e) { 
      window.showToast('خطأ! ربما البريد مستخدم مسبقاً أو كلمة المرور غير صحيحة.', 'error'); 
      // تصفير الباسورد لو فيه خطأ عشان المحاولة الجاية
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
