# I-Powered Document Processing System
A powerful, scalable system for intelligent document processing and semantic search

## ✨ Features
- 📄 PDF Processing - Upload and process PDF documents with ease
- 🔍 Semantic Search - Find information using natural language queries
- 🤖 AI-Powered Responses - Get comprehensive answers from your documents
- 🔄 Asynchronous Processing - Handle large documents efficiently
- 📊 Vector Embeddings - Store and search document content semantically
- 🔌 Microservices Architecture - Scalable and maintainable design
## 🏗️ System Architecture
```mermaid
graph TD
    A[Frontend Angular App] --> B[Backend API]
    B --> C[Redis Queue]
    C --> D[Worker Service]
    D --> E[Text Extractor Service]
    D --> F[Qdrant Vector DB]
    B --> F
    G[Google Generative AI] <--> B
 ```

## 🛠️ Tech Stack
- Frontend : Angular, Next.js
- Backend : Bun.js, TypeScript
- Database : Qdrant Vector Database
- Queue : Redis
- AI : Google Generative AI
- Containerization : Docker, Docker Compose
- Build System : Turborepo
## 🚀 Getting Started
### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Google AI API Key
### Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-practice.git
cd ai-practice
 ```
```

2. Install dependencies:
```bash
pnpm install
 ```

3. Set up environment variables:
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env file with your API keys
 ```

4. Start the development environment:
```bash
pnpm dev
 ```

### Using Docker
Start all services with Docker Compose:

```bash
cd apps/backend
docker-compose up
 ```

## 📋 Project Structure
```plaintext
AI_practice/
├── apps/
│   ├── backend/           # Bun.js API and worker services
│   ├── frontend/          # Angular frontend application
│   ├── text_extractor/    # Python service for text extraction
│   └── web/               # Next.js web application
├── packages/
│   ├── ui/                # Shared UI components
│   ├── eslint-config/     # ESLint configurations
│   └── typescript-config/ # TypeScript configurations
└── turbo.json             # Turborepo configuration
 ```
```

## 🔄 Data Flow
1. Upload : User uploads PDF document through the frontend
2. Queue : API service queues processing job in Redis
3. Process : Worker extracts text, chunks content, and generates embeddings
4. Store : Vector embeddings are stored in Qdrant
5. Query : User searches using natural language
6. Retrieve : System finds relevant document chunks
7. Generate : AI creates comprehensive responses based on context
## 🧪 Development
To develop all apps and packages:

```bash
pnpm dev
 ```

To build all apps and packages:

```bash
pnpm build
 ```

## 🔒 Environment Variables
The following environment variables are required:

- GOOGLE_API_KEY : Google AI API key
- REDIS_HOST : Redis host (default: localhost)
- REDIS_PORT : Redis port (default: 6379)
- QDRANT_URL : Qdrant URL (default: http://localhost:6333 )
## 🌐 Deployment
The system can be deployed using Docker Compose or to cloud services:

- Docker Compose : For local or self-hosted deployment
- AWS ECS/ECR : For cloud deployment with container orchestration
- Vercel : For frontend applications
## 📚 Learn More
- Turborepo Documentation
- Next.js Documentation
- Angular Documentation
- Qdrant Vector Database
- Google Generative AI
## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch ( git checkout -b feature/amazing-feature )
3. Commit your changes ( git commit -m 'Add some amazing feature' )
4. Push to the branch ( git push origin feature/amazing-feature )
5. Open a Pull Request
## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

Made with ❤️ using Turborepo