let currentSelection = '';
let currentParagraph = '';

// 使用 MutationObserver 来监听 DOM 变化
let popupContainer = null;
let resultContainer = null;

// 添加一个标志来控制是否显示按钮
let isProcessingClick = false;
let isButtonClicked = false;

// 创建容器元素
function createContainers() {
    if (!popupContainer) {
        popupContainer = document.createElement('div');
        popupContainer.id = 'deepee-popup-container';
        document.body.appendChild(popupContainer);
    }
    if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.id = 'deepee-result-container';
        document.body.appendChild(resultContainer);
    }
}

// 创建选中文本后的弹出按钮
function createSelectionPopup(x, y, selectedText, contextText) {
    removeExistingPopup();

    const popup = document.createElement('div');
    popup.className = 'deepee-popup';
    popup.innerHTML = `<button id="deepee-btn">DeepEE</button>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    popup.dataset.selectedText = selectedText;
    popup.dataset.contextText = contextText;
    
    document.body.appendChild(popup);

    const deepeeBtn = document.getElementById('deepee-btn');
    deepeeBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isButtonClicked = true;
        removeExistingPopup();
        showResultWindow(selectedText, contextText);
    });
}

// 移除现有的DeepEE按钮
function removeExistingPopup() {
    const existingPopup = document.querySelector('.deepee-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
}

// 显示结果窗口
async function showResultWindow(selectedText, contextText) {
    const existingWindow = document.querySelector('.deepee-result-window');
    if (existingWindow) {
        existingWindow.remove();
    }

    const resultWindow = document.createElement('div');
    resultWindow.className = 'deepee-result-window';
    resultWindow.innerHTML = '<p>正在生成解释...</p>';
    document.body.appendChild(resultWindow);

    try {
        const reader = await callDeepSeekAPI(selectedText, contextText);
        resultWindow.innerHTML = ''; // 清空加载提示

        // 处理流式响应
        while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            
            // 解析返回的数据
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    if (data.choices && data.choices[0].delta.content) {
                        const content = data.choices[0].delta.content;
                        // 将换行符转换为 <br> 标签
                        const formattedContent = content.replace(/\n/g, '<br>');
                        resultWindow.innerHTML += formattedContent;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 处理选中文本事件
document.addEventListener('mouseup', (e) => {
    if (isButtonClicked) {
        isButtonClicked = false;
        return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
        // 获取选中文本所在的段落内容
        const range = selection.getRangeAt(0);
        const paragraph = range.commonAncestorContainer.nodeType === 1 
            ? range.commonAncestorContainer 
            : range.commonAncestorContainer.parentElement;
        const contextText = paragraph.textContent.trim();
        
        createSelectionPopup(e.pageX, e.pageY, selectedText, contextText);
    }
});

// 点击其他地方关闭所有弹窗
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.deepee-popup') && !e.target.closest('.deepee-result-window')) {
        removeExistingPopup();
        const resultWindow = document.querySelector('.deepee-result-window');
        if (resultWindow) resultWindow.remove();
    }
});

// 调用 DeepSeek API
async function callDeepSeekAPI(selectedText, contextText) {
    // 从存储中获取 API Key
    const apiKey = await new Promise((resolve) => {
        chrome.storage.sync.get(['apiKey'], function(result) {
            resolve(result.apiKey);
        });
    });

    if (!apiKey) {
        throw new Error('请先在插件设置中配置 API Key');
    }

    const prompt = `<select>\n${selectedText}\n</select>\n\n<context>\n${contextText}\n</context>`;
    
    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        "role": "system",
                        "content": "你是个英语老师，深入讲解选择部分的文本在上下文中的解释，从三个方面解释：\n1.选择部分的内容是词组吗\n2.它的原本含义是什么，在句子中我怎么理解它\n3.这句话怎么翻译 \n\n输出格式为文本输出"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error('API 请求失败，请检查 API Key 是否正确');
        }

        return response.body.getReader();
    } catch (error) {
        console.error('API调用错误:', error);
        throw error;
    }
}
