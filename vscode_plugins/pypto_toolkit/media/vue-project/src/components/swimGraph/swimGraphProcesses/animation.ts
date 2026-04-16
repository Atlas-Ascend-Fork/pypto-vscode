export class Animation {
  private startTime = 0;
  private endTime = 0;
  private animationFrameId: number | null = null;

  constructor(private onAnimationStep: (timeSinceStartTime: number) => void) {}

  start(durationTime: number) {
    const now = performance.now();
    
    if (now <= this.endTime) {
      this.endTime = now + durationTime;
      return;
    }
    
    this.startTime = now;
    this.endTime = now + durationTime;
    
    this.onAnimationFrame();
  }

  stop() {
    this.endTime = 0;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  get isRunning(): boolean {
    return this.animationFrameId !== null;
  }

  private onAnimationFrame = () => {
    const now = performance.now();
    
    if (now >= this.endTime) {
      this.stop();
      return;
    }
    
    const timeSinceStartTime = Math.max(Math.round(now - this.startTime), 0);
    this.onAnimationStep(timeSinceStartTime);
    
    this.animationFrameId = requestAnimationFrame(this.onAnimationFrame);
  };
}
