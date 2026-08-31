import * as React from "react";
import ReactDOM from "react-dom";
import * as TextMaker from "./TextMaker";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as googleFonts from "google-fonts-complete";
import { fetch } from "cross-fetch";
import isValidFilename from "valid-filename";

/** Cache for loaded fonts to avoid redundant network requests */
const fontCache: { [name: string]: opentype.Font } = {};

/** Discovered local fonts */
let localFonts: Array<{ name: string; path: string }> = [];

/**
 * Discovers available local fonts by scanning the fonts directory.
 */
async function discoverLocalFonts(): Promise<void> {
  const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];

  try {
    const response = await fetch("/fonts/index.json").catch(() => null);
    if (response && response.ok) {
      const index = await response.json();
      localFonts = index.fonts || [];
      return;
    }
  } catch {
    // Continue to discovery
  }

  const possibleFonts: Array<{ name: string; path: string }> = [];
  const knownFontNames = [
    "Amity Jack",
    "Milwaukee-Packout-HelveticaFont",
    "RogueFitness-AeroExtended Regular",
    "Ryobi-Pulp Fiction Italic M54",
    "Ryobi-Pulp Fiction M54",
  ];

  for (const fontName of knownFontNames) {
    for (const ext of fontExtensions) {
      const path = `/fonts/${fontName}${ext}`;
      try {
        const response = await fetch(path, { method: "HEAD" });
        if (response.ok) {
          possibleFonts.push({ name: fontName, path: path });
          break;
        }
      } catch {
        // Font doesn't exist, continue
      }
    }
  }

  localFonts = possibleFonts;
  console.log(`✓ Discovered ${localFonts.length} local font(s)`);
}

async function getLocalFont(fontPath: string): Promise<opentype.Font> {
  if (!fontCache[fontPath]) {
    const res = await fetch(fontPath);
    if (!res.ok) {
      throw new Error(`Failed to load font: ${fontPath}`);
    }
    const fontData = await res.arrayBuffer();
    const font = TextMaker.loadFont(fontData);
    fontCache[fontPath] = font;
  }
  return fontCache[fontPath];
}

async function getGoogleFont(args: {
  fontName: string;
  fontVariant?: string;
  fontWeight?: string;
}): Promise<opentype.Font> {
  if (!(args.fontName in googleFonts)) {
    throw new Error("font not found");
  }
  const variants = googleFonts[args.fontName].variants;
  const variant =
    variants[args.fontVariant || "normal"] ||
    variants[Object.keys(variants)[0]];
  const face =
    variant[args.fontWeight || "400"] || variant[Object.keys(variant)[0]];
  const url = face.url.ttf!.replace("http:", "https:");
  if (!fontCache[url]) {
    const res = await fetch(url);
    const fontData = await res.arrayBuffer();
    const font = TextMaker.loadFont(fontData);
    fontCache[url] = font;
  }
  return fontCache[url];
}

async function getBinFont(buffer: ArrayBuffer): Promise<opentype.Font> {
  return TextMaker.loadFont(buffer);
}

async function generateGeometry(args: {
  text: string;
  fontSize?: number;
  width?: number;
  kerning?: number | number[];
  fontName?: string;
  fontPath?: string;
  fontVariant?: string;
  fontWeight?: string;
  fontBin?: ArrayBuffer;
}): Promise<THREE.BufferGeometry> {
  const fontSize = args.fontSize || 72;
  const width = args.width || 20;
  const text = args.text || "Hello";
  const kerning = args.kerning || 0;

  let font: opentype.Font;
  if (args.fontBin) {
    font = await getBinFont(args.fontBin);
  } else if (args.fontPath) {
    font = await getLocalFont(args.fontPath);
  } else {
    font = await getGoogleFont({
      fontName: args.fontName!,
      fontVariant: args.fontVariant,
      fontWeight: args.fontWeight,
    });
  }

  const geometry = TextMaker.stringToGeometry({
    font: font,
    text: text,
    size: fontSize,
    width: width,
    kerning: kerning,
  });
  return geometry;
}

