#!/bin/bash
# Script per collegarsi al database PostgreSQL Railway del progetto Agoralia

echo "🔗 Collegamento a Railway PostgreSQL..."
echo ""
echo "Questo script ti aiuta a ottenere il DATABASE_URL dal progetto Railway Agoralia"
echo ""

# Verifica se Railway CLI è installato
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI non trovato"
    echo "Installa con: npm i -g @railway/cli"
    exit 1
fi

echo "📋 Step 1: Login a Railway"
railway login

echo ""
echo "📋 Step 2: Seleziona progetto Agoralia"
railway link

echo ""
echo "📋 Step 3: Connettiti al database PostgreSQL"
echo "Questo aprirà una connessione al database. Premi Ctrl+C per uscire."
echo ""
railway connect postgres

echo ""
echo "✅ Connessione completata!"
echo ""
echo "Per ottenere il DATABASE_URL:"
echo "1. Vai su Railway Dashboard → Progetto Agoralia → PostgreSQL"
echo "2. Vai su Variables tab"
echo "3. Copia DATABASE_URL o PGDATABASE"
echo ""
echo "Oppure usa:"
echo "railway variables --json | jq '.[] | select(.name == \"DATABASE_URL\")'"
