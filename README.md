# Attorney Payout Dashboard

A comprehensive dashboard system for calculating and visualizing attorney payouts using Clio billing data. The system consists of a React frontend dashboard and a Node.js backend API that integrates with Clio's API.

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + TypeScript + Vercel Functions
- **Database**: Vercel KV (Redis) for caching and configuration
- **Integration**: Clio API v4 with OAuth 2.0

## 📋 Prerequisites

### Required API Keys and Configuration

You'll need to set up the following to use this system:

#### 1. Clio Developer Account & API Keys

1. **Create a Clio Developer Account**:
   - Go to [Clio Developer Portal](https://developers.clio.com/)
   - Sign up for a developer account
   - Create a new application

2. **Get Your API Credentials**:
   - `CLIO_CLIENT_ID`: Your application's Client ID
   - `CLIO_CLIENT_SECRET`: Your application's Client Secret
   - `CLIO_REDIRECT_URI`: OAuth callback URL (e.g., `https://your-app.vercel.app/api/oauth/callback`)

3. **Required Clio API Scopes**:
   - `read:bills` - To access billing information
   - `read:matters` - To access matter details
   - `read:time_entries` - To access time tracking data
   - `read:users` - To access attorney information
   - `read:payments` - To access payment data

#### 2. Database Setup

You need **TWO** databases for this system:

**A. PostgreSQL Database (Primary Data Storage)**
1. **Create a PostgreSQL Database**:
   - **Option 1**: Use [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
   - **Option 2**: Use [Supabase](https://supabase.com/) (free tier available)
   - **Option 3**: Use [Railway](https://railway.app/) or [PlanetScale](https://planetscale.com/)

2. **Required Environment Variable**:
   - `POSTGRES_URL`: Your PostgreSQL connection string
   - Example: `postgresql://user:password@host:5432/database`

**B. Vercel KV Database (Caching & Configuration)**
1. **Create a Vercel KV Database**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Create a new KV database
   - Get the connection details

2. **Required Environment Variables**:
   - `KV_URL`: Your KV database URL
   - `KV_REST_API_URL`: REST API endpoint
   - `KV_REST_API_TOKEN`: Authentication token

## 🚀 Setup Instructions

### Backend Setup

1. **Clone and navigate to the backend**:
   ```bash
   cd clio-attorney-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables** in `.env.local`:
   ```env
   # Clio API Configuration
   CLIO_CLIENT_ID=your_clio_client_id
   CLIO_CLIENT_SECRET=your_clio_client_secret
   CLIO_REDIRECT_URI=https://your-app.vercel.app/api/oauth/callback
   CLIO_BASE_URL=https://app.clio.com
   DEFAULT_SCOPE=read:bills read:matters read:time_entries read:users read:payments

   # PostgreSQL Database (Primary Storage)
   POSTGRES_URL=postgresql://user:password@host:5432/database

   # Vercel KV Configuration (Caching)
   KV_URL=your_kv_url
   KV_REST_API_URL=your_kv_rest_api_url
   KV_REST_API_TOKEN=your_kv_rest_api_token

   # Optional Configuration
   CLIO_MAX_USER_PAGES=5
   ```

5. **Set up the database**:
   ```bash
   npm run db:migrate
   ```

6. **Deploy to Vercel**:
   ```bash
   # Option 1: Use the deployment script
   ./scripts/deploy.sh
   
   # Option 2: Manual deployment
   npm run build
   npx vercel --prod
   ```

**That's it!** The dashboard is now a full-stack application that includes both the API and the React frontend in a single Vercel deployment.

## 🔧 Configuration

### Payout Algorithm Configuration

The system supports customizable payout algorithms. Default percentages are:

- **Originating Attorney**: 15% of collected fees
- **Working Attorney**: 30% of billed time
- **Referral Fees**: 10% of referred matters
- **Self-Originating + Self-Billed**: 50% of billed amount
- **Self-Originating + Others-Billed**: 15% of others' billed amount
- **Non-Originating + Self-Billed**: 30% of billed amount

You can customize these through the API:

```bash
# Get current configuration
curl -X GET "https://your-backend.vercel.app/api/config?firmId=YOUR_FIRM_ID"

# Update configuration
curl -X POST "https://your-backend.vercel.app/api/config?firmId=YOUR_FIRM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "originatingPercentage": 20,
    "workingPercentage": 35,
    "referralPercentage": 12,
    "selfOrigSelfBilledPercentage": 55,
    "selfOrigOthersBilledPercentage": 18,
    "nonOrigSelfBilledPercentage": 32
  }'
```

## 🔐 Authentication Flow

1. **Initial Setup**:
   - User enters their Firm ID in the login screen
   - Click "Setup Clio OAuth" to authorize the application
   - User is redirected to Clio for authentication
   - After approval, user returns to the dashboard

2. **Ongoing Access**:
   - The system stores OAuth tokens securely
   - Tokens are automatically refreshed as needed
   - Users only need to enter their Firm ID for subsequent logins

## 📊 Features

### Dashboard Features

- **Real-time Payout Calculations**: Based on actual Clio data
- **Attorney Overview**: Individual attorney payout breakdowns
- **Matter-level Details**: See payouts for each matter
- **Interactive Charts**: Bar charts and pie charts for visualization
- **Export Functionality**: Download Excel reports
- **Search and Filtering**: Find specific attorneys or matters
- **Responsive Design**: Works on desktop and mobile

### API Endpoints

- `GET /api/sync?firmId=X` - Calculate and return payout data
- `GET /api/export?firmId=X` - Export all data as Excel
- `GET /api/export/attorney?firmId=X&attorneyId=Y` - Export single attorney data
- `GET /api/config?firmId=X` - Get payout configuration
- `POST /api/config?firmId=X` - Update payout configuration
- `GET /api/users?firmId=X` - List all attorneys
- `GET /api/env?firmId=X` - Check environment configuration

## 🔄 Data Synchronization

- **Automatic Sync**: Data refreshes every 5 minutes in the dashboard
- **Manual Sync**: Click the sync button for immediate refresh
- **Caching**: Results are cached for 10 minutes to improve performance
- **Rate Limiting**: Built-in rate limiting to respect Clio API limits

## 🛠️ Customization

### Adding Custom Algorithms

To implement custom payout algorithms:

1. **Modify** `lib/payouts.ts` in the backend
2. **Update** the `calculatePayouts` function
3. **Add** new configuration options in `PayoutConfig` interface
4. **Update** the frontend to support new configuration options

### Extending Data Sources

To add additional Clio data:

1. **Add** new API functions in `lib/clio.ts`
2. **Update** the payout calculation logic
3. **Modify** the dashboard to display new data

## 🚨 Security Considerations

- OAuth tokens are stored securely in Vercel KV
- All API calls use HTTPS
- Rate limiting prevents API abuse
- Environment variables protect sensitive credentials
- No sensitive data is stored in the frontend

## 📈 Performance

- **Caching**: Aggressive caching reduces API calls
- **Pagination**: Large datasets are paginated
- **Lazy Loading**: Components load data as needed
- **Optimized Queries**: Minimal API calls for maximum data

## 🐛 Troubleshooting

### Common Issues

1. **OAuth Setup Failed**:
   - Verify `CLIO_REDIRECT_URI` matches your deployed URL
   - Check that all required scopes are requested
   - Ensure Clio app is approved and active

2. **No Data Showing**:
   - Verify API credentials are correct
   - Check that the firm has bills, matters, and time entries
   - Look at browser console for API errors

3. **Performance Issues**:
   - Reduce `CLIO_MAX_USER_PAGES` if you have many attorneys
   - Check Vercel function logs for timeout issues
   - Consider implementing incremental sync for large datasets

### Debug Mode

Enable debug logging by adding to your environment:
```env
DEBUG=true
```

## 📞 Support

For issues with:
- **Clio API**: Contact [Clio Developer Support](https://support.clio.com/hc/en-us/categories/201319038-API)
- **Vercel Deployment**: Check [Vercel Documentation](https://vercel.com/docs)
- **Custom Development**: Modify the code as needed for your specific requirements

## 📄 License

This project is provided as-is for educational and business use. Modify as needed for your organization's requirements.