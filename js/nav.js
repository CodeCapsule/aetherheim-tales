// Walkability grid with A* pathfinding, shared by the overworld and dungeons.
// Coordinates are world-space x/z; the grid covers [minX, minX + width) x [minZ, minZ + depth).
export class NavGrid {
  constructor(minX, minZ, width, depth, cell = 2, fill = 0) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.nx = Math.ceil(width / cell); this.nz = Math.ceil(depth / cell);
    this.grid = new Uint8Array(this.nx * this.nz).fill(fill);
  }
  cellOf(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  center(cx, cz) { return [this.minX + (cx + 0.5) * this.cell, this.minZ + (cz + 0.5) * this.cell]; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.nx && cz < this.nz; }
  isBlocked(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    if (!this.inside(cx, cz)) return true;
    return this.grid[cz * this.nx + cx] === 1;
  }
  setCell(cx, cz, v) { if (this.inside(cx, cz)) this.grid[cz * this.nx + cx] = v; }
  setCircle(x, z, r, v = 1, pad = 0.6) {
    const [c0x, c0z] = this.cellOf(x - r - pad, z - r - pad), [c1x, c1z] = this.cellOf(x + r + pad, z + r + pad);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      if (!this.inside(cx, cz)) continue;
      const [wx, wz] = this.center(cx, cz);
      if (Math.hypot(wx - x, wz - z) < r + pad) this.grid[cz * this.nx + cx] = v;
    }
  }
  setRect(x, z, w, d, rot = 0, v = 1, pad = 0.4) {
    const r = Math.hypot(w, d) / 2 + 1 + pad;
    const [c0x, c0z] = this.cellOf(x - r, z - r), [c1x, c1z] = this.cellOf(x + r, z + r);
    const c = Math.cos(-rot), s = Math.sin(-rot);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      if (!this.inside(cx, cz)) continue;
      const [cwx, cwz] = this.center(cx, cz); const wx = cwx - x, wz = cwz - z;
      const lx = wx * c + wz * s, lz = -wx * s + wz * c;
      if (Math.abs(lx) < w / 2 + pad && Math.abs(lz) < d / 2 + pad) this.grid[cz * this.nx + cx] = v;
    }
  }
  blockCircle(x, z, r) { this.setCircle(x, z, r, 1); }
  blockRect(x, z, w, d, rot = 0) { this.setRect(x, z, w, d, rot, 1); }
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / (this.cell * 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  nearestFree(x, z) {
    if (!this.isBlocked(x, z)) return [x, z];
    for (let r = 1; r < 30; r++) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r * this.cell, pz = z + Math.sin(a / 16 * Math.PI * 2) * r * this.cell;
      if (!this.isBlocked(px, pz)) return [px, pz];
    }
    return [x, z];
  }
  findPath(sx, sz, tx, tz) {
    [tx, tz] = this.nearestFree(tx, tz);
    if (this.lineClear(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
    const NX = this.nx, NZ = this.nz, G = this.grid;
    const [ax, az] = this.cellOf(...this.nearestFree(sx, sz)), [bx, bz] = this.cellOf(tx, tz);
    if (!this.inside(ax, az) || !this.inside(bx, bz)) return [{ x: tx, z: tz }];
    const N = NX * NZ, start = az * NX + ax, goal = bz * NX + bx;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hfn = (i) => { const dx = Math.abs(i % NX - bx), dz = Math.abs(((i / NX) | 0) - bz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[start] = 0; push(hfn(start), start);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 80000) {
      const [, cur] = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % NX, cz = (cur / NX) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
        const ni = nz * NX + nx;
        if (G[ni] || closed[ni]) continue;
        if (dx && dz && (G[cz * NX + nx] || G[nz * NX + cx])) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + hfn(ni), ni); }
      }
    }
    if (!found) return [{ x: tx, z: tz }];
    const cells = []; for (let c = goal; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => { const [x, z] = this.center(c % NX, (c / NX) | 0); return { x, z }; });
    pts[pts.length - 1] = { x: tx, z: tz };
    const out = []; let px = sx, pz = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(px, pz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); px = pts[j].x; pz = pts[j].z; i = j + 1;
    }
    return out;
  }
}
