import {GetOutputRecordsRes} from "../../../../../../src/services/workspace";
import {ControlFlowFile, OutputDetail} from "../../../../../../src/types/workspace";

export interface DevUITreeNode extends GetOutputRecordsRes {
    id: string;
    label: string;
    type: 'dir' | 'file';
    date: string;
    expanded: boolean;
    isLeaf: boolean;  // 新增：标识是否为叶子节点（文件为true，文件夹为false）
    children?: DevUITreeChildrenNode[];

    selected?: boolean;
    checked?: boolean;

    disableSelect?: boolean;
    disableCheck?: boolean;
    disableToggle?: boolean;

}

export interface DevUITreeChildrenNode extends ControlFlowFile {
    id: string;
    label: string;
    expanded: boolean;
    isLeaf: boolean;  // 新增：标识是否为叶子节点（文件为true，文件夹为false）
    children?: DevUITreeChildrenNode[];
}