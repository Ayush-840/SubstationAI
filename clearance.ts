/** Hazard volumes: spheres around live parts. Violations fire on ENTRY, not every frame. */
export interface Zone {
  id: string
  center: [number, number, number]
  radius: number // metres, from the clearance table (sample values)
}

const dist = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export class ClearanceMonitor {
  private inside = new Set<string>()
  constructor(private zones: Zone[]) {}

  /** Returns the ids of zones newly entered by this position. */
  update(p: [number, number, number]): string[] {
    const entered: string[] = []
    for (const z of this.zones) {
      const isIn = dist(p, z.center) < z.radius
      if (isIn && !this.inside.has(z.id)) {
        this.inside.add(z.id)
        entered.push(z.id)
      } else if (!isIn) this.inside.delete(z.id)
    }
    return entered
  }
}
