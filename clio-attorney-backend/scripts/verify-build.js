#!/usr/bin/env node

import { existsSync, statSync } from 'fs'
import { join } from 'path'

console.log('🔍 Verifying build...')

const distPath = join(process.cwd(), 'dist')
const indexPath = join(distPath, 'index.html')

if (!existsSync(distPath)) {
  console.error('❌ dist directory not found')
  console.log('💡 Run "npm run build" to build the application')
  process.exit(1)
}

if (!existsSync(indexPath)) {
  console.error('❌ index.html not found in dist directory')
  console.log('💡 Run "npm run build" to build the application')
  process.exit(1)
}

const stats = statSync(indexPath)
console.log(`✅ Build verified!`)
console.log(`📁 Dist directory: ${distPath}`)
console.log(`📄 Index file: ${indexPath} (${stats.size} bytes)`)
console.log(`🕐 Built: ${stats.mtime.toLocaleString()}`)

// Check for common assets
const assetsPath = join(distPath, 'assets')
if (existsSync(assetsPath)) {
  console.log(`📦 Assets directory found`)
} else {
  console.log(`⚠️  No assets directory found (this might be normal)`)
}

console.log('🎉 Ready for deployment!')