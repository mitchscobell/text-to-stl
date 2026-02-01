import * as React from "react";
import ReactDOM from "react-dom";
import * as TextMaker from "./TextMaker";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as googleFonts from "google-fonts-complete";
import { fetch } from "cross-fetch";
import isValidFilename from "valid-filename";

/** Cache for loaded Google Fonts to avoid redundant network requests */
const fontCache: { [name: string]: opentype.Font } = {};

/** Width of form input controls in pixels */
const controlWidth: number = 250;

/**
 * Fetches and caches a Google Font by name.
 * 
 * @param args - Font request configuration
 * @param args.fontName - Name of the Google Font (e.g., "Roboto", "Damion")
 * @param args.fontVariant - Font variant like "normal" or "italic", defaults to "normal"
 * @param args.fontWeight - Font weight like "400", "700", defaults to "400"
 * @returns The loaded opentype.Font object
 * @throws If the font is not found in Google Fonts Complete
 * 
 * @example
 * const font = await getGoogleFont({
 *   fontName: "Roboto",
 *   fontVariant: "normal",
 *   fontWeight: "700"
 * });
 */
async function getGoogleFont(args: {
  fontName: string;
  fontVariant?: string;
  fontWeight?: string;
}): Promise<opentype.Font> {
  if (!(args.fontName in googleFonts)) {
    console.error(Object.keys(googleFonts));
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
  const font = fontCache[url];
  return font;
}

/**
 * Loads a font from user-uploaded binary file (TTF/OTF).
 * 
 * @param buffer - The font file as an ArrayBuffer
 * @returns The loaded opentype.Font object
 * 
 * @example
 * const font = await getBinFont(fontArrayBuffer);
 */
async function getBinFont(buffer: ArrayBuffer): Promise<opentype.Font> {
  return TextMaker.loadFont(buffer);
}

/**
 * Generates 3D BufferGeometry from text using the specified font and parameters.
 * Handles both Google Fonts and custom uploaded fonts.
 * 
 * @param args - Geometry generation options
 * @param args.text - The text to render
 * @param args.fontSize - Font size in pixels, defaults to 72
 * @param args.width - Extrusion depth (Z-axis), defaults to 20
 * @param args.kerning - Kerning adjustment, defaults to 0
 * @param args.fontName - Name of Google Font to use
 * @param args.fontVariant - Font variant (normal/italic)
 * @param args.fontWeight - Font weight (400, 700, etc.)
 * @param args.fontBin - ArrayBuffer of custom font file (takes precedence over fontName)
 * @returns A BufferGeometry ready for 3D rendering
 * @throws If font loading or geometry generation fails
 * 
 * @example
 * const geometry = await generateGeometry({
 *   text: "Hello",
 *   fontSize: 72,
 *   width: 20,
 *   fontName: "Damion"
 * });
 */
async function generateGeometry(args: {
  text: string;
  fontSize?: number;
  width?: number;
  kerning?: number | number[];
  fontName?: string;
  fontVariant?: string;
  fontWeight?: string;
  fontBin?: ArrayBuffer;
}): Promise<THREE.BufferGeometry> {
  const fontSize = args.fontSize || 72;
  const width = args.width || 20;
  const text = args.text || "Hello";
  const kerning = args.kerning || 0;
  const font = args.fontBin
    ? await getBinFont(args.fontBin)
    : await getGoogleFont({
        fontName: args.fontName!,
        fontVariant: args.fontVariant,
        fontWeight: args.fontWeight,
      });
  const geometry = TextMaker.stringToGeometry({
    font: font,
    text: text,
    size: fontSize,
    width: width,
    kerning: kerning,
  });
  return geometry;
}

interface ThreePreviewProps {
  geometry?: THREE.BufferGeometry;
  style?: any;
}

class ThreePreview extends React.Component<ThreePreviewProps, {}> {
  private active = false;
  private frame: number;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private geometry?: THREE.BufferGeometry;
  private mesh?: THREE.Mesh;
  private surface: HTMLDivElement | null;
  private container: HTMLDivElement | null;
  private size?: { width: number; height: number };
  private controls: any;

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

    this.camera = new THREE.PerspectiveCamera(75, 1024 / 768, 0.1, 10000);
    this.camera.position.z = 200;
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(1024, 768); // @TODO
    this.renderer.setClearColor(0xffffff, 1);
    if (this.surface) {
      this.surface.appendChild(this.renderer.domElement);
    }

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
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
    }
  }

  public setGeometry(geometry: THREE.BufferGeometry | undefined) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = undefined;
    }
    this.geometry = geometry;
    if (this.geometry) {
      this.mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshPhongMaterial({
          color: 0x156289,
          emissive: 0x072534,
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
      if (
        this.size === undefined ||
        this.size.width !== this.container.offsetWidth ||
        this.size.height !== this.container.offsetHeight
      ) {
        this.size = {
          width: this.container.offsetWidth,
          height: this.container.offsetHeight,
        };
        this.renderer.setSize(this.size.width, this.size.height);
        this.camera.aspect = this.size.width / this.size.height;
        this.camera.updateProjectionMatrix();
      }
    }
    this.frame++;
    if (this.mesh && 0) {
      this.mesh.rotation.x = 0.005 * this.frame;
    }
    // this.mesh.rotation.y = 0.002 * this.frame;
    this.camera.lookAt(this.scene.position);
    this.renderer.render(this.scene, this.camera);
  }

  private setSurface(surface: HTMLDivElement | null) {
    this.surface = surface;
    if (this.surface && this.renderer) {
      this.surface.appendChild(this.renderer.domElement);
    }
  }

  private setContainer(container: HTMLDivElement | null) {
    this.container = container;
  }

  public render() {
    return (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          ...this.props.style,
        }}
        ref={(ref) => this.setContainer(ref)}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            margin: 0,
            padding: 0,
          }}
          ref={(ref) => this.setSurface(ref)}
        />
      </div>
    );
  }
}

