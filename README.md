# Cooperative Bayesian Optimization — UI Design Study

An online user study platform where participants co-optimize UI layout parameters with a Bayesian Optimization (BO) agent powered by an LLM.

## Architecture

```
frontend/   React 18 + TypeScript + Vite  (4-panel study UI)
backend/    FastAPI + BoTorch + OpenAI + SQLite  (API server)
nginx.conf  Reverse proxy (serves static frontend, proxies /api → backend)
docker-compose.yml
```

## Local Development

### Backend
```bash
cd backend

# 仮想環境を作成してパッケージをインストール（初回のみ）
uv venv .venv
source .venv/bin/activate
uv pip install -e .

# .env を作成して SECRET_KEY と OPENAI_API_KEY を設定
cp ../.env.example ../.env
# nano ../.env  など好きなエディタで編集

# 開発サーバー起動
uvicorn app.main:app --reload --port 8000
```

> **Note**: 次回以降は `source .venv/bin/activate` だけで OK。

### Frontend
```bash
cd frontend
npm install
npm run dev          # dev server on :5174 with /api proxy to :8000
```

### Register a participant (admin)
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"participant_id":"p01","password":"pw","admin_secret":"<SECRET_KEY>"}'
```

## Production Deployment (VPS with Docker)

```bash
# 1. Build frontend static files
cd frontend && npm ci && npm run build && cd ..

# 2. Set up .env
cp .env.example .env
# Edit .env with real SECRET_KEY and OPENAI_API_KEY

# 3. Start services
docker compose up -d --build
```

The nginx service listens on port 80.  
`/api/*` requests are proxied to the backend container.  
All other requests serve `frontend/dist/index.html` (SPA).

### TLS / HTTPS
Uncomment the letsencrypt volume in `docker-compose.yml` and update `nginx.conf`
to add SSL directives pointing at `/etc/letsencrypt/live/<domain>/`.

## Session Flow

1. **Login** — participant enters ID + password  
2. **Session Setup** — select task (resumes existing active session if any)  
3. **Study UI** — 4-panel layout:  
   - *Webpage Preview* — live rendering of current parameters  
   - *Set Parameters* — sliders + AI chat (BO suggest + LLM select)  
   - *Evaluate* — informal (~high noise) or formal (~low noise) evaluation  
   - *Check Results* — scatter plot + parameter history  
4. **Session End** — triggered by ≥3 Pareto-front formal evaluations **or** 20 min timeout

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
