import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // In production, Vercel will serve the built files directly
    // This is just a fallback for development
    const indexPath = join(process.cwd(), 'dist', 'index.html')
    const html = readFileSync(indexPath, 'utf8')
    
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
  } catch (error) {
    // If dist doesn't exist, show a helpful message
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attorney Payout Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
            .success { background: #efe; border: 1px solid #cfc; padding: 20px; border-radius: 5px; }
            code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>🏗️ Attorney Payout Dashboard</h1>
          
          <div class="error">
            <h3>⚠️ Dashboard Not Built Yet</h3>
            <p>The React dashboard needs to be built before it can be served.</p>
          </div>
          
          <div class="success">
            <h3>✅ API is Running</h3>
            <p>Your backend API is working correctly! Here are the available endpoints:</p>
            <ul>
              <li><a href="/api/env?firmId=test">Environment Check</a></li>
              <li><a href="/api/users?firmId=test">Users API</a></li>
              <li><a href="/api/sync?firmId=test">Sync API</a></li>
            </ul>
          </div>
          
          <h3>🚀 To Deploy the Full Dashboard:</h3>
          <ol>
            <li>Run <code>npm install</code> to install dependencies</li>
            <li>Run <code>npm run build</code> to build the React app</li>
            <li>Run <code>npx vercel --prod</code> to deploy</li>
          </ol>
          
          <h3>🔧 For Development:</h3>
          <ol>
            <li>Run <code>npm run build</code> to build the React app</li>
            <li>Run <code>vercel dev</code> to start the development server</li>
          </ol>
        </body>
      </html>
    `)
  }
}