require('dotenv').config();
const express    = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // serves index.html + any other static files

// ── Mailer ────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 465,
  secure: (Number(process.env.SMTP_PORT) || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Booking form endpoint ─────────────────────────────────────────────────────
app.post('/api/book', async (req, res) => {
  const { name, business, phone, email, best_time, message } = req.body;

  // Basic server-side validation
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Name and email are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  const subject = `New call request from ${name}${business ? ` — ${business}` : ''}`;

  const text = [
    `New booking request from the Shawcliffe Digital website`,
    ``,
    `Name:          ${name}`,
    `Business:      ${business  || '—'}`,
    `Phone:         ${phone     || '—'}`,
    `Email:         ${email}`,
    `Best time:     ${best_time || '—'}`,
    ``,
    `Message:`,
    message || '(none)',
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#020617">
      <div style="background:#1d4ed8;padding:24px 28px;border-radius:8px 8px 0 0">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.7)">Shawcliffe Digital</p>
        <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#fff">New call request</h1>
      </div>
      <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#475569;width:110px">Name</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Business</td><td style="padding:6px 0;font-weight:600">${business || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Phone</td><td style="padding:6px 0;font-weight:600">${phone || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#475569">Email</td><td style="padding:6px 0;font-weight:600"><a href="mailto:${email}" style="color:#1d4ed8">${email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#475569">Best time</td><td style="padding:6px 0;font-weight:600">${best_time || '—'}</td></tr>
        </table>
        ${message ? `
        <div style="margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569">Message</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#334155">${message.replace(/\n/g, '<br>')}</p>
        </div>` : ''}
        <div style="margin-top:24px">
          <a href="mailto:${email}?subject=Re: Your Shawcliffe Digital inquiry" style="display:inline-block;background:#1d4ed8;color:#fff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:9999px;text-decoration:none">Reply to ${name}</a>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from:    `"Shawcliffe Digital" <${process.env.SMTP_USER}>`,
      to:      process.env.TO_EMAIL || 'cassandra@shawcliffedigital.com',
      replyTo: email,
      subject,
      text,
      html,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Mail send error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not send email. Please try again.' });
  }
});

// ── Catch-all → serve index.html ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Shawcliffe Digital running at http://localhost:${PORT}`);
});
