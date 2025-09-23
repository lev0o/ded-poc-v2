# Fabric Nexus

AI-powered Microsoft Fabric data exploration and analysis platform.

## Overview

Fabric Nexus is a modern web application that provides intelligent data exploration capabilities for Microsoft Fabric environments. Built with Next.js and FastAPI, it offers a sleek, cyberpunk-inspired interface for querying and analyzing your Fabric data through natural language interactions.

## Features

- **AI-Powered Chat Interface**: Natural language queries with context-aware responses
- **Fabric Catalog Integration**: Browse and explore your Fabric workspaces, databases, and tables
- **Context Management**: Add specific data sources to your queries for precise results
- **Modern UI**: Dark/light theme support with smooth transitions
- **Real-time Data**: Live catalog refresh and dynamic query execution

## Architecture

### Frontend (`frontend-v2/`)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React Query for server state
- **Theme System**: CSS custom properties with smooth transitions
- **Components**: Modular, reusable React components

### Backend (`backend/`)
- **Framework**: FastAPI with Python
- **Database**: SQLite for catalog metadata
- **Authentication**: Microsoft Fabric integration
- **API**: RESTful endpoints for chat and catalog operations

## Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.9+
- Microsoft Fabric access

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend-v2
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
├── backend/                 # FastAPI backend
│   ├── auth/               # Authentication modules
│   ├── catalog/            # Catalog management
│   ├── clients/            # External service clients
│   ├── routers/            # API route handlers
│   └── sql/                # Database utilities
├── frontend-v2/            # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js app router
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities and types
│   │   └── styles/         # CSS and design tokens
│   └── public/             # Static assets
└── README.md               # This file
```

## Development

### Design System
The application uses a centralized design system with CSS custom properties:
- Consistent color palette across themes
- Smooth transitions between dark/light modes
- Responsive typography and spacing

### Component Architecture
- **Layout Components**: Header, ResizableLayout, Sidebar
- **Chat Components**: ChatPanel, MessageArea, ChatInput
- **Catalog Components**: FabricExplorer, CatalogTree
- **UI Components**: StatusIcon, BeamsBackground

### API Integration
- React Query for data fetching and caching
- Type-safe API client with proper error handling
- Real-time catalog refresh capabilities

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue in the repository.
