import { createTool } from '@mastra/core';
import { z } from 'zod';

export const twitterTool = createTool({
  id: 'fetch-twitter-tweets',
  description: 'Fetch recent tweets about a given cryptocurrency',
  inputSchema: z.object({
    query: z.string().describe('Crypto keyword, e.g. bitcoin, ethereum'),
  }),
  outputSchema: z.object({
    tweets: z.array(z.string()),
    error: z.string().optional(),   // new optional error field
  }),
  execute: async ({ context }) => {
    const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
    const query = context.query;

    if (!BEARER_TOKEN) {
      return { tweets: [], error: 'Missing TWITTER_BEARER_TOKEN env var' };
    }
    if (!query) {
      return { tweets: [], error: 'Missing query parameter' };
    }

    try {
      const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=10&tweet.fields=text`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          tweets: [],
          error: `Twitter API error ${response.status} ${response.statusText}: ${body}`,
        };
      }

      const json = await response.json();
      const tweets = (json.data || []).map((t: any) => t.text || '');
      return { tweets };
    } catch (err: any) {
      return {
        tweets: [],
        error: `Exception: ${err?.message || String(err)}`,
      };
    }
  },
});
