import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { telegramTool } from '../tools/telegram-tool';
import { twitterTool } from '../tools/twitter-tool';
import { analyzeReasonAgent } from '../agents/analyze-reason-agent';

// 1️⃣ Fetch crypto prices
const fetchCryptoPrices = createStep({
  id: 'fetch-crypto-prices',
  description: 'Fetches cryptocurrency prices for given coins and currencies',
  inputSchema: z.object({
    ids: z.string(),
    vs_currencies: z.string(),
  }),
  outputSchema: z.object({
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
  }),
  execute: async ({ inputData }) => {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      inputData.ids
    )}&vs_currencies=${encodeURIComponent(inputData.vs_currencies)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch crypto prices: ${response.statusText}`);

    const data = await response.json();
    return { prices: data, ids: inputData.ids };
  },
});

// 2️⃣ Fetch tweets about the crypto (set rate limit flag)
const fetchTweets = createStep({
  id: 'fetch-tweets',
  description: 'Fetches recent tweets about the requested crypto',
  inputSchema: z.object({
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
  }),
  outputSchema: z.object({
    tweets: z.array(z.string()),
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
    twitterRateLimited: z.boolean().optional(),
  }),
  execute: async ({ inputData }) => {
    try {
      const result = await (twitterTool as any).execute({
        context: { query: inputData.ids },
      });
      return { tweets: result.tweets || [], twitterRateLimited: false, ...inputData };
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('429') || msg.includes('Too Many Requests')) {
        console.warn('⚠️ Twitter rate limit hit — skipping tweet analysis.');
        return { tweets: [], twitterRateLimited: true, ...inputData };
      }
      throw err;
    }
  },
});

// 3️⃣ IF: skip analysis if rate-limited, else analyze
const analyzeOrSkip = createStep({
  id: 'analyze-or-skip',
  description: 'Analyzes tweets or skips if Twitter rate limited',
  inputSchema: z.object({
    tweets: z.array(z.string()),
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
    twitterRateLimited: z.boolean().optional(),
  }),
  outputSchema: z.object({
    reason: z.string(),
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
  }),
  execute: async ({ inputData }) => {
    // IF Twitter limit triggered → skip analysis
    if (inputData.twitterRateLimited) {
      return {
        reason: 'Twitter rate limit reached — showing only price update.',
        ...inputData,
      };
    }

    // ELSE run the analyzeReasonAgent
    const agent = analyzeReasonAgent as any;
    const joined = inputData.tweets.slice(0, 10).join('\n- ');
    const prompt = `These are recent tweets about ${inputData.ids}:\n- ${joined}\n\nSummarize the main sentiment and explain in one short paragraph why people believe ${inputData.ids} is high or low right now.`;

    const response = await agent.stream([{ role: 'user', content: prompt }]);
    let reasonText = '';
    for await (const chunk of response.textStream) {
      reasonText += chunk;
    }

    return { reason: reasonText.trim(), ...inputData };
  },
});

// 4️⃣ Summarize prices + reasoning
const summarizePrices = createStep({
  id: 'summarize-prices',
  description: 'Formats crypto prices and adds reasoning',
  inputSchema: z.object({
    prices: z.record(z.string(), z.record(z.string(), z.number())),
    ids: z.string(),
    reason: z.string(),
  }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData }) => {
    const lines: string[] = [];
    for (const [coin, prices] of Object.entries(inputData.prices)) {
      const priceList = Object.entries(prices)
        .map(([cur, val]) => `${cur.toUpperCase()}: ${val}`)
        .join(' | ');
      lines.push(`${coin.toUpperCase()}: ${priceList}`);
    }
    const summary = `${lines.join('\n')}\n\n🧠 Reason: ${inputData.reason}`;
    return { summary };
  },
});

// 5️⃣ Send Telegram message
const sendTelegramMessage = createStep({
  id: 'send-telegram-message',
  description: 'Sends the crypto summary to Telegram',
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({ ok: z.boolean(), summary: z.string() }),
  execute: async ({ inputData }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat_id = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat_id) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.');
    }

    const result = await (telegramTool as any).execute({
      context: { token, chat_id, text: `📊 Crypto Update:\n\n${inputData.summary}` },
    });
    return { ok: result.ok, summary: inputData.summary };
  },
});

// 6️⃣ Final output mapper
const mapResult = createStep({
  id: 'map-result',
  description: 'Maps workflow output',
  inputSchema: z.object({ ok: z.boolean(), summary: z.string() }),
  outputSchema: z.object({ summary: z.string(), sent: z.boolean() }),
  execute: async ({ inputData }) => ({
    summary: inputData.summary,
    sent: inputData.ok,
  }),
});

// 🧩 Final Workflow
export const cryptoWorkflow = createWorkflow({
  id: 'crypto-twitter-workflow',
  inputSchema: z.object({
    ids: z.string(),
    vs_currencies: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    sent: z.boolean(),
  }),
})
  .then(fetchCryptoPrices)
  .then(fetchTweets)
  .then(analyzeOrSkip) // <— IF logic handled here
  .then(summarizePrices)
  .then(sendTelegramMessage)
  .then(mapResult);

cryptoWorkflow.commit();
