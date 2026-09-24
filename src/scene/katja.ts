import * as THREE from 'three'
import type { ItemId } from '../game/rules'
import type { Pose, SceneAssets } from './assets'
import { itemPlacements } from './itemLayout'

/** World height of each pose plane. The hang canvas is untrimmed, so it includes some margin. */
export const POSE_HEIGHT: Record<Pose, number> = {
  hang: 4.0,
  surprised: 4.0,
  happy: 4.0,
  jump: 3.9,
  beg: 3.1,
  confetti: 3.9,
  sleep: 2.7,
  wake: 2.7,
}

/** Katja: a sprite plane with item layers that follow the pose and the mirroring. */
export class Katja {
  readonly root = new THREE.Group()
  /** Squash, stretch and wobble happen here, so items follow. */
  readonly body = new THREE.Group()
  private sprite: THREE.Mesh
  private itemMeshes = new Map<ItemId, THREE.Mesh>()
  pose: Pose = 'hang'
  worn: ItemId[] = []

  constructor(private assets: SceneAssets) {
    this.root.add(this.body)
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaTest: 0.01 }),
    )
    this.sprite.renderOrder = 10
    this.body.add(this.sprite)
    for (const [id, tex] of Object.entries(assets.items) as [ItemId, THREE.Texture][]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.01 }),
      )
      m.visible = false
      this.itemMeshes.set(id, m)
      this.body.add(m)
    }
    this.setPose('hang')
  }

  size(pose: Pose = this.pose): { w: number; h: number } {
    const pm = this.assets.meta.poses[pose]
    const h = POSE_HEIGHT[pose]
    const aspect = pm ? pm.w / pm.h : 0.67
    return { w: h * aspect, h }
  }

  /** Fraction of the width where the paws touch the wall. */
  wallContact(pose: Pose = this.pose): number {
    return this.assets.meta.poses[pose]?.wallContact ?? 0.1
  }

  setPose(pose: Pose): void {
    this.pose = pose
    const mat = this.sprite.material as THREE.MeshBasicMaterial
    mat.map = this.assets.poses[pose]
    mat.needsUpdate = true
    const { w, h } = this.size(pose)
    this.sprite.scale.set(w, h, 1)
    this.layoutItems()
  }

  setWorn(items: ItemId[]): void {
    this.worn = items.slice()
    this.layoutItems()
  }

  /** Where an item would sit right now, in world space (used to fly an item onto Katja). */
  itemWorldPosition(id: ItemId): THREE.Vector3 | null {
    const pl = itemPlacements(this.assets.meta, this.pose, [id])[0]
    if (!pl) return null
    const { w, h } = this.size()
    const v = new THREE.Vector3((pl.cx - 0.5) * w, (0.5 - pl.cy) * h, 0.05)
    this.root.updateMatrixWorld(true)
    return this.body.localToWorld(v)
  }

  private layoutItems(): void {
    const { w, h } = this.size()
    const placements = itemPlacements(this.assets.meta, this.pose, this.worn)
    for (const [id, m] of this.itemMeshes) {
      const pl = placements.find((p) => p.id === id)
      if (!pl) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.set((pl.cx - 0.5) * w, (0.5 - pl.cy) * h, pl.z * 0.01)
      m.rotation.z = (-pl.rot * Math.PI) / 180
      m.scale.set(pl.w * w, pl.h * h, 1)
      m.renderOrder = 10 + pl.z
    }
  }
}
