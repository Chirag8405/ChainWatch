# ChainWatch

Personal wallet activity monitor with real-time Telegram notifications for Ethereum Sepolia testnet.

## What is this?

ChainWatch monitors your wallet's blockchain activity in real-time. It watches for **native ETH transfers** and **ERC20 token transfers** (like LINK) involving your wallet address, and sends instant Telegram notifications when transactions are detected.

**How it works:** ChainWatch connects to Sepolia testnet via WebSocket, monitors every new block for transactions involving your watched wallet(s), and immediately sends you a Telegram alert with transaction details including amount, addresses, and Etherscan link.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ChainWatch System                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│   │   Ethereum   │────▶│  Blockchain  │────▶│   Wallet     │        │
│   │   Sepolia    │     │   Listener   │     │   Filter     │        │
│   │   (RPC WS)   │     │ (ETH+Token)  │     │              │        │
│   └──────────────┘     └──────────────┘     └──────┬───────┘        │
│                                                     │               │
│                              ┌──────────────────────┼───────────┐   │
│                              │                      │           │   │
│                              ▼                      ▼           │   │
│                     ┌──────────────┐       ┌──────────────┐     │   │
│                     │   Telegram   │       │   WebSocket  │     │   │
│                     │   Notifier   │       │   Broadcast  │     │   │
│                     │  (5 retries) │       │              │     │   │
│                     └──────┬───────┘       └──────┬───────┘     │   │
│                            │                      │             │   │
│                            ▼                      ▼             │   │
│                     ┌──────────────┐       ┌──────────────┐     │   │
│                     │   Telegram   │       │   React UI   │     │   │
│                     │     App      │       │  Dashboard   │     │   │
│                     └──────────────┘       └──────────────┘     │   │
│                                                                     │
│   ┌──────────────┐                                                  │
│   │ config.json  │◀──── Hot Reload (chokidar)                       │
│   │              │                                                  │
│   └──────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

- **Wallet-focused monitoring** — Only tracks YOUR wallet's transactions (no spam)
- **Dual tracking** — Monitors both native ETH and ERC20 token transfers
- **Real-time detection** — WebSocket connection for instant event capture
- **Telegram alerts** — Instant notifications with Etherscan links (5 retry attempts)
- **Live UI** — Real-time dashboard showing your wallet activity
- **Hot reload** — Change config.json without restarting
- **Auto-reconnect** — Handles connection drops gracefully

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- Alchemy account (for Sepolia WebSocket RPC)
- Telegram bot (for notifications)

### 2. Setup

```bash
# Enter directory
cd chainwatch

# Install all dependencies
npm run install:all

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Configure `.env`

```env
# Required: Get from Alchemy (free tier works)
SEPOLIA_WS_RPC=wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Required: For Telegram alerts
TELEGRAM_BOT_TOKEN=your_bot_token
```

### 4. Configure `config.json`

```json
{
  "tokenContract": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  "trackingMode": "all",
  "thresholdAmount": 0,
  "watchedWallets": [
    "0xYOUR_WALLET_ADDRESS_HERE"
  ],
  "cooldownSeconds": 0,
  "telegramChatId": "your_chat_id",
  "confirmationDepth": 0
}
```

**Configuration Options:**

| Field | Description |
|-------|-------------|
| `tokenContract` | ERC20 token address to monitor (default: LINK on Sepolia) |
| `trackingMode` | `"all"` (ETH + Token), `"eth"` (ETH only), `"token"` (Token only) |
| `thresholdAmount` | Minimum transfer amount to trigger alert |
| `watchedWallets` | **Your wallet address(es)** — only these will be tracked |
| `cooldownSeconds` | Seconds between alerts for same wallet |
| `telegramChatId` | Your Telegram chat ID for notifications |
| `confirmationDepth` | Block confirmations before alerting (0 = immediate) |

### 5. Run

```bash
# Start everything (backend + UI)
npm run demo
```

Or run separately:

```bash
# Terminal 1: Backend
npm start

