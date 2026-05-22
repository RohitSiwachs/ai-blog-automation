declare const _default: () => {
    strapi: {
        baseUrl: string;
        apiToken: string;
        siteUrl: string;
        bypassMode: boolean;
    };
    aiProvider: string;
    gemini: {
        apiKey: string;
        model: string;
    };
    nvidia: {
        apiKey: string;
        imageApiKey: string;
        model: string;
        chatEndpoint: string;
        imageEndpoint: string;
    };
    redis: {
        enabled: string;
        host: string;
        port: number;
        password: string | undefined;
        tls: boolean;
    };
    database: {
        url: string;
    };
    scheduler: {
        dailyCron: string;
        postsPerDay: number;
    };
    brand: {
        name: string;
    };
};
export default _default;
