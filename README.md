# Cooperative Bayesian Optimization — UI Design Study

## About

This repository is a reproduction and extension of the following paper:

> **Cooperative Design Optimization through Natural Language Interaction**  
> Ryogo Niwa, Shigeo Yoshida, Yuki Koyama, Yoshitaka Ushiku  
> arXiv:2508.16077 · DOI:[10.1145/3746059.3747789](https://doi.org/10.1145/3746059.3747789)  
> https://arxiv.org/abs/2508.16077

The original paper proposes a cooperative design optimization framework that integrates Bayesian Optimization (BO) with Large Language Models (LLMs), enabling designers to intervene in the optimization process via natural language.

**This project reproduces the above framework and additionally implements an *uncertainty badge* — a UI element that visualizes the BO model's predictive uncertainty — to study its effect on user experience and optimization performance through a within-subjects user study.**

---

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

### Initial Setup

```bash
# 1. Build frontend static files
cd frontend && npm ci && npm run build && cd ..

# 2. Set up .env
cp .env.example .env
# Edit .env with real SECRET_KEY and OPENAI_API_KEY

# 3. Set up nginx.conf
cp nginx.conf.example nginx.conf
# Edit nginx.conf and replace YOUR_DOMAIN with your actual domain
# sed -i 's/YOUR_DOMAIN/sjak1631.dev/g' nginx.conf

# 4. Start services
docker compose up -d --build
```

The nginx service listens on port 80.  
`/api/*` requests are proxied to the backend container.  
All other requests serve `frontend/dist/index.html` (SPA).

### After the First Run

After the initial setup, you can start and stop the services easily:

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### TLS / HTTPS
Uncomment the letsencrypt volume in `docker-compose.yml` and update `nginx.conf`
to add SSL directives pointing at `/etc/letsencrypt/live/<domain>/`.