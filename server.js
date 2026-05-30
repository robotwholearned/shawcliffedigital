require('dotenv').config();
const express   = require('express');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(__dirname));

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again in a minute.' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ALLOWED_TIMES = ['Morning (8am – 12pm)', 'Afternoon (12pm – 5pm)', 'Evening (5pm – 8pm)', 'Anytime'];

// ── Booking form endpoint ─────────────────────────────────────────────────────
app.post('/api/book', bookingLimiter, async (req, res) => {
  const { name, business, phone, email, best_time, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Name and email are required.' });
  }

  if (String(name).length > 100 || String(email).length > 200) {
    return res.status(400).json({ ok: false, error: 'Input too long.' });
  }
  if (business && String(business).length > 200) {
    return res.status(400).json({ ok: false, error: 'Input too long.' });
  }
  if (phone && String(phone).length > 30) {
    return res.status(400).json({ ok: false, error: 'Input too long.' });
  }
  if (message && String(message).length > 2000) {
    return res.status(400).json({ ok: false, error: 'Message must be under 2000 characters.' });
  }
  if (best_time && !ALLOWED_TIMES.includes(best_time)) {
    return res.status(400).json({ ok: false, error: 'Invalid best time selection.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  const eName     = escapeHtml(name);
  const eBusiness = escapeHtml(business);
  const ePhone    = escapeHtml(phone);
  const eEmail    = escapeHtml(email);
  const eTime     = escapeHtml(best_time);
  const eMessage  = escapeHtml(message);

  const subject = `New call request from ${eName}${eBusiness ? ` — ${eBusiness}` : ''}`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#020617">
      <div style="background:#1d4ed8;padding:24px 28px;border-radius:8px 8px 0 0">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.7)">Shawcliffe Digital</p>
        <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#fff">New call request</h1>
      </div>
      <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#475569;width:110px">Name</td><td style="padding:6px 0;font-weight:600">${eName}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Business</td><td style="padding:6px 0;font-weight:600">${eBusiness || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Phone</td><td style="padding:6px 0;font-weight:600">${ePhone || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Email</td><td style="padding:6px 0;font-weight:600"><a href="mailto:${eEmail}" style="color:#1d4ed8">${eEmail}</a></td></tr>
          <tr><td style="padding:6px 0;color:#475569">Best time</td><td style="padding:6px 0;font-weight:600">${eTime || '—'}</td></tr>
        </table>
        ${message ? `
        <div style="margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569">Message</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#334155">${eMessage.replace(/\n/g, '<br>')}</p>
        </div>` : ''}
        <div style="margin-top:24px">
          <a href="mailto:${eEmail}?subject=Re:%20Your%20Shawcliffe%20Digital%20inquiry" style="display:inline-block;background:#1d4ed8;color:#fff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:9999px;text-decoration:none">Reply to ${eName}</a>
        </div>
      </div>
    </div>
  `;

  console.log(`[book] request from ${name} <${email}>`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     'Shawcliffe Digital <noreply@shawcliffedigital.com>',
        to:       [process.env.TO_EMAIL || 'cassandra@shawcliffedigital.com'],
        reply_to: email,
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Resend error');

    console.log('[book] email sent OK');
    res.json({ ok: true });
  } catch (err) {
    console.error('[book] mail send error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not send email. Please try again.' });
  }
});

// ── Catch-all → serve index.html (non-API routes only) ───────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Not found.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Shawcliffe Digital running at http://localhost:${PORT}`);
});
