const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a helpful, conversational voice assistant.
Keep your responses concise and natural for spoken conversation — avoid bullet points,
markdown formatting, or long lists. Respond in the same language the user speaks (Spanish or English).
Aim for 1-3 short sentences per response unless more detail is needed.`;

// Store conversation history per session
const sessions = {};

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: 'Missing message or sessionId' });

  if (!sessions[sessionId]) sessions[sessionId] = [];
  const history = sessions[sessionId];

  history.push({ role: 'user', content: message });
  if (history.length > 20) history.splice(0, history.length - 20);

  // Stream the response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let fullText = '';

    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    }

    history.push({ role: 'assistant', content: fullText });
    res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Claude error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Error connecting to Claude' })}\n\n`);
    res.end();
  }
});

app.delete('/session/:id', (req, res) => {
  delete sessions[req.params.id];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Voice agent running on http://localhost:${PORT}`));
