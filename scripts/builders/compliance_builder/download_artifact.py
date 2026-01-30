#!/usr/bin/env python3
"""
Script per scaricare l'artifact compliance-v3 dall'ultima run di GitHub Actions
"""

import os
import sys
import json
import requests
from pathlib import Path

# GitHub API
REPO = "giacomocavalcabo/KB-Agoralia"
WORKFLOW = "build_compliance.yml"
ARTIFACT_NAME = "compliance-v3"

def get_latest_run_artifact():
    """Scarica l'artifact dall'ultima run"""
    
    # Usa GITHUB_TOKEN se disponibile, altrimenti chiedi
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("⚠️  GITHUB_TOKEN non trovato nelle variabili d'ambiente")
        print("   Puoi ottenerlo da: https://github.com/settings/tokens")
        print("   Oppure usa: export GITHUB_TOKEN=your_token")
        token = input("Incolla il tuo GitHub token (o premi Enter per usare API pubblica): ").strip()
        if not token:
            print("❌ Token richiesto per scaricare artifact")
            return None
    
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}" if token else None,
        "X-GitHub-Api-Version": "2022-11-28"
    }
    if not token:
        headers.pop("Authorization")
    
    # 1. Trova l'ultima run del workflow
    print(f"🔍 Cercando ultima run del workflow '{WORKFLOW}'...")
    url = f"https://api.github.com/repos/{REPO}/actions/workflows/{WORKFLOW}/runs"
    params = {"per_page": 1, "status": "completed"}
    
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        print(f"❌ Errore API: {response.status_code}")
        print(f"   {response.text[:200]}")
        return None
    
    runs = response.json().get("workflow_runs", [])
    if not runs:
        print("❌ Nessuna run trovata")
        return None
    
    latest_run = runs[0]
    run_id = latest_run["id"]
    run_status = latest_run["status"]
    run_conclusion = latest_run.get("conclusion", "unknown")
    
    print(f"✅ Trovata run #{run_id}")
    print(f"   Status: {run_status}, Conclusion: {run_conclusion}")
    print(f"   URL: {latest_run['html_url']}")
    
    # 2. Lista artifact della run
    print(f"\n🔍 Cercando artifact '{ARTIFACT_NAME}'...")
    artifacts_url = f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}/artifacts"
    
    response = requests.get(artifacts_url, headers=headers)
    if response.status_code != 200:
        print(f"❌ Errore API: {response.status_code}")
        return None
    
    artifacts = response.json().get("artifacts", [])
    artifact = None
    for art in artifacts:
        if art["name"] == ARTIFACT_NAME:
            artifact = art
            break
    
    if not artifact:
        print(f"❌ Artifact '{ARTIFACT_NAME}' non trovato")
        print(f"   Artifact disponibili: {[a['name'] for a in artifacts]}")
        return None
    
    print(f"✅ Artifact trovato: {artifact['name']} ({artifact['size_in_bytes']} bytes)")
    
    # 3. Scarica artifact
    print(f"\n📥 Scaricando artifact...")
    download_url = artifact["archive_download_url"]
    
    response = requests.get(download_url, headers=headers, stream=True)
    if response.status_code != 200:
        print(f"❌ Errore download: {response.status_code}")
        return None
    
    # Salva come zip
    output_zip = Path("compliance-v3-downloaded.zip")
    with open(output_zip, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"✅ Artifact scaricato: {output_zip}")
    print(f"   Dimensione: {output_zip.stat().st_size} bytes")
    
    # 4. Estrai JSON
    import zipfile
    print(f"\n📦 Estraendo JSON...")
    with zipfile.ZipFile(output_zip, 'r') as zip_ref:
        zip_ref.extractall(".")
    
    # Cerca il file JSON
    json_file = Path("compliance_builder/compliance.v3.json")
    if json_file.exists():
        print(f"✅ File estratto: {json_file}")
        
        # Verifica contenuto
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"   Paesi nel file: {len(data.get('fused_by_iso', {}))}")
        print(f"   Generated at: {data.get('generated_at')}")
        
        return json_file
    else:
        # Cerca in altri posti
        for path in Path(".").rglob("compliance.v3.json"):
            print(f"✅ File trovato: {path}")
            return path
    
    return None


if __name__ == "__main__":
    print("="*70)
    print("📥 Download Artifact da GitHub Actions")
    print("="*70)
    print()
    
    result = get_latest_run_artifact()
    
    if result:
        print(f"\n✅ Completato! File disponibile in: {result}")
        print(f"\nPer usarlo:")
        print(f"  cp {result} compliance_builder/compliance.v3.json")
    else:
        print("\n❌ Download fallito")
        sys.exit(1)

