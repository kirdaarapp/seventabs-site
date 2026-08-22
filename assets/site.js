// Shared sign-in + download logic for every page on 7tabs.org. Each page
// includes this as a module script and provides the same modal markup
// (see index.html's #signInOverlay) plus whichever of these optional
// trigger buttons it has: #navAppBtn (every page has this one),
// #heroAppBtn, #ctaAppBtn, #footAppBtn.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Scroll-reveal for every [data-animate] element on the page (feature
// cards, steps, plans, download cards, FAQ items, contact card). Runs
// on every page since it only touches elements that opt in via the
// attribute — pages with none of them are unaffected.
const revealTargets = document.querySelectorAll('[data-animate]');
if (revealTargets.length && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('in-view'));
}

// ---- Ambient particle field (dark starfield + cursor glow) ----
// A restrained nod to the reference sites shared for this project —
// small drifting/twinkling points plus a soft glow that follows the
// cursor. Off entirely under prefers-reduced-motion (site.css also
// hides the canvas in that case — this is the animation-side half),
// and paused whenever the tab isn't visible so it never wastes battery.
(function initParticleField() {
  const canvas = document.getElementById('fx');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || reduceMotion) return;

  const ctx = canvas.getContext('2d');
  const COLORS = ['108,99,255', '156,149,255', '255,255,255'];
  let w = 0;
  let h = 0;
  let particles = [];
  let rafId = null;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(120, Math.round((w * h) / 14000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      baseAlpha: Math.random() * 0.5 + 0.15,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.015 + 0.005,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);

    if (mouse.x > -999) {
      const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
      glow.addColorStop(0, 'rgba(108,99,255,0.10)');
      glow.addColorStop(1, 'rgba(108,99,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mouse.x - 220, mouse.y - 220, 440, 440);
    }

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      // Gentle pull toward the cursor — parallax-ish, never strong
      // enough to feel like a game, just a hint the field is alive.
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01 && dist < 160) {
        p.x -= (dx / dist) * 0.25;
        p.y -= (dy / dist) * 0.25;
      }

      p.twinkle += p.twinkleSpeed;
      const alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.twinkle));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${alpha})`;
      ctx.fill();
    });

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('pointerleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  resize();
  start();
})();

// Same project the app itself talks to (lib/core/supabase_config.dart) —
// this key is Supabase's own "safe to ship in client code" publishable
// key, meaningless without the Row Level Security policies enforced
// server-side. Signing in here writes the session to localStorage under
// the same 'sb-<project-ref>-auth-token' key supabase_flutter reads on
// web, so /app/ picks up this exact session on load — a real sign-in,
// not a redirect-and-hope.
const SUPABASE_URL = 'https://kamjtddqgofuasublpwc.supabase.co';
const supabase = createClient(
  SUPABASE_URL,
  'sb_publishable_25vQKsEQqDUEjEkuglU1Rg_GzEW9S3a'
);

// Honest, real "businesses on SevenTabs" count — see
// supabase/functions/public-stats. Not a fabricated "N people online"
// figure: it's the real count of registered companies, refreshed
// periodically so the number on the page can't silently go stale.
const pillText = document.getElementById('pillText');
if (pillText) {
  const loadStats = () => {
    fetch(`${SUPABASE_URL}/functions/v1/public-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.companies === 'number' && data.companies > 0) {
          pillText.textContent = `${data.companies}+ businesses run on SevenTabs`;
        }
      })
      .catch(() => {}); // Keep the static fallback text — never show a broken stat.
  };
  loadStats();
  setInterval(loadStats, 60000);
}

// Which browser/device this is, for both the "device already trusted"
// check below and the native-download step further down.
const DEVICE_TRUST_KEY = 'sevenTabsTrustedEmails';
function isDeviceTrusted(email) {
  try {
    const list = JSON.parse(localStorage.getItem(DEVICE_TRUST_KEY) || '[]');
    return list.includes(email.trim().toLowerCase());
  } catch {
    return false;
  }
}
function markDeviceTrusted(email) {
  try {
    const list = JSON.parse(localStorage.getItem(DEVICE_TRUST_KEY) || '[]');
    const norm = email.trim().toLowerCase();
    if (!list.includes(norm)) list.push(norm);
    localStorage.setItem(DEVICE_TRUST_KEY, JSON.stringify(list));
  } catch {
    // Worst case this device asks for a code again next time — never
    // block sign-in over a storage failure (e.g. private browsing).
  }
}

