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

// 設置默認API配置，適用於生產環境
// 注意：此文件將被提交到GitHub，不要包含真實的API金鑰
const API_CONFIG = {
    // 生產環境使用RunPod的端點
    baseUrl: 'https://api.runpod.ai/v2/2xi4wl5mf51083/run',
    
    // 改用更安全的API金鑰存取方式
    get apiKey() {
        const key = localStorage.getItem('temp_api_key');
        if (!key) {
            console.warn('API金鑰未設置');
            return '';
        }
        return key;
    }
};

// 檢測是否在本地開發環境，並嘗試加載本地配置
(function loadLocalConfig() {
    // 檢查是否在本地開發環境（localhost或127.0.0.1）
    const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        // 嘗試動態加載本地配置（僅用於開發環境）
        const script = document.createElement('script');
        script.src = 'config.local.js';
        script.onerror = () => console.warn('未找到本地配置，使用默認配置');
        document.head.appendChild(script);
    }
})();

// 將配置導出用於其他模塊
export { API_CONFIG }; 