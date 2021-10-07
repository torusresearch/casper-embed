declare const _default: {
    errors: {
        disconnected: () => string;
        permanentlyDisconnected: () => string;
        sendSiteMetadata: () => string;
        unsupportedSync: (method: string) => string;
        invalidDuplexStream: () => string;
        invalidOptions: (maxEventListeners: number, shouldSendMetadata: boolean) => string;
        invalidRequestArgs: () => string;
        invalidRequestMethod: () => string;
        invalidRequestParams: () => string;
        invalidLoggerObject: () => string;
        invalidLoggerMethod: (method: string) => string;
    };
    info: {
        connected: (chainId: string) => string;
    };
    warnings: {};
};
export default _default;