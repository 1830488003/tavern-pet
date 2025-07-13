const https = require('https');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 目标文件夹
const GIF_DIR = path.join(__dirname, 'gif');
if (!fs.existsSync(GIF_DIR)) {
    fs.mkdirSync(GIF_DIR, { recursive: true });
}

// 基础URL和页面范围
const BASE_URL = 'https://www.aigei.com/lib/sticker/cartoon_expression_';
const START_PAGE = 1;
// 我们可以先尝试抓取几页，比如5页，来确保逻辑正确
const END_PAGE = 5;

let totalStickers = 0;

// 下载图片的函数
function downloadImage(url, folderPath, fileName) {
    const filePath = path.join(folderPath, fileName);
    if (fs.existsSync(filePath)) {
        // console.log(`文件已存在，跳过下载: ${fileName}`);
        return;
    }

    https
        .get(url, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filePath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    // console.log(`下载成功: ${fileName}`);
                });
            } else {
                console.error(
                    `下载失败，状态码: ${res.statusCode}, URL: ${url}`,
                );
            }
        })
        .on('error', (e) => {
            console.error(`下载时发生错误: ${e.message}`);
        });
}

// 获取并解析单个页面的函数
function getPage(page) {
    const url = `${BASE_URL}${page}`;
    https
        .get(url, (res) => {
            let html = '';
            res.on('data', (chunk) => (html += chunk));
            res.on('end', () => {
                console.log(`正在处理页面: ${url}`);
                const $ = cheerio.load(html);

                $('div[id^="item_"]').each((i, item) => {
                    const titleElement = $(item).find('.title a');
                    const title = titleElement
                        .text()
                        .trim()
                        .replace(/[\\/:*?"<>|]/g, '_');

                    if (!title) {
                        console.warn('找到一个没有标题的专辑，跳过...');
                        return;
                    }

                    const albumPath = path.join(GIF_DIR, title);
                    if (!fs.existsSync(albumPath)) {
                        fs.mkdirSync(albumPath, { recursive: true });
                    }

                    $(item)
                        .find('.content img, .album_pic img')
                        .each((j, img) => {
                            const imgUrl =
                                $(img).attr('data-src') || $(img).attr('src');
                            if (imgUrl) {
                                const fullUrl = new URL(
                                    imgUrl,
                                    'https://www.aigei.com',
                                ).href;
                                const fileName = `${j + 1}.gif`;
                                downloadImage(fullUrl, albumPath, fileName);
                                totalStickers++;
                            }
                        });
                });

                if (page === END_PAGE) {
                    console.log('----------------------------------------');
                    console.log(`所有页面处理完毕！开始下载... (请稍候)`);
                    console.log(`预计将下载 ${totalStickers} 个表情包。`);
                    console.log('下载完成后，请检查 tavern-pet/gif/ 文件夹。');
                }
            });
        })
        .on('error', (e) => {
            console.error(`获取页面 ${url} 时出错: ${e.message}`);
        });
}

// 开始执行
console.log(`开始从 aigei.com 抓取表情包...`);
console.log(`目标页面范围: ${START_PAGE} 到 ${END_PAGE}`);
console.log('----------------------------------------');

for (let i = START_PAGE; i <= END_PAGE; i++) {
    getPage(i);
}
