/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
