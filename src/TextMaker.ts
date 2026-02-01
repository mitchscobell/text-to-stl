import * as opentype from "opentype.js";
import * as THREE from "three";

/**
 * Represents a single point on a font glyph contour.
 * @property x - X coordinate of the point
 * @property y - Y coordinate of the point
 * @property onCurve - Whether this point lies on the curve (true) or is an off-curve control point (false)
 */
export interface ContourPoint {
  x: number;
  y: number;
  onCurve: boolean;
}

/** An array of ContourPoints representing a closed contour path in a glyph */
export type Contour = ContourPoint[];

/**
 * Converts a font glyph into THREE.Shape objects for 3D rendering.
 * Handles complex contours including holes using winding number algorithm.
 * 
 * @param glyph - The opentype.Glyph to convert
 * @returns Array of THREE.Shape objects, with holes properly assigned to outer contours
 * 
 * @example
 * const glyph = font.glyphs.get(65); // Get 'A' glyph
 * const shapes = glyphToShapes(glyph);
 * 
 * @remarks
 * Uses winding number algorithm: if the signed area is positive, the contour is a hole;
 * if negative, it's an outer contour. Holes are assigned to all outer shapes.
 */
export function glyphToShapes(glyph: opentype.Glyph) {
  glyph.getMetrics();
  const shapes: THREE.Shape[] = [];
  const holes: THREE.Path[] = [];
  // @TODO: opentype has wrong typings here
  for (const contour of glyph.getContours() as Contour[]) {
    const path = new THREE.Path();
    let prev: ContourPoint | null = null;
    let curr = contour[contour.length - 1];
    let next = contour[0];
    if (curr.onCurve) {
      path.moveTo(curr.x, curr.y);
    } else {
      if (next.onCurve) {
        path.moveTo(next.x, next.y);
      } else {
        const start = {
          x: (curr.x + next.x) * 0.5,
          y: (curr.y + next.y) * 0.5,
        };
        path.moveTo(start.x, start.y);
      }
    }
    for (let i = 0; i < contour.length; ++i) {
      prev = curr;
      curr = next;
      next = contour[(i + 1) % contour.length];
      if (curr.onCurve) {
        path.lineTo(curr.x, curr.y);
      } else {
        let prev2 = prev;
        let next2 = next;
        if (!prev.onCurve) {
          prev2 = {
            x: (curr.x + prev.x) * 0.5,
            y: (curr.y + prev.y) * 0.5,
            onCurve: false,
          };
          path.lineTo(prev2.x, prev2.y);
        }
        if (!next.onCurve) {
          next2 = {
            x: (curr.x + next.x) * 0.5,
            y: (curr.y + next.y) * 0.5,
            onCurve: false,
          };
        }
        path.lineTo(prev2.x, prev2.y);
        path.quadraticCurveTo(curr.x, curr.y, next2.x, next2.y);
      }
    }
    path.closePath();
    let sum = 0;
    let lastPoint = contour[contour.length - 1];
    for (const point of contour) {
      sum += (lastPoint.x - point.x) * (point.y + lastPoint.y);
      lastPoint = point;
    }
    if (sum > 0) {
      holes.push(path);
    } else {
      const shape = new THREE.Shape();
      shape.add(path);
      shapes.push(shape);
    }
  }
  for (const shape of shapes) {
    shape.holes = holes;
  }
  return shapes;
}

/**
 * Converts text string into a 3D BufferGeometry using a specified font.
 * Creates extruded text geometry with proper kerning and positioning.
 * 
 * @param args - Configuration object
 * @param args.font - The opentype.Font to render with
 * @param args.text - The text string to convert
 * @param args.size - Font size in pixels
 * @param args.width - Extrusion depth (Z-axis)
 * @param args.kerning - Kerning adjustment (number or array of per-character adjustments), defaults to 0
 * @returns A THREE.BufferGeometry ready for rendering or export
 * 
 * @example
 * const geometry = stringToGeometry({
 *   font: myFont,
 *   text: "Hello",
 *   size: 72,
 *   width: 20,
 *   kerning: 5
 * });
 * 
 * @remarks
 * - Combines multiple glyph geometries into a single merged BufferGeometry
 * - Uses ExtrudeGeometry for 3D depth
 * - Properly handles kerning for typography-accurate rendering
 */
export function stringToGeometry(args: {
  font: opentype.Font;
  text: string;
  size: number;
  width: number;
  kerning?: number | number[];
}): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  let dx = 0;
  args.font.forEachGlyph(
    args.text,
    0,
    0,
    args.size,
    undefined,
    (glyph, x, y) => {
      x += dx;
      if (typeof args.kerning === "number") {
        dx += args.kerning;
      } else if (Array.isArray(args.kerning) && args.kerning.length > 0) {
        dx += args.kerning.shift()!;
      }
      const shapes = glyphToShapes(glyph);
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: args.width,
        steps: 1,
      });
      geometry.applyMatrix4(
        new THREE.Matrix4().makeScale(
          (1 / args.font.unitsPerEm) * args.size,
          (1 / args.font.unitsPerEm) * args.size,
          1
        )
      );
      geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, 0));
      geometries.push(geometry);
    }
  );
  // Manually merge geometries
  if (geometries.length === 0) {
    throw new Error("No geometries generated");
  }
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  
  for (const geo of geometries) {
    const posAttr = geo.getAttribute("position");
    const normAttr = geo.getAttribute("normal");
    
    if (posAttr) {
      for (let i = 0; i < posAttr.count; i++) {
        positions.push(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );
      }
    }
    
    if (normAttr) {
      for (let i = 0; i < normAttr.count; i++) {
        normals.push(
          normAttr.getX(i),
          normAttr.getY(i),
          normAttr.getZ(i)
        );
      }
    }
  }
  
  merged.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  if (normals.length > 0) {
    merged.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
  }
  
  return merged;
}

