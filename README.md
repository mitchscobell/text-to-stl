# Text to STL

Convert text to 3D STL files for 3D printing. Uses Three.js for 3D rendering and OpenType.js for font parsing.

## Features

- Real-time 3D text preview
- Support for Google Fonts and custom font uploads
- Adjustable text size and extrusion depth
- Interactive 3D viewer with rotation and zoom
- Direct STL file download

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

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js 0.182.0** - 3D graphics
- **OpenType.js 1.3.4** - Font parsing
- **Webpack 5** - Module bundler
- **Google Fonts Complete** - Font library

## Project Structure

```
src/
  ├── index.tsx        - Main React component and UI
  ├── TextMaker.ts     - Core text-to-geometry conversion and STL export
  └── images/          - Favicon and assets
fonts/                 - Custom fonts (for future use)
dist/                  - Production build output
```

## Fonts

Custom fonts can be placed in the `fonts/` directory for future integration.

## Forked from

[mo22/textstl](https://github.com/mo22/textstl)
