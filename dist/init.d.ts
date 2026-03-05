export interface InitOptions {
    crmRoot: string;
    templates: string[];
    customTemplatePath: string | undefined;
    configPath: string;
}
export declare function runInitNonInteractive(opts: InitOptions): void;
export declare function runInit(): Promise<void>;
