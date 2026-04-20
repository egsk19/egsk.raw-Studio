// api/subscribe.js — Vercel Serverless Function
// Stores newsletter subscribers to a simple JSON file via Vercel KV or filesystem
// Deploy to Vercel: vercel deploy

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Option A: Vercel KV (recommended — add KV integration in Vercel dashboard)
    // import { kv } from '@vercel/kv';
    // const key = `subscriber:${email.toLowerCase()}`;
    // const existing = await kv.get(key);
    // if (existing) return res.status(409).json({ error: 'Already subscribed' });
    // await kv.set(key, { email, name: name || '', subscribedAt: new Date().toISOString() });

    // Option B: Notion database (replace NOTION_API_KEY and DATABASE_ID in env)
    if (process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID) {
      const notionRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: {
            Email: { email: email.toLowerCase() },
            Name: { title: [{ text: { content: name || '' } }] },
            'Subscribed At': { date: { start: new Date().toISOString() } },
            Status: { select: { name: 'Active' } },
          },
        }),
      });
      if (!notionRes.ok) {
        const err = await notionRes.json();
        if (err.code === 'validation_error') {
          return res.status(409).json({ error: 'Already subscribed' });
        }
        throw new Error('Notion error: ' + JSON.stringify(err));
      }
      return res.status(200).json({ success: true, message: 'Subscribed!' });
    }

    // Option C: Resend (email service) — add RESEND_API_KEY and AUDIENCE_ID in env
    if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
      const resendRes = await fetch(`https://api.resend.com/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          first_name: name ? name.split(' ')[0] : '',
          last_name: name ? name.split(' ').slice(1).join(' ') : '',
          unsubscribed: false,
        }),
      });
      const data = await resendRes.json();
      if (!resendRes.ok) throw new Error('Resend error: ' + JSON.stringify(data));
      return res.status(200).json({ success: true, message: 'Subscribed!' });
    }

    // Fallback: log to console (for development)
    console.log('New subscriber:', { email, name, subscribedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, message: 'Subscribed (dev mode)' });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Subscription failed. Please try again.' });
  }
}
