# ChainWatch

> **Professional Web3 Monitoring Platform** — Real-time blockchain event tracking with Telegram notifications and comprehensive dashboard for Ethereum Sepolia testnet.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

## 🌟 Overview

ChainWatch is a full-featured blockchain monitoring platform that tracks wallet activity in real-time. It combines powerful backend monitoring with a professional React dashboard, offering instant Telegram notifications, transaction categorization, USD price tracking, and comprehensive portfolio analytics.

**Key Capabilities:**
- 🔍 **Real-time Monitoring** — WebSocket connection for instant transaction detection
- 💰 **Portfolio Tracking** — Live USD values and historical analytics
- 📱 **Telegram Alerts** — Instant notifications with retry logic
- 🎯 **Smart Categorization** — Auto-detect swaps, NFT trades, DeFi interactions
- 🎨 **Professional Dashboard** — Modern sidebar navigation with dark theme
- ⚡ **Web3 Actions** — Send transactions, verify contracts, create alerts
- 📊 **Analytics** — Historical search and transaction export

---

## 📸 Features

### 🎨 Modern Professional UI

**Welcome Page**
- Beautiful landing page with feature showcase
- Gradient branding and hero section
- MetaMask wallet integration

**Sidebar Navigation**
- Fixed left sidebar with active state highlighting
- Mobile responsive with hamburger menu
- Connection status and wallet display

**Multi-Page Dashboard**
- **Dashboard** — Stats overview, quick actions, recent activity
- **Send Transaction** — Execute ETH/token transfers
- **Verify Contract** — Contract verification on Etherscan
- **Alert Rules** — Custom notification conditions
- **Analytics** — Historical transaction search

### 💼 Blockchain Features

**Transaction Monitoring**
- Native ETH transfers
- ERC20 token transfers (LINK, USDC, etc.)
- Incoming and outgoing transaction detection
- Smart contract interaction tracking

**Transaction Categorization**
- 🔄 **DEX Swaps** — Uniswap, SushiSwap, PancakeSwap
- 💸 **Token Transfers** — Peer-to-peer transfers
- 🖼️ **NFT Trades** — OpenSea, Blur, LooksRare
- ✅ **Token Approvals** — Approval tracking
- 🏦 **DeFi Interactions** — Staking, lending, liquidity
- 📝 **Contract Calls** — Generic smart contract interactions

**USD Price Integration**
- Real-time USD values via CoinGecko API
- Cached pricing (1-minute refresh)
- Historical price tracking
- 24-hour price change indicators

**Portfolio Analytics**
- Total portfolio value calculation
- Individual token holdings with live prices
- Portfolio value history charts
- Diversification score
- Multi-wallet support

### 🔔 Alert System

**Custom Alert Rules**
- Large transaction detection (threshold-based)
- Whale watching (specific addresses)
- Token-specific monitoring
- Time-window alerts
- Multiple conditions per rule

**Telegram Notifications**
- Instant alerts with transaction details
- Etherscan links for verification
- USD value display
- Transaction category badges
- 5 retry attempts with exponential backoff

### 🛠️ Web3 Actions

**Transaction Executor**
- Send ETH with gas estimation
- Send ERC20 tokens
- MetaMask integration
- Transaction status tracking

**Contract Verifier**
- Verify contracts on Etherscan
- Multi-network support
- Contract bytecode analysis
- Verification status display

