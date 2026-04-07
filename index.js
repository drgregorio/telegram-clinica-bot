const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const conversations = {};
const SYSTEM_PROMPT = `You are the AI receptionist for Vitalumina, an aesthetic medicine clinic by Dr. Gregorio De Carvalho, with over 12 years experience, based in London. Respond warmly and professionally in the same language the patient uses (English or Spanish). LOCATIONS: Cornhill London EC3V 3ND (Primary), Chelsea Bridge SW11 8NN, Harley Street W1G 9QQ, Ice Health Kensington W8 6SA. TREATMENTS: Botox, dermal fillers (lips/cheeks/jaw/tear trough), fat dissolving, thread lift, calf/shoulder/trapezius toxin, hyperhidrosis, filler dissolving, non-surgical rhinoplasty, brow lift, Profhilo, polynucleotides, skin boosters, chemical peels, microneedling. For pricing always suggest booking a consultation. Keep responses concise and friendly.`;
async function sendMessage(chatId, text) {
  try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown' }); }
  catch (err) { console.error('Send error:', err.message); }
}
async function processMessage(chatId, userMessage) {
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: 'user', content: userMessage });
  if (conversations[chatId].length > 20) conversations[chatId] = conversations[chatId].slice(-20);
  try {
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversations[chatId]],
      max_tokens: 1024
    }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });
    const reply = r.data.choices[0].message.content;
    conversations[chatId].push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('OpenAI error:', JSON.stringify(err.response?.data || err.message));
    return 'Sorry, technical issue. Please try again shortly.';
  }
}
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message) return;
  const chatId = update.message.chat.id;
  const text = update.message.text;
  const name = update.message.from?.first_name || 'there';
  if (!text) return;
  if (text === '/start') {
    await sendMessage(chatId, `👋 Hello ${name}! Welcome to *Vitalumina* by Dr. De Carvalho.\n\nI'm your AI assistant. How can I help today?\n\n• Treatments\n• Locations\n• Book a consultation`);
    return;
  }
  const reply = await processMessage(chatId, text);
  await sendMessage(chatId, reply);
});
app.get('/', (req, res) => res.json({ status: 'OK' }));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Bot running on port ' + PORT));