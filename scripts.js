// 配置 API URL - 部署時需修改為實際的 RunPod Serverless API 端點
const API_BASE_URL = 'http://localhost:7860';  // 本地開發時使用

// RunPod API 配置
const RUNPOD_CONFIG = {
    endpoint: "https://api.runpod.ai/v2/2xi4wl5mf51083",
    apiKey: "rpa_UYWYGDW24QRLJ7EEMCU0ZHPDH9F886AWNE1ZT1QSa5a5bt"
};

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
        // 檢查 API 是否可用
        const response = await fetch(`${API_BASE_URL}/`);
        if (!response.ok) {
            showNotification('無法連接到 API 服務', 'error');
        }
    } catch (error) {
        console.error('API 連接錯誤:', error);
        showNotification('API 服務暫時不可用，請稍後再試', 'error');
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

// 修改 transcribeAudio 函數以處理不同類型的輸入
async function transcribeAudio(audioData, modelType) {
    try {
        const requestBody = {
            input: {
                model: modelType,
                language: "auto",
                timestamps: timestampCheckbox.checked
            }
        };

        // 根據輸入類型設置請求內容
        if (audioData.type === 'url') {
            requestBody.input.link = audioData.content;
        } else {
            requestBody.input.audio = audioData.content;
            requestBody.input.filename = audioData.filename;
        }

        const response = await fetch(`${RUNPOD_CONFIG.endpoint}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RUNPOD_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { id: taskId } = await response.json();
        return await pollResult(taskId);
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }
}

// 輪詢結果函數
async function pollResult(taskId) {
    const maxAttempts = 100;
    const interval = 2000; // 2秒
    let attempts = 0;

    while (attempts < maxAttempts) {
        const response = await fetch(`${RUNPOD_CONFIG.endpoint}/status/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${RUNPOD_CONFIG.apiKey}`
            }
        });

        const result = await response.json();

        if (result.status === 'COMPLETED') {
            return result.output;
        } else if (result.status === 'FAILED') {
            throw new Error('Transcription failed');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Polling timeout');
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
        
        const response = await fetch(`${API_BASE_URL}/api/download`, {
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
    const youtubeUrl = document.getElementById('youtube-url').value;
    if (!youtubeUrl) {
        showMessage('請輸入YouTube連結', 'error');
        return;
    }

    showMessage('處理中...請稍候', 'info');
    setLoading(true);

    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                input: {
                    link: youtubeUrl,
                    model: getSelectedModel(),
                    timestamps: document.getElementById('enable-timestamps').checked
                }
            })
        });

        const data = await response.json();
        
        // 檢查是否有任務ID並開始輪詢結果
        if (data.id) {
            pollRunpodResult(data.id);
        } else {
            setLoading(false);
            showMessage('轉譯請求失敗', 'error');
        }
    } catch (error) {
        console.error('API請求錯誤:', error);
        setLoading(false);
        showMessage(`轉譯失敗: ${error.message}`, 'error');
    }
}

// 輪詢RunPod結果
async function pollRunpodResult(jobId) {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/status/${jobId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });

        const data = await response.json();
        
        if (data.status === 'COMPLETED') {
            // 處理成功結果
            const result = data.output;
            displayTranscription(result.transcription);
            displayPerformanceData(result.performance);
            setLoading(false);
        } else if (data.status === 'FAILED') {
            // 處理失敗
            setLoading(false);
            showMessage(`轉譯失敗: ${data.error || '未知錯誤'}`, 'error');
        } else {
            // 繼續輪詢
            setTimeout(() => pollRunpodResult(jobId), 2000);
        }
    } catch (error) {
        console.error('輪詢結果錯誤:', error);
        setLoading(false);
        showMessage(`獲取結果失敗: ${error.message}`, 'error');
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