# Terminal 2: UI
npm run ui
```

### 6. Access

- **Dashboard:** http://localhost:5173
- **API Status:** http://localhost:3001/api/status

## Setting Up Telegram

### Step 1: Create a Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow prompts to name your bot
4. Copy the bot token (looks like `123456789:ABC-DEF...`)
5. Add to `.env` as `TELEGRAM_BOT_TOKEN`

### Step 2: Get Your Chat ID

1. Start a conversation with your new bot (send any message)
2. Open this URL in browser (replace YOUR_TOKEN):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Find `"chat":{"id":123456789}` in the response
4. Add to `config.json` as `telegramChatId`

### Step 3: Test

Send a small ETH transfer from your wallet — you should receive a Telegram notification!

## 🧪 Demo Flow

1. Start the app with `npm run demo`
2. Open http://localhost:5173 in your browser
3. UI shows "Connected" status with your wallet indicator
4. Send ETH or LINK from/to your watched wallet
5. Watch the event appear in both:
   - Terminal logs: `✅ Event MATCHED: 0.001 ETH`
   - UI Dashboard: Live event card
   - Telegram: Alert with Etherscan link

### Test with Sepolia Faucets

1. Get Sepolia ETH: https://sepoliafaucet.com
2. Get test LINK: https://faucets.chain.link
3. Send to yourself or another address to trigger events

## Project Structure

```
chainwatch/
├── src/
│   ├── index.js          # Main entry point & event orchestration
│   ├── listener.js       # Blockchain listener (ETH + Token)
│   ├── filter.js         # Wallet matching & deduplication
│   ├── notifier.js       # Telegram notifications (5 retries)
│   ├── configWatcher.js  # Hot reload for config.json
│   ├── websocket.js      # WebSocket server for UI
│   └── routes.js         # Express API routes
├── ui/
│   ├── src/
│   │   ├── App.jsx       # React UI component
│   │   ├── main.jsx      # React entry point
│   │   └── index.css     # Dark theme styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── config.json           # Runtime configuration (hot reloadable)
├── .env                  # Environment secrets
├── .env.example          # Environment template
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/status` | Full system status |
| `GET /api/config` | Current configuration |
| `GET /api/events` | Recent wallet events (last 100) |
| `GET /api/stats` | Filter and alert statistics |
| `POST /api/test-telegram` | Send test notification |

## UI Features

- **Connection Status** — Shows WebSocket connection to Sepolia
- **Active Filters** — Displays threshold, watched wallets count, cooldown
- **My Wallet Activity** — Real-time feed of YOUR wallet's transactions only
- **Last Telegram Alert** — Confirms successful notification delivery
- **Dark Theme** — Easy on the eyes for monitoring

## Known Limitations

- **Sepolia testnet only** — Configured for Ethereum testnet
- **Memory storage** — Events not persisted across restarts
- **No authentication** — UI and API are open (for demo purposes)
- **Single notification channel** — Telegram only
- **Watched wallets required** — Must configure at least one wallet

## Troubleshooting

**"SEPOLIA_WS_RPC environment variable not set"**
- Copy `.env.example` to `.env` and add your Alchemy RPC URL

**"WebSocket disconnected"**
- Check your RPC URL is valid
- Ensure you have remaining API credits on Alchemy

**"Telegram notifications disabled"**
- Verify `TELEGRAM_BOT_TOKEN` in `.env`
- Verify `telegramChatId` in `config.json`
- Make sure you've started a chat with your bot

**"No transactions appearing"**
- Verify your wallet address is in `watchedWallets` array
- Check the address is correctly formatted (starts with 0x)
- Ensure `trackingMode` includes the transfer type you're testing

**"ECONNRESET error on Telegram"**
- Network hiccup — the system auto-retries up to 5 times
- Check your internet connection

**UI shows "Connecting..."**
- Ensure backend is running on port 3001
- Check browser console for WebSocket errors

## License

MIT

---

Built for hackathon demo purposes. Personal wallet monitoring for Ethereum Sepolia testnet.
