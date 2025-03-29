// 移除此重複定義
// const API_CONFIG = {
//     baseUrl: 'http://localhost:7860' // 開發環境，部署時修改
// };

// 直接使用全局的API_CONFIG變量

// DOM 元素
const linkInput = document.getElementById('link-input');
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const modelSelect = document.getElementById('model-select');
const timestampCheckbox = document.getElementById('timestamp-checkbox');
const transcribeButton = document.getElementById('transcribe-button');
const outputText = document.getElementById('output-text');
const performanceBox = document.getElementById('performance-box');
const totalTimeDisplay = document.getElementById('total-time');
const wordCountDisplay = document.getElementById('word-count');
const copyButton = document.getElementById('copy-button');
const txtButton = document.getElementById('txt-button');
const srtButton = document.getElementById('srt-button');
const vttButton = document.getElementById('vtt-button');
const loadingOverlay = document.getElementById('loading-overlay');
const notification = document.getElementById('notification');
const uploadToggle = document.querySelector('.upload-toggle');
const uploadContainer = document.querySelector('.upload-container');

// 全局變數
let currentTranscription = '';
let hasTimestamps = false;

// 切換上傳區域顯示/隱藏
uploadToggle.addEventListener('click', () => {
    uploadContainer.classList.toggle('hidden');
    const icon = uploadToggle.querySelector('i');
    if (uploadContainer.classList.contains('hidden')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
});

// 更新文件名顯示
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileName.textContent = fileInput.files[0].name;
        // 清空連結輸入
        linkInput.value = '';
    } else {
        fileName.textContent = '選擇檔案';
    }
});

// 轉譯主控制器
const TranscriptionController = {
    // 初始化函數
    init() {
        console.log('初始化轉譯控制器...');
        
        // 檢查API配置
        const apiKey = localStorage.getItem('temp_api_key');
        console.log('API金鑰狀態:', apiKey ? '已設置' : '未設置');
        
        // 自動檢查API服務健康狀態
        this.checkApiHealth();
        
        // 綁定界面事件
        this.bindUIEvents();
    },
    
    // 檢查API健康狀態
    async checkApiHealth() {
        try {
            const status = await ApiService.checkHealth();
            if (status && status.ready) {
                console.log('✅ API服務正常運行');
                this.showNotification('API服務連接正常', 'success');
            } else {
                console.warn('⚠️ API服務可能不可用');
                this.showNotification('API服務可能不可用，請檢查設置', 'warning');
            }
        } catch (error) {
            console.error('API健康檢查失敗:', error);
            this.showNotification('無法連接到API服務', 'error');
        }
    },
    
    // 綁定UI事件
    bindUIEvents() {
        // 轉譯按鈕事件
        document.getElementById('transcribe-button').addEventListener('click', async () => {
            this.startTranscription();
        });
        
        // 其他UI事件...
    },
    
    // 開始轉譯流程
    async startTranscription() {
        const loadingOverlay = document.getElementById('loading-overlay');
        const outputText = document.getElementById('output-text');
        
        try {
            // 顯示載入中
            loadingOverlay.style.display = 'flex';
            outputText.value = "準備處理您的請求...";
            
            // 1. 獲取輸入數據
            const link = await this.getInputLink();
            const modelType = document.getElementById('model-select').value;
            const useTimestamps = document.getElementById('timestamp-checkbox').checked;
            
            outputText.value = "連接API服務...";
            
            // 2. 提交轉譯任務
            console.log('開始轉譯:', { link, modelType, useTimestamps });
            const jobResponse = await ApiService.submitTranscriptionJob(link, modelType, useTimestamps);
            
            // 3. 輪詢任務結果
            outputText.value = "正在處理音訊，請稍候...\n\n任務ID: " + jobResponse.id;
            
            const result = await JobPoller.pollJobStatus(jobResponse.id, {
                onProgress: (data) => {
                    if (data.status === 'polling') {
                        outputText.value = `正在處理音訊，請稍候...\n\n任務ID: ${jobResponse.id}\n輪詢次數: ${data.attempt}/${data.maxAttempts}`;
                    }
                }
            });
            
            // 4. 顯示結果
        outputText.value = result.text;
            this.updatePerformanceMetrics(result.metrics);
            
            // 保存當前轉譯結果
            this.currentTranscription = result.text;
            this.hasTimestamps = useTimestamps;
            
            // 顯示成功通知
            this.showNotification('轉譯完成！', 'success');
    } catch (error) {
            console.error('轉譯過程失敗:', error);
            outputText.value = this.formatErrorMessage(error);
            this.showNotification('轉譯失敗', 'error');
    } finally {
        loadingOverlay.style.display = 'none';
    }
    },
    
    // 獲取輸入連結
    async getInputLink() {
        const linkInput = document.getElementById('link-input');
    const link = linkInput.value.trim();
        
        if (!link) {
            throw new Error('請提供影片連結');
        }
        
        // 處理YouTube連結
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            return this.processYoutubeLink(link);
        }
        
        return link;
    },
    
    // 處理YouTube連結
    processYoutubeLink(link) {
        console.log('處理YouTube連結:', link);
        // 獲取YouTube ID (如果需要)
        return link;
    },
    
    // 更新性能指標
    updatePerformanceMetrics(metrics) {
        if (!metrics) return;
        
        try {
            const totalTimeDisplay = document.getElementById('total-time');
            const wordCountDisplay = document.getElementById('word-count');
            
            totalTimeDisplay.textContent = `總時間: ${metrics.total_time || 0}秒`;
            wordCountDisplay.textContent = `字數: ${metrics.word_count || 0}`;
        } catch (error) {
            console.error('更新性能指標錯誤:', error);
        }
    },
    
    // 顯示通知
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    },
    
    // 格式化錯誤消息
    formatErrorMessage(error) {
        const timestamp = new Date().toLocaleTimeString();
        let message = `操作失敗 [${timestamp}]\n${error.message}\n\n`;
        
        // 添加上下文相關的提示
        if (error.message.includes('API金鑰未設置')) {
            message += '請點擊"設置API金鑰"按鈕設置您的API金鑰。';
        } else if (error.message.includes('輪詢超時')) {
            message += '可能原因:\n';
            message += '1. 服務器處理負載較高\n';
            message += '2. 影片過長或格式不支持\n';
            message += '建議選擇較短的視頻再次嘗試。';
        } else if (error.message.includes('無法連接')) {
            message += '請檢查您的網絡連接或API服務是否可用。';
        }
        
        return message;
    }
};

