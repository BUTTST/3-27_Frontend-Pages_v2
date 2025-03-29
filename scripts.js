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
        showNotification('轉錄失敗：' + error.message, 'error');
        outputText.value = `處理過程中出錯：${error.message}\n\n請檢查網址是否有效，或稍後再試。`;
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

// 在getAudioData函數中專門處理YouTube連結
async function getAudioData() {
    const link = linkInput.value.trim();
    if (link) {
        // 檢查是否為YouTube連結
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            const videoId = getYouTubeVideoId(link);
            if (videoId) {
                console.log('檢測到YouTube視頻，ID:', videoId);
                // 可以選擇直接返回視頻ID或完整URL
                return link; // 或考慮 return `https://www.youtube.com/watch?v=${videoId}`;
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
        
        const requestData = {
            input: {
                source_url: audioData,
                model: modelType,
                language: "auto",
                task: "transcribe",
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

        // 完整記錄回應資訊
        console.log('回應狀態:', response.status);
        
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

// 更新輪詢函數使用正確的URL格式
async function pollResult(jobId, retryCount = 0) {
    // 最多嘗試30次，每次間隔3秒，總計最多等待90秒
    if (retryCount >= 30) {
        throw new Error('等待任務完成超時，請稍後再試');
    }
    
    try {
        // 在輪詢前增加輔助函數，用於檢查RunPod端點狀態
        async function checkRunPodEndpointStatus() {
            try {
                const response = await fetch(`https://api.runpod.ai/v2/2xi4wl5mf51083/health`, {
                    headers: {
                        'Authorization': `Bearer ${API_CONFIG.apiKey}`
                    }
                });
                const data = await response.json();
                console.log('RunPod端點狀態:', data);
                return data;
            } catch (error) {
                console.error('無法檢查RunPod端點狀態:', error);
                return null;
            }
        }

        // 在第一次輪詢前調用此函數
        if (retryCount === 0) {
            console.log('檢查RunPod端點狀態...');
            const status = await checkRunPodEndpointStatus();
            if (status && !status.ready) {
                console.warn('RunPod端點未就緒，這可能導致任務處理延遲');
            }
        }

        // 更詳細的日誌
        console.log(`輪詢任務 #${retryCount+1}: ${jobId}`);
        document.getElementById('output-text').value = `正在處理音訊，請稍候...\n\n任務ID: ${jobId}\n輪詢次數: ${retryCount+1}/30`;
        
        // 修正URL格式 - 這是關鍵修改
        const statusUrl = `https://api.runpod.ai/v2/2xi4wl5mf51083/status/${jobId}`;
        
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
        console.log("輪詢結果:", data);
        
        if (data.status === 'COMPLETED') {
            console.log('轉譯任務完成，完整回應:', data);
            
            // 更好的結果處理邏輯
            let resultText = "無轉譯結果";
            let metrics = { total_time: 0, word_count: 0 };
            
            // 處理各種可能的回應格式
            if (data.output) {
                if (typeof data.output === 'object') {
                    if (data.output.transcription) {
                        resultText = data.output.transcription;
                    } else if (data.output.text) {
                        resultText = data.output.text;
                    } else if (data.output.result) {
                        resultText = data.output.result;
                    }
                    
                    // 處理指標
                    if (data.output.metrics) {
                        metrics = data.output.metrics;
                    }
                } else if (typeof data.output === 'string') {
                    resultText = data.output;
                }
            }
            
            return {
                text: resultText,
                metrics: metrics
            };
        } else if (data.status === 'FAILED') {
            throw new Error(data.error || '轉錄失敗');
        } else if (data.status === 'IN_QUEUE' && retryCount > 10) {
            console.warn(`任務長時間在隊列中(${retryCount}次輪詢)，嘗試重新取得狀態...`);
            
            // 給使用者更新進度
            document.getElementById('output-text').value = 
                "任務在處理隊列中等待時間較長...\n" +
                "這可能是因為RunPod伺服器較忙，請耐心等待。\n\n" +
                `任務ID: ${jobId}\n輪詢次數: ${retryCount+1}/30\n\n` +
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

// ... 其他現有代碼 ... 

// 簡化初始化過程，不進行API檢查
(function init() {
    console.log('應用初始化中...');
    // 僅顯示API鑰匙狀態
    const apiKey = localStorage.getItem('temp_api_key');
    console.log('API金鑰狀態:', apiKey ? '已設置' : '未設置');
})(); 