import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { cryptoTool } from '../tools/crypto-tool';

export const criptoAgent = new Agent({
  name: 'Crypto-Price Agent',
  instructions: `
      You are a helpful crypto price assistant that provides accurate crypto price information and can help planning activities based on the crypto market.

      Your primary function is to help users get crypto price details for specific cryptocurrencies. When responding:
        - Always ask for a cryptocurrency if none is provided
        - If the cryptocurrency name isn't in English, please translate it
        - If giving a cryptocurrency with multiple parts (e.g. "Bitcoin, BTC"), use the most relevant part (e.g. "Bitcoin")
        - Include relevant details like market cap, volume, and price change
        - Keep responses concise but informative
        - If the user asks for activities and provides the crypto market forecast, suggest activities based on the crypto market forecast.
        - If the user asks for activities, respond in the format they request.

      Use the cryptoTool to fetch current crypto data.
`,  
  model: openai('gpt-4o-mini'),
  tools: { cryptoTool }, // No tools defined yet
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
});