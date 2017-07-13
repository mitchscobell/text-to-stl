from __future__ import print_function
import struct

header = 'STLB ATF 2.0.0.9000 COLOR=\xa0\xa0\xa0\xff                                                  '

def vec_sub(a, b):
  assert len(a) == len(b)
  return tuple([ a[i] - b[i] for i in range(len(a)) ])

def vec_add(a, b):
  assert len(a) == len(b)
  return tuple([ a[i] + b[i] for i in range(len(a)) ])

def vec_scale(a, s):
  return tuple([ a[i] * s for i in range(len(a)) ])

def vec_cross(u, v):
  assert len(u) == len(v)
  dim = len(u)
  s = []
  for i in range(dim):
    if i == 0:
      j,k = 1,2
      s.append(u[j]*v[k] - u[k]*v[j])
    elif i == 1:
      j,k = 2,0
      s.append(u[j]*v[k] - u[k]*v[j])
    else:
      j,k = 0,1
      s.append(u[j]*v[k] - u[k]*v[j])
  return s

def vec_len(a):
  return sum([ i**2 for i in a ]) ** 0.5



triangles = [
  (
    (-1.0,-1.0,-1.0),
    (-1.0,-1.0, 1.0),
    (-1.0, 1.0, 1.0),
  ), (
    (1.0, 1.0,-1.0),
    (-1.0,-1.0,-1.0),
    (-1.0, 1.0,-1.0),
  ), (
    (1.0,-1.0, 1.0),
    (-1.0,-1.0,-1.0),
    (1.0,-1.0,-1.0),
  ), (
    (1.0, 1.0,-1.0),
    (1.0,-1.0,-1.0),
    (-1.0,-1.0,-1.0),
  ), (
    (-1.0,-1.0,-1.0),
    (-1.0, 1.0, 1.0),
    (-1.0, 1.0,-1.0),
  ), (
    (1.0,-1.0, 1.0),
    (-1.0,-1.0, 1.0),
    (-1.0,-1.0,-1.0),
  ), (
    (-1.0, 1.0, 1.0),
    (-1.0,-1.0, 1.0),
    (1.0,-1.0, 1.0),
  ), (
    (1.0, 1.0, 1.0),
    (1.0,-1.0,-1.0),
    (1.0, 1.0,-1.0),
  ), (
    (1.0,-1.0,-1.0),
    (1.0, 1.0, 1.0),
    (1.0,-1.0, 1.0),
  ), (
    (1.0, 1.0, 1.0),
    (1.0, 1.0,-1.0),
    (-1.0, 1.0,-1.0),
  ), (
    (1.0, 1.0, 1.0),
    (-1.0, 1.0,-1.0),
    (-1.0, 1.0, 1.0),
  ), (
    (1.0, 1.0, 1.0),
    (-1.0, 1.0, 1.0),
    (1.0,-1.0, 1.0)
  )
]

triangles = [
  ((ax*5, ay*5, az*5), (bx*5, by*5, bz*5), (cx*5, cy*5, cz*5)) for ((ax, ay, az), (bx, by, bz), (cx, cy, cz)) in triangles
]

# triangles = []
# triangles += [
#   ( (-1.0, -1.0,  1.0), ( 1.0, -1.0,  1.0), ( 1.0,  1.0,  1.0) ),
#   ( ( 1.0,  1.0,  1.0), (-1.0,  1.0,  1.0), (-1.0, -1.0,  1.0) ),
# ]
# triangles = [
#   ((ax*5, ay*5, az*5), (bx*5, by*5, bz*5), (cx*5, cy*5, cz*5)) for ((ax, ay, az), (bx, by, bz), (cx, cy, cz)) in triangles[0:2]
# ]
# # create other sides
# triangles += [
#   ((bx, bz, by), (ax, az, ay), (cx, cz, cy)) for ((ax, ay, az), (bx, by, bz), (cx, cy, cz)) in triangles
# ] + [
#   ((az, ax, ay), (bz, bx, by), (cz, cx, cy)) for ((ax, ay, az), (bx, by, bz), (cx, cy, cz)) in triangles
# ]
# # mirror z axis
# triangles += [
#   ((bx, by, -bz), (ax, ay, -az), (cx, cy, -cz)) for ((ax, ay, az), (bx, by, bz), (cx, cy, cz)) in triangles
# ]


with open('test.stl', 'wb') as fp:
  fp.write(header)
  fp.write(struct.pack('<I', len(triangles)))
  for tri in triangles:
    n1 = vec_sub(tri[0], tri[1])
    n2 = vec_sub(tri[1], tri[2])
    n = vec_cross(n1, n2)
    n = vec_scale(n, 1 / vec_len(n))
    # n = [ 1, 0, 0]
    fp.write(struct.pack('<fff', n[0], n[1], n[2]))
    fp.write(struct.pack('<fff', tri[0][0], tri[0][1], tri[0][2]))
    fp.write(struct.pack('<fff', tri[1][0], tri[1][1], tri[1][2]))
    fp.write(struct.pack('<fff', tri[2][0], tri[2][1], tri[2][2]))
    fp.write(struct.pack('<H', 0)) # 20083

if False:
  with open('noah1.stl', 'rb') as fp:
    header = fp.read(80)
    (count, ) = struct.unpack('<I', fp.read(4))
    print( 'count', count )
    for i in range(count):
      (nx, ny, nz) = struct.unpack('<fff', fp.read(3*4))
      (ax, ay, az) = struct.unpack('<fff', fp.read(3*4))
      (bx, by, bz) = struct.unpack('<fff', fp.read(3*4))
      (cx, cy, cz) = struct.unpack('<fff', fp.read(3*4))
      (attributes, ) = struct.unpack('<H', fp.read(2)) # 20083 ?
      print( 'attributes', attributes )
    print( 'xx', fp.tell() )

