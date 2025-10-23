Purpose
-------
This repository is a small Mastra-based project that wires together AI Agents, Tools and Workflows to fetch crypto prices, weather, and send notifications (Telegram). These instructions capture the minimal, concrete knowledge an AI coding agent needs to make safe, useful changes quickly.

Quick facts
-----------
- Entry point that assembles the runtime: `src/mastra/index.ts` (exports `mastra`).
- Agents live in `src/mastra/agents/*.ts` (e.g. `crypto-price.ts`, `weather-agent.ts`).
- Tools live in `src/mastra/tools/*.ts` (e.g. `crypto-tool.ts`, `telegram-tool.ts`, `weather-tool.ts`).
- Workflows live in `src/mastra/workflows/*.ts` (e.g. `crypto-workflow.ts`, `weather-workflow.ts`).
- Uses `zod` for input/output validation in tools/steps and Mastra primitives (`createTool`, `createStep`, `createWorkflow`).
- Node requirement: >=20.9.0 (project `package.json`), TypeScript used.

Big-picture architecture
------------------------
- Mastra instance (`src/mastra/index.ts`) composes: workflows, agents, storage (LibSQLStore), logger (PinoLogger), and observability settings.
- Agents encapsulate an LLM model, instructions prompt, optional tools map and a Memory backed by `LibSQLStore`.
- Tools are thin, typed wrappers around external APIs (CoinGecko, Open-Meteo, Telegram). They are defined with `createTool({ id, inputSchema, outputSchema, execute })` and expected to throw on unrecoverable errors.
- Workflows are sequences of typed steps (`createStep`) chained into a `createWorkflow` and must call `commit()` (see `weather-workflow.ts` and `crypto-workflow.ts`). Steps either call tools (directly) or invoke agents (e.g., `mastra.getAgent('weatherAgent')`).

Conventions & idioms to preserve
--------------------------------
- Zod-first: Every tool and step declares `inputSchema` and `outputSchema` using `zod`. Keep schemas accurate and minimal.
- Tool `execute` signature: `async ({ context }) => { ... }` where `context` contains validated inputs. Return JSON matching `outputSchema` or throw Error.
- Workflow step `execute` signature: `async ({ inputData, outputData, mastra }) => { ... }` (some steps use `mastra` to fetch agents).
- Workflows must call `.commit()` after being built. Without commit the workflow may not be registered by the runtime.
- Agent memory persistence: default examples use `LibSQLStore({ url: ':memory:' })` for ephemeral runs. To persist memory change the URL to a file database as in `crypto-price.ts` and `weather-agent.ts` where memory storage is set to `file:../mastra.db` (path is relative to `.mastra/output` at runtime).
- Agent streaming: Some steps stream agent responses — see `planActivities` in `weather-workflow.ts` that calls `agent.stream([...])` and consumes `response.textStream` as an async iterator. Preserve streaming flow where used.

External integrations to be careful with
-------------------------------------
- CoinGecko (public API) in `crypto-tool.ts`: no API key, but rate limits apply. Requests include a `User-Agent` header.
- Open-Meteo (geocoding + weather) in `weather-tool.ts` and `weather-workflow.ts`.
- Telegram Bot API in `telegram-tool.ts` requires a `token` and `chat_id` passed at runtime (the code expects these as workflow inputs rather than env variables).

Developer workflows and commands
--------------------------------
- Dev: `npm run dev` (runs `mastra dev` via `package.json`).
- Build: `npm run build` (runs `mastra build`).
- Start: `npm run start` (runs `mastra start`).
- Node.js 20+ is required because code relies on global `fetch` and modern JS features.
- There are no automated tests configured (`npm test` is a placeholder). Edit carefully and run the app locally with `npm run dev` to validate changes.

Patterns to follow when editing
------------------------------
- Add tools via `src/mastra/tools/*.ts` using `createTool` and a `zod` schema. Keep tool IDs unique (e.g. `get-crypto-prices`, `get-weather`).
- Register any new agents or workflows in `src/mastra/index.ts` by adding them to the `Mastra` constructor `agents` and `workflows` maps.
- Workflows: prefer pure, typed input/output shapes. Use `createStep` for atomic operations and reuse tools instead of copying fetch logic.
- Errors: tools and steps typically `throw new Error(...)` and may `console.error(...)` for diagnostics. Follow same pattern.

Small gotchas observed in the codebase
------------------------------------
- `telemetry.enabled` is set to `false` and marked deprecated in `src/mastra/index.ts` — do not rely on telemetry for tracing.
- `observability.default.enabled` is set to `true` — there may be exporters enabled by the Mastra runtime.
- Workflow `sendTelegramMessage` in `crypto-workflow.ts` calls `telegramTool.execute(...)` directly; ensure inputs match the tool's zod schema (token/chat_id/text).
- When switching `LibSQLStore` from `:memory:` to file-backed DB, mind runtime path (`file:../mastra.db`) and process working directory used by the Mastra CLI.

When to ask the human (instead of guessing)
-------------------------------------------
- If you need production credentials (Telegram bot token) or intend to change persistent storage locations — ask for the intended deployment paths and secrets handling.
- If a change affects observability or telemetry exports — confirm whether tracing is required before enabling/removing exporters.

Files worth opening first (quick tour)
-------------------------------------
- `src/mastra/index.ts`  — Mastra runtime composition and defaults
- `src/mastra/agents/crypto-price.ts` — agent prompt, model selection, memory settings
- `src/mastra/tools/crypto-tool.ts` — example of `createTool` + zod + fetch + error handling
- `src/mastra/workflows/crypto-workflow.ts` — createStep/createWorkflow chaining and Telegram integration
- `src/mastra/workflows/weather-workflow.ts` — agent streaming example and detailed response formatting constraints

If you update this file
-----------------------
- Keep it short and code-focused. Update examples and files list as new agents/tools/workflows are added.
- After edits, run `npm run dev` to validate the runtime boots with your changes.

If anything above is unclear or you want more examples (small unit test harness, how to run a single workflow locally, or example env var usage), tell me what you'd like clarified and I'll update this file.
