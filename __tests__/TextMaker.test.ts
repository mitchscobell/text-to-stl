import * as THREE from "three";
import * as TextMaker from "../src/TextMaker";

// ── glyphToShapes ─────────────────────────────────────────────────────────

describe("glyphToShapes", () => {
  /**
   * Builds a minimal mock glyph with explicit contours.
   * A contour is an array of { x, y, onCurve } points.
   */
  function mockGlyph(contours: TextMaker.Contour[]) {
    return {
      getMetrics: jest.fn(),
      getContours: () => contours,
    } as unknown as opentype.Glyph;
  }

  it("returns a Shape for an outer contour (negative signed area)", () => {
    // The winding number algorithm in glyphToShapes uses:
    //   sum += (lastPoint.x - point.x) * (point.y + lastPoint.y)
    // sum > 0 → hole, sum <= 0 → outer shape
    // This CCW square produces a negative sum → outer shape
    const square: TextMaker.Contour = [
      { x: 0, y: 0, onCurve: true },
      { x: 0, y: 100, onCurve: true },
      { x: 100, y: 100, onCurve: true },
      { x: 100, y: 0, onCurve: true },
    ];
    const glyph = mockGlyph([square]);
    const shapes = TextMaker.glyphToShapes(glyph);

    expect(shapes.length).toBe(1);
    expect(shapes[0]).toBeInstanceOf(THREE.Shape);
  });

  it("separates holes from outer contours", () => {
    // Outer — negative signed area (CCW in this coordinate system)
    const outer: TextMaker.Contour = [
      { x: 0, y: 0, onCurve: true },
      { x: 0, y: 200, onCurve: true },
      { x: 200, y: 200, onCurve: true },
      { x: 200, y: 0, onCurve: true },
    ];
    // Hole — positive signed area (CW in this coordinate system)
    const hole: TextMaker.Contour = [
      { x: 50, y: 50, onCurve: true },
      { x: 150, y: 50, onCurve: true },
      { x: 150, y: 150, onCurve: true },
      { x: 50, y: 150, onCurve: true },
    ];
    const glyph = mockGlyph([outer, hole]);
    const shapes = TextMaker.glyphToShapes(glyph);

    expect(shapes.length).toBe(1);
    expect(shapes[0].holes.length).toBe(1);
  });

  it("returns empty array for a glyph with no contours (e.g. space)", () => {
    const glyph = mockGlyph([]);
    const shapes = TextMaker.glyphToShapes(glyph);
    expect(shapes.length).toBe(0);
  });

  it("handles off-curve (quadratic) control points without crashing", () => {
    const contour: TextMaker.Contour = [
      { x: 0, y: 0, onCurve: true },
      { x: 50, y: 100, onCurve: false },
      { x: 100, y: 0, onCurve: true },
    ];
    const glyph = mockGlyph([contour]);
    expect(() => TextMaker.glyphToShapes(glyph)).not.toThrow();
  });
});

// ── geometryToSTL ─────────────────────────────────────────────────────────

describe("geometryToSTL", () => {
  it("produces a valid binary STL from a simple triangle", () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    const stl = TextMaker.geometryToSTL(geometry);

    expect(stl).toBeInstanceOf(ArrayBuffer);
    // Binary STL: 80 byte header + 4 byte count + 50 bytes per triangle
    // 1 triangle → 80 + 4 + 50 = 134 bytes
    expect(stl.byteLength).toBe(134);

    const view = new DataView(stl);
    const triangleCount = view.getUint32(80, true);
    expect(triangleCount).toBe(1);
  });

  it("handles indexed geometry correctly", () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,   // 0
      1, 0, 0,   // 1
      1, 1, 0,   // 2
      0, 1, 0,   // 3
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]); // 2 triangles
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const stl = TextMaker.geometryToSTL(geometry);
    const view = new DataView(stl);
    const triangleCount = view.getUint32(80, true);
    expect(triangleCount).toBe(2);
    // 80 + 4 + 2*50 = 184 bytes
    expect(stl.byteLength).toBe(184);
  });

  it("writes correct header string", () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    const stl = TextMaker.geometryToSTL(geometry);
    const header = new Uint8Array(stl, 0, 21);
    const headerStr = String.fromCharCode(...header);
    expect(headerStr).toBe("Three.js STL Exporter");
  });

  it("computes a non-zero normal for a non-degenerate triangle", () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    const stl = TextMaker.geometryToSTL(geometry);
    const view = new DataView(stl);
    // Normal starts at offset 84
    const nx = view.getFloat32(84, true);
    const ny = view.getFloat32(88, true);
    const nz = view.getFloat32(92, true);
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    expect(length).toBeCloseTo(1.0, 3);
  });
});

// ── loadFont ──────────────────────────────────────────────────────────────

describe("loadFont", () => {
  it("throws on invalid/empty buffer", () => {
    expect(() => TextMaker.loadFont(new ArrayBuffer(0))).toThrow();
  });

  it("throws on garbage data", () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer;
    expect(() => TextMaker.loadFont(garbage)).toThrow();
  });
});

// ── stringToGeometry ──────────────────────────────────────────────────────

describe("stringToGeometry", () => {
  // We can't easily load a real font in tests without fetch, but we can
  // test that the function throws sensibly on edge cases.

  it("throws when given empty text (no geometries generated)", () => {
    // Create a minimal mock font that produces no glyphs for empty text
    const mockFont = {
      unitsPerEm: 1000,
      forEachGlyph: jest.fn(), // never calls callback → no geometries
    } as unknown as opentype.Font;

    expect(() =>
      TextMaker.stringToGeometry({
        font: mockFont,
        text: "",
        size: 72,
        width: 20,
      })
    ).toThrow("No geometries generated");
  });
});
