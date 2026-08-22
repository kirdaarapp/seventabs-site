// Embedded, custom-styled Stripe checkout for upgrading a company to
// Pro — the website-side counterpart to lib/features/cloud/billing_screen.dart's
// "Upgrade — subscribe on Stripe" button, which still opens Stripe's
// hosted page in the system browser; this page is the newer, in-house
// alternative described in the reference animation the user shared.
// Card data is still never seen by this file or any of our servers —
// Stripe's own Payment Element (an iframe) collects it directly.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kamjtddqgofuasublpwc.supabase.co';
const supabase = createClient(
  SUPABASE_URL,
  'sb_publishable_25vQKsEQqDUEjEkuglU1Rg_GzEW9S3a'
);

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
const gateSuccess = document.getElementById('gateSuccess');
const checkoutGrid = document.getElementById('checkoutGrid');
const checkoutFatalError = document.getElementById('checkoutFatalError');
const stepAccount = document.getElementById('stepAccount');
const stepPayment = document.getElementById('stepPayment');

function showGate(el) {
  [gateSignIn, gateNoCompany, gateAlreadyPro, gateSuccess, checkoutGrid].forEach((g) => {
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

  stepPayment.classList.add('active');
  document.getElementById('companyNameText').textContent = company.name;
  showGate(checkoutGrid);
  storedAccessToken = session.access_token;
  startStripe(storedAccessToken);
}

// Kept so the billing-period toggle can restart checkout for a newly
// chosen plan after the Stripe form has already mounted once —
// creating a fresh Subscription/PaymentIntent for the new Price is the
// only way to change the amount (an already-created PaymentIntent's
// amount can't just be edited client-side).
let storedAccessToken = null;
let stripeStarted = false;
document.querySelectorAll('#checkoutBillingToggle .billing-toggle-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.period === selectedPlan) return;
    selectedPlan = btn.dataset.period;
    updateAmountUI();
    if (stripeStarted && storedAccessToken) {
      // Strip the old form's submit listener by replacing it with an
      // unbound clone, unmount the stale Payment Element, and start a
      // fresh Subscription for the newly selected plan.
      const oldForm = document.getElementById('paymentForm');
      oldForm.replaceWith(oldForm.cloneNode(true));
      document.getElementById('paymentElement').innerHTML = '';
      stripeStarted = false;
      startStripe(storedAccessToken);
    }
  });
});

async function startStripe(accessToken) {
  if (stripeStarted) return;
  stripeStarted = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-subscription-intent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Could not start checkout.');

    // Stripe.js is loaded on demand — no reason to ship it to every page
    // on the site, only this one actually needs it.
    await loadScript('https://js.stripe.com/v3/');
    const stripe = window.Stripe(data.publishableKey);
    const elements = stripe.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#6c63ff',
          colorBackground: '#171833',
          colorText: '#f2f0fb',
          colorDanger: '#ff5a5a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          borderRadius: '10px',
        },
      },
    });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#paymentElement');

    const form = document.getElementById('paymentForm');
    const submitBtn = document.getElementById('paySubmitBtn');
    const submitLabel = document.getElementById('paySubmitLabel');
    const paymentError = document.getElementById('paymentError');
    const payCard = document.getElementById('payCard');
    const payCardStatus = document.getElementById('payCardStatus');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      paymentError.classList.remove('show');
      submitBtn.disabled = true;
      submitLabel.textContent = 'Processing…';
      payCard.classList.add('processing');
      payCardStatus.hidden = false;
      payCardStatus.textContent = 'Processing secure transaction…';

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        payCard.classList.remove('processing');
        payCardStatus.hidden = true;
        paymentError.textContent = error.message || 'Payment failed. Please try again.';
        paymentError.classList.add('show');
        submitBtn.disabled = false;
        submitLabel.textContent = `Pay ${PLAN_AMOUNTS[selectedPlan]} now`;
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        payCard.classList.remove('processing');
        payCard.classList.add('success');
        payCardStatus.textContent = 'Payment successful!';
        setTimeout(() => showGate(gateSuccess), 900);
      }
    });
  } catch (e) {
    fatalError(`Could not start checkout: ${e}`);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

updateAmountUI();
runGateCheck();
