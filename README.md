# Alice - Agoralia Control Center

Dashboard centralizzata per la gestione di Agoralia: traduzioni, pricing, catalogues, monitoring.

## Struttura del progetto

```
Alice-Agoralia/
├── src/                          # Codice sorgente Next.js
│   ├── app/
│   │   ├── admin/                # Dashboard pages
│   │   │   ├── page.tsx          # Main dashboard
│   │   │   ├── i18n/             # Translation management
│   │   │   ├── pricing/          # Pricing editor
│   │   │   ├── catalogues/       # Catalogues viewer
│   │   │   ├── calls/            # Call monitoring
│   │   │   └── finance/          # Finance overview
│   │   ├── api/                  # API routes
│   │   │   ├── pricing/          # Pricing API (public + admin)
│   │   │   ├── i18n/             # Translation status, config, translate
│   │   │   ├── catalogues/       # Catalogues API
│   │   │   └── monitoring/       # App monitoring
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   └── lib/                      # Shared libraries
│       ├── i18n-config.ts        # Languages, projects, Grok pricing
│       ├── pricing-db.ts         # Pricing data access
│       ├── github.ts             # GitHub API for syncing
│       └── app-db.ts             # App database connection
│
├── config/                       # Configuration files
│   ├── kb-locale-mapping.json    # UI → Compliance locale mapping
│   ├── i18n-projects.json        # i18n project definitions
│   └── design.json               # Design tokens
│
├── data/                         # Local data storage
│   ├── pricing.json              # Marketing pricing (source of truth)
│   ├── translations/             # Translation files cache
│   └── *.json                    # Other data files
│
├── scripts/                      # Utility scripts
│   ├── builders/                 # Data builders (from KB Agoralia)
│   │   ├── pricing_builder/      # RetellAI pricing scraper
│   │   └── compliance_builder/   # Compliance data generator
│   └── *.py, *.mjs               # Other utility scripts
│
├── .env.local                    # Environment variables (not in git)
├── .env.example                  # Example environment variables
├── package.json                  # Node.js dependencies
└── vercel.json                   # Vercel deployment config
```

## Setup locale

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev
# Open http://localhost:3000/admin
```

## Variabili d'ambiente

| Variable | Descrizione |
|----------|-------------|
| `ADMIN_API_KEY` | Chiave per API admin |
| `GROK_API_KEY` | xAI Grok API key per traduzioni AI |
| `XAI_MANAGEMENT_KEY` | xAI Management API per crediti |
| `GITHUB_TOKEN` | GitHub PAT per sync traduzioni |
| `GITHUB_OWNER` | GitHub username |
| `APP_DATABASE_URL` | PostgreSQL Agoralia App (read-only) |
| `STRIPE_SECRET_KEY` | Stripe API key |

## Progetti collegati

- **Agoralia App** (`/Users/macbook/Desktop/Agoralia/`) - Frontend + Backend principale
  - `catalogues/` - File JSON letti da Alice
  - `frontend/locales/` - File traduzioni UI
- **Sito Agoralia** (`/Users/macbook/Desktop/Agoralia Site/`) - Sito marketing
  - `locales/` - File traduzioni sito

## API Endpoints

### Pricing
- `GET /api/pricing?country=IT` - Prezzi per paese
- `GET /api/pricing/admin` - Admin pricing data
- `PUT /api/pricing/admin` - Update pricing

### i18n
- `GET /api/i18n/status?project=site|app|compliance` - Translation status
- `GET /api/i18n/config` - API keys status + Grok credits
- `POST /api/i18n/translate` - Trigger AI translation

### Catalogues
- `GET /api/catalogues` - List all catalogues
- `GET /api/catalogues?file=voices/azure-vapi-voices.json` - Get file content

## Scripts

### Pricing Builder
```bash
cd scripts/builders/pricing_builder
pip install -r requirements.txt
python build_pricing.py
# Output: pricing.json → copy to Agoralia/catalogues/pricing/retell.json
```

### Compliance Builder
```bash
cd scripts/builders/compliance_builder
pip install -r requirements.txt
python build_compliance_v3.py
# Output: compliance.v3.json → copy to Agoralia/catalogues/compliance/
```
