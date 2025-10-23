import { createTool } from '@mastra/core';
import { z } from 'zod';

export const cryptoTool = createTool({
  id: 'get-crypto-prices',
  description: 'Get current cryptocurrency prices for selected coins and currencies',
  inputSchema: z.object({
    ids: z.string().describe("Comma-separated list of crypto IDs (e.g. 'bitcoin,ethereum')"),
    vs_currencies: z.string().describe("Comma-separated list of fiat currencies (e.g. 'usd,eur')"),
  }),
  outputSchema: z.record(
    z.string(), // coin id
    z.record(z.string(), z.number()) // currency -> price
  ),
  execute: async ({ context }) => {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        context.ids
      )}&vs_currencies=${encodeURIComponent(context.vs_currencies)}`;

      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'User-Agent': 'mastra-dev-tool', // helps some APIs
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch crypto prices: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();

      if (!data || Object.keys(data).length === 0) {
        throw new Error('No data returned from CoinGecko API.');
      }

      return data;
    } catch (error) {
      console.error('Error in cryptoTool:', error);
      throw new Error(`Error executing crypto tool: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});