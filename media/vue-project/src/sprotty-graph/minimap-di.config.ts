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
import { LayoutOptions } from "elkjs/lib/elk-api";
import { Container, ContainerModule } from "inversify";
import {
  configureModelElement,
  configureViewerOptions,
  editFeature,
  loadDefaultModules,
  LocalModelSource,
  moveFeature, hoverFeedbackFeature,
  RectangularNode, SEdgeImpl, SGraphImpl, SLabelImpl,
  SNodeImpl, SRoutingHandleImpl,
  SRoutingHandleView,
  TYPES,
  SCompartmentImpl,
  SCompartmentView,
  contextMenuModule,
  selectModule,
  buttonModule,
  labelEditModule,
  labelEditUiModule,
  hoverModule,
  edgeEditModule,
} from "sprotty";
import {
  DefaultLayoutConfigurator,
} from "sprotty-elk/lib/inversify";
import { Point, SGraph, SModelIndex, SNode, SPort } from "sprotty-protocol";
import {
  AstgrEdge,
  AstgrGraphView,
  AstgrOpMinimapView,
  AstgrTensorMinimapView,
  emptyLabelView,
  emptyPortView,
  InputOutputNodeView,
  BootomAstgrEdge,
} from "./views";
import { AstgrNode, AstgrPort } from "./graph.types";

export function createMiniMapDiContainer(sprottyContainerId: string) {
  const randomGraphModule = new ContainerModule(
    (bind, unbind, isBound, rebind) => {
      bind(TYPES.ModelSource).to(LocalModelSource).inSingletonScope();

      const context = { bind, unbind, isBound, rebind };
      configureModelElement(context, "graph", SGraphImpl, AstgrGraphView);
      
      configureModelElement(
        context,
        "node:input",
        RectangularNode,
        InputOutputNodeView,
        {
          disable: [moveFeature],
        }
      );

      configureModelElement(
        context,
        "node:output",
        RectangularNode,
        InputOutputNodeView,
        {
          disable: [moveFeature],
        }
      );

      configureModelElement(context, "node", RectangularNode, AstgrOpMinimapView, {
        disable: [moveFeature],
        enable: [hoverFeedbackFeature],
      });

      configureModelElement(context, "node:tensor", RectangularNode, AstgrTensorMinimapView, {
        disable: [moveFeature],
      });

      configureModelElement(context, "port", SNodeImpl, emptyPortView);

      configureModelElement(context, "label", SLabelImpl, emptyLabelView);

      configureModelElement(context, "edge", SEdgeImpl, AstgrEdge, {
        disable: [editFeature],
      });

      configureModelElement(context, 'bottom', SEdgeImpl, BootomAstgrEdge, {
        disable: [editFeature],
      });

      configureModelElement(context, 'compartment', SCompartmentImpl, SCompartmentView);

      configureModelElement(
        context,
        "routing-point",
        SRoutingHandleImpl,
        SRoutingHandleView,
        {
          disable: [moveFeature],
        }
      );
      configureModelElement(
        context,
        "volatile-routing-point",
        SRoutingHandleImpl,
        SRoutingHandleView,
        {
          disable: [moveFeature],
        }
      );

      configureViewerOptions(context, {
        needsClientLayout: true,
        baseDiv: sprottyContainerId,
        zoomLimits: { min: 0.0001, max: 10 },
        horizontalScrollLimits: { min: -400000, max: 400000 },
        verticalScrollLimits: { min: -400000, max: 400000 },
      });
    }
  );

  const container = new Container();
  loadDefaultModules(container, {exclude: [
    selectModule, contextMenuModule, buttonModule, labelEditModule, labelEditUiModule, hoverModule, edgeEditModule
  ]}); // Sprotty's default modules
  container.load(randomGraphModule); // Your custom module

  return container;
}

export class AstgrLayoutConfigurator extends DefaultLayoutConfigurator {

  protected override graphOptions(
    sgraph: SGraph,
    _index: SModelIndex
  ): LayoutOptions {
    // Count nodes for performance optimization
    const nodeCount = sgraph.children?.filter(child => 
      child.type.includes('node')).length || 0;
    
    
      return {
        "org.eclipse.elk.algorithm": "org.eclipse.elk.layered",
        "elk.direction": "RIGHT",
      };
    
  }

protected override nodeOptions(
        snode: SNode,
        _index: SModelIndex
    ): LayoutOptions {
        const role = (snode as AstgrNode).role;
        const base: LayoutOptions = {
            'org.eclipse.elk.portConstraints': 'FIXED_SIDE',
            'org.eclipse.elk.nodeLabels.placement': 'INSIDE',
        };

        if (role === 'input') {
            return {
                ...base
            };
        }
        if (role === 'output') {
            return {
                ...base
            };
        }
        if (role === 'tensor') {
            return {
                ...base,
                'org.eclipse.elk.nodeSize.minimum': '(50,30)',
                'org.eclipse.elk.spacing.labelNode': '3.0',
                'org.eclipse.elk.spacing.labelLabel': '2.0'
            };
        }
        if (role === 'operation') {
            return {
                ...base
            };
        }
        if (role === 'sync') {
            return {
                ...base
            };
        }
        return base;
    }

    protected override portOptions(
        sport: SPort,
        _index: SModelIndex
    ): LayoutOptions {


        const role = (sport as AstgrPort).role;
        const base: LayoutOptions = {
            'org.eclipse.elk.port.borderOffset': '1',
        }

        if (role === 'input') {
            return {
                ...base,
                'org.eclipse.elk.port.side': 'WEST'
            };
        } else {
            return {
                ...base,
                'org.eclipse.elk.port.side': 'EAST'
            };
        }
    }
}