const overlay = document.getElementById('signInOverlay');
// No overlay on this page (shouldn't happen — every page carries the
// shared header partial — but fail quietly rather than throw).
if (overlay) {
  const navAppBtn = document.getElementById('navAppBtn');
  const heroAppBtn = document.getElementById('heroAppBtn');
  const heroAppBtnLabel = document.getElementById('heroAppBtnLabel');
  const ctaAppBtn = document.getElementById('ctaAppBtn');
  const footAppBtn = document.getElementById('footAppBtn');
  const closeBtn = document.getElementById('closeSignIn');
  const modalTitle = document.getElementById('signInTitle');
  const modalSubtitle = document.getElementById('signInSubtitle');
  const form = document.getElementById('signInForm');
  const footer = document.getElementById('signInFooter');
  const errorBox = document.getElementById('signInError');
  const submitBtn = document.getElementById('signInSubmit');
  const successBox = document.getElementById('signInSuccess');
  const successText = document.getElementById('signInSuccessText');
  const downloadBtn = document.getElementById('signInDownloadBtn');

  // ---- Signup: full business signup on the website itself, instead of
  // sending "New business?" off to /app/ (which used to skip straight to
  // the app's own login screen with no way to actually create an
  // account from here). Collects the same details the app's own
  // onboarding asks for (business name, your name, email, phone,
  // password), creates the Supabase auth user + company row directly,
  // then reuses the exact same OTP device-confirmation and
  // download-on-success flow as sign-in below.
  const goToSignUpBtn = document.getElementById('goToSignUpBtn');
  const signUpPanel = document.getElementById('signUpPanel');
  const signUpForm = document.getElementById('signUpForm');
  const signUpError = document.getElementById('signUpError');
  const signUpSubmit = document.getElementById('signUpSubmit');
  const signUpBackBtn = document.getElementById('signUpBackBtn');
  const DEFAULT_TITLE = modalTitle ? modalTitle.textContent : '';
  const DEFAULT_SUBTITLE = modalSubtitle ? modalSubtitle.textContent : '';
  let justSignedUp = false;

  // One-time device-confirmation code step — mirrors the app's own
  // device-trust flow (CloudAuthRepository.sendDeviceConfirmationCode /
  // verifyDeviceConfirmationCode, DeviceTrustStore): a password alone is
  // never enough on a device that hasn't proven it controls the inbox
  // yet. localStorage here plays the same role DeviceTrustStore plays
  // on the app side — once verified, this exact browser skips the code
  // on future sign-ins with the same email.
  const otpPanel = document.getElementById('signInOtp');
  const otpIcon = otpPanel ? otpPanel.querySelector('.otp-icon') : null;
  const otpText = document.getElementById('otpText');
  const otpBoxesWrap = document.getElementById('otpBoxes');
  const otpBoxes = otpBoxesWrap
    ? Array.from(otpBoxesWrap.querySelectorAll('.otp-box'))
    : [];
  const otpError = document.getElementById('otpError');
  const otpVerifyBtn = document.getElementById('otpVerifyBtn');
  const otpResendBtn = document.getElementById('otpResendBtn');
  const otpBackBtn = document.getElementById('otpBackBtn');

  let hasSession = false;
  let pendingEmail = '';
  let otpCooldownTimer = null;

  // Builds are published to kirdaarapp/seventabs-site's releases, not
  // this repo's own — Account-software is private, and GitHub Release
  // assets on a private repo 404 for an anonymous download regardless
  // of anything here (confirmed directly: even the release page itself
  // 404s with no auth). seventabs-site is already public (it's the
  // GitHub Pages mirror serving 7tabs.org itself), so its releases are
  // real public downloads. See build-windows.yml's own comment on its
  // release step for the full story.
  const PLATFORM_BUILDS = {
    windows: {
      label: 'Windows',
      file: 'SevenTabs-Windows.zip',
      url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Windows.zip',
    },
    android: {
      label: 'Android',
      file: 'SevenTabs-Android.apk',
      url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Android.apk',
    },
    mac: {
      label: 'Mac',
      file: 'SevenTabs-macOS.zip',
      url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-macOS.zip',
    },
  };

  // Windows/Android/Mac get a real native build; iOS (no build
  // published — see the Download page's "Coming soon" card) falls
  // back to the browser, which is the only thing that'll actually run
  // there today.
  function detectDownload() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return PLATFORM_BUILDS.windows;
    if (/Android/i.test(ua)) return PLATFORM_BUILDS.android;
    if (/Macintosh/i.test(ua)) return PLATFORM_BUILDS.mac;
    return null;
  }

  // A real <a download> click for a given platform's build — same safe
  // technique showSuccess() below uses (never location.href, so it can
  // never navigate the page away even without a Content-Disposition
  // header). Used by the platform download cards directly, with no
  // sign-in/session involved at all: getting the installer is free and
  // needs no account, only the cloud/team product does.
  function triggerDirectDownload(platform) {
    const build = PLATFORM_BUILDS[platform];
    if (!build) return;
    const a = document.createElement('a');
    a.href = build.url;
    a.setAttribute('download', build.file);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Shown once a session exists AND this device has proven it via the
  // OTP step (or already had, on a repeat visit) — downloads first,
  // browser is the fallback link, never the other way around.
  function showSuccess() {
    form.hidden = true;
    footer.hidden = true;
    if (signUpPanel) signUpPanel.hidden = true;
    if (otpPanel) otpPanel.hidden = true;
    successBox.hidden = false;
    const greeting = justSignedUp ? "Your account is ready and you're signed in." : "You're signed in.";
    const dl = detectDownload();
    if (dl) {
      successText.textContent = `${greeting} Downloading SevenTabs for ${dl.label}…`;
      downloadBtn.href = dl.url;
      downloadBtn.setAttribute('download', dl.file);
      downloadBtn.textContent = `Download for ${dl.label} again`;
      downloadBtn.style.display = 'inline-flex';
      // A real <a download> click — unlike setting location.href, this
      // can never navigate the page away even if a proxy/CDN ever serves
      // the asset without a Content-Disposition: attachment header.
      downloadBtn.click();
    } else {
      successText.textContent = `${greeting} There's no native build for this device yet, so open SevenTabs in your browser instead.`;
      downloadBtn.style.display = 'none';
    }
    justSignedUp = false;
  }

  function resetModal() {
    if (modalTitle) modalTitle.textContent = DEFAULT_TITLE;
    if (modalSubtitle) modalSubtitle.textContent = DEFAULT_SUBTITLE;
    form.hidden = false;
    footer.hidden = false;
    if (signUpPanel) signUpPanel.hidden = true;
    if (otpPanel) otpPanel.hidden = true;
    successBox.hidden = true;
    form.reset();
    errorBox.classList.remove('show');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
    if (signUpForm) signUpForm.reset();
    if (signUpError) signUpError.classList.remove('show');
    if (signUpSubmit) {
      signUpSubmit.disabled = false;
      signUpSubmit.textContent = 'Create account';
    }
    justSignedUp = false;
    stopOtpCooldown();
  }

  // Swaps the modal into signup mode — same overlay/shell, different
  // panel, so it never feels like a separate disconnected page.
  function showSignUp() {
    form.hidden = true;
    footer.hidden = true;
    if (otpPanel) otpPanel.hidden = true;
    successBox.hidden = true;
    if (signUpPanel) signUpPanel.hidden = false;
    if (modalTitle) modalTitle.textContent = 'Create your SevenTabs account';
    if (modalSubtitle) modalSubtitle.textContent = "Set up your business — you'll verify your email with a one-time code, then get SevenTabs for your device.";
    errorBox.classList.remove('show');
    if (signUpError) signUpError.classList.remove('show');
    const first = document.getElementById('suBusiness');
    if (first) first.focus();
  }

  function openModal() {
    overlay.classList.add('open');
    if (hasSession) {
      showSuccess();
    } else {
      resetModal();
      document.getElementById('siEmail').focus();
    }
  }
  function closeModal() {
    overlay.classList.remove('open');
  }

  [navAppBtn, heroAppBtn, ctaAppBtn, footAppBtn].forEach((btn) => {
    if (btn) btn.addEventListener('click', openModal);
  });

  // Platform-specific download cards (index.html + download.html) —
  // deliberately NOT gated behind sign-in: getting the installer is
  // free and needs no email, unlike every other "Get SevenTabs" entry
  // point above, which is the cloud/team product and keeps its
  // existing sign-in-first flow untouched.
  document.querySelectorAll('[data-platform]').forEach((btn) => {
    btn.addEventListener('click', () => triggerDirectDownload(btn.dataset.platform));
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Promo popup — the real offer already backing the Pro plan (30-day
  // trial, no card). Only present in index.html's markup (see
  // marketing/index.html), so it can never appear on any other page —
  // and shown at most once per browser via localStorage, so it doesn't
  // reappear on every refresh either. Also skipped once we know there's
  // a live session — an already-signed-in visitor doesn't need a trial
  // pitch. See the getSession().then() below for that half.
  const PROMO_SEEN_KEY = 'seventabs_promo_seen';
  const promoPopup = document.getElementById('promoPopup');
  if (promoPopup) {
    const promoPopupCta = document.getElementById('promoPopupCta');
    const promoPopupClose = document.getElementById('promoPopupClose');
    const promoPopupSignIn = document.getElementById('promoPopupSignIn');
    function closePromoPopup() {
      promoPopup.classList.remove('open');
    }
    if (promoPopupCta) {
      promoPopupCta.addEventListener('click', () => {
        closePromoPopup();
        openModal();
      });
    }
    if (promoPopupSignIn) {
      promoPopupSignIn.addEventListener('click', (e) => {
        e.preventDefault();
        closePromoPopup();
        openModal();
      });
    }
    if (promoPopupClose) promoPopupClose.addEventListener('click', closePromoPopup);
    promoPopup.addEventListener('click', (e) => { if (e.target === promoPopup) closePromoPopup(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePromoPopup(); });
  }

  // ---- OTP step ----

  function stopOtpCooldown() {
    if (otpCooldownTimer) clearInterval(otpCooldownTimer);
    otpCooldownTimer = null;
    if (otpResendBtn) {
      otpResendBtn.disabled = false;
      otpResendBtn.textContent = 'Resend code';
    }
  }

  function startOtpCooldown() {
    if (!otpResendBtn) return;
    let seconds = 60;
    otpResendBtn.disabled = true;
    otpResendBtn.textContent = `Resend code in ${seconds}s`;
    otpCooldownTimer = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        stopOtpCooldown();
        return;
      }
      otpResendBtn.textContent = `Resend code in ${seconds}s`;
    }, 1000);
  }

  function otpFriendlyError(error) {
    const msg = error && error.message ? error.message : String(error);
    if (/expired|invalid/i.test(msg)) return "That code's wrong or has expired. Try again or resend.";
    return msg;
  }

  function clearOtpBoxes() {
    otpBoxes.forEach((box) => {
      box.value = '';
      box.classList.remove('filled');
    });
    if (otpBoxes[0]) otpBoxes[0].focus();
  }

  async function sendOtp(email) {
    pendingEmail = email;
    form.hidden = true;
    footer.hidden = true;
    if (signUpPanel) signUpPanel.hidden = true;
    successBox.hidden = true;
    otpPanel.hidden = false;
    if (modalTitle) modalTitle.textContent = 'Verify your email';
    if (modalSubtitle) modalSubtitle.textContent = '';
    if (otpIcon) otpIcon.classList.remove('ok');
    otpError.classList.remove('show');
    otpText.textContent = justSignedUp
      ? `Almost done — we sent a 6-digit code to ${email} to confirm it's really you.`
      : `Since this is the first time you're signing in on this browser, we sent a 6-digit code to ${email}.`;
    clearOtpBoxes();
    otpVerifyBtn.disabled = false;
    otpVerifyBtn.textContent = 'Verify & continue';
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, shouldCreateUser: false });
      if (error) throw error;
      startOtpCooldown();
    } catch (e) {
      otpError.textContent = otpFriendlyError(e);
      otpError.classList.add('show');
    }
  }

  async function verifyOtp() {
    const code = otpBoxes.map((b) => b.value).join('');
    if (code.length !== 6) {
      otpError.textContent = 'Enter all 6 digits from the email.';
      otpError.classList.add('show');
      return;
    }
    otpError.classList.remove('show');
    otpVerifyBtn.disabled = true;
    otpVerifyBtn.textContent = 'Verifying…';
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: code,
        type: 'email',
      });
      if (error) throw error;
      markDeviceTrusted(pendingEmail);
      hasSession = true;
      stopOtpCooldown();
      if (otpIcon) {
        otpIcon.classList.add('ok');
        otpIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
      }
      otpText.textContent = "Device confirmed. You won't need to do this again on this browser.";
      setTimeout(showSuccess, 650);
    } catch (e) {
      otpError.textContent = otpFriendlyError(e);
      otpError.classList.add('show');
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = 'Verify & continue';
      if (otpBoxesWrap) {
        otpBoxesWrap.classList.remove('shake');
        // eslint-disable-next-line no-void
        void otpBoxesWrap.offsetWidth; // restart the animation on repeat errors
        otpBoxesWrap.classList.add('shake');
      }
      clearOtpBoxes();
    }
  }

  if (otpBoxes.length) {
    otpBoxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        box.classList.toggle('filled', box.value !== '');
        if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus();
        if (otpBoxes.every((b) => b.value)) verifyOtp();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) otpBoxes[i - 1].focus();
      });
      box.addEventListener('paste', (e) => {
        const digits = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, otpBoxes.length);
        if (!digits.length) return;
        e.preventDefault();
        digits.forEach((d, j) => {
          if (otpBoxes[j]) {
            otpBoxes[j].value = d;
            otpBoxes[j].classList.add('filled');
          }
        });
        const next = otpBoxes[digits.length] || otpBoxes[otpBoxes.length - 1];
        next.focus();
        if (otpBoxes.every((b) => b.value)) verifyOtp();
      });
    });
  }
  if (otpVerifyBtn) otpVerifyBtn.addEventListener('click', verifyOtp);
  if (otpResendBtn) otpResendBtn.addEventListener('click', () => sendOtp(pendingEmail));
  if (otpBackBtn) {
    otpBackBtn.addEventListener('click', async () => {
      stopOtpCooldown();
      await supabase.auth.signOut();
      resetModal();
      document.getElementById('siEmail').focus();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    const email = document.getElementById('siEmail').value.trim();
    const password = document.getElementById('siPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
    if (error) {
      errorBox.textContent = error.message === 'Invalid login credentials'
        ? 'Wrong email or password.'
        : error.message;
      errorBox.classList.add('show');
      return;
    }
    if (isDeviceTrusted(email)) {
      hasSession = true;
      showSuccess();
    } else {
      await sendOtp(email);
    }
  });

  if (goToSignUpBtn) goToSignUpBtn.addEventListener('click', showSignUp);
  if (signUpBackBtn) {
    signUpBackBtn.addEventListener('click', () => {
      resetModal();
      document.getElementById('siEmail').focus();
    });
  }

  function signUpFriendlyError(error) {
    const msg = error && error.message ? error.message : String(error);
    if (/already registered|already exists/i.test(msg)) {
      return 'An account already exists for that email — sign in instead.';
    }
    if (/password/i.test(msg) && /least|short|characters/i.test(msg)) {
      return 'Password must be at least 8 characters.';
    }
    return msg;
  }

  // At least 8 characters, with lowercase, uppercase, a digit and a
  // symbol — matches the hint text under the Password field.
  const STRONG_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signUpError.classList.remove('show');

      const businessName = document.getElementById('suBusiness').value.trim();
      const yourName = document.getElementById('suName').value.trim();
      const email = document.getElementById('suEmail').value.trim();
      const phone = document.getElementById('suPhone').value.trim();
      const password = document.getElementById('suPassword').value;
      const passwordConfirm = document.getElementById('suPasswordConfirm').value;

      if (!STRONG_PASSWORD_RULE.test(password)) {
        signUpError.textContent = 'Password must be at least 8 characters and include uppercase, lowercase, a number and a symbol.';
        signUpError.classList.add('show');
        document.getElementById('suPassword').focus();
        return;
      }
      if (password !== passwordConfirm) {
        signUpError.textContent = "Passwords don't match.";
        signUpError.classList.add('show');
        document.getElementById('suPasswordConfirm').focus();
        return;
      }

      signUpSubmit.disabled = true;
      signUpSubmit.textContent = 'Creating account…';

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: yourName, phone } },
        });
        if (error) throw error;
        // Supabase's documented signal for "this email is already a
        // confirmed user" when email confirmations are off: signUp
        // still returns 200 with no error, but no new identity gets
        // attached. Catch it here instead of silently creating nothing.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('An account already exists for that email — sign in instead.');
        }

        // Company creation mirrors the app's own onboarding exactly
        // (CloudOnboardingScreen.finishCreateCompany): insert the
        // company, then overwrite the display_name a DB trigger
        // auto-fills from the JWT email with the name actually typed
        // in. Phone isn't a company_members column (yet), so it's kept
        // on the auth user's own metadata instead, set above.
        const { data: companyRow, error: companyError } = await supabase
          .from('companies')
          .insert({ name: businessName })
          .select()
          .single();
        if (companyError) throw companyError;

        const { error: memberError } = await supabase
          .from('company_members')
          .update({ display_name: yourName })
          .eq('company_id', companyRow.id)
          .eq('user_id', data.user.id);
        if (memberError) throw memberError;

        justSignedUp = true;
        await sendOtp(email);
      } catch (err) {
        signUpError.textContent = signUpFriendlyError(err);
        signUpError.classList.add('show');
      } finally {
        signUpSubmit.disabled = false;
        signUpSubmit.textContent = 'Create account';
      }
    });
  }

  // If already signed in on this device, every entry point should say
  // so instead of a generic "sign in" prompt — small but real touch.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      hasSession = true;
      if (navAppBtn) navAppBtn.textContent = 'Get SevenTabs →';
      if (heroAppBtnLabel) heroAppBtnLabel.textContent = 'Get SevenTabs for your device';
      if (ctaAppBtn) ctaAppBtn.textContent = 'Get SevenTabs for your device →';
      if (footAppBtn) footAppBtn.textContent = 'Get SevenTabs';
    } else if (promoPopup && !localStorage.getItem(PROMO_SEEN_KEY)) {
      // A beat after load so it doesn't compete with the page's own
      // entrance animations for attention. Marked as seen immediately
      // so it never shows again on this browser, even without the
      // visitor closing it.
      localStorage.setItem(PROMO_SEEN_KEY, '1');
      setTimeout(() => promoPopup.classList.add('open'), 900);
    }
  });
}

