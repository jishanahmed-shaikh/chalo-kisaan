# Chalo Kisaan Frontend

React PWA frontend for the Chalo Kisaan agritourism platform.

## Overview

A mobile-first Progressive Web App featuring:
- Voice-first onboarding with multi-language support
- Business plan visualization with cards and charts
- Dream visualization with Before/After slider
- Offline-first architecture with Service Worker
- Cross-device synchronization
- Professional PDF export

## Technology Stack

- **Framework**: React 18 with TypeScript
- **State Management**: Redux with Redux Toolkit
- **Build Tool**: Vite
- **Testing**: Vitest with fast-check for property-based tests
- **Local Storage**: Dexie (IndexedDB wrapper)
- **HTTP Client**: Axios
- **Styling**: CSS Modules / Tailwind CSS (to be added)

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with API endpoint

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── VoiceRecorder/
│   │   ├── BusinessPlanViewer/
│   │   ├── DreamVisualization/
│   │   ├── Dashboard/
│   │   └── ...
│   ├── pages/
│   │   ├── Onboarding.tsx
│   │   ├── PlanView.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── store/
│   │   ├── slices/
│   │   ├── hooks.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── storage.ts
│   │   └── sync.ts
│   ├── hooks/
│   │   ├── useVoiceRecording.ts
│   │   ├── useOfflineSync.ts
│   │   └── ...
│   ├── types/
│   │   ├── index.ts
│   │   └── api.ts
│   ├── utils/
│   │   ├── encryption.ts
│   │   ├── validation.ts
│   │   └── ...
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── manifest.json
│   ├── service-worker.ts
│   └── ...
├── tests/
│   ├── unit/
│   ├── integration/
│   └── property/
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run property-based tests
npm run test:pbt

# Lint code
npm run lint

# Type check
npm run type-check
```

### Code Style

- Use TypeScript for type safety
- Follow React hooks best practices
- Use functional components
- Add JSDoc comments for complex functions

## Testing

### Unit Tests
```bash
npm run test
```

### Property-Based Tests
```bash
npm run test:pbt
```

### Test Coverage
```bash
npm run test -- --coverage
```

## PWA Features

### Service Worker
- Offline support with cached assets
- Background sync for offline changes
- Push notifications (future)

### Web App Manifest
- Installable on mobile devices
- Custom app icon and splash screen
- Standalone mode

### Local Storage
- IndexedDB for large data (images, plans)
- Encrypted sensitive data
- Automatic sync when online

## Performance

### Optimization Strategies
- Code splitting with Vite
- Lazy loading of components
- Image compression and optimization
- Service Worker caching
- Minification and tree-shaking

### Performance Targets
- Initial load: < 3 seconds (4G)
- Time to interactive: < 5 seconds
- Lighthouse score: > 90

## Accessibility

- ARIA labels on interactive elements
- Semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility
- Large touch targets (48x48px minimum)

## Deployment

### Build
```bash
npm run build
```

### Deploy to AWS S3 + CloudFront
See [DEPLOYMENT.md](../docs/DEPLOYMENT.md) for detailed instructions.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - See [LICENSE](../LICENSE) for details.
