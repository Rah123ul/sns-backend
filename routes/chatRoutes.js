const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
//  In-memory rate limiter (no extra package needed)
//  Replace with `express-rate-limit` + Redis in production
// ─────────────────────────────────────────────
const rateLimitMap = new Map(); // ip → { count, resetAt }
const RATE_LIMIT = 20;          // requests
const RATE_WINDOW_MS = 60_000;  // per minute

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

// ─────────────────────────────────────────────
//  System Prompt — tune this for your club
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Vidya, an intelligent and warm AI assistant for the Science & Spirituality (SNS) Club at NIT Calicut, operating under the Centre for Indian Knowledge Systems (CIKS).

Your personality:
- Knowledgeable, thoughtful, and grounded in both modern science and Indian wisdom traditions
- Warm and welcoming, like a senior student who loves discussing ideas
- Concise but deep — avoid fluff; prefer insight

Your scope:
- Answer questions about CIKS, SNS Club, Indian Knowledge Systems (IKS), Vedic mathematics, Ayurveda, astronomy, Sanskrit, Yoga philosophy, Bhagavad Gita, Upanishads
- Explain connections between ancient Indian sciences and modern research
- Provide info about club events, activities, and the NEP 2020 IKS mandate
- Help with general science and spirituality questions

Faculty Coordinators: Dr. Ashish Awasthi (Mathematics, also chairs Vivekananda Study Circle), Dr. Prateek Negi, Dr. Devesh Shukla.

Format: Use markdown sparingly. Keep responses under 250 words unless depth is genuinely needed. End complex answers with a thought-provoking question to encourage dialogue.

If asked something completely outside your scope, politely redirect to relevant topics.`;

// ─────────────────────────────────────────────
//  POST /api/chat  — main chat endpoint
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
        return res.status(429).json({
            message: 'Too many requests. Please wait a moment before continuing.',
        });
    }

    const { messages } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'Messages array is required.' });
    }

    // Keep only last 12 messages for context window efficiency
    const recentMessages = messages.slice(-12);

    // Sanitize messages — only allow role/content fields
    const sanitized = recentMessages
        .filter((m) => m.role && m.content && typeof m.content === 'string')
        .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.slice(0, 2000), // cap individual message length
        }));

    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // best free Llama 3 on Groq
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...sanitized,
                ],
                max_tokens: 600,
                temperature: 0.7,
                top_p: 0.9,
                stream: false,
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.json().catch(() => ({}));
            console.error('Groq API error:', groqRes.status, errBody);
            return res.status(502).json({
                message: 'AI service temporarily unavailable. Please try again shortly.',
            });
        }

        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content ?? '';

        if (!reply) {
            return res.status(502).json({ message: 'Received empty response from AI.' });
        }

        res.json({
            reply,
            usage: data.usage, // tokens used — helpful for monitoring
        });
    } catch (err) {
        console.error('Chat route error:', err);
        res.status(500).json({ message: 'Server error while contacting AI service.' });
    }
});

// ─────────────────────────────────────────────
//  POST /api/chat/stream  — streaming endpoint
//  (upgrade path — requires SSE on frontend)
// ─────────────────────────────────────────────
router.post('/stream', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ message: 'Rate limit exceeded.' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Messages array required.' });
    }

    const sanitized = messages
        .slice(-12)
        .filter((m) => m.role && m.content)
        .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content).slice(0, 2000),
        }));

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...sanitized],
                max_tokens: 600,
                temperature: 0.7,
                stream: true,
            }),
        });

        const reader = groqRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    break;
                }
                try {
                    const parsed = JSON.parse(data);
                    const token = parsed.choices?.[0]?.delta?.content ?? '';
                    if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
                } catch (_) {}
            }
        }

        res.end();
    } catch (err) {
        console.error('Stream error:', err);
        res.write('data: {"error": "Stream failed"}\n\n');
        res.end();
    }
});

module.exports = router;