# Bedriftsgrafen Frontend

The React/TypeScript frontend for Bedriftsgrafen.no.

## 🛠️ Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: TanStack Router
- **State/Data**: TanStack Query (React Query) & Zustand
- **Visualization**: Recharts & Leaflet (Maps)

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Server will start at http://localhost:5173

### Build

```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

## 📁 Project Structure

- `src/components/`: React components
- `src/routes/`: TanStack Router definitions
- `src/store/`: Global state management
- `src/utils/`: Helper functions
- `src/lib/`: Library configurations (API client, etc.)

## 🧪 Testing & Quality

- **Linting**: `npm run lint` (ESLint)
- **Type Checking**: `npm run tc` (TypeScript)
- **Validation**: `npm run validate` (Runs both)
