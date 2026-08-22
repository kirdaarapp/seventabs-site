// Checkout for upgrading a company to Pro — powered by Tap Payments
// (tap.company), the GCC-focused processor used in place of Stripe
// (Stripe does not support Qatar merchant accounts). The counterpart to
// lib/features/cloud/billing_screen.dart's "Upgrade" button, which
// opens the same Tap hosted page in the system browser; this page is
// the in-house, same-tab alternative.
//
// Flow: "Pay now" calls create-checkout-session, which returns both a
// Tap-hosted payment `url` and that charge's own `tapId`. The tapId is
// stashed in sessionStorage *before* redirecting the whole tab to Tap's
// page — sessionStorage survives a full-page navigation within the same
// tab, unlike a JS variable. When the page loads again after Tap
// redirects back here, a pending tapId in sessionStorage means "we just
// came back from paying" — verify-tap-payment is called with it to
// confirm and activate the subscription. This sidesteps needing to
// parse whatever query param Tap's redirect appends (never confirmed
// against Tap's official docs, which are unreachable from this
// project's sandbox) — the same reasoning documented in
// create-checkout-session's own header comment.
//
// Card data is still never seen by this file or any of our servers —
// Tap's own hosted payment page collects it directly.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kamjtddqgofuasublpwc.supabase.co';
const supabase = createClient(
  SUPABASE_URL,
  'sb_publishable_25vQKsEQqDUEjEkuglU1Rg_GzEW9S3a'
);

const PENDING_TAP_ID_KEY = 'seventabs_pending_tap_id';

// Monthly/yearly plan choice — defaults from pricing.html's own toggle
// via ?plan=yearly (see assets/pricing.css's "Upgrade now" link), but
// stays changeable here too via the toggle below.
let selectedPlan = new URLSearchParams(location.search).get('plan') === 'yearly'
  ? 'yearly'
  : 'monthly';
const PLAN_AMOUNTS = { monthly: '$19.00', yearly: '$199.00' };
const PLAN_PERIODS = { monthly: '/mo', yearly: '/yr' };

function updateAmountUI() {
  const amountValue = document.getElementById('checkoutAmountValue');
  const period = document.getElementById('checkoutAmountPeriod');
  const submitLabel = document.getElementById('paySubmitLabel');
  if (amountValue) amountValue.textContent = PLAN_AMOUNTS[selectedPlan];
  if (period) period.textContent = PLAN_PERIODS[selectedPlan];
  if (submitLabel) submitLabel.textContent = `Pay ${PLAN_AMOUNTS[selectedPlan]} now`;
  document.querySelectorAll('#checkoutBillingToggle .billing-toggle-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.period === selectedPlan);
  });
}

const gateSignIn = document.getElementById('gateSignIn');
const gateNoCompany = document.getElementById('gateNoCompany');
const gateAlreadyPro = document.getElementById('gateAlreadyPro');
const gateVerifying = document.getElementById('gateVerifying');
const gateSuccess = document.getElementById('gateSuccess');
const checkoutGrid = document.getElementById('checkoutGrid');
const checkoutFatalError = document.getElementById('checkoutFatalError');
const stepAccount = document.getElementById('stepAccount');
const stepPayment = document.getElementById('stepPayment');

function showGate(el) {
  [gateSignIn, gateNoCompany, gateAlreadyPro, gateVerifying, gateSuccess, checkoutGrid].forEach((g) => {
    if (g) g.hidden = g !== el;
  });
}

function fatalError(message) {
  checkoutFatalError.textContent = message;
  checkoutFatalError.classList.add('show');
}

document.getElementById('checkoutSignInBtn')?.addEventListener('click', () => {
  document.getElementById('navAppBtn')?.click();
});

// Once someone finishes signing in via the shared modal (site.js), close
// it automatically and move straight into the checkout flow instead of
// making them close the modal by hand.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') {
    document.getElementById('signInOverlay')?.classList.remove('open');
    runGateCheck();
  }
});

function isPaidActive(company) {
  if (company.subscription_status !== 'active') return false;
  if (!company.current_period_end) return true;
  return new Date(company.current_period_end) > new Date();
}

