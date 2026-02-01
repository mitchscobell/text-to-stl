#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json
const pkg = require(path.join(__dirname, '../package.json'));

// Generate version info
const versionInfo = {
  version: pkg.version,
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'production',
  name: pkg.name,
  description: pkg.description
};

// Write to public directory so it gets served
const publicPath = path.join(__dirname, '../public/version.json');
fs.writeFileSync(publicPath, JSON.stringify(versionInfo, null, 2));

console.log(`✅ Generated version.json: ${versionInfo.version} (${versionInfo.buildDate})`);
