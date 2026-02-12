# Chalo Kisaan - Project Structure

## Directory Organization

```
chalo-kisaan/
├── .kiro/                           # Kiro IDE configuration and specifications
│   └── specs/
│       └── chalo-kisaan/
│           ├── requirements.md      # Detailed requirements (10 categories, 100+ criteria)
│           ├── design.md            # Technical design (36 correctness properties)
│           └── tasks.md             # Implementation plan (100+ tasks, 8 phases)
│
├── frontend/                        # React PWA Application (To be created)
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── VoiceRecorder/      # Voice recording UI
│   │   │   ├── BusinessPlanViewer/ # Business plan display
│   │   │   ├── DreamVisualization/ # Before/After slider
│   │   │   ├── Dashboard/          # Project management
│   │   │   └── ...
│   │   ├── pages/                  # Page components
│   │   ├── store/                  # Redux store
│   │   ├── services/               # API and utility services
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── types/                  # TypeScript interfaces
│   │   ├── utils/                  # Utility functions
│   │   ├── App.tsx                 # Root component
│   │   └── main.tsx                # Entry point
│   ├── public/                     # Static assets
│   ├── tests/                      # Test files
│   ├── vite.config.ts              # Vite configuration
│   ├── tsconfig.json               # TypeScript configuration
│   ├── package.json                # NPM dependencies
│   └── README.md                   # Frontend-specific documentation
│
├── backend/                         # FastAPI Backend (To be created)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/             # API endpoints
│   │   │   │   ├── transcribe.py   # Voice transcription
│   │   │   │   ├── plans.py        # Business plan generation
│   │   │   │   ├── visualizations.py # Dream visualization
│   │   │   │   ├── projects.py     # Project management
│   │   │   │   ├── sync.py         # Cross-device sync
│   │   │   │   └── export.py       # PDF export
│   │   │   └── dependencies.py     # Dependency injection
│   │   ├── models/                 # Database models
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── farm_details.py
│   │   │   ├── business_plan.py
│   │   │   └── image.py
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── services/               # Business logic
│   │   │   ├── transcription.py
│   │   │   ├── plan_generation.py
│   │   │   ├── visualization.py
│   │   │   ├── sync.py
│   │   │   └── pdf_export.py
│   │   ├── utils/                  # Utility functions
│   │   │   ├── aws.py              # AWS service wrappers
│   │   │   ├── encryption.py       # Data encryption
│   │   │   ├── validation.py       # Input validation
│   │   │   └── errors.py           # Error handling
│   │   ├── middleware/             # FastAPI middleware
│   │   ├── config.py               # Configuration management
│   │   └── main.py                 # FastAPI app initialization
│   ├── migrations/                 # Alembic database migrations
│   ├── tests/                      # Test suite
│   │   ├── unit/                   # Unit tests
│   │   ├── integration/            # Integration tests
│   │   └── property/               # Property-based tests
│   ├── requirements.txt            # Python dependencies
│   ├── alembic.ini                 # Alembic configuration
│   ├── pytest.ini                  # Pytest configuration
│   └── README.md                   # Backend-specific documentation
│
├── media/                           # Project assets
│   ├── Logo-Primary.png            # Official branding
│   ├── ProcessFlow-UseCaseDiagram.png # User journey
│   └── Technical_Architecture.png  # System architecture
│
├── docs/                            # Additional documentation (To be created)
│   ├── API.md                      # API documentation
│   ├── DEPLOYMENT.md               # Deployment guide
│   ├── ARCHITECTURE.md             # Architecture deep-dive
│   └── TESTING.md                  # Testing guide
│
├── .github/                         # GitHub configuration (To be created)
│   ├── workflows/                  # CI/CD workflows
│   │   ├── test.yml                # Test automation
│   │   ├── build.yml               # Build automation
│   │   └── deploy.yml              # Deployment automation
│   └── ISSUE_TEMPLATE/             # Issue templates
│
├── .kiro/                           # Kiro IDE configuration
├── .gitignore                       # Git ignore rules
├── .env.example                     # Environment variables template
├── README.md                        # Project overview
├── CONTRIBUTING.md                 # Contribution guidelines
├── CHANGELOG.md                     # Version history
├── LICENSE                          # MIT License
├── PROJECT_STRUCTURE.md             # This file
└── package.json                     # Root package.json (optional)
```

## Key Directories

### .kiro/specs/chalo-kisaan/
Contains the complete specification for the project:
- **requirements.md**: 10 major requirement categories with 100+ acceptance criteria
- **design.md**: Technical architecture with 36 correctness properties
- **tasks.md**: Implementation plan with 100+ actionable tasks across 8 phases

### frontend/
React PWA application with:
- Voice recording interface
- Business plan visualization
- Dream visualization with Before/After slider
- Dashboard and project management
- Offline-first architecture with Service Worker
- Cross-device synchronization

### backend/
FastAPI backend with:
- AWS Transcribe integration for voice-to-text
- AWS Bedrock integration for business plan generation
- AWS SageMaker integration for image visualization
- PostgreSQL database for data persistence
- JWT authentication and authorization
- Comprehensive error handling and logging

### media/
Project branding and visual assets:
- Logo for README and documentation
- Process flow diagram showing user journey
- Technical architecture diagram

## File Naming Conventions

### Frontend (React/TypeScript)
- Components: `PascalCase.tsx` (e.g., `VoiceRecorder.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useVoiceRecording.ts`)
- Utils: `camelCase.ts` (e.g., `audioProcessor.ts`)
- Tests: `ComponentName.test.tsx` or `utils.test.ts`

### Backend (Python/FastAPI)
- Modules: `snake_case.py` (e.g., `transcription_service.py`)
- Classes: `PascalCase` (e.g., `TranscriptionService`)
- Functions: `snake_case` (e.g., `extract_farm_details()`)
- Tests: `test_module_name.py` (e.g., `test_transcription.py`)

## Development Workflow

1. **Specification Phase**: Review requirements, design, and tasks in `.kiro/specs/chalo-kisaan/`
2. **Implementation Phase**: Create features following the task breakdown
3. **Testing Phase**: Write unit tests and property-based tests
4. **Integration Phase**: Wire features together and test workflows
5. **Deployment Phase**: Build, test, and deploy to production

## Getting Started

1. Clone the repository
2. Review the specification documents in `.kiro/specs/chalo-kisaan/`
3. Set up frontend: `cd frontend && npm install`
4. Set up backend: `cd backend && pip install -r requirements.txt`
5. Configure environment variables: `cp .env.example .env`
6. Start development servers and begin implementation

## Documentation

- **README.md**: Project overview and getting started
- **CONTRIBUTING.md**: Contribution guidelines
- **CHANGELOG.md**: Version history and roadmap
- **PROJECT_STRUCTURE.md**: This file
- **.kiro/specs/chalo-kisaan/requirements.md**: Detailed requirements
- **.kiro/specs/chalo-kisaan/design.md**: Technical design
- **.kiro/specs/chalo-kisaan/tasks.md**: Implementation tasks

## Next Steps

1. Create frontend directory structure and initialize React project
2. Create backend directory structure and initialize FastAPI project
3. Set up database schema and migrations
4. Begin implementing tasks from Phase 1 (Project Setup and Core Infrastructure)
5. Follow the implementation plan in tasks.md for systematic development
