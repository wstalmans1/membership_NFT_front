#!/usr/bin/env node

/**
 * Post-build script to fix IPFS routing
 * Copies HTML files into their respective directories as index.html
 * This ensures IPFS serves the page instead of a directory listing
 */

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');

// Routes that need index.html files
const routes = [
  'membership',
  'governance',
  'treasury',
  'constitution',
  'dao-architecture',
  'philosophy',
  'getting-started',
];

console.log('🔧 Fixing IPFS routes...');

routes.forEach((route) => {
  const htmlFile = path.join(outDir, `${route}.html`);
  const routeDir = path.join(outDir, route);
  const indexFile = path.join(routeDir, 'index.html');

  // Check if HTML file exists
  if (!fs.existsSync(htmlFile)) {
    console.warn(`⚠️  Warning: ${route}.html not found, skipping...`);
    return;
  }

  // Ensure route directory exists
  if (!fs.existsSync(routeDir)) {
    console.log(`📁 Creating directory: ${route}`);
    fs.mkdirSync(routeDir, { recursive: true });
  }

  // Copy HTML file to index.html in route directory
  try {
    fs.copyFileSync(htmlFile, indexFile);
    console.log(`✅ Created ${route}/index.html`);
  } catch (error) {
    console.error(`❌ Error creating ${route}/index.html:`, error.message);
  }
});

console.log('✨ IPFS routes fixed!');
