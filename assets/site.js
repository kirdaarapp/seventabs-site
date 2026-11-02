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
    label: 'Windows', file: 'SevenTabs-Windows.zip',
    url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Windows.zip',
  },
  android: {
    label: 'Android', file: 'SevenTabs-Android.apk',
    url: 'https://github.com/kirdaarapp/seventabs-site/releases/latest/download/SevenTabs-Android.apk',
  },
  mac: {
    label: 'Mac', file: 'SevenTabs-macOS.zip',
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
      if (label) label.textContent = `Download for ${BUILDS[want].label}`;
      if (icon) icon.innerHTML = ICONS[want];
    } else {
      if (label) label.textContent = 'See all downloads';
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
      counter.querySelector('[data-stat="visits"]').textContent = nf.format(d.visitsMonth);
      counter.querySelector('[data-stat="downloads"]').textContent = nf.format(d.downloads);
      counter.querySelector('[data-stat="now"]').textContent = nf.format(Math.max(1, d.liveNow));
      counter.hidden = false;
    })
    .catch(() => {});
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
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
  return `<div class="a-card"><div class="a-stars" aria-label="${r.stars} out of 5">${starsHtml(r.stars)}</div>`
    + `<p>“${esc(r.text)}”</p><div class="a-who"><div class="a-av" style="background:${color}">${esc((r.name || '?').trim().charAt(0).toUpperCase())}</div>`
    + `<div>${name}${r.business ? `<span>${esc(r.business)}</span>` : ''}</div></div></div>`;
}
const rList = document.getElementById('reviewList');
if (rList) {
  const limit = Number(rList.getAttribute('data-limit') || 3);
  fetch(`${SITE_API}?action=reviews&limit=${limit}`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const empty = document.getElementById('reviewEmpty');
      if (!d || !Array.isArray(d.reviews) || d.reviews.length === 0) {
        if (empty) empty.hidden = false;
        return;
      }
      rList.innerHTML = d.reviews.map(reviewCard).join('');
      const score = document.getElementById('reviewScore');
      if (score && d.count > 0) {
        score.querySelector('b').textContent = Number(d.average).toFixed(1);
        score.querySelector('.a-stars').innerHTML = starsHtml(d.average);
        score.querySelector('[data-count]').textContent = `from ${nf.format(d.count)} review${d.count === 1 ? '' : 's'}`;
        score.hidden = false;
      }
    })
    .catch(() => {
      const empty = document.getElementById('reviewEmpty');
      if (empty) empty.hidden = false;
    });
}

const rForm = document.getElementById('reviewForm');
if (rForm) {
  let stars = 5;
  const pick = rForm.querySelectorAll('.a-pick button');
  const paint = () => pick.forEach((b, i) => {
    b.classList.toggle('on', i < stars);
    b.setAttribute('aria-pressed', String(i < stars));
  });
  pick.forEach((b, i) => b.addEventListener('click', () => { stars = i + 1; paint(); }));
  paint();
  const msg = document.getElementById('reviewMsg');
  const send = document.getElementById('reviewSend');
  rForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = rForm.querySelector('#rName').value.trim();
    const text = rForm.querySelector('#rText').value.trim();
    msg.hidden = true;
    if (!name || text.length < 10) {
      msg.className = 'a-msg err';
      msg.textContent = 'Please write your name and a few words (at least 10 letters).';
      msg.hidden = false;
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending…';
    try {
      const res = await fetch(SITE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'review', name, text, stars,
          business: rForm.querySelector('#rBusiness').value.trim(),
          website: rForm.querySelector('#rWebsite').value,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      msg.className = 'a-msg ok';
      msg.textContent = 'Thank you! Your review will show here after a quick check.';
      msg.hidden = false;
      rForm.reset();
      stars = 5; paint();
    } catch (_) {
      msg.className = 'a-msg err';
      msg.textContent = "That didn't go through. Please try again in a moment.";
      msg.hidden = false;
    } finally {
      send.disabled = false;
      send.textContent = 'Send review';
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

