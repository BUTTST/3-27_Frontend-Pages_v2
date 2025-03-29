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

// 執行轉譯按鈕點擊事件
transcribeButton.addEventListener('click', async () => {
    try {
        // 顯示載入中覆蓋層
        loadingOverlay.style.display = 'flex';
        document.getElementById('output-text').value = "";
        
        // 設置處理中的提示文字
        outputText.value = "準備處理您的請求...";
        
        const audioData = await getAudioData();
        const modelType = modelSelect.value;
        
        outputText.value = "連接API服務...";
        
        console.log('使用的API配置:', {
            baseUrl: API_CONFIG.baseUrl,
            apiKeyExists: !!API_CONFIG.apiKey
        });
        
        const result = await transcribeAudio(audioData, modelType);
        
        outputText.value = result.text;
        updatePerformanceMetrics(result.metrics);
        
        // 顯示成功通知
        showNotification('轉譯完成！', 'success');
    } catch (error) {
        const errorMessage = handleApiError(error, '轉錄過程');
        showNotification('轉錄失敗', 'error');
        outputText.value = errorMessage;
    } finally {
        loadingOverlay.style.display = 'none';
    }
});

// 增加專門處理YouTube影片的函數
function getYouTubeVideoId(url) {
    // 識別YouTube短片和標準URL的正則表達式
    const regExp = /^.*(?:youtu.be\/|v\/|shorts\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? match[1] : null;
}

// 更新 getAudioData 函數以正確處理 YouTube 連結
async function getAudioData() {
    const link = linkInput.value.trim();
    if (link) {
        // YouTube 連結處理
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            const videoId = getYouTubeVideoId(link);
            if (videoId) {
                console.log('檢測到YouTube視頻，ID:', videoId);
                
                // 確保使用完整 URL 格式
                const fullUrl = link.includes('shorts') 
                    ? `https://www.youtube.com/shorts/${videoId}`
                    : `https://www.youtube.com/watch?v=${videoId}`;
                
                console.log('處理YouTube視頻URL:', fullUrl);
                return fullUrl;
            }
        }
        return link;
    }

    // 檢查是否有文件輸入
    const file = fileInput.files[0];
    if (file) {
        // 暫時不支持文件上傳
        throw new Error('目前僅支持網址轉譯，檔案上傳功能即將推出');
    }

    throw new Error('請提供影片連結');
}

// 修改 transcribeAudio 函數以符合RunPod API格式要求
async function transcribeAudio(audioData, modelType) {
    try {
        // 檢查是否已設置API金鑰
        if (!API_CONFIG.apiKey) {
            throw new Error('未設置API金鑰，請先設置API金鑰');
        }

        console.log('發送請求到:', API_CONFIG.baseUrl);
        console.log('使用模型:', modelType);
        
        // 嘗試匹配後端handler函數期望的格式
        const requestData = {
            input: {
                link: audioData,              // 使用link而非source_url
                model: modelType,
                timestamps: timestampCheckbox.checked
            }
        };
        
        console.log('請求資料:', JSON.stringify(requestData, null, 2));
        
        // 設置正確的請求格式
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestData)
        });

        // 顯示詳細的請求與響應信息
        console.log('HTTP狀態碼:', response.status);
        console.log('回應頭:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            let errorMessage = `API錯誤: ${response.status}`;
            try {
                const errorData = await response.text();
                console.error('API錯誤詳情:', errorData);
                errorMessage += ` - ${errorData}`;
            } catch (e) {
                console.error('無法解析錯誤詳情');
            }
            throw new Error(errorMessage);
        }

        // 解析響應
        const data = await response.json();
        console.log('收到回應:', data);
        
        // 處理異步任務
        if (data.id) {
            document.getElementById('output-text').value = "正在處理音訊，請稍候...";
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

// 更新性能指標
function updatePerformanceMetrics(metrics) {
    if (metrics) {
        totalTimeDisplay.textContent = `總時間: ${metrics.total_time.toFixed(2)}秒`;
        wordCountDisplay.textContent = `字數: ${metrics.word_count}`;
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