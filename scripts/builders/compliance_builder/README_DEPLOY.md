# Deploy Instructions

## GitHub Actions

1. **Aggiungi il secret**:
   - Vai su GitHub repo → Settings → Secrets and variables → Actions
   - Aggiungi `PERPLEXITY_API_KEY` con la tua chiave API

2. **Esegui il workflow**:
   - Vai su Actions → Build Compliance v3
   - Clicca "Run workflow"
   - Scegli:
     - **Limit**: lascia vuoto per tutti i paesi, oppure inserisci un numero (es. `2` per testare)
     - **Model**: `sonar-pro` (raccomandato) o `sonar` (più economico)
   - Clicca "Run workflow"

3. **Risultati**:
   - Il file `compliance.v3.json` viene salvato come artifact
   - Se sei su `main`/`master`, viene anche committato automaticamente nel repo

**Nota**: GitHub Actions ha un limite di 6 ore per job. Per ~200 paesi con `sonar-pro`, potrebbe richiedere 4-6 ore.

---

## Railway

1. **Crea un nuovo progetto**:
   - Vai su [Railway](https://railway.app)
   - Clicca "New Project" → "Deploy from GitHub repo"
   - Seleziona il tuo repo

2. **Configura le variabili d'ambiente**:
   - Vai su Variables
   - Aggiungi `PERPLEXITY_API_KEY` con la tua chiave API

3. **Deploy**:
   - Railway rileverà automaticamente il `Dockerfile` o `railway.toml`
   - Il container partirà e eseguirà lo script
   - I log sono visibili in tempo reale

4. **Risultati**:
   - Il file `compliance.v3.json` viene generato nel container
   - Puoi scaricarlo via Railway CLI o aggiungere un volume persistente

**Nota**: Railway è più flessibile per job long-running. Puoi anche aggiungere un volume per salvare il file direttamente.

---

## Opzioni

### Test con pochi paesi
```bash
# GitHub Actions: usa "Limit" = 2
# Railway: modifica CMD in Dockerfile a:
CMD ["python", "build_compliance_v3.py", "--limit", "2", "--model", "sonar-pro"]
```

### Processare un singolo paese
```bash
# Railway: modifica CMD a:
CMD ["python", "build_compliance_v3.py", "--iso", "IT", "--model", "sonar-pro"]
```

### Salvare su volume persistente (Railway)
Aggiungi un volume nel `railway.toml`:
```toml
[deploy]
volumes = ["/app/data"]
```

E modifica lo script per salvare in `/app/data/compliance.v3.json`

