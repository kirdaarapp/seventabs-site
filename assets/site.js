// Shared script for every page on 7tabs.org (2026-11 redesign).
// No sign-in on the website any more: every "get the app" button is a
// direct download for the visitor's device. Also: honest visitor and
// download counts, customer reviews, and the customer-care widget.
// Everything here fails quietly — if the cloud can't be reached, the
// page still works and simply hides the numbers/reviews.

const SUPABASE_URL = 'https://kamjtddqgofuasublpwc.supabase.co';
// Supabase's publishable key: safe in client code (RLS + the functions
// decide what it can do).
const SUPABASE_ANON_KEY = 'sb_publishable_25vQKsEQqDUEjEkuglU1Rg_GzEW9S3a';
const SITE_API = `${SUPABASE_URL}/functions/v1/site-public`;

// Page language: the Arabic pages (marketing/ar/) say lang="ar".
const AR = (document.documentElement.lang || '').toLowerCase().startsWith('ar');
const L = (en, ar) => (AR ? ar : en);

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Scroll-reveal for [data-animate] elements (older pages use it).
const revealTargets = document.querySelectorAll('[data-animate]');
if (revealTargets.length && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('in-view'));
}

// ---- Downloads ----
export const BUILDS = {
  windows: {
    label: L('Windows', 'ويندوز'), file: 'SevenTabs-Windows.zip',
    url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Windows.zip',
  },
  android: {
    label: L('Android', 'أندرويد'), file: 'SevenTabs-Android.apk',
    url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Android.apk',
  },
  mac: {
    label: L('Mac', 'ماك'), file: 'SevenTabs-macOS.zip',
    url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-macOS.zip',
  },
};
const ICONS = {
  windows: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5 10.5 4.5v7H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>',
  android: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>',
  mac: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.9-.8-3.1-.8C6.8 7.3 5.3 8.2 4.5 9.7c-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.4s1.6-.8 3.1-.8 1.8.8 3.1.7 2-1.1 2.8-2.3c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-4zM14.2 5.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>',
};
export function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return null; // no iOS build yet
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  return null;
}
const myPlatform = detectPlatform();

function track(kind, platform) {
  try {
    fetch(SITE_API, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'hit', kind, platform: platform || null, path: location.pathname, sid: sessionId() }),
    }).catch(() => {});
  } catch (_) { /* never block the page */ }
}
function sessionId() {
  try {
    let id = sessionStorage.getItem('st_sid');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
      sessionStorage.setItem('st_sid', id);
    }
    return id;
  } catch (_) { return 'anon'; }
}

function startDownload(platform) {
  const b = BUILDS[platform];
  if (!b) return;
  track('download', platform);
  const a = document.createElement('a');
  a.href = b.url;
  a.setAttribute('download', b.file);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// [data-get]           → "Download for <your device>" (falls back to the
//                         download page when the device has no build).
// [data-get="android"] → that platform's build.
document.querySelectorAll('[data-get]').forEach((el) => {
  const want = el.getAttribute('data-get') || myPlatform;
  const label = el.querySelector('[data-get-label]');
  const icon = el.querySelector('[data-get-icon]');
  if (!el.getAttribute('data-get')) {
    if (want && BUILDS[want]) {
      if (label) label.textContent = L(`Download for ${BUILDS[want].label}`, `حمّل لـ${BUILDS[want].label}`);
      if (icon) icon.innerHTML = ICONS[want];
    } else {
      if (label) label.textContent = L('See all downloads', 'كل التحميلات');
      if (icon) icon.innerHTML = '';
    }
  }
  el.addEventListener('click', (e) => {
    if (!want || !BUILDS[want]) return; // let the link open download.html
    e.preventDefault();
    startDownload(want);
  });
});

// Download page: put this device's card first and mark it.
const dlCards = document.querySelectorAll('[data-plat]');
dlCards.forEach((card) => {
  if (card.getAttribute('data-plat') === myPlatform) {
    card.classList.add('me');
    card.parentElement.prepend(card);
    const btn = card.querySelector('.a-btn');
    if (btn) { btn.classList.remove('out'); btn.classList.add('primary'); }
  }
});

// Phone bottom bar: only on phones we have a build for.
const mbar = document.getElementById('mbar');
if (mbar) {
  if (myPlatform === 'android') {
    mbar.hidden = false;
    document.body.classList.add('has-mbar');
  } else {
    mbar.remove();
  }
}

// Respect "reduce motion": show the still picture instead of the video.
try {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('video[autoplay]').forEach((v) => {
      v.removeAttribute('autoplay');
      v.pause();
    });
  }
} catch (_) { /* ignore */ }

