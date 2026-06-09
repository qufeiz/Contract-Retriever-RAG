# Environment & ops

## Env vars

| Var | What | Self-serve? |
|---|---|---|
| `LLM_API_KEY` | DeepSeek API key (router + generation) | Set in `.env.local` (gitignored) and as a Vercel env var. **Never commit.** |
| `LLM_BASE_URL` | `https://api.deepseek.com` | Same |
| `LLM_MODEL` | `deepseek-chat` | Same |

All variable **names + placeholders** live in [`../../.env.example`](../../.env.example) (committed). Real values live **only** in `.env.local` (gitignored) and Vercel.

> 🚨 **Secrets hygiene.** `.gitignore` excludes every `.env*` except `.env.example`. Never commit, print, or hardcode a key. If a key is ever exposed, rotate it.

## Local run
```bash
npm install
cp .env.example .env.local        # then fill in the real DeepSeek values
npm run build:index               # builds data-index/ from data/*.csv + the PDFs (deterministic)
npm run dev                       # http://localhost:3000
```

## Deploy (Vercel)
```bash
vercel env add LLM_API_KEY        # + LLM_BASE_URL, LLM_MODEL (production)
vercel --prod
```
The index is rebuilt during the Vercel build (`npm run build` runs `build:index` first). Verify the deployment is **READY** (`vercel ls` / `vercel inspect <url>`), not merely pushed.

## Access / auth matrix
| Platform | How access works | Agent self-serve? |
|---|---|---|
| GitHub (`gh`) | token | ✅ authed as `qufeiz` |
| Vercel | token | ✅ authed as `qufeiz` |
| DeepSeek | API key in env | ✅ if `.env.local` set |
