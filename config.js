// 建立配置文件但不直接存放敏感信息
export const RUNPOD_CONFIG = {
    // 使用替代方案，不直接存放敏感金鑰
    apiKey: '您需要在運行時提供API金鑰',  // 將在後端或構建時處理
    endpoint: 'https://api.runpod.ai/v2/2xi4wl5mf51083'
};

// 如果使用打包工具如webpack，可以這樣處理
// export const RUNPOD_CONFIG = {
//     apiKey: process.env.RUNPOD_API_KEY,
//     endpoint: process.env.RUNPOD_ENDPOINT
// }; 

// 不使用export，讓變數可全域訪問
const API_CONFIG = {
    baseUrl: window.API_BASE_URL || 'http://localhost:7860'
}; 