// ---- Visits, downloads, people here now ----
// One "visit" per browser tab session; a light ping while the page is
// open so "here now" is real. Numbers show only when the cloud answers.
try {
  if (!sessionStorage.getItem('st_seen')) {
    sessionStorage.setItem('st_seen', '1');
    track('visit', myPlatform);
  } else {
    track('ping', myPlatform);
  }
} catch (_) { track('visit', myPlatform); }
setInterval(() => { if (document.visibilityState === 'visible') track('ping', myPlatform); }, 60000);

const nf = new Intl.NumberFormat('en');
const counter = document.getElementById('siteCounter');
if (counter) {
  const load = () => fetch(`${SITE_API}?action=stats`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || typeof d.visitsMonth !== 'number') return;
      const first = counter.hidden;
      const set = (k, v) => {
        const el = counter.querySelector(`[data-stat="${k}"]`);
        if (first && typeof countUp === 'function') countUp(el, v); else el.textContent = nf.format(v);
      };
      set('visits', d.visitsMonth);
      set('downloads', d.downloads);
      counter.querySelector('[data-stat="now"]').textContent = nf.format(Math.max(1, d.liveNow));
      counter.hidden = false;
    })
    .catch(() => {});
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
}

function reduceMotionNow() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return true; }
}

// ---- Reviews ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function starsHtml(n) {
  const full = Math.round(n);
  return '★'.repeat(full) + `<span class="off">${'★'.repeat(5 - full)}</span>`;
}
const AV_COLORS = ['#5b4ff5', '#16a34a', '#db2777', '#0891b2', '#ea580c', '#7c3aed'];
function reviewCard(r) {
  const name = esc(r.name);
  const color = AV_COLORS[(r.name || '').length % AV_COLORS.length];
  return `<div class="a-card"><div class="a-stars" aria-label="${L(`${r.stars} out of 5`, `${r.stars} من 5`)}">${starsHtml(r.stars)}</div>`
    + `<p dir="auto">${L('“', '«')}${esc(r.text)}${L('”', '»')}</p><div class="a-who"><div class="a-av" style="background:${color}">${esc((r.name || '?').trim().charAt(0).toUpperCase())}</div>`
    + `<div dir="auto">${name}${r.business ? `<span dir="auto">${esc(r.business)}</span>` : ''}</div></div></div>`;
}
const rList = document.getElementById('reviewList');
// Loaded again after a review is written, changed or deleted, so the
// average and the count are always the live ones.
function reloadReviews() {
  if (!rList) return;
  const limit = Number(rList.getAttribute('data-limit') || 3);
  fetch(`${SITE_API}?action=reviews&limit=${limit}&t=${Date.now()}`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const empty = document.getElementById('reviewEmpty');
      const score = document.getElementById('reviewScore');
      if (!d || !Array.isArray(d.reviews) || d.reviews.length === 0) {
        rList.innerHTML = '';
        if (score) score.hidden = true;
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;
      rList.innerHTML = d.reviews.map(reviewCard).join('');
      if (typeof revealNew === 'function') revealNew(rList.children);
      if (score && d.count > 0) {
        score.querySelector('b').textContent = Number(d.average).toFixed(1);
        score.querySelector('.a-stars').innerHTML = starsHtml(d.average);
        score.querySelector('[data-count]').textContent = L(`from ${nf.format(d.count)} review${d.count === 1 ? '' : 's'}`, `من ${nf.format(d.count)} تقييم`);
        score.hidden = false;
      }
    })
    .catch(() => {
      const empty = document.getElementById('reviewEmpty');
      if (empty && !rList.children.length) empty.hidden = false;
    });
}
reloadReviews();

