# Kage AI — Multi-stage AI Edition

Kage AI is a mobile-friendly ChatGPT-inspired interface with Markdown, syntax-highlighted code blocks, LaTeX math, conversation history, code copy/download, HTML preview and export.

## Fixed AI pipeline

1. **Groq** creates the first answer.
2. **Gemini** reviews the draft, improves clarity and fixes apparent errors.
3. **OpenAI** performs the final quality pass and returns the polished answer.

Each provider is optional at runtime. If a configured provider fails, the pipeline skips it and continues with the next available provider. If Groq fails, Gemini can answer from scratch and OpenAI can polish it. If Gemini fails, OpenAI can polish the Groq draft. If OpenAI fails, the best available earlier draft is returned. A user-facing error is returned only if no provider produces an answer.

Model IDs are fixed in `server.js`; there is no model selector. Only the three provider keys are required in `.env` (PORT is optional).

## Run locally

1. Install Node.js 18 or newer.
2. Extract the ZIP and open its folder in VS Code.
3. Copy `.env.example` to `.env`.
4. Put your own keys into `.env`:

   ```dotenv
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   OPENAI_API_KEY=...
   ```

5. In the terminal, run:

   ```bash
   npm install
   npm start
   ```

6. Open `http://localhost:3000`.

Never commit `.env` or expose these keys in browser JavaScript.

## Hosting notes

**GitHub Pages alone cannot run this AI pipeline.** Pages only hosts static files and cannot read a server `.env` or safely keep provider keys private. The UI files can be published to Pages as a static demo, but live multi-provider AI requires this Node server to be hosted on a Node-capable service. For the simplest working setup, deploy the whole project to a Node host and set the three environment variables in that host's secret/environment settings. No API-key entry is needed in the interface.

## Notes

- Conversation history and preferences remain in the browser's local storage.
- External rendering libraries use CDNs and require an internet connection.
- Provider availability, quotas, model access and pricing depend on the respective provider accounts.
