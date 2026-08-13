# CircleFi App

React-based web application for CircleFi rotating savings circles on Stellar testnet.

## Features

- **Circle Creation**: Create new savings groups with customizable parameters
- **Member Management**: Invite members by wallet address or contact
- **Contribution Tracking**: Monitor contributions and payment history
- **Payout Calendar**: View upcoming payouts and rotation schedule
- **Trust Score Display**: See member trust scores based on payment history
- **Bid Management**: Place bids for payout priority (bid-based circles)
- **Responsive Design**: Works on desktop and mobile devices

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

The app runs on `http://localhost:3000`.

## Building

```bash
npm build
```

## Configuration

Create a `.env` file in the root directory:

```
REACT_APP_STELLAR_NETWORK=testnet
REACT_APP_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
REACT_APP_CONTRACT_ID=<your-contract-id>
```

## Architecture

- **Context API** for state management
- **CircleContext** handles all circle-related operations
- **Components** are modular and reusable
- **Responsive CSS** for mobile-first design

## License

MIT