const rForm = document.getElementById('reviewForm');
if (rForm) {
  let stars = 0;
  const pick = rForm.querySelectorAll('.a-pick button');
  const textBox = rForm.querySelector('#rText');
  // A friendly answer for every rating. Honest on purpose: unhappy
  // customers are thanked and asked what to fix, never pushed to change
  // their stars (that would make the reviews untrustworthy).
  const MOODS = AR ? {
    1: ['😔', 'نأسف جدًا.', 'أخبرنا ما الخطأ — وسنصلحه.', 'ما الذي حدث؟ وما أول شيء يجب أن نصلحه؟'],
    2: ['😕', 'نأسف، لم يصل للمستوى المطلوب بعد.', 'أخبرنا بما ينقص وسيعمل فريقنا عليه.', 'ما الذي ينقص أو لا يعمل لديك؟'],
    3: ['🙂', 'شكرًا لك — نستطيع أن نكون أفضل.', 'ما الشيء الواحد الذي يجعل SevenTabs رائعًا لك؟', 'ما الذي يجب أن يتحسن؟'],
    4: ['😊', 'رائع، شكرًا لك!', 'هل من شيء صغير يجعله مثاليًا؟', 'ما الذي أعجبك؟ وهل من شيء نحسّنه؟'],
    5: ['🤩', 'رائع — شكرًا جزيلًا!', 'أسعدت فريقنا اليوم. أخبر الآخرين بما أحببته.', 'ما الذي أحببته في SevenTabs؟'],
  } : {
    1: ['😔', 'We are really sorry.', 'Please tell us what went wrong — we will make it right.', 'What went wrong? What should we fix first?'],
    2: ['😕', 'Sorry it is not good enough yet.', 'Tell us what is missing and our team will work on it.', 'What is missing or not working for you?'],
    3: ['🙂', 'Thank you — we can do better.', 'What one thing would make SevenTabs great for you?', 'What should be better?'],
    4: ['😊', 'Great, thank you!', 'Anything small that would make it perfect?', 'What do you like? Anything we should improve?'],
    5: ['🤩', 'Wow — thank you so much!', 'You made our team’s day. Tell others what you love.', 'What do you love about SevenTabs?'],
  };
  let mood = rForm.querySelector('.a-mood');
  if (!mood) {
    mood = document.createElement('div');
    mood.className = 'a-mood';
    mood.setAttribute('aria-live', 'polite');
    mood.hidden = true;
    rForm.querySelector('.a-pick').after(mood);
  }
  const paint = (hover) => pick.forEach((b, i) => {
    const n = hover || stars;
    b.classList.toggle('on', i < n);
    b.setAttribute('aria-pressed', String(i < stars));
  });
  const burst = () => {
    if (reduceMotionNow()) return;
    const host = rForm.querySelector('.a-pick');
    for (let k = 0; k < 18; k++) {
      const sp = document.createElement('span');
      sp.className = 'a-spark';
      sp.textContent = k % 3 === 0 ? '★' : '';
      const a = (Math.PI * 2 * k) / 18 + Math.random() * 0.3;
      const r = 60 + Math.random() * 70;
      sp.style.setProperty('--x', `${Math.cos(a) * r}px`);
      sp.style.setProperty('--y', `${Math.sin(a) * r - 20}px`);
      sp.style.setProperty('--c', ['#f59e0b', '#5b4ff5', '#db2777', '#16a34a'][k % 4]);
      sp.style.left = `${110 + Math.random() * 40}px`;
      host.appendChild(sp);
      setTimeout(() => sp.remove(), 1100);
    }
  };
  const choose = (n) => {
    stars = n;
    paint();
    pick.forEach((b, i) => {
      b.classList.remove('pop');
      if (i < n && !reduceMotionNow()) {
        void b.offsetWidth;
        b.style.setProperty('--pd', `${i * 0.06}s`);
        b.classList.add('pop');
      }
    });
    const [emoji, head, line, hint] = MOODS[n];
    mood.className = `a-mood m${n}`;
    mood.innerHTML = `<span class="a-mood-e">${emoji}</span><div><b>${head}</b><span>${line}</span>`
      + (n <= 3 ? `<a href="#suggest" class="a-mood-link">${L('Suggest an improvement ›', 'اقترح تحسينًا ‹')}</a>` : '') + '</div>';
    mood.hidden = false;
    if (!reduceMotionNow()) { mood.classList.remove('show'); void mood.offsetWidth; mood.classList.add('show'); }
    textBox.placeholder = hint;
    rForm.classList.toggle('happy', n === 5);
    if (n === 5) burst();
  };
  pick.forEach((b, i) => {
    b.addEventListener('click', () => choose(i + 1));
    b.addEventListener('mouseenter', () => paint(i + 1));
    b.addEventListener('mouseleave', () => paint());
  });
  // "Suggest an improvement" → the Ideas side (also switches the phone tab).
  rForm.addEventListener('click', (e) => {
    const a = e.target.closest('.a-mood-link');
    if (!a) return;
    const ideas = document.getElementById('ideaForm');
    if (!ideas) { location.href = 'reviews.html#suggest'; e.preventDefault(); return; }
    e.preventDefault();
    if (location.hash === '#suggest') window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = '#suggest';
    setTimeout(() => ideas.querySelector('#iTitle')?.focus({ preventScroll: true }), 700);
  });
  paint();
  const msg = document.getElementById('reviewMsg');
  const send = document.getElementById('reviewSend');
  // ---- Who is writing (user, 2026-11-02) ----
  // Only app users write reviews: the app opens this page with #r=<token>
  // (signed: who he is). Kept in this browser so he can come back to change
  // or delete his review; taken out of the address bar at once.
  const TOKEN_KEY = 'st_review_token';
  let token = '';
  // Reads #r=<token> (also when the page is already open and only the
  // address's # part changes); otherwise the one kept in this browser.
  const readToken = () => {
    const m = /(?:^#|&)r=([^&]+)/.exec(location.hash);
    if (m) {
      try { token = decodeURIComponent(m[1]); } catch (_) { token = m[1]; }
      try { localStorage.setItem(TOKEN_KEY, token); } catch (_) { /* this visit only */ }
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    }
    if (!token) {
      try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { token = ''; }
    }
    return false;
  };
  readToken();
  const appOnly = document.getElementById('reviewAppOnly');
  const mine = document.getElementById('myReview');
  const formTitle = document.getElementById('reviewFormTitle');
  const api = (body) => fetch(SITE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ ...body, token }),
  });
  const forget = () => {
    token = '';
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    rForm.hidden = true;
    if (mine) mine.hidden = true;
    if (appOnly) appOnly.hidden = false;
  };
  const fill = (r) => {
    rForm.querySelector('#rName').value = r ? r.name || '' : '';
    rForm.querySelector('#rBusiness').value = r ? r.business || '' : '';
    rForm.querySelector('#rText').value = r ? r.text || '' : '';
    if (r) choose(r.stars); else { stars = 0; paint(); mood.hidden = true; rForm.classList.remove('happy'); }
  };
  const showMine = (r) => {
    if (!mine) return;
    if (!r) { mine.hidden = true; return; }
    mine.innerHTML = `<b>${L('Your review', 'تقييمك')}</b>`
      + (r.hidden ? `<p class="a-msg err">${L('It is hidden from the website for now.', 'إنه مخفي عن الموقع حاليًا.')}</p>` : '')
      + reviewCard(r)
      + `<div class="a-mine-btns"><button type="button" class="a-btn small out" id="myEdit">${L('Edit', 'تعديل')}</button>`
      + `<button type="button" class="a-btn small danger" id="myDelete">${L('Delete', 'حذف')}</button></div>`;
    mine.hidden = false;
    mine.querySelector('#myEdit').addEventListener('click', () => {
      fill(r);
      if (formTitle) formTitle.textContent = L('Change your review', 'عدّل تقييمك');
      send.textContent = L('Save changes', 'احفظ التغييرات');
      mine.hidden = true;
      rForm.hidden = false;
      rForm.scrollIntoView({ behavior: reduceMotionNow() ? 'auto' : 'smooth', block: 'center' });
    });
    mine.querySelector('#myDelete').addEventListener('click', async () => {
      if (!window.confirm(L('Delete your review? This cannot be undone.', 'حذف تقييمك؟ لا يمكن التراجع عن ذلك.'))) return;
      try {
        const res = await api({ action: 'review_delete' });
        if (res.status === 403) { forget(); return; }
        if (!res.ok) throw new Error(String(res.status));
        reloadReviews();
        startMine();
      } catch (_) {
        window.alert(L("That didn't go through. Please try again in a moment.", 'لم يتم ذلك. حاول مرة أخرى بعد قليل.'));
      }
    });
  };
  const startMine = async () => {
    if (!token) { forget(); return; }
    if (appOnly) appOnly.hidden = true;
    try {
      const res = await api({ action: 'my_review' });
      if (res.status === 403) { forget(); return; }
      const d = res.ok ? await res.json() : null;
      const r = d && d.review;
      showMine(r);
      if (formTitle) formTitle.textContent = L('Write a review', 'اكتب تقييمًا');
      send.textContent = L('Send review', 'أرسل التقييم');
      fill(null);
      rForm.hidden = !!r;
    } catch (_) {
      // Offline: let him write; sending says if it failed.
      rForm.hidden = false;
    }
  };
  startMine();
  window.addEventListener('hashchange', () => { if (readToken()) startMine(); });
  rForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = rForm.querySelector('#rName').value.trim();
    const text = rForm.querySelector('#rText').value.trim();
    msg.hidden = true;
    if (!stars) {
      msg.className = 'a-msg err';
      msg.textContent = L('Please tap the stars to choose your rating.', 'اضغط على النجوم لاختيار تقييمك.');
      msg.hidden = false;
      return;
    }
    if (!name || text.length < 10) {
      msg.className = 'a-msg err';
      msg.textContent = L('Please write your name and a few words (at least 10 letters).', 'اكتب اسمك وبضع كلمات (10 أحرف على الأقل).');
      msg.hidden = false;
      return;
    }
    send.disabled = true;
    send.textContent = L('Sending…', 'جارٍ الإرسال…');
    try {
      const res = await api({
        action: 'review', name, text, stars,
        business: rForm.querySelector('#rBusiness').value.trim(),
        website: rForm.querySelector('#rWebsite').value,
      });
      if (res.status === 403) {
        forget();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      rForm.reset();
      stars = 0; paint(); mood.hidden = true; rForm.classList.remove('happy');
      textBox.placeholder = L('What do you like? What should be better?', 'ما الذي أعجبك؟ وما الذي يجب أن يتحسن؟');
      await startMine();
      reloadReviews();
      if (mine && !mine.hidden) {
        const ok = document.createElement('p');
        ok.className = 'a-msg ok';
        ok.textContent = L('Thank you! Your review is on the website now.', 'شكرًا لك! تقييمك على الموقع الآن.');
        mine.prepend(ok);
      }
    } catch (_) {
      msg.className = 'a-msg err';
      msg.textContent = L("That didn't go through. Please try again in a moment.", 'لم يتم الإرسال. حاول مرة أخرى بعد قليل.');
      msg.hidden = false;
    } finally {
      send.disabled = false;
      if (send.textContent === L('Sending…', 'جارٍ الإرسال…')) {
        send.textContent = formTitle && formTitle.textContent === L('Change your review', 'عدّل تقييمك')
          ? L('Save changes', 'احفظ التغييرات')
          : L('Send review', 'أرسل التقييم');
      }
    }
  });
}

