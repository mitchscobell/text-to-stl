import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Props for the ThreePreview component.
 * @property geometry - Optional BufferGeometry to display
 * @property style - Optional CSS styles to apply to the container
 */
interface ThreePreviewProps {
  geometry?: THREE.BufferGeometry;
  style?: React.CSSProperties;
}

/**
 * 3D preview component that displays a BufferGeometry in a Three.js scene.
 * Provides interactive controls with mouse/touch support for rotation and zoom.
 * 
 * Features:
 * - Automatic responsive sizing
 * - Orbit controls for interactive viewing
 * - Multiple light sources for proper shading
 * - Smooth animation loop
 * 
 * @example
 * <ThreePreview 
 *   geometry={myGeometry} 
 *   style={{ height: '600px' }} 
 * />
 */
export class ThreePreview extends React.Component<ThreePreviewProps, {}> {
  private active = false;
  private frame: number = 0;
  private scene: THREE.Scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
  private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
  private geometry?: THREE.BufferGeometry;
  private mesh?: THREE.Mesh;
  private surface: HTMLDivElement | null = null;
  private container: HTMLDivElement | null = null;
  private size?: { width: number; height: number };
  private controls: OrbitControls | null = null;

  /**
   * Cleanup when component is unmounted.
   */
  public componentWillUnmount() {
    this.active = false;
  }

  /**
   * Initialize Three.js scene, camera, renderer, and controls.
   * Sets up lighting and default geometry.
   */
  public componentDidMount() {
    this.active = true;
    this.frame = 0;
    this.scene = new THREE.Scene();

    // Create three point lights for proper shading
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

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(75, 1024 / 768, 0.1, 10000);
    this.camera.position.z = 200;
    this.scene.add(this.camera);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(1024, 768);
    this.renderer.setClearColor(0xffffff, 1);
    if (this.surface) {
      this.surface.appendChild(this.renderer.domElement);
    }

    // Setup orbit controls
    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    if (this.controls) {
      this.controls.maxPolarAngle = Math.PI * 1;
      this.controls.minDistance = 50;
      this.controls.maxDistance = 1000;
    }

    // Display initial geometry
    if (this.props.geometry) {
      this.setGeometry(this.props.geometry);
    } else {
      this.setGeometry(new THREE.SphereGeometry(60, 8, 8));
    }

    this.renderFrame();
  }

  /**
   * Update geometry when props change.
   */
  public componentDidUpdate(prevProps: ThreePreviewProps) {
    if (prevProps.geometry !== this.props.geometry) {
      this.setGeometry(this.props.geometry);
    }
  }

  /**
   * Updates the displayed geometry in the scene.
   * 
   * @param geometry - The new geometry to display, or undefined to clear
   */
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

  /**
   * Renders a frame and schedules the next frame.
   * Handles responsive sizing and updates projection matrix as needed.
   */
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
    this.camera.lookAt(this.scene.position);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Sets the surface element for the renderer.
   * 
   * @param surface - The DOM element to render into
   */
  private setSurface(surface: HTMLDivElement | null) {
    this.surface = surface;
    if (this.surface && this.renderer) {
      this.surface.appendChild(this.renderer.domElement);
    }
  }

  /**
   * Sets the container element for sizing calculations.
   * 
   * @param container - The DOM element that contains the renderer
   */
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
