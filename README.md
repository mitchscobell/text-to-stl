# Text to STL

[![CI](https://github.com/mitchscobell/text-to-stl/actions/workflows/build.yml/badge.svg)](https://github.com/mitchscobell/text-to-stl/actions/workflows/build.yml)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.182.0-black?logo=threedotjs)](https://threejs.org/)
[![Webpack](https://img.shields.io/badge/Webpack-5.104.1-8dd6f9?logo=webpack)](https://webpack.js.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Convert text to 3D STL files for 3D printing. Uses Three.js for 3D rendering and OpenType.js for font parsing.

## 🚀 Quick Start with Docker

### Prerequisites
- [Docker](https://www.docker.com/get-started) & Docker Compose
- OR [Node.js 20+](https://nodejs.org/) (for local development without Docker)

### Run with Docker (Recommended)

```bash
git clone https://github.com/mitchscobell/text-to-stl.git
cd text-to-stl
docker-compose up
```

The app will be available at `http://localhost:3000`

### Stop the application
```bash
docker-compose down
```

## 🎯 Features

- ✅ **Real-time 3D Preview** - Interactive WebGL rendering with Three.js
- ✅ **Multiple Font Sources** - Google Fonts, local custom fonts, and file uploads
- ✅ **Auto Font Discovery** - Local fonts in `fonts/` directory automatically discovered at runtime
- ✅ **3D Controls** - Rotate, zoom, and pan with OrbitControls
- ✅ **STL Export** - Direct download as binary STL for 3D printing
- ✅ **Zero Dependencies** - No backend required, runs entirely in the browser
- ✅ **Docker Ready** - Production-optimized multi-stage build
- ✅ **ESLint** - Code quality with TypeScript linting

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build -t text-to-stl:latest .
```

### Run with Docker Directly

```bash
docker run -p 3000:3000 text-to-stl:latest
```

The Dockerfile uses a multi-stage build:
1. **Dependencies stage**: Installs npm packages
2. **Builder stage**: Builds the production bundle with Webpack
3. **Runtime stage**: Serves static files with Nginx on port 3000

### Health Check

Docker automatically checks container health via HTTP requests to `http://localhost:3000/`

Health check configuration:
- Interval: 30s
- Timeout: 10s
- Start period: 5s
- Retries: 3

## 🏥 Version & Health Check Endpoints

### Version HTML Page
```
GET http://localhost:3000/version
```
Returns an HTML page with version information, build date, and environment details. Useful for quick verification and monitoring dashboards.

### Version JSON API
```
GET http://localhost:3000/version.json
```
Returns version information in JSON format:
```json
{
  "version": "2.0.1",
  "buildDate": "2026-02-01T04:53:07.774Z",
  "environment": "production",
  "name": "text-to-stl",
  "description": "create .stl files from font"
}
```

**Use cases:**
- Docker healthchecks
- Monitoring and alerting
- Deployment verification
- Version tracking across environments

## 🔄 Continuous Integration

GitHub Actions automatically on every push to `master`:

1. **Lint** - Runs ESLint (`npm run lint`)
2. **Build** - Creates production bundle (`npm run build`)
3. **Version Bump** - Increments patch version in `package.json`
4. **Auto-commit** - Commits version change back to repository

View workflow: [.github/workflows/build.yml](.github/workflows/build.yml)

## 📚 Using Custom Fonts

Place TrueType or OpenType font files (`.ttf`, `.otf`, etc.) in the `fonts/` directory. They will be automatically discovered and available in the font dropdown.

**Included fonts:**
- Amity Jack
- Milwaukee-Packout-HelveticaFont
- RogueFitness-AeroExtended Regular
- Ryobi-Pulp Fiction Italic M54
- Ryobi-Pulp Fiction M54

To add more fonts:

```bash
cp /path/to/myfont.ttf fonts/
npm run build
```

The new font will be available in the "Local Fonts" section immediately.

### Font Discovery System

The app automatically discovers fonts via:
1. **Runtime HEAD requests** - Tests if font files exist at `/fonts/[fontname].[extension]`
2. **Automatic caching** - Fonts are cached in memory to avoid redundant requests
3. **Three categories** - Organized as Local Fonts, Google Fonts, and Uploaded fonts

## 🔄 How It Works

### Conversion Process

1. **Font Loading** - Selected font is loaded via OpenType.js parser
2. **Glyph Processing** - Each character is converted to Three.js shapes with hole detection
3. **Geometry Generation** - Shapes are extruded into 3D BufferGeometry
4. **STL Export** - 3D geometry is binary-encoded in STL format for 3D printing

### 3D Viewer

- **Rotation** - Left mouse drag to rotate
- **Zoom** - Mouse wheel to zoom in/out  
- **Pan** - Right mouse drag to pan (optional)
- **Real-time updates** - Changes apply immediately

## 📊 Tech Stack

- **Framework:** React 18.2.0
- **Language:** TypeScript 5.1.6
- **3D Graphics:** Three.js 0.182.0
- **Font Parsing:** OpenType.js 1.3.4
- **Bundler:** Webpack 5.104.1
- **Build:** copy-webpack-plugin (auto-copies fonts to dist/)
- **Font Library:** Google Fonts Complete
- **3D Controls:** Three.js OrbitControls
- **Linting:** ESLint 9 with TypeScript support

## 🐛 NPM Scripts

```bash
npm run dev          # Start dev server at http://localhost:8081
npm run build        # Build production bundle
npm run lint         # Check code quality
npm run lint:fix     # Auto-fix linting issues
```

## 🔧 Development

### Prerequisites
- Node.js 20+ (for local development)
- npm 10+

### Installation

```bash
npm install
```

### Development Server

Start the development server with hot module reloading:

```bash
npm run dev
```

The app will be available at `http://localhost:8081/`

### Production Build

Build the production bundle:

```bash
npm run build
```

Output will be in the `dist/` directory. Deploy the `dist/` folder to your web server.

### Linting

Check code style:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint:fix
```

### Project Structure

```
text-to-stl/
├── src/
│   ├── index.tsx                # Main React component and UI
│   ├── TextMaker.ts             # Core text-to-3D geometry and STL export
│   └── images/                  # Favicon and assets
├── fonts/                       # Custom TrueType/OpenType fonts (auto-discovered)
├── public/                      # Static assets
├── dist/                        # Production build output
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Docker Compose configuration
├── nginx.conf                   # Nginx configuration for static serving
├── webpack.config.js            # Webpack bundler configuration
├── tsconfig.json                # TypeScript configuration
├── eslint.config.js             # ESLint configuration
└── .github/workflows/
    └── build.yml                # GitHub Actions CI pipeline
```

## 📖 Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [OpenType.js](https://opentype.js.org/)
- [Google Fonts API](https://fonts.google.com/)
- [STL Format](https://en.wikipedia.org/wiki/STL_(file_format))
- [3D Printing Preparation](https://www.prusaprinters.org/3d-printing/3d-models/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Credits

- Forked from [mo22/textstl](https://github.com/mo22/textstl)
- Built with [Three.js](https://threejs.org/)
- Font parsing with [OpenType.js](https://opentype.js.org/)

## 📧 Support

For issues, questions, or suggestions, please open an [issue on GitHub](https://github.com/mitchscobell/text-to-stl/issues).

---

**Made with ❤️ by [Mitch Scobell](https://github.com/mitchscobell)**
