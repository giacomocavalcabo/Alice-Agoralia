#!/usr/bin/env node

/**
 * 🌍 NATURAL EARTH ULTRA-PRECISION TEXTURE GENERATOR
 * 
 * Questo script:
 * 1. Legge il dataset Natural Earth 10m coastline (.shp)
 * 2. Lo converte in GeoJSON
 * 3. Usa d3-geo per proiezione equirettangolare
 * 4. Genera texture PNG ad altissima risoluzione (8K)
 * 5. Ottimizza per performance (8K desktop, 4K mobile)
 */

import { createCanvas } from 'canvas';
import * as d3 from 'd3-geo';
import * as shapefile from 'shapefile';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.join(__dirname, '..');

// Configurazione risoluzione
const RESOLUTIONS = {
  '8K': { width: 8192, height: 4096, lineWidth: 1.5 },
  '4K': { width: 4096, height: 2048, lineWidth: 1.2 },
  'HD': { width: 2048, height: 1024, lineWidth: 1.0 }
};

// Colori ottimizzati per massimo contrasto
const COLORS = {
  ocean: '#0a0e27',    // Blu molto scuro
  land: '#16a34a',     // Verde emerald brillante
  coast: '#15803d'     // Verde scuro per bordi
};

/**
 * Converte Shapefile Natural Earth in GeoJSON
 */
async function convertShapefileToGeoJSON() {
  console.log('🔄 Conversione Shapefile → GeoJSON...');
  
  const shpPath = path.join(PROJECT_ROOT, 'public/data/ne_10m_coastline/ne_10m_coastline.shp');
  
  if (!fs.existsSync(shpPath)) {
    throw new Error(`❌ Shapefile non trovato: ${shpPath}`);
  }

  const features = [];
  
  try {
    // Legge il shapefile e converte in GeoJSON
    const source = await shapefile.open(shpPath);
    
    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      if (result.value && result.value.geometry) {
        features.push(result.value);
      }
    }
    
    await source.close();
    
    const geoJSON = {
      type: 'FeatureCollection',
      features: features
    };
    
    // Salva GeoJSON per debug
    const geoJsonPath = path.join(PROJECT_ROOT, 'public/data/coastline_natural_earth.json');
    fs.writeFileSync(geoJsonPath, JSON.stringify(geoJSON, null, 2));
    
    console.log(`✅ GeoJSON creato: ${features.length} features`);
    return geoJSON;
    
  } catch (error) {
    console.error('❌ Errore conversione Shapefile:', error);
    throw error;
  }
}

/**
 * Genera texture ad alta risoluzione usando d3-geo
 */
function generateTexture(geoJSON, resolution = '4K') {
  console.log(`🎨 Generazione texture ${resolution}...`);
  
  const config = RESOLUTIONS[resolution];
  const { width, height, lineWidth } = config;
  
  // Crea canvas ad alta risoluzione
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Sfondo oceano
  ctx.fillStyle = COLORS.ocean;
  ctx.fillRect(0, 0, width, height);
  
  // Proiezione equirettangolare d3-geo
  const projection = d3.geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI))
    .precision(0.1); // Alta precisione
  
  const pathGenerator = d3.geoPath(projection, ctx);
  
  // Disegna le coste
  ctx.strokeStyle = COLORS.coast;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Disegna ogni feature (costa)
  geoJSON.features.forEach((feature, index) => {
    if (feature.geometry) {
      ctx.beginPath();
      pathGenerator(feature);
      ctx.stroke();
    }
    
    // Progress indicator
    if (index % 100 === 0) {
      console.log(`   Processati ${index}/${geoJSON.features.length} features...`);
    }
  });
  
  console.log(`✅ Texture ${resolution} completata (${width}×${height})`);
  return canvas;
}

/**
 * Salva texture come PNG ottimizzato
 */
function saveTexture(canvas, resolution) {
  const outputPath = path.join(PROJECT_ROOT, 'public/textures');
  
  // Crea cartella se non esiste
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const filename = `earth_coastline_${resolution.toLowerCase()}.png`;
  const filePath = path.join(outputPath, filename);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  
  const sizeKB = (buffer.length / 1024).toFixed(0);
  console.log(`💾 Salvato: ${filename} (${sizeKB} KB)`);
  
  return filePath;
}

/**
 * Pipeline principale
 */
async function main() {
  console.log('🌍 NATURAL EARTH ULTRA-PRECISION TEXTURE GENERATOR\n');
  
  try {
    // 1. Converte Shapefile → GeoJSON
    const geoJSON = await convertShapefileToGeoJSON();
    
    // 2. Genera texture multiple risoluzioni
    const resolutions = ['HD', '4K', '8K'];
    
    for (const resolution of resolutions) {
      const canvas = generateTexture(geoJSON, resolution);
      saveTexture(canvas, resolution);
    }
    
    console.log('\n🎉 PIPELINE COMPLETATO!');
    console.log('📁 Texture generate in: public/textures/');
    console.log('   • earth_coastline_hd.png   (2K - mobile)');
    console.log('   • earth_coastline_4k.png   (4K - desktop)');
    console.log('   • earth_coastline_8k.png   (8K - ultra)');
    
  } catch (error) {
    console.error('\n❌ ERRORE PIPELINE:', error.message);
    process.exit(1);
  }
}

// Esegui il pipeline
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertShapefileToGeoJSON, generateTexture, saveTexture };
