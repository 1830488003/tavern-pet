// @ts-check
const fs = require('fs/promises');
const path = require('path');

/**
 * 该脚本用于扫描 `gif/url` 目录下的所有 .txt 文件，
 * 并将它们整合成一个统一的 `pets.json` 文件。
 * 
 * 每个 .txt 文件代表一个宠物，文件名即为宠物名。
 * 文件内容为该宠物的多个GIF/PNG图片链接，每个链接占一行。
 * 
 * 生成的 JSON 格式如下：
 * {
 *   "宠物名1": [ "url1", "url2", ... ],
 *   "宠物名2": [ "url1", "url2", ... ],
 *   ...
 * }
 */
async function generatePetsJson() {
    // 定义源目录和输出文件路径
    const urlDir = path.join(__dirname, 'gif', 'url');
    const outputFile = path.join(__dirname, 'gif', 'pets.json');
    
    // 用于存储所有宠物数据
    const petsData = {};

    try {
        // 1. 读取 `gif/url` 目录下的所有文件名
        const files = await fs.readdir(urlDir);
        console.log(`发现 ${files.length} 个文件，开始处理...`);

        // 2. 遍历每个文件
        for (const file of files) {
            // 只处理 .txt 文件
            if (path.extname(file) !== '.txt') {
                console.log(`跳过非 .txt 文件: ${file}`);
                continue;
            }

            // 提取宠物名（去掉.txt后缀）
            const petName = path.basename(file, '.txt');
            const filePath = path.join(urlDir, file);

            // 3. 读取文件内容
            const content = await fs.readFile(filePath, 'utf-8');
            
            // 4. 解析URL列表
            const urls = content
                .split(/\r?\n/) // 按行分割
                .map(line => line.trim()) // 去除每行首尾的空白
                .filter(line => line.startsWith('http')) // 只保留有效的URL行
                // 使用 Set 去除重复的URL
                .filter((url, index, self) => self.indexOf(url) === index); 

            // 如果该文件有有效的URL，则添加到数据对象中
            if (urls.length > 0) {
                petsData[petName] = urls;
                console.log(`处理成功: ${petName} (${urls.length} 个姿态)`);
            } else {
                console.warn(`警告: ${file} 文件中未找到有效URL。`);
            }
        }

        // 5. 将整合后的数据写入 `pets.json`
        await fs.writeFile(outputFile, JSON.stringify(petsData, null, 4));
        console.log(`\n成功生成 pets.json 文件，路径: ${outputFile}`);
        console.log(`共处理了 ${Object.keys(petsData).length} 个宠物。`);

    } catch (error) {
        console.error('生成 pets.json 时发生错误:', error);
    }
}

// 执行脚本
generatePetsJson();
