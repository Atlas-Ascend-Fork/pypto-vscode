# PyPTO Toolkit Plugin Version Change Notes

## [2.0.20] - 2026.08.21

### Added

- The GM memory visualization supports arbitrary Tensor distance measurement, adds a single region view mode, and adds an Accesses table view
- The swimlane graph supports scroll-based box selection

## [2.0.19] - 2026.08.07

### Added

- The swimlane graph node details support automatic positioning when the user clicks a node in the dependency mini-graph

## [2.0.18] - 2026.07.31

### Added

- The GM memory visualization Tensor details page supports scaling, which optimizes the display effect
- The run results support navigation to the TaskCheck page, which parses the Task-granularity precision tool results
- The swimlane graph performance statistics PMU panel receives visual optimization

### Fixed

- This release fixes the display issue of the multi-round end-to-end swimlane graph node details panel

## [2.0.17] - 2026.07.17

- The plugin adds GM memory visualization capabilities
- The swimlane graph node details panel supports zooming in and out

## [2.0.16] - 2026.07.03

- The swimlane graph supports A5 Group2 PMU information display

## [2.0.15] - 2026.06.24

### Added

- The swimlane graph supports PMU Trace file visualization, and the Mix mode interaction is optimized
- The swimlane graph interaction performance is optimized
- The run results support navigation to the OpCheck page, which parses the Op-granularity precision tool results

## [2.0.14] - 2026.05.29

### Added

- The plugin adds memory visualization capabilities
- The swimlane graph supports coloring by isomorphic subgraph groups

## [2.0.13] - 2026.05.22

### Added

- The swimlane graph supports viewing the pipeline inside a Wrap in Mix mode

## [2.0.12] - 2026.05.15

### Added

- The computation graph supports coloring by mix subgraphs

## [2.0.11] - 2026.04.24

### Added

- The swimlane graph performance report supports viewing the AICore end-to-end time
- The swimlane graph first-screen rendering performance is optimized
- The control flow and computation graph support reading precision tool data

## [2.0.10] - 2026.04.14

### Added

- The swimlane graph supports coloring by mix subgraphs
- The end-to-end swimlane graph optimizes the highlight logic, and the AICore node details mini-graph supports clicking to locate the kernel node

## [2.0.9] - 2026.03.31

### Added

- The swimlane graph supports pinning lanes to the top
- The swimlane graph adds an optimized display for the end-to-end swimlane graph (node coloring, dependency analysis, and so on)

## [2.0.8] - 2026.03.25

### Fixed

- This release fixes the issue where the swimlane graph cannot open the end-to-end swimlane graph

## [2.0.7] - 2026.03.17

### Added

- The swimlane graph performance report supports statistics of duration information by subgraph and semantic labels

## [2.0.6] - 2026.03.13

### Added

- The comparison computation graph displays error messages in separate columns, which prevents mutual interference
- The computation graph optimizes the forward and backward operations, supports keyboard shortcuts, and remembers the path within the same operation session
- The layout assistant plugin java-elk-extension updates to version 0.0.3, which supports arm architecture on Linux
- In three-column mode, the computation graph first screen automatically navigates to the executeGraph

### Fixed
- The plugin adds compatibility for two new operators in expression parsing

## [2.0.5] - 2026.02.28

### Added

- The swimlane graph performance report supports displaying the maximum scheduling gap and the longest and shortest duration nodes, and provides click-to-locate capability
- The run results list supports single and batch deletion
- The computation graph comparison page supports viewing details for non-difference nodes
- In three-column mode, the computation graph supports opening subgraphs in new tabs, and the pass drop-down list displays the graph type and name

## [2.0.4] - 2026.02.13

### Added

- The run configuration supports code completion and validation based on scheme rules
- The run results support automatic refresh and opening program.json
- The three-column mode supports selecting run results
- The plugin optimizes the download function of the computation graph and swimlane graph
- The computation graph optimizes the opening speed of program.json, and optimizes the styles of input, output, and Middle type nodes
- The swimlane graph optimizes the node text display

### Fixed

- The swimlane graph fixes the issue where node rectangles do not display when the zoom ratio is extremely large

## [2.0.3] - 2026.01.26

### Added

- When the user opens the computation graph search, the plugin supports configuring the display hierarchy
- The computation graph adds the Middle node type (which is both incast and outcast)
- The plugin supports visualization of AICPU type swimlane graphs
- The swimlane graph supports automatically obtaining the matching computation graph path
- The swimlane graph supports automatic snapping for small nodes
- The beginner guide supports user operations in the open area

## [2.0.2] - 2026.01.16

### Added

- The computation graph adds support for the layout acceleration plugin java-elk-extension, which can improve performance by 50%
- The swimlane graph supports image export, path locking, and searching by rootHash and leafHash
- In three-column mode, the computation graph supports returning to the original graph after drilling down
- The beginner guide supports stepping back and opening the three-column view
- The plugin adds visualization for PyPTO source project run configurations