// ---- Ideas (feature suggestions) ----
const VOTED_KEY = 'st_voted_ideas';
function votedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]')); } catch (_) { return new Set(); }
}
function saveVoted(set) {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...set].slice(-300))); } catch (_) { /* ignore */ }
}
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>';
function ideaCard(r, voted) {
  const badge = r.status === 'added'
    ? `<span class="a-badge added">${L('✓ Added in the app', '✓ أُضيفت إلى التطبيق')}</span>`
    : r.status === 'planned' ? `<span class="a-badge planned">${L('Planned', 'مخطط لها')}</span>` : '';
  const when = r.status === 'added' && r.added_at ? r.added_at : r.created_at;
  const date = when ? new Date(when).toLocaleDateString(L('en', 'ar-u-nu-latn'), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const meta = [r.name ? esc(r.name) : '', r.status === 'added' ? L(`added ${date}`, `أُضيفت ${date}`) : date].filter(Boolean).join(' · ');
  const on = voted.has(r.id);
  return `<div class="a-idea${r.status === 'added' ? ' added' : ''}">`
    + `<button type="button" class="a-vote${on ? ' on' : ''}" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? L('You voted for this', 'صوّتّ لهذه الفكرة') : L('Vote for this idea', 'صوّت لهذه الفكرة')}">${UP}<b>${nf.format(r.votes || 0)}</b></button>`
    + `<div><h4><bdi>${esc(r.title)}</bdi>${badge}</h4>${r.details ? `<p dir="auto">${esc(r.details)}</p>` : ''}<div class="a-meta" dir="auto">${meta}</div></div></div>`;
}
const iList = document.getElementById('ideaList');
if (iList) {
  const limit = Number(iList.getAttribute('data-limit') || 4);
  fetch(`${SITE_API}?action=suggestions`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const list = d && Array.isArray(d.suggestions) ? d.suggestions.slice(0, limit) : [];
      if (!list.length) { document.getElementById('ideaEmpty').hidden = false; return; }
      const voted = votedSet();
      iList.innerHTML = list.map((r) => ideaCard(r, voted)).join('');
      revealNew(iList.children);
    })
    .catch(() => { document.getElementById('ideaEmpty').hidden = false; });
  iList.addEventListener('click', (e) => {
    const btn = e.target.closest('.a-vote');
    if (!btn || btn.classList.contains('on')) return;
    const id = btn.getAttribute('data-id');
    const voted = votedSet();
    if (voted.has(id)) return;
    const b = btn.querySelector('b');
    const before = b.textContent;
    b.textContent = nf.format(Number(before.replace(/[^0-9]/g, '')) + 1);
    btn.classList.add('on', 'bump');
    btn.setAttribute('aria-pressed', 'true');
    setTimeout(() => btn.classList.remove('bump'), 220);
    voted.add(id); saveVoted(voted);
    fetch(SITE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'vote', id }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((x) => { if (typeof x.votes === 'number') b.textContent = nf.format(x.votes); })
      .catch(() => { b.textContent = before; btn.classList.remove('on'); voted.delete(id); saveVoted(voted); });
  });
}

