import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { twitterTool } from '../tools/twitter-tool';

export const analyzeReasonAgent = new Agent({
  name: 'Analyze-Reason Agent',
  instructions: `
    You are an analyst assistant. Given a short list of recent tweets about a cryptocurrency, summarize the prevailing sentiment and provide a concise explanation (1-3 sentences) why the community thinks the price is high or low right now.

    Output should be a short, focused paragraph. If the tweets are mixed or uncertain, state that uncertainty clearly.
  `,
  model: openai('gpt-4o-mini'),
  tools: {twitterTool},
  memory: new Memory({
    storage: new LibSQLStore({ url: 'file:../mastra.db' }),
  }),
});
