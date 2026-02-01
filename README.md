# Text to STL

Convert text to 3D STL files for 3D printing. Uses Three.js for 3D rendering and OpenType.js for font parsing.

## Features

- Real-time 3D text preview
- Support for Google Fonts, local custom fonts, and user uploads
- Local fonts automatically discovered and available in dropdown
- Adjustable text size and extrusion depth
- Interactive 3D viewer with rotation and zoom
- Direct STL file download

## Using Custom Fonts

Place TrueType or OpenType font files (`.ttf`, `.otf`, etc.) in the `fonts/` directory. They will be automatically discovered and available in the font dropdown on app startup.

**Included fonts:**
- Amity Jack
- Milwaukee-Packout-HelveticaFont
- RogueFitness-AeroExtended Regular
- Ryobi-Pulp Fiction Italic M54
- Ryobi-Pulp Fiction M54

To add more fonts, simply copy font files to `fonts/` and rebuild:

```bash
cp /path/to/myfont.ttf fonts/
npm run build
```

The new font will be available in the "Local Fonts" section of the dropdown immediately.

## Development

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

## Docker Deployment

### Build Docker Image

```bash
docker build -t text-to-stl:latest .
```

### Run with Docker Compose

```bash
docker-compose up
```

The app will be available at `http://localhost:3000`

### Run with Docker Directly

```bash
docker run -p 3000:3000 text-to-stl:latest
```

The Dockerfile uses a multi-stage build:
1. **Dependencies stage**: Installs npm packages
2. **Builder stage**: Builds the production bundle
3. **Runtime stage**: Serves static files with Nginx on port 3000

### Health Check

Docker automatically checks if the container is healthy by making HTTP requests to `http://localhost:3000/`

## Continuous Integration

GitHub Actions automatically:
- Runs on every push to `master` branch
- Installs dependencies
- Runs linter (`npm run lint`)
- Builds the project (`npm run build`)
- Increments the patch version in `package.json`
- Commits version change back to repository

View workflow: `.github/workflows/build.yml`

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js 0.182.0** - 3D graphics
- **OpenType.js 1.3.4** - Font parsing
- **Webpack 5** - Module bundler with copy-webpack-plugin for font assets
- **Google Fonts Complete** - Font library

## Project Structure

```
src/
  ├── index.tsx        - Main React component and UI
  ├── TextMaker.ts     - Core text-to-geometry conversion and STL export
  └── images/          - Favicon and assets
fonts/                 - Custom TrueType/OpenType fonts (auto-discovered at runtime)
dist/                  - Production build output
public/                - Static assets (favicon, fonts)
```

## How It Works

1. **Font Discovery**: On app startup, the app automatically scans for available fonts by attempting to fetch font files
2. **Font Dropdown Groups**: Fonts are organized into three categories:
   - **Local Fonts**: Custom fonts from the `fonts/` directory
   - **Google Fonts**: Complete Google Fonts library
   - **Uploaded**: Any font uploaded via the file picker
3. **Geometry Generation**: Selected font is used to render text as 3D geometry
4. **STL Export**: 3D geometry is exported as binary STL format for 3D printing

## Forked from

[mo22/textstl](https://github.com/mo22/textstl)