const iForm = document.getElementById('ideaForm');
if (iForm) {
  const msg = document.getElementById('ideaMsg');
  const send = document.getElementById('ideaSend');
  iForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = iForm.querySelector('#iTitle').value.trim();
    msg.hidden = true;
    if (title.length < 4) {
      msg.className = 'a-msg err';
      msg.textContent = L('Please write your idea in a few words (at least 4 letters).', 'اكتب فكرتك في كلمات قليلة (4 أحرف على الأقل).');
      msg.hidden = false;
      return;
    }
    send.disabled = true;
    send.textContent = L('Sending…', 'جارٍ الإرسال…');
    try {
      const res = await fetch(SITE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'suggest', title,
          details: iForm.querySelector('#iDetails').value.trim(),
          name: iForm.querySelector('#iName').value.trim(),
          website: iForm.querySelector('#iWebsite').value,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      msg.className = 'a-msg ok';
      msg.textContent = L('Thank you! Our team reads every idea — it shows here after a quick check.', 'شكرًا لك! فريقنا يقرأ كل فكرة — وستظهر هنا بعد مراجعة سريعة.');
      msg.hidden = false;
      iForm.reset();
    } catch (_) {
      msg.className = 'a-msg err';
      msg.textContent = L("That didn't go through. Please try again in a moment.", 'لم يتم الإرسال. حاول مرة أخرى بعد قليل.');
      msg.hidden = false;
    } finally {
      send.disabled = false;
      send.textContent = L('Send idea', 'أرسل الفكرة');
    }
  });
}