// 複製按鈕點擊事件
copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(outputText.value)
        .then(() => {
            showNotification('文本已複製到剪貼板！');
        })
        .catch(err => {
            console.error('複製失敗:', err);
            showNotification('複製到剪貼板失敗', 'error');
        });
});

// 下載 TXT 格式
txtButton.addEventListener('click', () => {
    downloadTranscription('txt');
});

// 下載 SRT 格式
srtButton.addEventListener('click', () => {
    downloadTranscription('srt');
});

// 下載 VTT 格式
vttButton.addEventListener('click', () => {
    downloadTranscription('vtt');
});

// 下載轉譯內容
async function downloadTranscription(format) {
    try {
        loadingOverlay.classList.remove('hidden');
        
        const response = await fetch(`${API_CONFIG.baseUrl}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: currentTranscription,
                format: format,
                timestamps: hasTimestamps
            })
        });
        
        if (!response.ok) {
            throw new Error('下載檔案失敗');
        }
        
        // 創建一個 Blob 來保存檔案
        const blob = await response.blob();
        
        // 生成檔案名稱
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `whisper_transcription_${timestamp}.${format}`;
        
        // 創建下載連結並點擊
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`${format.toUpperCase()} 格式檔案下載成功`);
    } catch (error) {
        console.error('下載錯誤:', error);
        showNotification('下載檔案時發生錯誤', 'error');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// 啟用操作按鈕
function enableActionButtons() {
    copyButton.disabled = false;
    txtButton.disabled = false;
    srtButton.disabled = false;
    vttButton.disabled = false;
}

// 禁用操作按鈕
function disableActionButtons() {
    copyButton.disabled = true;
    txtButton.disabled = true;
    srtButton.disabled = true;
    vttButton.disabled = true;
}

// 連結輸入處理 - 清空文件選擇
linkInput.addEventListener('input', () => {
    if (linkInput.value.trim()) {
        fileInput.value = '';
        fileName.textContent = '選擇檔案';
    }
});

// 轉譯YouTube連結
async function transcribeYouTubeLink() {
    // ... 確保不使用API金鑰 ...
}

// 更新輪詢函數的錯誤和超時處理
async function pollResult(jobId, retryCount = 0) {
    // 最多嘗試45次，每次間隔增加
    if (retryCount >= 45) {
        throw new Error('等待任務完成超時，請稍後再試');
    }
    
    try {
        // 更詳細的日誌
        console.log(`輪詢任務 #${retryCount+1}: ${jobId}`);
        document.getElementById('output-text').value = `正在處理音訊，請稍候...\n\n任務ID: ${jobId}\n輪詢次數: ${retryCount+1}/45`;
        
        // 確保URL格式正確
        const statusUrl = `https://api.runpod.ai/v2/2xi4wl5mf51083/status/${jobId}`;
        console.log(`輪詢任務狀態: ${statusUrl}`);
        
        // 使用更完整的錯誤處理
        const response = await fetch(statusUrl, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });
        
        // 檢查HTTP錯誤
        if (!response.ok) {
            const responseText = await response.text();
            console.error(`狀態查詢失敗: HTTP ${response.status}`, responseText);
            throw new Error(`狀態查詢失敗: ${response.status} - ${responseText}`);
        }
        
        // 處理響應
        const data = await response.json();
        console.log(`第${retryCount+1}次輪詢結果:`, data);
        
        // 完成處理
        if (data.status === 'COMPLETED') {
            console.log('輸出數據結構:', JSON.stringify(data, null, 2));
            
            // 嚴格檢查輸出格式
            if (!data.output) {
                throw new Error('收到完成狀態但缺少output欄位');
            }
            
            // 根據可能的回應結構提取文本
            let resultText = "";
            let metrics = { total_time: 0, word_count: 0 };
            
            try {
                if (typeof data.output === 'string') {
                    resultText = data.output;
                } else if (typeof data.output === 'object') {
                    // 處理各種可能的輸出格式
                    if (data.output.text) {
                        resultText = data.output.text;
                    } else if (data.output.transcription) {
                        resultText = data.output.transcription;
                    } else if (data.output.data && data.output.data.text) {
                        resultText = data.output.data.text;
                    } else {
                        resultText = JSON.stringify(data.output);
                    }
                }
                
                return { text: resultText, metrics: metrics };
            } catch (extractError) {
                console.error('結果提取錯誤:', extractError);
                throw new Error(`無法解析轉錄結果: ${extractError.message}`);
            }
        } else if (data.status === 'FAILED') {
            throw new Error(data.error || '轉錄失敗');
        } else if (data.status === 'IN_QUEUE' && retryCount > 10) {
            console.warn(`任務長時間在隊列中(${retryCount}次輪詢)，嘗試重新取得狀態...`);
            
            // 給使用者更新進度
            document.getElementById('output-text').value = 
                "任務在處理隊列中等待時間較長...\n" +
                "這可能是因為RunPod伺服器較忙，請耐心等待。\n\n" +
                `任務ID: ${jobId}\n輪詢次數: ${retryCount+1}/45\n\n` +
                "如果等待超過5分鐘仍無回應，可以嘗試重新提交。";
            
            // 超過20次輪詢時，建議用戶重新嘗試
            if (retryCount > 20) {
                throw new Error("任務等待時間過長，請嘗試重新提交或選擇較短的影片");
            }
        } else {
            // 修改等待時間策略，根據輪詢次數動態調整
            const waitTime = Math.min(3000 + (retryCount * 500), 10000); // 從3秒開始，最多增加到10秒
            console.log(`任務狀態: ${data.status}，等待 ${waitTime/1000} 秒後再次檢查...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return pollResult(jobId, retryCount + 1);
        }
    } catch (error) {
        console.error('輪詢結果錯誤:', error);
        throw error;
    }
}

// 在scripts.js開頭添加測試函數
async function testRunPodConnection() {
    try {
        const response = await fetch(`https://api.runpod.ai/v2/2xi4wl5mf51083/health`, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });
        
        const data = await response.json();
        console.log('RunPod連接測試:', data);
        console.log('API金鑰長度:', API_CONFIG.apiKey?.length || 0);
        console.log('API端點:', API_CONFIG.baseUrl);
        return data;
    } catch (error) {
        console.error('連接測試失敗:', error);
        return null;
    }
}

// 在init函數中調用
(function init() {
    console.log('應用初始化中...');
    const apiKey = localStorage.getItem('temp_api_key');
    console.log('API金鑰狀態:', apiKey ? '已設置' : '未設置');
    
    // 添加自動連接測試
    testRunPodConnection().then(status => {
        if (status && status.ready) {
            console.log('✅ RunPod服務可用');
        } else {
            console.warn('⚠️ RunPod服務可能不可用，請檢查設置');
        }
    });
})();

// 更完善的錯誤處理函數
function handleApiError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorDetails = {
        timestamp,
        context,
        message: error.message,
        stack: error.stack
    };
    
    console.error('詳細錯誤信息:', JSON.stringify(errorDetails, null, 2));
    
    // 顯示更具描述性的錯誤訊息
    let userMessage = `操作失敗 [${timestamp}]\n`;
    
    if (error.message.includes('Cannot read properties')) {
        userMessage += '後端返回的資料格式不正確，可能是API版本不匹配。\n';
        userMessage += '建議檢查Docker映像版本與API請求格式是否一致。';
    } else if (error.message.includes('等待任務完成超時')) {
        userMessage += '任務處理時間過長。這可能是由於:\n';
        userMessage += '1. RunPod服務器負載過高\n';
        userMessage += '2. 輸入的媒體檔案過大\n';
        userMessage += '3. 請求格式不被後端識別\n';
        userMessage += '建議使用較短的YouTube片段再次嘗試。';
    }
    
    return userMessage;
}

// 添加重試與嘗試不同格式的功能
async function transcribeWithRetry(audioData, modelType, attempts = 0) {
    if (attempts >= 2) {
        throw new Error('多次嘗試後仍無法完成轉錄');
    }
    
    try {
        // 嘗試不同請求格式
        const formatOptions = [
            // 格式1
            {
                input: {
                    audio: audioData,
                    model: modelType,
                    language: "auto"
                }
            },
            // 格式2
            {
                input: {
                    source_url: audioData,
                    model_type: modelType,
                    language_code: "auto"
                }
            }
        ];
        
        const requestData = formatOptions[attempts];
        console.log(`嘗試格式 ${attempts+1}:`, JSON.stringify(requestData, null, 2));
        
        // 其他代碼保持不變...
    } catch (error) {
        // 重試其他格式
        console.warn(`格式 ${attempts+1} 失敗，嘗試其他格式...`);
        return transcribeWithRetry(audioData, modelType, attempts + 1);
    }
}

// 新增測試函數用於診斷
async function testDirectApiCall() {
    try {
        // 使用一個非常短的影片進行測試
        const testUrl = "https://www.youtube.com/shorts/JdUjciCnS6g";
        
        // 嘗試最小化的請求體
        const testRequest = {
            input: {
                source_url: testUrl,
                model: "tiny", // 最小的模型以便快速測試
                language: "auto"
            }
        };
        
        console.log('發送測試請求:', testRequest);
        
        // 發送請求
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify(testRequest)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API返回錯誤 ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('測試請求回應:', result);
        
        if (result.id) {
            console.log('測試任務已提交，開始輪詢...');
            
            // 手動輪詢一次
            const statusResponse = await fetch(`https://api.runpod.ai/v2/2xi4wl5mf51083/status/${result.id}`, {
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.apiKey}`
                }
            });
            
            const statusResult = await statusResponse.json();
            console.log('首次狀態檢查:', statusResult);
            
            return {
                success: true,
                message: `測試請求成功，任務ID: ${result.id}，狀態: ${statusResult.status}`
            };
        }
        
        return { 
            success: true, 
            message: '測試請求已發送，但未收到任務ID' 
        };
    } catch (error) {
        console.error('測試請求失敗:', error);
        return {
            success: false,
            message: `測試失敗: ${error.message}`
        };
    }
}

// 添加到scripts.js底部
async function testRunpodApi() {
    try {
        // 基本連接測試
        const healthResponse = await fetch(`https://api.runpod.ai/v2/2xi4wl5mf51083/health`, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });
        
        console.log('健康檢查狀態:', healthResponse.status);
        console.log('健康檢查結果:', await healthResponse.json());
        
        // 發送極簡測試請求
        const testResponse = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                input: {
                    link: "https://www.youtube.com/shorts/JdUjciCnS6g",
                    model: "tiny"
                }
            })
        });
        
        console.log('測試請求狀態:', testResponse.status);
        const result = await testResponse.json();
        console.log('測試請求結果:', result);
        
        if (result.id) {
            console.log('成功獲取任務ID，開始檢查任務狀態');
            
            // 等待3秒
            await new Promise(r => setTimeout(r, 3000));
            
            // 檢查任務狀態
            const statusResponse = await fetch(`https://api.runpod.ai/v2/2xi4wl5mf51083/status/${result.id}`, {
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.apiKey}`
                }
            });
            
            console.log('狀態檢查結果:', await statusResponse.json());
        }
        
        return "API測試完成，請檢查控制台日誌";
    } catch (error) {
        console.error('API測試失敗:', error);
        return `API測試失敗: ${error.message}`;
    }
}

// API服務模塊 - 集中管理所有API相關功能
const ApiService = {
    // 取得API配置
    config: {
        baseUrl: 'https://api.runpod.ai/v2/2xi4wl5mf51083/run',
        statusUrl: 'https://api.runpod.ai/v2/2xi4wl5mf51083/status',
        healthUrl: 'https://api.runpod.ai/v2/2xi4wl5mf51083/health',
        
        // 安全地獲取API金鑰
        get apiKey() {
            const key = localStorage.getItem('temp_api_key');
            if (!key) {
                console.warn('API金鑰未設置');
                return '';
            }
            return key;
        }
    },
    
    // 檢查API服務健康狀態
    async checkHealth() {
        console.log('檢查API服務健康狀態...');
        try {
            const response = await fetch(this.config.healthUrl, {
                headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
            });
            
            if (!response.ok) {
                throw new Error(`健康檢查失敗: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API健康狀態:', data);
            return data;
        } catch (error) {
            console.error('健康檢查錯誤:', error);
            throw error;
        }
    },
    
    // 修正後的提交轉譯任務函數
    async submitTranscriptionJob(link, modelType, useTimestamps) {
        console.log('提交轉譯任務...');
        
        // 檢查API金鑰
        if (!this.config.apiKey) {
            throw new Error('API金鑰未設置，請先設置API金鑰');
        }
        
        // 處理YouTube鏈接格式
        let processedLink = link;
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            // 使用invidious等替代服務前綴（如果需要）
            // processedLink = `https://yewtu.be/watch?v=${this.extractYouTubeID(link)}`;
            
            // 或者轉換為短鏈接格式（有時這種格式更容易處理）
            const videoId = this.extractYouTubeID(link);
            if (videoId) {
                processedLink = `https://youtu.be/${videoId}`;
                console.log('轉換為短鏈接格式:', processedLink);
            }
        }
        
        // 構建請求數據
        const requestData = {
            input: {
                link: processedLink,
                model: modelType,
                timestamps: useTimestamps
            }
        };
        
        console.log('請求數據:', JSON.stringify(requestData, null, 2));
        
        try {
            const response = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('API響應狀態:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API錯誤 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log('任務提交響應:', data);
            
            // 確認回應中包含任務ID
            if (!data.id) {
                throw new Error('API響應中缺少任務ID');
            }
            
            return data;
        } catch (error) {
            console.error('提交任務失敗:', error);
            throw error;
        }
    },
    
    // 獲取任務狀態
    async getJobStatus(jobId) {
        if (!jobId) {
            throw new Error('需要提供任務ID');
        }
        
        try {
            const statusUrl = `${this.config.statusUrl}/${jobId}`;
            console.log('檢查任務狀態:', statusUrl);
            
            const response = await fetch(statusUrl, {
                headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`狀態檢查失敗 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`任務 ${jobId} 狀態:`, data);
            return data;
        } catch (error) {
            console.error(`檢查任務 ${jobId} 狀態失敗:`, error);
            throw error;
        }
    },
    
    // 抽取YouTube視頻ID的輔助函數
    extractYouTubeID(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }
};

// 任務輪詢模塊 - 處理長時間運行的任務
const JobPoller = {
    // 輪詢任務狀態，使用指數退避策略
    async pollJobStatus(jobId, options = {}) {
        const defaults = {
            maxRetries: 45,                    // 最大重試次數  
            initialInterval: 3000,             // 初始間隔(毫秒)
            maxInterval: 15000,                // 最大間隔(毫秒)
            backoffFactor: 1.5,                // 退避因子
            onProgress: (status, attempt) => {} // 進度回調函數
        };
        
        const config = { ...defaults, ...options };
        let attempt = 0;
        let interval = config.initialInterval;
        
        while (attempt < config.maxRetries) {
            attempt++;
            
            try {
                // 回調函數更新進度
                config.onProgress({ status: 'polling', attempt, maxAttempts: config.maxRetries });
                
                // 獲取任務狀態
                const jobStatus = await ApiService.getJobStatus(jobId);
                
                // 根據任務狀態處理
                if (jobStatus.status === 'COMPLETED') {
                    console.log('任務完成:', jobStatus);
                    return this.processCompletedJob(jobStatus);
                } else if (jobStatus.status === 'FAILED') {
                    console.error('任務失敗:', jobStatus);
                    throw new Error(jobStatus.error || '任務處理失敗');
                } else if (jobStatus.status === 'IN_QUEUE') {
                    if (attempt > 10) {
                        console.warn(`任務在隊列中等待較長時間 (${attempt}/${config.maxRetries})`);
                    }
                }
                
                // 計算下一次等待時間
                interval = Math.min(interval * config.backoffFactor, config.maxInterval);
                console.log(`任務狀態: ${jobStatus.status}，等待 ${interval/1000} 秒後重試...`);
                
                // 等待下一次輪詢
                await new Promise(resolve => setTimeout(resolve, interval));
            } catch (error) {
                console.error(`輪詢第 ${attempt} 次失敗:`, error);
                
                // 特別處理YouTube錯誤
                if (error.message && (
                    error.message.includes('YouTube') || 
                    error.message.includes('HTTP Error 400') ||
                    error.message.includes('Precondition check failed')
                )) {
                    throw new Error(`無法下載YouTube視頻。可能原因：
1. 視頻可能被限制或需要登入
2. 視頻可能在您的地區不可用
3. YouTube可能檢測到自動下載

建議嘗試：
- 使用不同的視頻連結
- 使用較短的YouTube短片
- 如果您有本地音頻文件，嘗試直接上傳`);
                }
                
                // 短暫等待後重試
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // 超過重試次數
        throw new Error(`輪詢超時：任務 ${jobId} 在 ${config.maxRetries} 次嘗試後仍未完成`);
    },
    
    // 處理已完成的任務結果
    processCompletedJob(jobStatus) {
        // 確保輸出存在
        if (!jobStatus.output) {
            throw new Error('任務完成但缺少輸出數據');
        }
        
        // 解析輸出數據
        try {
            let transcription = '';
            let performance = {};
            
            // 處理各種可能的輸出格式
            if (typeof jobStatus.output === 'string') {
                transcription = jobStatus.output;
            } else if (typeof jobStatus.output === 'object') {
                // 處理標準格式
                transcription = jobStatus.output.transcription || 
                               jobStatus.output.text || 
                               JSON.stringify(jobStatus.output);
                
                // 提取性能指標
                performance = jobStatus.output.performance || 
                             jobStatus.output.metrics || 
                             {};
            }
            
            return {
                text: transcription,
                metrics: performance
            };
        } catch (error) {
            console.error('處理任務結果失敗:', error);
            throw new Error(`無法解析轉譯結果: ${error.message}`);
        }
    }
};

// 頁面加載時初始化應用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化轉譯控制器
    TranscriptionController.init();
    
    // 檢查是否在開發環境中，添加調試功能
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        initDebugTools();
    }
});

// 初始化調試工具
function initDebugTools() {
    console.log('初始化調試工具...');
    
    // 添加調試面板到頁面
    const debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    debugPanel.innerHTML = `
        <h3>調試工具</h3>
        <button id="test-health-btn">檢查API健康狀態</button>
        <button id="test-sample-btn">測試樣本視頻</button>
        <pre id="debug-output"></pre>
    `;
    document.body.appendChild(debugPanel);
    
    // 綁定調試按鈕事件
    document.getElementById('test-health-btn').addEventListener('click', async () => {
        const output = document.getElementById('debug-output');
        output.textContent = '檢查API健康狀態...';
        
        try {
            const status = await ApiService.checkHealth();
            output.textContent = JSON.stringify(status, null, 2);
        } catch (error) {
            output.textContent = `錯誤: ${error.message}`;
        }
    });
    
    document.getElementById('test-sample-btn').addEventListener('click', () => {
        document.getElementById('link-input').value = 'https://www.youtube.com/watch?v=JdUjciCnS6g';
        document.getElementById('model-select').value = 'tiny';
        document.getElementById('transcribe-button').click();
    });
}

// 全域錯誤處理
window.addEventListener('error', (event) => {
    console.error('全域錯誤:', event.error);
    
    // 向用戶顯示友好的錯誤消息
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = '發生意外錯誤，請刷新頁面重試';
        notification.className = 'notification error';
        notification.style.display = 'block';
    }
});

// 處理未捕獲的Promise錯誤
window.addEventListener('unhandledrejection', (event) => {
    console.error('未處理的Promise錯誤:', event.reason);
}); 