**Historical Analytics**
- Search transactions by date range
- Filter by type, direction, amount
- Export to CSV
- Multi-wallet queries

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Alchemy Account** ([Sign up](https://alchemy.com/)) — Free tier works
- **Telegram Bot** (Optional) — For notifications

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ChainWatch

# Install all dependencies (backend + frontend)
npm run install:all
```

### Configuration

#### 1. Environment Variables

Create `.env` file in the root directory:

```env
# Required: Alchemy Sepolia WebSocket RPC
SEPOLIA_WS_RPC=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Optional: For Telegram notifications
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

**Getting Alchemy API Key:**
1. Sign up at [alchemy.com](https://alchemy.com/)
2. Create a new app on Sepolia network
3. Copy the WebSocket URL from the dashboard

#### 2. Runtime Configuration

Edit `config.json`:

```json
{
  "tokenContract": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  "trackingMode": "all",
  "thresholdAmount": 0,
  "watchedWallets": [
    {
      "address": "0xYOUR_WALLET_ADDRESS_HERE",
      "label": "My Wallet",
      "enabled": true
    }
  ],
  "cooldownSeconds": 0,
  "telegramChatId": "your_chat_id",
  "confirmationDepth": 0
}
```

**Configuration Options:**

| Field | Type | Description |
|-------|------|-------------|
| `tokenContract` | String | ERC20 token address to monitor (default: LINK) |
| `trackingMode` | String | `"all"` (ETH + Token), `"eth"`, or `"token"` |
| `thresholdAmount` | Number | Minimum transfer amount to trigger alerts |
| `watchedWallets` | Array | Wallet objects with address, label, enabled |
| `cooldownSeconds` | Number | Seconds between alerts for same wallet |
| `telegramChatId` | String | Your Telegram chat ID |
| `confirmationDepth` | Number | Required block confirmations (0 = immediate) |

### Running the Application

**Option 1: Everything at once (Recommended)**
```bash
npm run demo
```

**Option 2: Separate terminals**
```bash
# Terminal 1: Backend server
npm start

# Terminal 2: UI development server
npm run ui
```

### Access Points

- **Dashboard:** http://localhost:5173
- **API:** http://localhost:3002
- **Health Check:** http://localhost:3002/api/health
- **System Status:** http://localhost:3002/api/status

---

## 📱 Setting Up Telegram (Optional)

### Step 1: Create Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow prompts to name your bot
4. Copy the bot token provided
5. Add to `.env` as `TELEGRAM_BOT_TOKEN`

### Step 2: Get Chat ID

1. Start a conversation with your new bot (send any message)
2. Visit this URL (replace `YOUR_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Find `"chat":{"id":123456789}` in the JSON response
4. Add to `config.json` as `telegramChatId`

### Step 3: Test Notification

```bash
curl http://localhost:3002/api/test-telegram
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ChainWatch System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Ethereum   │────▶│  Blockchain  │────▶│   Wallet     │    │
│  │   Sepolia    │     │   Listener   │     │   Filter     │    │
│  │   (RPC WS)   │     │              │     │              │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│                                                    │            │
│                       ┌────────────────────────────┼─────────┐  │
│                       │                            │         │  │
│                       ▼                            ▼         │  │
│              ┌──────────────┐           ┌──────────────┐     │  │
│              │   Analytics  │           │   WebSocket  │     │  │
│              │   Engine     │           │   Server     │     │  │
│              │              │           │              │     │  │
│              └──────┬───────┘           └──────┬───────┘     │  │
│                     │                          │             │  │
│                     ▼                          ▼             │  │
│              ┌──────────────┐           ┌──────────────┐     │  │
│              │   Telegram   │           │   React UI   │     │  │
│              │   Notifier   │           │   Dashboard  │     │  │
│              └──────────────┘           └──────────────┘     │  │
│                                                              │  │
│  ┌──────────────┐                                            │  │
│  │ config.json  │◀─── Hot Reload (chokidar)                  │  │
│  └──────────────┘                                            │  │
│                                                              │  │
└──────────────────────────────────────────────────────────────┘
```

### Project Structure

```
ChainWatch/
├── src/                          # Backend source code
│   ├── index.js                  # Main entry point
│   │
│   ├── blockchain/               # Blockchain monitoring
│   │   ├── listener.js           # WebSocket RPC connection
│   │   └── filter.js             # Transaction filtering
│   │
│   ├── analytics/                # Transaction analysis
│   │   ├── categorizer.js        # Auto-categorization
│   │   ├── priceService.js       # USD price integration
│   │   ├── portfolio.js          # Portfolio tracking
│   │   └── analyticsService.js   # Historical analytics
│   │
│   ├── notifications/            # Alert system
│   │   └── notifier.js           # Telegram notifications
│   │
│   ├── api/                      # Web API
│   │   ├── routes.js             # REST endpoints
│   │   ├── authRoutes.js         # Authentication (legacy)
│   │   └── websocket.js          # Real-time updates
│   │
│   └── core/                     # Core utilities
│       ├── storage.js            # Event persistence
│       ├── configWatcher.js      # Hot reload
│       ├── alertRules.js         # Custom alert rules
│       ├── auth.js               # Authentication (legacy)
│       └── userManager.js        # User management (legacy)
│
├── ui/                           # React frontend
│   ├── src/
│   │   ├── App.jsx               # Main application
│   │   ├── Portfolio.jsx         # Portfolio component
│   │   │
│   │   └── components/
│   │       ├── Sidebar.jsx       # Navigation sidebar
│   │       ├── WelcomePage.jsx   # Landing page
│   │       ├── DashboardPage.jsx # Dashboard overview
│   │       ├── WalletConnect.jsx # MetaMask integration
│   │       ├── TransactionExecutor.jsx
│   │       ├── ContractVerifier.jsx
│   │       ├── AlertRulesManager.jsx
│   │       ├── HistoricalAnalytics.jsx
│   │       └── ui/               # shadcn/ui components
│   │           ├── button.jsx
│   │           ├── card.jsx
│   │           ├── badge.jsx
│   │           └── tabs.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── data/
│   ├── events.json               # Persistent event storage
│   └── users.json                # User data (legacy)
│
├── config.json                   # Runtime configuration
├── .env                          # Environment variables
├── package.json
└── README.md
```

---

## 🔌 API Reference

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/status` | Full system status |
| `GET` | `/api/config` | Current configuration |
| `POST` | `/api/test-telegram` | Send test notification |

### Event Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events` | Recent events (limit, wallet params) |
| `GET` | `/api/events/search` | Search historical events |
| `GET` | `/api/events/export` | Export events to CSV |
| `GET` | `/api/stats` | Event statistics |

### Wallet Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/wallets` | Get watched wallets |
| `POST` | `/api/wallets` | Add wallet to watch |
| `DELETE` | `/api/wallets/:address` | Remove wallet |
| `PATCH` | `/api/wallets/:address` | Update wallet settings |

### Portfolio & Pricing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/portfolio/:address` | Get portfolio with live prices |
| `GET` | `/api/portfolio/:address/history` | Portfolio value history |
| `GET` | `/api/price/:tokenAddress` | Get USD price for token |

### Alert Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alert-rules` | Get all alert rules |
| `POST` | `/api/alert-rules` | Create new rule |
| `DELETE` | `/api/alert-rules/:id` | Delete rule |
| `PATCH` | `/api/alert-rules/:id` | Update rule |

---

## 🎯 Usage Examples

### Monitoring Your Wallet

1. **Add your wallet** to `config.json`:
   ```json
   "watchedWallets": [
     {
       "address": "0xYourWalletAddress",
       "label": "My Main Wallet",
       "enabled": true
     }
   ]
   ```

2. **Start the application**:
   ```bash
   npm run demo
   ```

3. **Open dashboard**: http://localhost:5173

4. **Connect MetaMask** on the welcome page

5. **Send a test transaction** from/to your wallet

6. **Watch events appear** in:
   - Terminal logs
   - Dashboard live feed
   - Telegram (if configured)

### Creating Custom Alert Rules

Navigate to **Alert Rules** page and create rules like:

- **Large Transaction Alert**
  ```
  Type: Large Transaction
  Threshold: 1 ETH
  Direction: Both
  ```

- **Whale Watching**
  ```
  Type: Specific Address
  Address: 0xWhaleAddress...
  Direction: Incoming
  ```

- **Token Monitoring**
  ```
  Type: Token Activity
  Token: 0xTokenAddress...
  Min Amount: 100
  ```

### Sending Transactions

1. Navigate to **Send Transaction** page
2. Choose ETH or Token
3. Enter recipient address
4. Enter amount
5. Click **Send Transaction**
6. Approve in MetaMask

### Verifying Contracts

1. Navigate to **Verify Contract** page
2. Enter contract address
3. Click **Check Verification**
4. View verification status and bytecode

### Searching Transaction History

1. Navigate to **Analytics** page
2. Set date range
3. Filter by type/direction/amount
4. Click **Search**
5. Export results to CSV if needed

---

## 🧪 Testing with Sepolia

### Get Test Funds

**Sepolia ETH:**
- https://sepoliafaucet.com
- https://sepolia-faucet.pk910.de

**Test LINK Tokens:**
- https://faucets.chain.link

### Test Scenarios

1. **ETH Transfer**: Send 0.01 ETH to another address
2. **Token Transfer**: Send 10 LINK tokens
3. **Swap**: Use Uniswap on Sepolia
4. **Contract Interaction**: Interact with any dApp

All transactions will be automatically:
- Categorized by type
- Displayed with USD values
- Added to portfolio
- Sent to Telegram (if configured)

---

## 🎨 UI Features

### Dark Theme Design

- **Background**: `zinc-950` (main), `zinc-900` (cards)
- **Text**: `white` (primary), `zinc-400` (secondary)
- **Accent**: `blue-600` (active states, CTAs)
- **Success**: `green-500` (incoming, connected)
- **Warning**: `orange-500` (outgoing)
- **Error**: `red-500` (errors, offline)

### Responsive Design

- **Desktop** (≥1024px): Sidebar always visible
- **Tablet/Mobile** (<1024px): Hamburger menu, collapsible sidebar
- Touch-optimized buttons and controls
- Adaptive layouts for small screens

### Components

Built with **shadcn/ui** and **Tailwind CSS 4**:
- Cards with glass-morphism effects
- Animated badges and buttons
- Smooth transitions
- Loading states
- Error boundaries

---

## 🔧 Development

### Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- ethers.js v6
- WebSocket (ws)
- node-telegram-bot-api
- chokidar (file watching)

**Frontend:**
- React 18
- Vite 5
- Tailwind CSS 4
- shadcn/ui components
- lucide-react icons
- recharts (analytics)

### Scripts

```bash
# Development
npm run dev          # Backend with hot reload
npm run ui           # Frontend dev server
npm run demo         # Both at once

# Production
npm start            # Start backend
npm run build        # Build UI for production

# Installation
npm run install:all  # Install all dependencies
```

### Hot Reload

Configuration changes in `config.json` are automatically detected and applied without restart. This includes:
- Watched wallets
- Threshold amounts
- Cooldown periods
- Tracking mode

---

## 🐛 Troubleshooting

### Backend Issues

**"SEPOLIA_WS_RPC environment variable not set"**
- Copy `.env.example` to `.env`
- Add your Alchemy WebSocket URL

**"WebSocket disconnected"**
- Verify RPC URL is correct
- Check Alchemy API credits/rate limits
- System will auto-reconnect

**"Telegram notifications disabled"**
- Verify `TELEGRAM_BOT_TOKEN` in `.env`
- Verify `telegramChatId` in `config.json`
- Test: `curl http://localhost:3002/api/test-telegram`

### Frontend Issues

**UI shows "Connecting..."**
- Ensure backend is running on port 3002
- Check browser console for errors
- Verify WebSocket connection

**Wallet won't connect**
- Install MetaMask browser extension
- Switch to Sepolia network in MetaMask
- Refresh page and try again

**Transactions not appearing**
- Verify wallet address in `watchedWallets`
- Check address format (must start with 0x)
- Ensure `trackingMode` is set correctly
- Wait a few seconds for block confirmation

**Disconnect button not working**
- Clear browser localStorage: `localStorage.clear()`
- Hard refresh: Ctrl+Shift+R
- The app uses localStorage to prevent auto-reconnect

---

## 📝 Known Limitations

- **Sepolia testnet only** — Not configured for mainnet
- **Single chain** — Only Ethereum (no L2s, side chains)
- **No persistence across restarts** — Events stored in memory/JSON
- **Rate limits** — CoinGecko API limited to 30 calls/min (free tier)
- **MetaMask required** — For transaction execution features

---

## 🤝 Contributing

This is a hackathon demo project. Feel free to fork and extend!

**Ideas for enhancement:**
- Multi-chain support (Polygon, Arbitrum, etc.)
- Database persistence (PostgreSQL, MongoDB)
- Email notifications
- Mobile app
- Advanced charting
- DeFi protocol integrations

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Alchemy** — Blockchain infrastructure
- **CoinGecko** — Price data API
- **shadcn/ui** — UI component library
- **Etherscan** — Block explorer
- **Telegram** — Notification platform

---

**Built for hackathon demonstration purposes.**  
**ChainWatch** — Your comprehensive blockchain monitoring companion.