// ---- Reviews | Ideas switch (phones) ----
const seg = document.querySelector('.a-seg');
if (seg) {
  const tabs = [...seg.querySelectorAll('button[data-pane]')];
  const phone = window.matchMedia('(max-width: 760px)');
  const select = (paneId, animate) => {
    tabs.forEach((t, i) => {
      const on = t.getAttribute('data-pane') === paneId;
      t.setAttribute('aria-selected', String(on));
      const pane = document.getElementById(t.getAttribute('data-pane'));
      if (!pane) return;
      if (on) {
        pane.removeAttribute('hidden-phone');
        if (animate) {
          pane.style.setProperty('--dx', i === 0 ? '-24px' : '24px');
          pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap');
        }
      } else {
        pane.setAttribute('hidden-phone', '');
      }
    });
    seg.classList.toggle('right', paneId === tabs[1].getAttribute('data-pane'));
  };
  tabs.forEach((t) => t.addEventListener('click', () => select(t.getAttribute('data-pane'), true)));
  const fromHash = () => {
    if (location.hash === '#suggest') select('paneIdeas', false);
    else select('paneReviews', false);
    const target = location.hash === '#suggest' ? document.getElementById('ideaForm')
      : location.hash === '#write' ? document.getElementById('reviewForm') : null;
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);
  phone.addEventListener?.('change', () => fromHash());
}

