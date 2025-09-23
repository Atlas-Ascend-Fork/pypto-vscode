function XTraceDAG(attachPoint, reports) {
  var dag = this;
  
  // Twiddle the attach point a little bit
  var rootSVG = d3.select(attachPoint).append("svg").attr("width", "100%").attr("height", "100%");
  var graphSVG = rootSVG.append("svg").attr("width", "100%").attr("height", "100%").attr("class", "graph-attach");
  graphSVG.node().oncontextmenu = function(d) { return false; };
  var minimapSVG = rootSVG.append("svg").attr("class", "minimap-attach");
  
  // Create the graph representations
  var graph = createGraphFromReports(reports);
  
  
  // Create the chart instances
  var DAG = DirectedAcyclicGraph().animate(true);
  var DAGMinimap = DirectedAcyclicGraphMinimap(DAG).width("19.5%").height("19.5%").x("80%").y("80%");

  // Attach the panzoom behavior
  var refreshViewport = function() {
      var t = zoom.translate();
      var scale = zoom.scale();
      graphSVG.select(".graph").attr("transform","translate("+t[0]+","+t[1]+") scale("+scale+")");
      minimapSVG.select('.viewfinder').attr("x", -t[0]/scale).attr("y", -t[1]/scale).attr("width", attachPoint.offsetWidth/scale).attr("height", attachPoint.offsetHeight/scale);
      graphSVG.selectAll(".node text").attr("opacity", 3*scale-0.3);
  }
  var zoom = MinimapZoom().scaleExtent([0.001, 2.0]).on("zoom", refreshViewport);
  zoom.call(this, rootSVG, minimapSVG);
  
  // A function that resets the viewport by zooming all the way out
  var resetViewport = function() {
    var curbbox = graphSVG.node().getBBox();
    var bbox = { x: curbbox.x, y: curbbox.y, width: curbbox.width+50, height: curbbox.height+50};
    scale = Math.min(attachPoint.offsetWidth/bbox.width, attachPoint.offsetHeight/bbox.height);
    w = attachPoint.offsetWidth/scale;
    h = attachPoint.offsetHeight/scale;
    tx = ((w - bbox.width)/2 - bbox.x + 25)*scale;
    ty = ((h - bbox.height)/2 - bbox.y + 25)*scale;
    zoom.translate([tx, ty]).scale(scale);
    refreshViewport();
  }
  
  
  // Detaches any bound context menus
  function detachContextMenus() {
      $(".graph .node").unbind("contextmenu");    
  }
  
  // A function that attaches mouse-click events to nodes to enable node selection
  function setupEvents(){
      var nodes = graphSVG.selectAll(".node");
      var edges = graphSVG.selectAll(".edge");
  
      // Set up node selection events
      var select = Selectable().getrange(function(a, b) {
          var path = getNodesBetween(a, b).concat(getNodesBetween(b, a));
          return nodes.data(path, DAG.nodeid());
      }).on("select", function() {
          var selected = {};
          graphSVG.selectAll(".node.selected").data().forEach(function(d) { selected[d.id]=true; });
          edges.classed("selected", function(d) {
              return selected[d.source.id] && selected[d.target.id]; 
          });
      });
      select(nodes);

        nodes.on("mouseover", function(d) {
            graphSVG.classed("hovering", true);
            highlightPath(d);
        }).on("mouseout", function(d){
            graphSVG.classed("hovering", false);
            edges.classed("hovered", false).classed("immediate", false);
            nodes.classed("hovered", false).classed("immediate", false);
        });

        edges.on("mouseover", function(d) {
          d3.event.stopPropagation();
          graphSVG.classed("hovering", true);
          nodes.classed("hovered", function(node) {
            return node.id === d.source.id || node.id === d.target.id;
          });
          d3.select(this).classed("hovered", true).classed("immediate", true);
        }).on("mouseout", function(d) {
          d3.event.stopPropagation();
          graphSVG.classed("hovering", false);
          nodes.classed("hovered", false);
          d3.select(this).classed("hovered", false).classed("immediate", false);
        }).on("click", function(d) {
          d3.event.stopPropagation();
          edges.classed("selected", false);
          nodes.classed("selected", false);
          d3.select(this).classed("selected", true);
          var srcNode = d.source;
          var tgtNode = d.target;
          console.log(srcNode.data);
          console.log(tgtNode.data);
          $('#node-detail').show();
          var srcInfo = getNodeInfo(srcNode.data);
          var tgtInfo = getNodeInfo(tgtNode.data);
          $('#result').html(`
              <p>${srcInfo} to ${tgtInfo}</p>
            `);
        });

      function getNodeInfo(nodeData) {
        if ('opcode' in nodeData) {
          var opcode = nodeData.opcode;
          var opmagic = nodeData.opmagic;
          return 'Operation ' + opcode + ' ' + opmagic;
        } else{
          var tensormagic = nodeData.magic;
          return 'Tensor ' + tensormagic;
        }
      }
      
      function highlightPath(center) {        
          var path = getEntirePathLinks(center);
          
          var pathnodes = {};
          var pathlinks = {};
          
          path.forEach(function(p) {
             pathnodes[p.source.id] = true;
             pathnodes[p.target.id] = true;
             pathlinks[p.source.id+p.target.id] = true;
          });
          
          edges.classed("hovered", function(d) {
              return pathlinks[d.source.id+d.target.id];            
          })
          nodes.classed("hovered", function(d) {
              return pathnodes[d.id];
          });
          
          var immediatenodes = {};
          var immediatelinks = {};
          immediatenodes[center.id] = true;
          center.getVisibleParents().forEach(function(p) {
              immediatenodes[p.id] = true;
              immediatelinks[p.id+center.id] = true;
          })
          center.getVisibleChildren().forEach(function(p) {
              immediatenodes[p.id] = true;
              immediatelinks[center.id+p.id] = true;
          })
          
          edges.classed("immediate", function(d) {
              return immediatelinks[d.source.id+d.target.id];
          })
          nodes.classed("immediate", function(d) {
              return immediatenodes[d.id];
          })
      }
  }
  
  // The main draw function
  this.draw = function() {
      console.log("draw begin")
      var begin = (new Date()).getTime();  
      var start = (new Date()).getTime();        
      graphSVG.datum(graph).call(DAG);    // Draw a DAG at the graph attach
      console.log("draw graph", new Date().getTime() - start);
      start = (new Date()).getTime();    
      minimapSVG.datum(graphSVG.node()).call(DAGMinimap);  // Draw a Minimap at the minimap attach
      console.log("draw minimap", new Date().getTime() - start);
      start = (new Date()).getTime();
      setupEvents();                      // Set up the node selection events
      console.log("draw events", new Date().getTime() - start);
      start = (new Date()).getTime();
      refreshViewport();                  // Update the viewport settings
      console.log("draw viewport", new Date().getTime() - start);
      console.log("draw complete, total time=", new Date().getTime() - begin);
  }
  
  //Call the draw function
  this.draw();
  
  // Start with the graph all the way zoomed out
  resetViewport();

  // Save important variables
  this.attachPoint = attachPoint;
  this.reports = reports;
  this.DAG = DAG
  this.DAGMinimap = DAGMinimap;
  this.graph = graph;
  this.resetViewport = resetViewport;
  this.graphSVG = graphSVG;
  this.zoom = zoom;
  
  var animate = function() {
      var startTime = new Date().getTime();
      
      // Find the min and max times
      var max = 0;
      var min = Infinity;
      graphSVG.selectAll(".node").each(function(d) {
          var time = parseFloat(d.report["Timestamp"]);
          if (time < min) {
              min = time;
          }
          if (time > max) {
              max = time;
          }
      })
      
      var playDuration = 10000;
      
      var update = function() {
          var elapsed = new Date().getTime() - startTime
          var threshold = (elapsed * (max - min) / playDuration) + min;
          graphSVG.selectAll(".node").attr("display", function(d) {
              d.animation_hiding = parseFloat(d.report["Timestamp"]) < threshold ? null : true;
              return d.animation_hiding ? "none" : "";
          });
          graphSVG.selectAll(".edge").attr("display", function(d) {
              return (d.source.animation_hiding || d.target.animation_hiding) ? "none" : ""; 
          })
          if (elapsed < playDuration) {
              window.setTimeout(update, 10);
          }
      }
      update();
      
  }
}