async function verifyPendingPayment(tapId, accessToken) {
  showGate(gateVerifying);
  const payCard = document.getElementById('payCard');
  const payCardStatus = document.getElementById('payCardStatus');
  payCard?.classList.add('processing');
  if (payCardStatus) {
    payCardStatus.hidden = false;
    payCardStatus.textContent = 'Confirming your payment…';
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-tap-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tapId }),
    });
    const data = await res.json();
    sessionStorage.removeItem(PENDING_TAP_ID_KEY);
    if (!res.ok || data.error) throw new Error(data.error || 'Could not confirm payment.');

    if (data.activated) {
      payCard?.classList.remove('processing');
      payCard?.classList.add('success');
      if (payCardStatus) payCardStatus.textContent = 'Payment successful!';
      setTimeout(() => showGate(gateSuccess), 900);
    } else {
      // Charge exists but Tap hasn't captured it (e.g. abandoned before
      // completing on Tap's page) — fall back to a fresh checkout view
      // rather than getting stuck on "confirming" forever.
      payCard?.classList.remove('processing');
      if (payCardStatus) payCardStatus.hidden = true;
      await runGateCheck();
    }
  } catch (e) {
    sessionStorage.removeItem(PENDING_TAP_ID_KEY);
    fatalError(`Could not confirm payment: ${e}`);
  }
}

async function runGateCheck() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showGate(gateSignIn);
    stepAccount.classList.add('active');
    stepPayment.classList.remove('active');
    return;
  }
  stepAccount.classList.remove('active');
  stepAccount.classList.add('done');
  stepAccount.textContent = '✓ Account';

  const { data: rows, error } = await supabase
    .from('company_members')
    .select('role, companies(id, name, subscription_status, current_period_end)')
    .eq('user_id', session.user.id)
    .limit(1);

  if (error) {
    fatalError(`Could not load your company: ${error.message}`);
    return;
  }
  if (!rows.length) {
    showGate(gateNoCompany);
    return;
  }
  const row = rows[0];
  const company = row.companies;
  if (row.role !== 'owner') {
    showGate(gateNoCompany);
    return;
  }
  if (isPaidActive(company)) {
    document.getElementById('alreadyProText').textContent = company.current_period_end
      ? `Renews ${new Date(company.current_period_end).toLocaleDateString()}.`
      : 'Your subscription is active.';
    showGate(gateAlreadyPro);
    return;
  }

  // Returning from Tap's hosted page with a charge already created for
  // this session — confirm it instead of showing the "pay now" button
  // again.
  const pendingTapId = sessionStorage.getItem(PENDING_TAP_ID_KEY);
  if (pendingTapId) {
    await verifyPendingPayment(pendingTapId, session.access_token);
    return;
  }

  stepPayment.classList.add('active');
  document.getElementById('companyNameText').textContent = company.name;
  showGate(checkoutGrid);
  storedAccessToken = session.access_token;
}

let storedAccessToken = null;
document.querySelectorAll('#checkoutBillingToggle .billing-toggle-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.period === selectedPlan) return;
    selectedPlan = btn.dataset.period;
    updateAmountUI();
  });
});

document.getElementById('paySubmitBtn')?.addEventListener('click', async () => {
  const submitBtn = document.getElementById('paySubmitBtn');
  const submitLabel = document.getElementById('paySubmitLabel');
  const paymentError = document.getElementById('paymentError');
  paymentError.classList.remove('show');
  submitBtn.disabled = true;
  submitLabel.textContent = 'Redirecting to Tap…';
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storedAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan }),
    });
    const data = await res.json();
    if (!res.ok || data.error || !data.url || !data.tapId) {
      throw new Error(data.error || 'Could not start checkout.');
    }
    sessionStorage.setItem(PENDING_TAP_ID_KEY, data.tapId);
    location.href = data.url;
  } catch (e) {
    paymentError.textContent = `${e}`;
    paymentError.classList.add('show');
    submitBtn.disabled = false;
    submitLabel.textContent = `Pay ${PLAN_AMOUNTS[selectedPlan]} now`;
  }
});

updateAmountUI();
runGateCheck();
