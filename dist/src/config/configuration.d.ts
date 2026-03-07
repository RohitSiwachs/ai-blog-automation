declare const _default: () => {
    strapi: {
        baseUrl: string;
        apiToken: string;
        siteUrl: string;
    };
    gemini: {
        apiKey: string;
        model: string;
    };
    redis: {
        host: string;
        port: number;
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