// ---- Customer-care widget: floating button + form, on every page ----
// Built and injected here instead of duplicated per-page HTML so every
// page carries the exact same contact experience — no separate
// "Contact" page section to scroll to anymore (see help.html, which
// used to have one at the very bottom).
(function initCareWidget() {
  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" id="careBtn" class="care-btn" aria-label="Contact support">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
    <div class="care-panel" id="carePanel">
      <div class="care-panel-head">
        <div>
          <strong>Customer care</strong>
          <p>We usually reply within a few hours.</p>
        </div>
        <button type="button" class="modal-close" id="careClose" aria-label="Close" style="position:static">&times;</button>
      </div>
      <form id="contactForm">
        <label class="field-label" for="cName">Name</label>
        <input class="field-input" id="cName" type="text" autocomplete="name" required>
        <label class="field-label" for="cEmail">Email</label>
        <input class="field-input" id="cEmail" type="email" autocomplete="email" required>
        <label class="field-label" for="cPhone">Phone number</label>
        <input class="field-input" id="cPhone" type="tel" autocomplete="tel" required>
        <div class="care-field-label-row">
          <label class="field-label" for="cMessage" style="margin-bottom:0">Message</label>
          <span class="care-counter" id="careCounter">0/500</span>
        </div>
        <textarea class="field-input" id="cMessage" rows="4" maxlength="500" required></textarea>
        <!-- Honeypot — real visitors never see or fill this in. -->
        <input class="hp-field" id="cWebsite" type="text" tabindex="-1" autocomplete="off">
        <button class="btn btn-primary" type="submit" id="contactSubmit" style="width:100%;justify-content:center;margin-top:14px">Send message</button>
        <div class="contact-status" id="contactStatus"></div>
      </form>
    </div>
  `);

  const careBtn = document.getElementById('careBtn');
  const carePanel = document.getElementById('carePanel');
  const careClose = document.getElementById('careClose');
  const cMessage = document.getElementById('cMessage');
  const careCounter = document.getElementById('careCounter');

  function toggleCare(open) {
    const next = open ?? !carePanel.classList.contains('open');
    carePanel.classList.toggle('open', next);
  }
  careBtn.addEventListener('click', () => toggleCare());
  careClose.addEventListener('click', () => toggleCare(false));
  document.addEventListener('click', (e) => {
    if (!carePanel.classList.contains('open')) return;
    if (carePanel.contains(e.target) || careBtn.contains(e.target)) return;
    toggleCare(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleCare(false); });

  // Every existing "Contact"/"Talk to us" link on any page opens this
  // widget directly instead of navigating to a page section — works
  // the same whether the link's href is "#contact" or "help.html#contact".
  document.querySelectorAll('a[href$="#contact"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Without this, the click bubbles up to the document-level
      // "outside click closes the panel" listener below, which would
      // otherwise close the panel in the same tick it just opened.
      e.stopPropagation();
      toggleCare(true);
    });
  });

  cMessage.addEventListener('input', () => {
    const len = cMessage.value.length;
    careCounter.textContent = `${len}/500`;
    careCounter.classList.toggle('warn', len > 450);
  });

  const contactForm = document.getElementById('contactForm');
  const contactSubmit = document.getElementById('contactSubmit');
  const contactStatus = document.getElementById('contactStatus');

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    contactStatus.className = 'contact-status';
    contactSubmit.disabled = true;
    contactSubmit.textContent = 'Sending…';
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: 'sb_publishable_25vQKsEQqDUEjEkuglU1Rg_GzEW9S3a',
        },
        body: JSON.stringify({
          name: document.getElementById('cName').value.trim(),
          email: document.getElementById('cEmail').value.trim(),
          phone: document.getElementById('cPhone').value.trim(),
          message: cMessage.value.trim(),
          website: document.getElementById('cWebsite').value,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      contactStatus.textContent = 'Thank you so much for your interest — the SevenTabs team will contact you soon.';
      contactStatus.classList.add('show', 'ok');
      contactForm.reset();
      careCounter.textContent = '0/500';
      careCounter.classList.remove('warn');
    } catch (err) {
      contactStatus.textContent = "That didn't go through — please try again in a moment, or email us directly at support@7tabs.org.";
      contactStatus.classList.add('show', 'err');
    } finally {
      contactSubmit.disabled = false;
      contactSubmit.textContent = 'Send message';
    }
  });
})();

// ---- Mouse-follow 3D tilt for a page's one focal element ----
// Each page gets at most one of these deliberately, not applied to every
// card on the page — a mouse-follow tilt on many elements at once reads
// as noisy rather than as a deliberate depth cue. Off under
// prefers-reduced-motion (the resting CSS tilt still applies from
// home.css/checkout.css; only the pointer-follow motion is skipped),
// and paused the instant the pointer leaves so it always settles back
// to the resting tilt rather than getting stuck mid-tween.
function initTilt(wrapId, tiltId, restY, rangeX, rangeY) {
  const wrap = document.getElementById(wrapId);
  const tilt = document.getElementById(tiltId);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!wrap || !tilt || reduceMotion) return;
  if (window.matchMedia('(max-width: 720px)').matches) return; // flattened on phones

  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;  // 0..1 across the element
    const py = (e.clientY - r.top) / r.height;
    tilt.style.setProperty('--tilt-y', `${(px - 0.5) * -2 * rangeX}deg`);
    tilt.style.setProperty('--tilt-x', `${(0.5 - py) * -2 * rangeY + restY}deg`);
  });
  wrap.addEventListener('pointerleave', () => {
    tilt.style.removeProperty('--tilt-y');
    tilt.style.removeProperty('--tilt-x');
  });
}
// index.html hero mockup — #preview3d/#previewTilt aren't on any other
// page, so this call is a no-op everywhere else.
initTilt('preview3d', 'previewTilt', 9, 12, 7);
// checkout.html payment card — #payCard3d/#payCard aren't on any other
// page. Smaller swing than the hero since the card itself is smaller.
initTilt('payCard3d', 'payCard', 5, 9, 5);
