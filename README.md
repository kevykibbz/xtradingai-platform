# WebSocket Trading Application

A modern React-based trading application built with Vite, featuring real-time WebSocket connections, Deriv API integration, Redux state management, and comprehensive testing capabilities.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Deriv.com account with API access

### Installation

```bash
npm install
```

### Environment Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your Deriv API credentials:
```env
VITE_APP_ID=YOUR_DERIV_APP_ID
```

3. Register your application at https://app.deriv.com/account/api-token:
   - Create a new API token
   - Set OAuth Redirect URL to your deployment URL
   - Note your App ID for the `.env` file

### Development

```bash
npm run dev
```

The application will start on `http://localhost:3001`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🌐 Deployment

### Deploying to Vercel (Recommended)

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

2. **Deploy to Vercel:**
   - Visit https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - Framework Preset: **Vite**
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`
   - Add Environment Variables:
     - `VITE_APP_ID`: Your Deriv App ID
   - Click "Deploy"

3. **Update Deriv OAuth Settings:**
   - Go to https://app.deriv.com/account/api-token
   - Update your app's OAuth Redirect URL to: `https://your-app.vercel.app/`

### Automatic Deployments

Vercel automatically deploys:
- **Production**: On every push to `main` branch
- **Preview**: On every pull request

## 📋 Available Scripts

- `npm run dev` - Start development server (port 3001)
- `npm run build` - Build for production
- `npm run preview` - Preview production build (port 3000)
- `npm run lint` - Run ESLint
- `npm test` - Run Playwright tests
- `npm run test:ui` - Run tests in UI mode
- `npm run test:headed` - Run tests with visible browser
- `npm run test:debug` - Run tests in debug mode
- `npm run test:report` - View test report
- `npm run sonar` - Run SonarQube analysis

## 🏗️ Project Structure

```
src/
├── components/     # React components
├── contexts/       # React contexts (DerivContext)
├── hooks/         # Custom React hooks
├── lib/           # Core libraries (Deriv API, WebSocket)
├── routes/        # Route components
├── store/         # Redux store and slices
└── utils/         # Utility functions
```

## 🔌 Deriv API Integration

The application includes a comprehensive Deriv API wrapper (`DerivAPI`) that provides access to all 108+ Deriv.com/Binary.com API endpoints.

### Usage

The `DerivAPI` class is automatically initialized in `DerivContext` when the WebSocket connects. Access it via the `useDerivAPI` hook:

```javascript
import { useDerivAPI } from '@/contexts/DerivContext';

function MyComponent() {
  const { api } = useDerivAPI();
  
  // Use API methods
  const proposal = await api.proposal('CALL', 'USD', 'R_50', {
    amount: 100,
    duration: 60,
    duration_unit: 's'
  });
}
```

### Available API Methods

#### Trading
- `buy(proposal_id, price, options)` - Buy a contract
- `sell(contract_id, price, options)` - Sell a contract
- `proposal(contract_type, currency, symbol, options)` - Get price proposal
- `portfolio(options)` - Get open positions

#### Market Data
- `active_symbols(active_symbols, options)` - Get active symbols
- `ticks(symbols, options)` - Subscribe to tick stream
- `ticks_history(symbol, end, options)` - Get historical ticks
- `contracts_for(symbol, options)` - Get contracts for symbol

#### Account Management
- `authorize(token, options)` - Authorize session
- `balance(options)` - Get account balance
- `get_settings(options)` - Get account settings
- `statement(options)` - Get account statement

See `src/lib/deriv-api.js` for the complete list of all 108+ available methods.

### Backward Compatibility

All existing code using `api.send()` continues to work:

```javascript
const response = await api.send({
  proposal: 1,
  contract_type: 'CALL',
  currency: 'USD',
  symbol: 'R_50',
  amount: 100
});
```

## 🔄 Redux State Management

The application uses Redux Toolkit for state management with the following slices:

- `userSlice.js` - User state, token, accounts, balances
- `connectionSlice.js` - WebSocket connection state
- `symbolsSlice.js` - Active symbols, tick data, market history
- `balancesSlice.js` - Account balances
- `tradeTypeSlice.js` - Trade type selection

### Usage Example

```javascript
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser, updateBalance } from '@/store/slices/userSlice';

const dispatch = useAppDispatch();
const user = useAppSelector(state => state.user);
const isConnected = useAppSelector(state => state.connection.connected);

// Update user
dispatch(setUser({ loginid: 'VRTC14440048', balance: 9888.42 }));
```

## 🧪 Testing

The project uses Playwright for end-to-end testing with comprehensive test coverage.

### Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in UI mode (recommended for first time)
npm run test:ui

# Run tests with visible browser
npm run test:headed

# Run specific test file
npx playwright test tests/auth.test.js

# Run tests on specific browser
npx playwright test --project=chromium
```

### Test Suites

- **Authentication Tests** - Login and signup functionality
- **Navigation Tests** - Page loading and basic functionality
- **Trading Tests** - Trade panel and execution
- **Chart Tests** - Chart functionality and indicators
- **Mobile Tests** - Mobile responsiveness
- **Performance Tests** - Application performance

Test results and Excel reports are saved to `test-results/` directory.

## 🔍 Code Quality

### SonarQube Analysis

Run code quality analysis:

```bash
npm run sonar
```

For local SonarQube:

```bash
npm run sonar:local
```

### Linting

```bash
npm run lint
```

## 🛠️ Technologies Used

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Redux Toolkit** - State management
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Radix UI** - UI components
- **Playwright** - E2E testing
- **Chart.js / ApexCharts** - Data visualization
- **TensorFlow.js** - Machine learning predictions

## 📝 Environment Variables

Create a `.env` file for environment-specific configuration:

```env
VITE_API_URL=your_api_url
VITE_WS_URL=your_websocket_url
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Submit a pull request

## 📄 License

Private project - All rights reserved
