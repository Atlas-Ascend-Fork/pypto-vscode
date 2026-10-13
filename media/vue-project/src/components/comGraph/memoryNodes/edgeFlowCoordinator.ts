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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { reactive } from 'vue';

interface Member {
  id: string;
  stage: number;
}

interface Group {
  activeStage: number | null;
  members: Member[];
  finishedInStage: Set<string>;
  completedStages: Set<number>;
}

const groups = reactive<Record<string, Group>>({});

function ensureGroup(group: string): Group {
  if (!groups[group]) {
    groups[group] = {
      activeStage: null,
      members: [],
      finishedInStage: new Set(),
      completedStages: new Set(),
    };
  }
  return groups[group];
}

function stagesOf(g: Group): number[] {
  return Array.from(new Set(g.members.map((m) => m.stage))).sort((a, b) => a - b);
}

export function registerFlowEdge(group: string, id: string, stage: number) {
  const g = ensureGroup(group);
  g.members = g.members.filter((m) => m.id !== id);
  g.members.push({ id, stage });
  if (g.activeStage === null) {
    g.activeStage = stagesOf(g)[0] ?? null;
  }
}

export function unregisterFlowEdge(group: string, id: string) {
  const g = groups[group];
  if (!g) return;
  g.members = g.members.filter((m) => m.id !== id);
  g.finishedInStage.delete(id);
  if (!g.members.length) {
    g.activeStage = null;
    g.completedStages.clear();
  }
}

export function reportFinished(group: string, id: string, stage: number) {
  const g = groups[group];
  if (!g || g.activeStage !== stage) return;
  g.finishedInStage.add(id);
  const stageMembers = g.members.filter((m) => m.stage === stage).map((m) => m.id);
  const allDone = stageMembers.every((mid) => g.finishedInStage.has(mid));
  if (allDone) {
    g.completedStages.add(stage);
    const stages = stagesOf(g);
    const idx = stages.indexOf(stage);
    const isLast = idx === stages.length - 1;
    if (isLast) {
      g.activeStage = stages[0];
      g.completedStages.clear();
      g.finishedInStage.clear();
    } else {
      g.activeStage = stages[idx + 1];
      stageMembers.forEach((mid) => g.finishedInStage.delete(mid));
    }
  }
}

export function isStageCompleted(group: string, stage: number): boolean {
  const g = groups[group];
  if (!g) return false;
  return g.completedStages.has(stage);
}

export function getFlowState() {
  return groups;
}

