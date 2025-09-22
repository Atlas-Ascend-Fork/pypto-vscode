
interface GlobalConfig {
  readonly IS_USE_DB: boolean;
}

export const globalConfig: GlobalConfig = Object.freeze({
    IS_USE_DB:true
});