/**
 * Loads and parses a font from an ArrayBuffer (TTF/OTF binary data).
 * 
 * @param arg - The font file as an ArrayBuffer
 * @returns The parsed opentype.Font object
 * @throws If the buffer contains invalid font data
 * 
 * @example
 * const fontBuffer = await fetch('font.ttf').then(r => r.arrayBuffer());
 * const font = loadFont(fontBuffer);
 */
export function loadFont(arg: ArrayBuffer): opentype.Font {
  const font = opentype.parse(arg);
  return font;
}

/**
 * Exports a THREE.BufferGeometry to binary STL (STereoLithography) format.
 * Generates complete STL file structure with triangle normals and vertices.
 * 
 * @param geometry - The BufferGeometry to export
 * @returns An ArrayBuffer containing binary STL data ready for file download
 * 
 * @example
 * const geometry = stringToGeometry({ font, text: "Hello", size: 72, width: 20 });
 * const stlBuffer = geometryToSTL(geometry);
 * const blob = new Blob([stlBuffer], { type: 'application/octet-stream' });
 * // Save blob or download it
 * 
 * @remarks
 * Binary STL format structure:
 * - 80-byte header
 * - 4-byte triangle count (uint32, little-endian)
 * - Per triangle (50 bytes each):
 *   - 3x4 bytes: normal vector (float32)
 *   - 3x(3x4 bytes): three vertices (float32)
 *   - 2 bytes: attribute byte count (usually 0)
 */
export function geometryToSTL(geometry: THREE.BufferGeometry) {
  // Simple binary STL exporter
  const posAttr = geometry.getAttribute("position");
  const indexAttr = geometry.getIndex();
  
  const triangles = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
  const buffer = new ArrayBuffer(80 + 4 + triangles * 50);
  const view = new DataView(buffer);
  const vertices = [];
  
  // Read positions
  for (let i = 0; i < posAttr.count; i++) {
    vertices.push(
      posAttr.getX(i),
      posAttr.getY(i),
      posAttr.getZ(i)
    );
  }
  
  // Write header (80 bytes of anything)
  const header = new Uint8Array(buffer, 0, 80);
  const headerStr = "Three.js STL Exporter";
  for (let i = 0; i < headerStr.length; i++) {
    header[i] = headerStr.charCodeAt(i);
  }
  
  // Write number of triangles
  view.setUint32(80, triangles, true);
  
  let offset = 84;
  
  // Write triangles
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const i0 = indexAttr.getX(i) * 3;
      const i1 = indexAttr.getX(i + 1) * 3;
      const i2 = indexAttr.getX(i + 2) * 3;
      
      // Calculate normal
      const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      
      const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
      const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
      
      const normal = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0]
      ];
      
      const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      if (len > 0) {
        normal[0] /= len;
        normal[1] /= len;
        normal[2] /= len;
      }
      
      view.setFloat32(offset, normal[0], true);
      view.setFloat32(offset + 4, normal[1], true);
      view.setFloat32(offset + 8, normal[2], true);
      offset += 12;
      
      view.setFloat32(offset, v0[0], true);
      view.setFloat32(offset + 4, v0[1], true);
      view.setFloat32(offset + 8, v0[2], true);
      offset += 12;
      
      view.setFloat32(offset, v1[0], true);
      view.setFloat32(offset + 4, v1[1], true);
      view.setFloat32(offset + 8, v1[2], true);
      offset += 12;
      
      view.setFloat32(offset, v2[0], true);
      view.setFloat32(offset + 4, v2[1], true);
      view.setFloat32(offset + 8, v2[2], true);
      offset += 12;
      
      view.setUint16(offset, 0, true); // attribute byte count
      offset += 2;
    }
  } else {
    for (let i = 0; i < vertices.length; i += 9) {
      const v0 = [vertices[i], vertices[i + 1], vertices[i + 2]];
      const v1 = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
      const v2 = [vertices[i + 6], vertices[i + 7], vertices[i + 8]];
      
      const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
      const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
      
      const normal = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0]
      ];
      
      const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      if (len > 0) {
        normal[0] /= len;
        normal[1] /= len;
        normal[2] /= len;
      }
      
      view.setFloat32(offset, normal[0], true);
      view.setFloat32(offset + 4, normal[1], true);
      view.setFloat32(offset + 8, normal[2], true);
      offset += 12;
      
      for (let j = 0; j < 3; j++) {
        view.setFloat32(offset, v0[j], true);
        offset += 4;
      }
      for (let j = 0; j < 3; j++) {
        view.setFloat32(offset, v1[j], true);
        offset += 4;
      }
      for (let j = 0; j < 3; j++) {
        view.setFloat32(offset, v2[j], true);
        offset += 4;
      }
      
      view.setUint16(offset, 0, true);
      offset += 2;
    }
  }
  
  return buffer;
}
