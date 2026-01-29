#!/bin/bash
# Script per avviare il Config Service in sviluppo

cd "$(dirname "$0")"

# Attiva virtual environment se esiste
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "⚠️  Virtual environment non trovato. Creo..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
fi

# Verifica che le dipendenze siano installate
python -c "import fastapi" 2>/dev/null || {
    echo "📦 Installo dipendenze..."
    pip install -r requirements.txt
}

# Avvia il server
echo "🚀 Avvio Config Service su http://localhost:8000"
uvicorn main:app --reload --port 8000
