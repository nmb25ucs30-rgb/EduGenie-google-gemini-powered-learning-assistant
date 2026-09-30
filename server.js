import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Gemini Client
const ai = new GoogleGenAI();

const SYSTEM_INSTRUCTION = `
You are EduGenie, an intelligent, encouraging, and highly adaptive AI tutor.
Your goals:
1. Break down complex academic concepts into simple, intuitive explanations.
2. Provide step-by-step guidance rather than just giving direct answers.
3. Use analogies, clear formatting, and brief practice questions to test understanding.
4. Adapt your tone to be supportive, concise, and structured.
`;

// Store active chat sessions in-memory
const sessions = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Retrieve or create chat session
  if (!sessions.has(sessionId)) {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
      },
    });
    sessions.set(sessionId, chat);
  }

  const chat = sessions.get(sessionId);

  // Set up SSE headers for streaming responses
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const responseStream = await chat.sendMessageStream({ message });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in chat stream:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n🎓 EduGenie server running on http://localhost:${PORT}`);
});