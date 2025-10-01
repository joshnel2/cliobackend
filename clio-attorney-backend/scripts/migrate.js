#!/usr/bin/env node

import { createClient } from '@vercel/postgres'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigrations() {
  console.log('🚀 Starting database migrations...')
  
  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Read and execute the initial schema
    const schemaPath = join(__dirname, '../migrations/001_initial_schema.sql')
    const schemaSql = readFileSync(schemaPath, 'utf8')
    
    console.log('📝 Running initial schema migration...')
    await client.query(schemaSql)
    console.log('✅ Initial schema migration completed')

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Record this migration
    await client.query(`
      INSERT INTO migrations (filename) 
      VALUES ('001_initial_schema.sql') 
      ON CONFLICT (filename) DO NOTHING
    `)

    console.log('✅ Migration tracking updated')
    console.log('🎉 All migrations completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Check if we have the required environment variable
if (!process.env.POSTGRES_URL) {
  console.error('❌ POSTGRES_URL environment variable is required')
  console.log('💡 Set up a PostgreSQL database and add POSTGRES_URL to your environment')
  process.exit(1)
}

runMigrations()