# Builders - Script per aggiornare i catalogues

Questa cartella contiene gli script Python per aggiornare i file JSON in `Agoralia/catalogues/`.

## Struttura

```
builders/
├── pricing_builder/     # Aggiorna costi RetellAI/Vapi
│   ├── build_pricing.py
│   ├── analyze_pricing.py
│   └── requirements.txt
│
└── compliance_builder/  # Aggiorna dati compliance per paese
    ├── build_compliance_v3.py
    ├── update_compliance_grok.py  # Usa Grok AI per aggiornare
    ├── update_sources_grok.py
    ├── countries.csv
    └── requirements.txt
```

## pricing_builder

Scrapa i prezzi da RetellAI e genera `pricing/retell.json`.

```bash
cd scripts/builders/pricing_builder
pip install -r requirements.txt
python build_pricing.py
# Output: pricing.json → copiare in Agoralia/catalogues/pricing/retell.json
```

## compliance_builder

Genera/aggiorna i dati compliance per paese usando Grok AI.

```bash
cd scripts/builders/compliance_builder
pip install -r requirements.txt

# Build completo da countries.csv
python build_compliance_v3.py

# Aggiorna con Grok AI (richiede GROK_API_KEY)
python update_compliance_grok.py --country IT

# Output: compliance.v3.json → copiare in Agoralia/catalogues/compliance/compliance-by-country.json
```

## Variabili d'ambiente

Per gli script che usano Grok AI:

```bash
export GROK_API_KEY=xai-xxxxx
```

## Note

- Questi script sono copiati da `KB Agoralia/` per centralizzare tutto in Alice
- Dopo aver generato i JSON, copiarli manualmente in `Agoralia/catalogues/`
- In futuro: integrazione diretta con UI Alice per lanciare gli script
