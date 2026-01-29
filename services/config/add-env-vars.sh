#!/bin/bash
# Script per aggiungere variabili d'ambiente a Vercel

echo "🔧 Aggiunta variabili d'ambiente a Vercel"
echo ""

# Chiedi DATABASE_URL
echo "Incolla DATABASE_URL da Railway PostgreSQL:"
read -r DATABASE_URL
vercel env add DATABASE_URL production <<< "$DATABASE_URL"

# Chiedi REDIS_URL
echo ""
echo "Incolla REDIS_URL da Railway Redis (o premi Enter per saltare):"
read -r REDIS_URL
if [ -n "$REDIS_URL" ]; then
  vercel env add REDIS_URL production <<< "$REDIS_URL"
fi

# Genera ADMIN_API_KEY se non esiste
if [ -z "$ADMIN_API_KEY" ]; then
  ADMIN_API_KEY=$(openssl rand -hex 32)
  echo ""
  echo "🔑 Generata nuova ADMIN_API_KEY: $ADMIN_API_KEY"
fi
vercel env add ADMIN_API_KEY production <<< "$ADMIN_API_KEY"

# Chiedi JWT_SECRET
echo ""
echo "Incolla JWT_SECRET (o premi Enter per generarne uno nuovo):"
read -r JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "🔑 Generato nuovo JWT_SECRET"
fi
vercel env add JWT_SECRET production <<< "$JWT_SECRET"

# Aggiungi ENVIRONMENT
vercel env add ENVIRONMENT production <<< "production"

echo ""
echo "✅ Variabili d'ambiente aggiunte!"
echo ""
echo "📋 Riepilogo:"
echo "ADMIN_API_KEY: $ADMIN_API_KEY"
echo ""
echo "🔄 Ora fai redeploy:"
echo "vercel --prod"