// ---- Motion: hero entrance, scroll reveal, counting numbers ----
const reduceMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return true; }
})();
let revealObs = null;
function revealNew(nodes) {
  if (!revealObs) return;
  [...nodes].forEach((el, i) => {
    el.classList.add('rv');
    el.style.setProperty('--d', `${Math.min(i, 6) * 0.07}s`);
    revealObs.observe(el);
  });
}
if (!reduceMotion && 'IntersectionObserver' in window) {
  const hero = document.querySelector('.a-hero');
  if (hero) hero.classList.add('go');
  revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  const groups = [
    '.a-sec > h2, .a-sec > .a-h2, .a-sec > .a-lead',
    '.a-bento > .a-tile', '.a-dl > .a-plat', '.a-steps > div',
    '.a-duo > .a-pane', '.a-counter > div', '.a-seg',
  ];
  groups.forEach((sel) => revealNew(document.querySelectorAll(sel)));
}
function countUp(el, to) {
  if (reduceMotion || !Number.isFinite(to) || to < 10) { el.textContent = nf.format(to); return; }
  const start = performance.now(), dur = 1200;
  const tick = (t) => {
    const k = Math.min(1, (t - start) / dur);
    el.textContent = nf.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- Customer-care widget: floating button + form, on every page ----
// Built and injected here instead of duplicated per-page HTML so every
// page carries the exact same contact experience — no separate
// "Contact" page section to scroll to anymore (see help.html, which
// used to have one at the very bottom).
(function initCareWidget() {
  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" id="careBtn" class="care-btn" aria-label="${L('Contact support', 'تواصل مع الدعم')}">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
    <div class="care-panel" id="carePanel">
      <div class="care-panel-head">
        <div>
          <strong>${L('Customer care', 'خدمة العملاء')}</strong>
          <p>${L('We usually reply within a few hours.', 'نرد عادة خلال ساعات قليلة.')}</p>
        </div>
        <button type="button" class="modal-close" id="careClose" aria-label="${L('Close', 'إغلاق')}" style="position:static">&times;</button>
      </div>
      <form id="contactForm">
        <label class="field-label" for="cName">${L('Name', 'الاسم')}</label>
        <input class="field-input" id="cName" type="text" autocomplete="name" required>
        <label class="field-label" for="cEmail">${L('Email', 'البريد الإلكتروني')}</label>
        <input class="field-input" id="cEmail" type="email" autocomplete="email" required>
        <label class="field-label" for="cPhone">${L('Phone number', 'رقم الهاتف')}</label>
        <input class="field-input" id="cPhone" type="tel" autocomplete="tel" required>
        <div class="care-field-label-row">
          <label class="field-label" for="cMessage" style="margin-bottom:0">${L('Message', 'الرسالة')}</label>
          <span class="care-counter" id="careCounter">0/500</span>
        </div>
        <textarea class="field-input" id="cMessage" rows="4" maxlength="500" required></textarea>
        <!-- Honeypot — real visitors never see or fill this in. -->
        <input class="hp-field" id="cWebsite" type="text" tabindex="-1" autocomplete="off">
        <button class="btn btn-primary" type="submit" id="contactSubmit" style="width:100%;justify-content:center;margin-top:14px">${L('Send message', 'أرسل الرسالة')}</button>
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
    contactSubmit.textContent = L('Sending…', 'جارٍ الإرسال…');
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
      contactStatus.textContent = L('Thank you so much for your interest — the SevenTabs team will contact you soon.', 'شكرًا جزيلًا لاهتمامك — سيتواصل معك فريق SevenTabs قريبًا.');
      contactStatus.classList.add('show', 'ok');
      contactForm.reset();
      careCounter.textContent = '0/500';
      careCounter.classList.remove('warn');
    } catch (err) {
      contactStatus.textContent = L("That didn't go through — please try again in a moment, or email us directly at support@7tabs.org.", 'لم يتم الإرسال — حاول مرة أخرى بعد قليل، أو راسلنا مباشرة على support@7tabs.org.');
      contactStatus.classList.add('show', 'err');
    } finally {
      contactSubmit.disabled = false;
      contactSubmit.textContent = L('Send message', 'أرسل الرسالة');
    }
  });
})();