## [2.0.1] - 2026.01.08

### Added

- The plugin optimizes the result output of the beginner guide when the user runs a Python file

## [2.0.0] - 2025.12.31

### Added

- The plugin adds a beginner guide feature
- The plugin adds a convenient toggle for the debug mode of the pypto.jit decorator
- The computation graph search mode supports full-graph search
- The three-column mode supports dynamic file selection, and the computation graph supports automatic drill-down when the user selects in the swimlane graph or clicks in the code

## [1.1.0] - 2025.12.18

### Added

- The computation graph diff comparison supports viewing node details
- The computation graph supports parsing logs to obtain error node information and highlight it in the graph
- The swimlane graph supports opening files up to 1GB
- The swimlane graph error prompts are optimized

## [1.0.3] - 2025.12.12

### Added

- In three-column mode, the swimlane graph colors nodes by semantic labels by default, and the computation graph supports automatic drill-down when the user locks a path
- The computation graph supports right-click to manually enable local search rendering
- The computation graph error prompts are optimized, and the plugin adds more prompts for blocking issues
- The swimlane graph adds a keyboard shortcuts page
- The swimlane graph supports horizontal canvas movement with a trackpad
- The plugin supports one-click closing of all pages opened by the plugin

## [1.0.2] - 2025.11.29

### Added

- The three-column mode supports layout position and size adjustment, and full-screen viewing
- The three-column mode highlight animation is optimized
- The computation graph diff comparison supports top and bottom layout
- The swimlane graph node dependencies support parsing from dyn_topo.txt
- The plugin adds a caching mechanism for the swimlane graph, which improves rendering efficiency by 20% to 50% when the user reopens it

## [1.0.1] - 2025.11.13

### Added

- The plugin adds a three-column linked view based on semantic labels

### Fixed

- The swimlane graph fixes the issue where distance measurement does not display on high-resolution screens
- The computation graph fixes the funcname not found issue in the root file

## [1.0.0] - 2025.11.06

### Added
- The plugin adds workflow control flow capabilities
- The computation graph supports hover display of full information after the nodes shrink
- The swimlane graph supports displaying the tensor list when the user hovers over a dependency line

### Fixed
- The swimlane graph fixes the issue where the measurement mode range does not sync with the canvas


## [0.1.12] - 2025.10.20

### Added

- The swimlane graph adds various statistical dimension information display capabilities (including PMU information)
- The swimlane graph adds free selection capability and statistical display capability for the selected range
- The computation graph supports local search and display when the user opens large data files
- The computation graph supports displaying the opened graph type

## [0.1.11] - 2025.09.29

### Added

- The computation graph adds comparison capabilities, which support file opening and automatic comparison graph discovery
- The computation graph node details display the specific mapping values of offset and shape
- The swimlane graph optimizes operation performance, and the zoom speed improves significantly for large data
- The swimlane graph adds clock cycle dimension measurement data

### Fixed

- The computation graph fixes the incorrect search range when the user switches layouts
- The swimlane graph fixes the issue where the graph freezes when the user zooms in to a certain size

## [0.1.10] - 2025.09.18

### Added

- The plugin officially upgrades to PyPTO Toolkit, and the interface and icons receive a comprehensive upgrade
- The swimlane graph adds a time observation line
- The computation graph adds layer control capabilities (including OP-only display and top and bottom layout)
- The computation graph adds the capability to lock a specified path and view only the specified path

## [0.1.9] - 2025.09.04

### Fixed

- The swimlane graph manual distance measurement interaction is optimized
- This release fixes some UI detail issues in the computation graph and swimlane graph

## [0.1.8] - 2025.09.02

### Added

- The swimlane graph supports time measurement mode
- The swimlane graph adapts to the light theme

### Fixed

- The computation graph and swimlane graph fix some detail issues
- When the swimlane graph navigates to the computation graph, it opens the program.json in the current directory by default

## [0.1.7] - 2025.8.30

## Added

- The computation graph and swimlane graph entries merge into one
- The computation graph health report supports node navigation
- The computation graph adds full-graph search capability
- The swimlane graph adds the capability to navigate to dump tensors
- The plugin adds old version detection

## Fixed

- The computation graph fixes the issue where the association is lost after the user selects a node in the standalone view

## [0.1.6] - 2025.8.27

- The computation graph supports custom node display fields
- The computation graph supports a navigation bar and fuzzy search, and the styles are optimized
- The computation graph adapts to the light theme
- The swimlane graph supports distance measurement and task search
- The swimlane graph rootHash and leafHash support navigation to the computation graph
- The swimlane graph line hierarchy supports configuration

## [0.1.2] - 2025.08.20

- The plugin adds basic computation graph and swimlane graph features
