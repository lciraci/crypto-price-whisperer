import { createTool } from '@mastra/core';
import { z } from 'zod';

export const telegramTool = createTool({
  id: 'send-telegram-message',
  description: 'Send a message to a Telegram chat using the Telegram Bot API',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    result: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      if (!TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN env var');
      if (!CHAT_ID) throw new Error('Missing TELEGRAM_CHAT_ID env var');

      const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: context.text }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { ok: false, error: `Telegram API error: ${JSON.stringify(data)}` };
      }

      return { ok: true, result: data.result };
    } catch (err: any) {
      console.error('Error in telegramTool:', err);
      return { ok: false, error: err.message || String(err) };
    }
  },
});