interface MainProps {}
interface MainState {
  text: string;
  fontBin?: ArrayBuffer;
  fontName: string;
  fontSize: string;
  width: string;
  fontVariant: string;
  fontWeight: string;
  kerning: string;
  geometry: THREE.BufferGeometry | undefined;
}
class Main extends React.Component<MainProps, MainState> {
  public state: MainState = {
    text: "Hello!",
    fontName: "Damion",
    fontSize: "72",
    width: "20",
    fontVariant: "normal",
    fontWeight: "400",
    kerning: "0",
    geometry: undefined,
  };

  private geometry: THREE.BufferGeometry;

  private async updateGeometry() {
    const geometry = await generateGeometry({
      text: this.state.text,
      fontBin: this.state.fontBin,
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
    let stl = TextMaker.geometryToSTL(this.geometry);
    let blob = new Blob([stl], { type: "application/octet-stream" });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement("a");
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

  public componentDidUpdate(_prevProps: MainProps, prevState: MainState) {
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

  public componentDidMount() {
    this.updateGeometry();
  }

  private renderSettings() {
    return (
      <div>
        <div>
          <label style={{ display: "inline-block", width: 80, margin: 10 }}>
            Text
          </label>
          <input
            style={{ width: controlWidth, margin: 10 }}
            type="text"
            value={this.state.text}
            onChange={(event) => this.setState({ text: event.target.value })}
          />
        </div>

        <div>
          <label style={{ display: "inline-block", width: 80, margin: 10 }}>
            Font
          </label>
          <select
            style={{ width: controlWidth, margin: 10 }}
            value={this.state.fontName}
            onChange={(event) =>
              this.setState({
                fontName: event.target.value,
                fontBin: undefined,
              })
            }
          >
            {Object.keys(googleFonts).map((a) =>
              a === "default" ? null : (
                <option key={a} value={a}>
                  {a}
                </option>
              )
            )}
            {!!this.state.fontBin && (
              <option value={this.state.fontName}>
                custom: {this.state.fontName}
              </option>
            )}
          </select>
        </div>

        <div>
          <label
            style={{ display: "inline-block", width: 80, margin: 10 }}
          ></label>
          <input
            style={{ width: controlWidth, margin: 10 }}
            type="file"
            accept=".ttf"
            onChange={async (e) => {
              const file = e.target.files![0];
              const buffer = await new Promise<ArrayBuffer>(
                (resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    resolve(reader.result as ArrayBuffer);
                  };
                  reader.onerror = (e) => {
                    reject(e);
                  };
                  reader.readAsArrayBuffer(file);
                }
              );
              this.setState({ fontName: file.name, fontBin: buffer });
            }}
          />
        </div>

        {googleFonts[this.state.fontName] && (
          <div>
            <label style={{ display: "inline-block", width: 80, margin: 10 }}>
              Variant
            </label>
            <select
              style={{ width: controlWidth, margin: 10 }}
              value={this.state.fontVariant}
              onChange={(event) =>
                this.setState({ fontVariant: event.target.value })
              }
            >
              {Object.keys(googleFonts[this.state.fontName].variants).map(
                (i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                )
              )}
            </select>
          </div>
        )}
        {googleFonts[this.state.fontName] &&
          googleFonts[this.state.fontName].variants[this.state.fontVariant] && (
            <div>
              <label style={{ display: "inline-block", width: 80, margin: 10 }}>
                Weight
              </label>
              <select
                style={{ width: controlWidth, margin: 10 }}
                value={this.state.fontWeight}
                onChange={(event) =>
                  this.setState({ fontWeight: event.target.value })
                }
              >
                {Object.keys(
                  googleFonts[this.state.fontName].variants[
                    this.state.fontVariant
                  ]
                ).map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          )}

        <div>
          <label style={{ display: "inline-block", width: 80, margin: 10 }}>
            Size
          </label>
          <input
            style={{ width: controlWidth, margin: 10 }}
            type="text"
            value={this.state.fontSize}
            onChange={(event) =>
              this.setState({ fontSize: event.target.value })
            }
          />
        </div>

        <div>
          <label style={{ display: "inline-block", width: 80, margin: 10 }}>
            Kerning
          </label>
          <input
            style={{ width: controlWidth, margin: 10 }}
            type="text"
            value={this.state.kerning}
            onChange={(event) => this.setState({ kerning: event.target.value })}
          />
        </div>

        <div>
          <label style={{ display: "inline-block", width: 80, margin: 10 }}>
            Width
          </label>
          <input
            style={{ width: controlWidth, margin: 10 }}
            type="text"
            value={this.state.width}
            onChange={(event) => this.setState({ width: event.target.value })}
          />
        </div>

        <div>
          <button
            style={{ alignSelf: "center", margin: 10 }}
            onClick={() => this.download()}
          >
            Download .STL
          </button>
        </div>
      </div>
    );
  }

  public render() {
    return (
      <div style={{ display: "flex", flex: 1, flexDirection: "row" }}>
        <div
          style={{ display: "flex", width: 400, backgroundColor: "powderblue" }}
        >
          {this.renderSettings()}
        </div>
        <ThreePreview
          geometry={this.state.geometry}
          style={{ display: "flex", flex: 1 }}
        />
      </div>
    );
  }
}

const element = document.createElement("div");
document.querySelector("body")!.appendChild(element);
ReactDOM.render(<Main />, element);
