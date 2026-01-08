import { defineAttributes, SqlStore, Store } from './store';

// swimgraph_parsed_info表
export interface swimGraphPasedInfoCache {
    filePath: string;
    lastChangeTime: string;
    dynTopoLastChangeTime: string;
    pmuLastChangeTime: string;
    infoPath: string;
}

const SWIM_GRAPH_PARSED_INFO_ATTRIBUTES = defineAttributes<swimGraphPasedInfoCache>({
    filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String },
    dynTopoLastChangeTime: { type: String },
    pmuLastChangeTime: { type: String },
    infoPath: { type: String },
});

let swimGraphPasedInfoStore: Store<swimGraphPasedInfoCache, 'filePath'>;

export function getSwimGraphParsedInfoStore() {
    if(!swimGraphPasedInfoStore) {
        swimGraphPasedInfoStore = new SqlStore('swim_graph_parsed_info', SWIM_GRAPH_PARSED_INFO_ATTRIBUTES);
    }
    return swimGraphPasedInfoStore;
}