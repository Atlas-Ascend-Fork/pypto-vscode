import { Command, CommandExecutionContext, CommandReturn, IActionHandler, ICommand } from "sprotty";
import { Action } from "sprotty-protocol";
import { injectable } from 'inversify';

let animateIndex = 0;
let stopAnimate = true;

export interface RectAnimateAction extends Action {
  kind: typeof RectAnimateAction.KIND;
  elementId: string;
  rotateLocation: number;
}

export namespace RectAnimateAction {
  export const KIND = 'rectAnimateAction';

  export function create(elementId: string, rotateLocation: number): RectAnimateAction {
    return {
      kind: KIND,
      elementId,
      rotateLocation
    };
  }
}

@injectable()
export class RectAnimateCommand implements Command {
  static readonly KIND = RectAnimateAction.KIND;

  constructor(public readonly action: RectAnimateAction) { }

  execute(context: CommandExecutionContext): CommandReturn {
    const model = context.root;
    if (this.action) {
      const element = model.index.getById(this.action.elementId) as any;
      element.location = this.action.rotateLocation;
    }
    return {
      model,
      modelChanged: true
    };
  }

  undo(context: CommandExecutionContext): CommandReturn {
    return this.execute(context);
  }
  redo(context: CommandExecutionContext): CommandReturn {
    return this.execute(context);
  }
}

@injectable()
export class RectAnimateActionHandler implements IActionHandler {
  handle(action: Action): ICommand | void {
    if (action.kind === 'rectAnimateAction') {
      return new RectAnimateCommand(action as any);
    }
  }
}

const rectAnimate = (modelSource: any, rotateLocation: number) => {
  const animationAction: RectAnimateAction = {
    kind: 'rectAnimateAction',
    elementId: 'show-node-rect',
    rotateLocation
  }

  modelSource.actionDispatcher.dispatch(animationAction);
  if (!stopAnimate) {
    animateIndex = requestAnimationFrame(() => {
      rectAnimate(modelSource, rotateLocation + 1);
    });
  }
}

export const startRectAnimation = (modelSource: any) => {
  stopAnimate = false;
  if (animateIndex) {
    cancelAnimationFrame(animateIndex);
    animateIndex = 0;
  }
  animateIndex = requestAnimationFrame(() => {
    rectAnimate(modelSource, 0);
  })
}

export const cancelRectAnimation = () => {
  cancelAnimationFrame(animateIndex);
  stopAnimate = true;
}

export function getRectPath(w, h, x, y) {
  const perimeter = 2 * (w + h);
  const start = (x / 100) * perimeter;
  const end = (y / 100) * perimeter;
  let v = [];

  const edges = [
    { len: h, dx: 0, dy: 1, corner: [0, h] },
    { len: w, dx: 1, dy: 0, corner: [w, h] },
    { len: h, dx: 0, dy: -1, corner: [w, 0] },
    { len: w, dx: -1, dy: 0, corner: [0, 0] },
    { len: h, dx: 0, dy: 1, corner: [0, h] },
    { len: w, dx: 1, dy: 0, corner: [w, h] }
  ];

  function getPointAt(dist) {
    let acc = 0;
    for (let index = 0; index < edges.length; index++) {
      const edge = edges[index];
      if (dist <= acc + edge.len) {
        const t = (acc + edge.len - dist) / edge.len;
        return {
          point: [
            edge.corner[0] - t * edge.dx * edge.len,
            edge.corner[1] - t * edge.dy * edge.len
          ],
          index
        };
      }
      acc += edge.len;
    }
  }

  let paths = [];
  if (start < end) {
    const point1 = getPointAt(start);
    const p1 = point1.point;
    const locationIndex1 = point1.index;
    const point2 = getPointAt(end);
    const p2 = point2.point;
    const locationIndex2 = point2.index;
    v = [p1, p2];
    paths.push(`M ${p1[0]} ${p1[1]}`);
    let acc = 0;
    for (let i = locationIndex1; i < locationIndex2; i++){
      const midPoint = edges[i].corner;
      paths.push(`L ${midPoint[0]} ${midPoint[1]}`)
    }

    paths.push(`L ${p2[0]} ${p2[1]}`);
  }

  return {
    path: paths.join(' '),
    v
  };
}