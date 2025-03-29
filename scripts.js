// 移除此重複定義
// const API_CONFIG = {
//     baseUrl: 'http://localhost:7860' // 開發環境，部署時修改
// };

// 改為從config.js導入
import { API_CONFIG } from './config.js';

// 移除所有RunPod直接配置
// 所有API呼叫透過我們的後端進行，不再直接呼叫RunPod API

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

// 初始化
(async function init() {
    try {
        // 準備請求頭
        const headers = {};
        if (API_CONFIG.apiKey) {
            headers['Authorization'] = `Bearer ${API_CONFIG.apiKey}`;
        }
        
        // 檢查API是否可用
        const response = await fetch(`${API_CONFIG.baseUrl}/`, {
            headers: headers
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API服務錯誤: ${response.status}`);
        }
    } catch (error) {
        console.error('API連接錯誤:', error);
        showNotification('API服務暫時不可用，請稍後再試', 'error');
    }
})();

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

// 執行轉譯按鈕點擊事件
transcribeButton.addEventListener('click', async () => {
    try {
        loadingOverlay.style.display = 'flex';
        
        const audioData = await getAudioData(); // 獲取音頻數據
        const modelType = modelSelect.value;
        
        const result = await transcribeAudio(audioData, modelType);
        
        outputText.value = result.text;
        updatePerformanceMetrics(result.metrics);
    } catch (error) {
        showNotification('轉錄失敗：' + error.message, 'error');
    } finally {
        loadingOverlay.style.display = 'none';
    }
});

// 獲取音頻數據的函數
async function getAudioData() {
    // 檢查是否有 URL 輸入
    const link = linkInput.value.trim();
    if (link) {
        return {
            type: 'url',
            content: link
        };
    }

    // 檢查是否有文件輸入
    const file = fileInput.files[0];
    if (file) {
        // 將文件轉換為 base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    type: 'file',
                    content: e.target.result.split(',')[1], // 獲取 base64 內容
                    filename: file.name
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    throw new Error('請提供影片連結或上傳音頻文件');
}

// 修改 transcribeAudio 函數以符合RunPod API格式要求
async function transcribeAudio(audioData, modelType) {
    try {
        // 檢查是否已設置API金鑰
        if (!API_CONFIG.apiKey) {
            throw new Error('未設置API金鑰，請先前往admin.html頁面設置');
        }

        // 設置正確的請求格式
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                input: {  // 添加input包裹層
                    url: audioData.content,  // 正確獲取URL內容
                    model: modelType,
                    timestamps: timestampCheckbox.checked
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API錯誤: ${response.status}`);
        }

        // 解析響應
        const data = await response.json();
        
        // 處理異步任務
        if (data.id) {
            console.log(`任務已提交，ID: ${data.id}`);
            return await pollResult(data.id);
        }
        
        return data;
    } catch (error) {
        console.error('轉譯請求失敗:', error);
        throw error;
    }
}

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

// 顯示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
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

// 更新輪詢函數使用正確的URL格式
async function pollResult(jobId) {
    try {
        // 修正URL格式：使用RunPod的標準格式
        const statusUrl = `${API_CONFIG.baseUrl.replace('/run', '')}/status/${jobId}`;
        
        console.log(`輪詢任務狀態: ${statusUrl}`);
        
        const response = await fetch(statusUrl, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`狀態查詢失敗: ${response.status}`);
        }
        
        // 處理響應數據
        const data = await response.json();
        
        if (data.status === 'COMPLETED') {
            console.log('轉譯任務完成');
            // 處理成功結果
            return {
                text: data.output.transcription || data.output || "無轉譯結果",
                metrics: data.output.performance || { total_time: 0, word_count: 0 }
            };
        } else if (data.status === 'FAILED') {
            // 處理失敗
            throw new Error(data.error || '轉錄失敗');
        } else {
            // 繼續輪詢 (等待2秒)
            console.log(`任務狀態: ${data.status}，繼續等待...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return pollResult(jobId);
        }
    } catch (error) {
        console.error('輪詢結果錯誤:', error);
        throw error;
    }
}

// 更新性能指標
function updatePerformanceMetrics(metrics) {
    if (metrics) {
        totalTimeDisplay.textContent = `總時間: ${metrics.total_time.toFixed(2)}秒`;
        wordCountDisplay.textContent = `字數: ${metrics.word_count}`;
    }
}

// ... 其他現有代碼 ... 

document.addEventListener('DOMContentLoaded', function() {
    // 檢查API金鑰是否已設置
    const apiKey = localStorage.getItem('temp_api_key');
    const apiKeyNotice = document.getElementById('api-key-notice');
    
    if (!apiKey) {
        console.warn('API金鑰未設置');
        apiKeyNotice.style.display = 'block';
    } else {
        apiKeyNotice.style.display = 'none';
    }
}); 