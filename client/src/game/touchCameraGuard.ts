/** A camera gesture consumes every participating touch until all fingers lift. */
export class TouchCameraGuard {
  private active = new Set<number>();
  private consumed = false;

  start(id: number, cameraMode: boolean) {
    this.active.add(id);
    if (cameraMode || this.active.size > 1) this.consumed = true;
  }

  /** True means the release must never generate a selection/placement/order. */
  release(id: number) {
    const consumed = this.consumed || !this.active.has(id);
    this.active.delete(id);
    if (this.active.size === 0) this.consumed = false;
    return consumed;
  }

  cancel() {
    this.active.clear();
    this.consumed = false;
  }
}
