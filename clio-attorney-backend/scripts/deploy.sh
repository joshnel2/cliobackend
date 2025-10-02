#!/bin/bash

echo "🚀 Deploying Attorney Payout Dashboard to Vercel..."

# Check if environment variables are set
if [ -z "$POSTGRES_URL" ]; then
    echo "❌ POSTGRES_URL environment variable is required"
    echo "💡 Set up a PostgreSQL database and add the connection string"
    exit 1
fi

if [ -z "$CLIO_CLIENT_ID" ] || [ -z "$CLIO_CLIENT_SECRET" ]; then
    echo "❌ Clio API credentials are required"
    echo "💡 Get your credentials from https://developers.clio.com/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Build the application
echo "🔨 Building application..."
npm run build

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
npx vercel --prod

echo "✅ Deployment completed!"
echo "🌐 Your dashboard should be available at your Vercel URL"
echo ""
echo "Next steps:"
echo "1. Visit your deployed URL"
echo "2. Click 'Setup Clio OAuth' to authorize the application"
echo "3. Enter your Firm ID to access the dashboard"
echo "4. The system will automatically sync data from Clio"