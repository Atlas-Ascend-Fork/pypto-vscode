var Selectable = function() {
    
  var select = function(selection) {
    console.log('selection: ', selection);
    var lastSelected = null;

    // 定义单击和双击事件处理
    const clickTimeout = 300;
    let clickTimer;

    selection.on("click", function(d) {
      const d3Event = d3.event;
      var node = d3.select(this);
      clearTimeout(clickTimer);

      clickTimer = setTimeout(() => {
        console.log('selection click', d);
        var selected = !node.classed("selected");
        if (selection.filter(".selected")[0].length==1) {
            selection.classed("selected", false);
            node.classed("selected", selected);
            lastSelected = selected ? d : null;
        } else {
            selection.classed("selected", false);
            node.classed("selected", true);
            lastSelected = d
        }
        $('#node-detail').show();
        const type = d.id.split('-')[0];
        $(`input[name="type][value=${type}]`).prop('checked', true);
        const id = $('#search-input').val();
        if (!id) {
          $('#search-input').attr('placeholder', type2placeholder[type]);
        }
        const da = JSON.stringify(d.data, null, 4);
        var options = {
            collapsed: false,
            enableClipboard: true
        };

        $('#result').jsonViewer(JSON.parse(da), options);
      }, clickTimeout);
    });

    selection.on("dblclick", function(d) {
      const data = d.data;
      if (data.calleehash) {
        vscode.postMessage({
          command: 'getSubgraph',
          paramObj: { calleehash: data.calleehash, subFuncmagicname: data.subFuncmagicname },
        });
      }
    });
    
    // Add the Ctrl-A behavior
    var attach = this;
    d3.select("body").on("keyup", function(d) {
        if (d3.event.ctrlKey && d3.event.keyCode==65) {
            var allSelected = selection.filter(function(d) {
                return !d3.select(this).classed("selected");
            }).empty();
            selection.classed("selected", !allSelected);
            onSelect();
        }
    });
  }

  var getrange = function(a, b) { return [a, b]; };
  var onSelect = function() {};
  
  select.getrange = function(_) { if (arguments.length==0) return getrange; getrange = _; return select; }
  select.on = function(event, _) { 
    if (event!="select") return;
    if (_==null) return onSelect;
    onSelect = _;
    return select;
  }
  
  return select;
}