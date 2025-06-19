// 在浏览器开发者工具的控制台中运行此脚本

(function() {
    'use strict';

    console.log("开始执行最终版抓取脚本...");

    // 首先定义核心的抓取函数
    function performScrape(doc) {
        const albumItems = doc.querySelectorAll('div[id^="item_"]');
        
        if (albumItems.length === 0) {
            return null; // 如果找不到，返回null
        }

        const allStickers = [];
        albumItems.forEach(item => {
            const titleElement = item.querySelector('.title a');
            const title = titleElement ? titleElement.innerText.trim().replace(/[\\/:*?"<>|]/g, '_') : '未命名';

            const images = item.querySelectorAll('.content img, .album_pic img');
            const imageUrls = [];
            images.forEach(img => {
                const src = img.dataset.src || img.src;
                if (src) {
                    imageUrls.push(new URL(src, window.location.href).href);
                }
            });

            if (imageUrls.length > 0) {
                allStickers.push({ title, urls: imageUrls });
            }
        });
        return allStickers;
    }

    // 尝试在主文档中抓取
    let results = performScrape(document);

    // 如果在主文档中找不到，则检查所有iframe
    if (!results || results.length === 0) {
        console.log("在主文档中未找到内容，正在检查iframe...");
        const iframes = document.querySelectorAll('iframe');
        if (iframes.length > 0) {
            for (let i = 0; i < iframes.length; i++) {
                try {
                    const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                    results = performScrape(iframeDoc);
                    if (results && results.length > 0) {
                        console.log(`在第 ${i+1} 个 iframe 中找到了内容！`);
                        break; // 找到后就跳出循环
                    }
                } catch (e) {
                    console.warn(`无法访问第 ${i+1} 个 iframe 的内容，可能是跨域限制。`);
                }
            }
        } else {
            console.log("页面上没有找到iframe。");
        }
    }

    // 输出最终结果
    if (results && results.length > 0) {
        console.log(`成功提取到 ${results.length} 个表情包专辑！`);
        console.log("请复制下面的JSON内容：");
        console.log(JSON.stringify(results, null, 2));
    } else {
        console.log("执行了所有检查（包括iframe），但仍然未能提取到任何表情包。请确保页面已完全加载，或尝试手动滚动页面到底部再运行脚本。");
    }

})();