// ── Styles ────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #0f0f0f;
    color: #e8e8e8;
    min-height: 100dvh;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: row;
    height: 100dvh;
    width: 100%;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────── */
  .sidebar {
    width: 340px;
    min-width: 340px;
    background: #1a1a1a;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-header {
    padding: 20px 20px 12px;
    border-bottom: 1px solid #333;
  }

  .sidebar-header h1 {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .sidebar-header h1 .icon { margin-right: 6px; }

  .sidebar-header p {
    color: #888;
    font-size: 0.8rem;
    margin-top: 4px;
  }

  .controls {
    padding: 16px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .field input[type="text"],
  .field input[type="number"],
  .field select {
    width: 100%;
    padding: 10px 12px;
    background: #252525;
    border: 1px solid #333;
    border-radius: 6px;
    color: #e8e8e8;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .field input:focus,
  .field select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .field select {
    cursor: pointer;
  }

  .field select option {
    background: #252525;
    color: #e8e8e8;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .file-upload {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #252525;
    border: 1px dashed #444;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    color: #888;
    transition: border-color 0.2s;
  }

  .file-upload:hover {
    border-color: #3b82f6;
  }

  .file-upload input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .file-upload .upload-icon { font-size: 1.1rem; }

  .download-btn {
    width: 100%;
    padding: 12px;
    background: #22c55e;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: auto;
  }

  .download-btn:hover { background: #16a34a; }

  .sidebar-footer {
    padding: 12px 20px 16px;
    border-top: 1px solid #333;
    font-size: 0.75rem;
    color: #666;
    font-variant-numeric: tabular-nums;
  }

  .sidebar-footer a {
    color: #888;
    text-decoration: none;
  }

  .sidebar-footer a:hover { color: #3b82f6; }

  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .color-row input[type="color"] {
    width: 44px;
    height: 36px;
    padding: 0;
    border: 1px solid #333;
    border-radius: 6px;
    background: #252525;
    cursor: pointer;
  }

  .color-row .hex {
    font-size: 0.8rem;
    color: #888;
    font-variant-numeric: tabular-nums;
  }

  .swatches {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 1px solid #444;
    cursor: pointer;
    padding: 0;
  }

  .swatch.selected {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  /* ── Preview ─────────────────────────────────────────────────────────── */
  .preview {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #111;
  }

  .preview canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .preview-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: #555;
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── Mobile toggle ───────────────────────────────────────────────────── */
  .mobile-toggle {
    display: none;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 100;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #3b82f6;
    color: #fff;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  /* ── Responsive ──────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .app {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      min-width: unset;
      max-height: 50dvh;
      border-right: none;
      border-bottom: 1px solid #333;
    }

    .sidebar.collapsed {
      max-height: 0;
      overflow: hidden;
      border-bottom: none;
    }

    .preview {
      min-height: 50dvh;
    }

    .mobile-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .field-row {
      grid-template-columns: 1fr;
    }
  }
`;

// ── ThreePreview Component ────────────────────────────────────────────────

interface ThreePreviewProps {
  geometry?: THREE.BufferGeometry;
  color: string;
}

class ThreePreview extends React.Component<ThreePreviewProps, {}> {
  private active = false;
  private frame: number;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private geometry?: THREE.BufferGeometry;
  private mesh?: THREE.Mesh;
  private container: HTMLDivElement | null;
  private controls: OrbitControls;

  public componentWillUnmount() {
    this.active = false;
  }

  public componentDidMount() {
    this.active = true;
    this.frame = 0;
    this.scene = new THREE.Scene();

    const lights = [];
    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[1] = new THREE.PointLight(0xffffff, 1, 0);
    lights[2] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(0, 200, 0);
    lights[1].position.set(100, 200, 100);
    lights[2].position.set(-100, -200, -100);
    this.scene.add(lights[0]);
    this.scene.add(lights[1]);
    this.scene.add(lights[2]);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000);
    this.camera.position.z = 200;
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x111111, 1);

    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
      const w = this.container.offsetWidth;
      const h = this.container.offsetHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxPolarAngle = Math.PI * 1;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 1000;

    if (this.props.geometry) {
      this.setGeometry(this.props.geometry);
    } else {
      this.setGeometry(new THREE.SphereGeometry(60, 8, 8));
    }

    this.renderFrame();
  }

  public componentDidUpdate(prevProps: ThreePreviewProps) {
    if (prevProps.geometry !== this.props.geometry) {
      this.setGeometry(this.props.geometry);
    } else if (prevProps.color !== this.props.color) {
      this.applyColor(this.props.color);
    }
  }

  private applyColor(hex: string) {
    if (!this.mesh) return;
    const mat = this.mesh.material as THREE.MeshPhongMaterial;
    mat.color.set(hex);
    mat.emissive.copy(new THREE.Color(hex).multiplyScalar(0.12));
  }

  public setGeometry(geometry: THREE.BufferGeometry | undefined) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = undefined;
    }
    this.geometry = geometry;
    if (this.geometry) {
      const color = new THREE.Color(this.props.color);
      this.mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshPhongMaterial({
          color,
          emissive: color.clone().multiplyScalar(0.12),
          side: THREE.DoubleSide,
        })
      );
      this.scene.add(this.mesh);
    }
  }

  private renderFrame() {
    if (!this.active) return;
    requestAnimationFrame(() => this.renderFrame());
    if (this.container) {
      const w = this.container.offsetWidth;
      const h = this.container.offsetHeight;
      if (
        this.renderer.domElement.width !== w * window.devicePixelRatio ||
        this.renderer.domElement.height !== h * window.devicePixelRatio
      ) {
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
    }
    this.frame++;
    this.camera.lookAt(this.scene.position);
    this.renderer.render(this.scene, this.camera);
  }

  private setContainer(container: HTMLDivElement | null) {
    this.container = container;
    if (this.container && this.renderer) {
      this.container.appendChild(this.renderer.domElement);
    }
  }

  public render() {
    return (
      <div className="preview" ref={(ref) => this.setContainer(ref)}>
        <div className="preview-hint">Click and drag to rotate · Scroll to zoom</div>
      </div>
    );
  }
}

// ── Main App Component ────────────────────────────────────────────────────

interface MainState {
  text: string;
  fontBin?: ArrayBuffer;
  fontPath?: string;
  fontName: string;
  fontSize: string;
  width: string;
  fontVariant: string;
  fontWeight: string;
  kerning: string;
  geometry: THREE.BufferGeometry | undefined;
  localFonts: Array<{ name: string; path: string }>;
  sidebarCollapsed: boolean;
  version: string;
  modelColor: string;
}

class Main extends React.Component<{}, MainState> {
  public state: MainState = {
    text: "Hello!",
    fontName: "Damion",
    fontSize: "72",
    width: "20",
    fontVariant: "normal",
    fontWeight: "400",
    kerning: "0",
    geometry: undefined,
    localFonts: [],
    sidebarCollapsed: false,
    version: "",
    modelColor: "#e8e8e8",
  };

  public async componentDidMount() {
    await discoverLocalFonts();
    this.setState({ localFonts: localFonts });
    this.updateGeometry();
    try {
      const res = await fetch("/version.json");
      if (res.ok) {
        const data = (await res.json()) as { version?: string };
        if (data.version) {
          this.setState({ version: data.version });
        }
      }
    } catch {
      // Footer stays hidden if version.json is unavailable.
    }
  }

  private geometry: THREE.BufferGeometry;

  private async updateGeometry() {
    const geometry = await generateGeometry({
      text: this.state.text,
      fontBin: this.state.fontBin,
      fontPath: this.state.fontPath,
      fontName: this.state.fontName,
      fontSize: parseFloat(this.state.fontSize),
      width: parseFloat(this.state.width),
      fontWeight: this.state.fontWeight,
      fontVariant: this.state.fontVariant,
      kerning:
        this.state.kerning.indexOf(",") >= 0
          ? this.state.kerning.split(",").map(parseFloat)
          : parseFloat(this.state.kerning),
    });
    this.geometry = geometry;
    geometry.computeBoundingBox();
    const boundingBoxMaxX = geometry.boundingBox ? -geometry.boundingBox.max.x : 0;
    const boundingBoxMaxY = geometry.boundingBox ? -geometry.boundingBox.max.y : 0;
    geometry.applyMatrix4(
      new THREE.Matrix4().makeTranslation(
        boundingBoxMaxX / 2,
        boundingBoxMaxY / 2,
        0
      )
    );
    this.setState({ geometry: geometry });
  }

  private download() {
    const stl = TextMaker.geometryToSTL(this.geometry);
    const blob = new Blob([stl], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.getFilename(this.state.text);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private getFilename(fileNameText: string): string {
    const defaultOutput = "STL Output.stl";
    let newFilename = fileNameText.replace(/(\W+)/gi, "-");
    newFilename = isValidFilename(newFilename)
      ? newFilename + ".stl"
      : defaultOutput;
    return newFilename;
  }

  public componentDidUpdate(_prevProps: {}, prevState: MainState) {
    if (
      prevState.text !== this.state.text ||
      prevState.fontBin !== this.state.fontBin ||
      prevState.fontName !== this.state.fontName ||
      prevState.fontSize !== this.state.fontSize ||
      prevState.fontVariant !== this.state.fontVariant ||
      prevState.fontWeight !== this.state.fontWeight ||
      prevState.kerning !== this.state.kerning ||
      prevState.width !== this.state.width
    ) {
      this.updateGeometry();
    }
  }

  public render() {
    const { fontName, localFonts: lf } = this.state;
    const gFont = googleFonts[fontName];
    const hasVariants = gFont && gFont.variants;
    const hasWeights = hasVariants && gFont.variants[this.state.fontVariant];

    return (
      <div className="app">
        <style>{CSS}</style>

        <div className={`sidebar ${this.state.sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-header">
            <h1><span className="icon">🔤</span> Text to STL</h1>
            <p>Turn text into 3D-printable STL files</p>
          </div>

          <div className="controls">
            {/* Text */}
            <div className="field">
              <label>Text</label>
              <input
                type="text"
                value={this.state.text}
                onChange={(e) => this.setState({ text: e.target.value })}
                placeholder="Enter text…"
              />
            </div>

            {/* Font */}
            <div className="field">
              <label>Font</label>
              <select
                value={fontName}
                onChange={(e) => {
                  const val = e.target.value;
                  const local = lf.find((f) => f.name === val);
                  if (local) {
                    this.setState({ fontName: val, fontPath: local.path, fontBin: undefined });
                  } else {
                    this.setState({ fontName: val, fontPath: undefined, fontBin: undefined });
                  }
                }}
              >
                {lf.length > 0 && (
                  <optgroup label="Local Fonts">
                    {lf.map((f) => (
                      <option key={f.path} value={f.name}>{f.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Google Fonts">
                  {Object.keys(googleFonts).map((a) =>
                    a === "default" ? null : (
                      <option key={a} value={a}>{a}</option>
                    )
                  )}
                </optgroup>
                {!!this.state.fontBin && (
                  <optgroup label="Uploaded">
                    <option value={fontName}>{fontName}</option>
                  </optgroup>
                )}
              </select>
            </div>

            {/* Upload font */}
            <div className="field">
              <label>Or upload a font</label>
              <div className="file-upload">
                <span className="upload-icon">📁</span>
                <span>Choose .ttf file…</span>
                <input
                  type="file"
                  accept=".ttf,.otf"
                  onChange={async (e) => {
                    const file = e.target.files![0];
                    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result as ArrayBuffer);
                      reader.onerror = (err) => reject(err);
                      reader.readAsArrayBuffer(file);
                    });
                    this.setState({ fontName: file.name, fontBin: buffer });
                  }}
                />
              </div>
            </div>

            {/* Variant + Weight */}
            {hasVariants && (
              <div className="field-row">
                <div className="field">
                  <label>Variant</label>
                  <select
                    value={this.state.fontVariant}
                    onChange={(e) => this.setState({ fontVariant: e.target.value })}
                  >
                    {Object.keys(gFont.variants).map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                {hasWeights && (
                  <div className="field">
                    <label>Weight</label>
                    <select
                      value={this.state.fontWeight}
                      onChange={(e) => this.setState({ fontWeight: e.target.value })}
                    >
                      {Object.keys(gFont.variants[this.state.fontVariant]).map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Size + Width */}
            <div className="field-row">
              <div className="field">
                <label>Font Size</label>
                <input
                  type="text"
                  value={this.state.fontSize}
                  onChange={(e) => this.setState({ fontSize: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Depth (Width)</label>
                <input
                  type="text"
                  value={this.state.width}
                  onChange={(e) => this.setState({ width: e.target.value })}
                />
              </div>
            </div>

            {/* Kerning */}
            <div className="field">
              <label>Kerning</label>
              <input
                type="text"
                value={this.state.kerning}
                onChange={(e) => this.setState({ kerning: e.target.value })}
              />
            </div>

            {/* Preview color */}
            <div className="field">
              <label>Preview color</label>
              <div className="color-row">
                <input
                  type="color"
                  value={this.state.modelColor}
                  onChange={(e) => this.setState({ modelColor: e.target.value })}
                  aria-label="Preview color"
                />
                <span className="hex">{this.state.modelColor}</span>
              </div>
              <div className="swatches">
                {["#e8e8e8", "#fbbf24", "#34d399", "#fb923c", "#f472b6"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${this.state.modelColor === c ? " selected" : ""}`}
                    style={{ background: c }}
                    aria-label={`Set preview color ${c}`}
                    onClick={() => this.setState({ modelColor: c })}
                  />
                ))}
              </div>
            </div>

            {/* Download */}
            <button className="download-btn" onClick={() => this.download()}>
              ⬇ Download .STL
            </button>
          </div>

          {this.state.version && (
            <footer className="sidebar-footer">
              <a href="/version" title="Version details">v{this.state.version}</a>
            </footer>
          )}
        </div>

        <ThreePreview geometry={this.state.geometry} color={this.state.modelColor} />

        {/* Mobile fab to toggle sidebar */}
        <button
          className="mobile-toggle"
          onClick={() => this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed })}
        >
          {this.state.sidebarCollapsed ? "⚙" : "✕"}
        </button>
      </div>
    );
  }
}

const element = document.createElement("div");
document.querySelector("body")!.appendChild(element);
ReactDOM.render(<Main />, element);
