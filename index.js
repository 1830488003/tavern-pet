// 使用 jQuery 确保在 DOM 加载完毕后执行
jQuery(async () => {
    // 定义扩展名称和路径
    const extensionName = 'tavern-pet';
    const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

    // 在控制台打印消息，确认插件已加载
    console.log('酒馆宠物扩展已加载！');

    // --- 常量 ---
    const PET_BUTTON_ID = 'tavern-pet-button';
    const STORAGE_KEY_BUTTON_POS = 'tavern-pet-button-pos';
    const PLUGIN_ENABLED_KEY = 'tavern-pet-enabled';
    const PET_POPUP_ID = 'tavern-pet-popup';
    const STORAGE_KEY_PET_STATE = 'tavern-pet-state';
    const PETS_JSON_PATH = `${extensionFolderPath}/gif/pets.json`;

    // --- 全局状态 ---
    let allPetsData = {}; // 存储从 pets.json 加载的所有宠物数据
    let petState = {}; // 当前宠物的状态

    // --- 商店和物品定义 ---
    const shopItems = {
        food: {
            普通饼干: {
                price: 5,
                description: '恢复15点饥饿度',
                hunger: 15,
                unlockLevel: 1,
            },
            豪华大餐: {
                price: 20,
                description: '恢复60点饥饿度，10点心情',
                hunger: 60,
                happiness: 10,
                unlockLevel: 5,
            },
        },
        medicine: {
            药丸: {
                price: 30,
                description: '恢复全部健康值',
                health: 100,
                unlockLevel: 3,
            },
        },
        cleaning: {
            肥皂: {
                price: 15,
                description: '恢复全部清洁度',
                cleanliness: 100,
                unlockLevel: 2,
            },
        },
        toys: {
            小皮球: {
                price: 50,
                description: '增加30点心情',
                happiness: 30,
                unlockLevel: 4,
            },
        },
    };

    // --- (v11) 新增：等级经验配置 ---
    const levelUpConfig = {
        1: 100,
        2: 150,
        3: 220,
        4: 300,
        5: 450,
        6: 600,
        7: 800,
        8: 1000,
        9: 1250,
        10: 1500,
        // 后续等级可以用公式生成，这里先定义前10级
    };

    // --- (v10) 新增：挂机活动定义 ---
    const activityOptions = {
        work: {
            '勘探矿洞 (10分钟)': {
                duration: 10 * 60 * 1000,
                reward: { coins: 10, exp: 5 },
                cost: { hunger: 5, cleanliness: 2 },
                unlockLevel: 1,
            },
            '酒馆帮工 (30分钟)': {
                duration: 30 * 60 * 1000,
                reward: { coins: 35, exp: 20 },
                cost: { hunger: 15, cleanliness: 5 },
                unlockLevel: 2,
            },
            '商队护卫 (1小时)': {
                duration: 60 * 60 * 1000,
                reward: { coins: 80, exp: 50 },
                cost: { hunger: 25, cleanliness: 10 },
                unlockLevel: 4,
            },
            '遗迹寻宝 (4小时)': {
                duration: 4 * 60 * 60 * 1000,
                reward: { coins: 400, exp: 250 },
                cost: { hunger: 60, cleanliness: 30 },
                unlockLevel: 7,
            },
            '长期贸易 (8小时)': {
                duration: 8 * 60 * 60 * 1000,
                reward: { coins: 900, exp: 600 },
                cost: { hunger: 80, cleanliness: 50 },
                unlockLevel: 10,
            },
        },
    };

    let defaultPetState = {
        // 核心属性
        hunger: 80,
        happiness: 90,
        cleanliness: 70,
        health: 100,
        // 养成属性
        level: 1,
        exp: 0,
        // maxExp is now dynamic based on level
        // 经济系统
        coins: 50,
        inventory: {}, // { '普通饼干': 2, '肥皂': 1 }
        // 宠物身份
        petId: null, // 当前宠物的ID (即名字)
        poseIndex: 0, // 当前姿态的索引
        status: 'idle', // idle, working, sick, playing, hosting 等
        // (v10) 新增：持续性活动状态
        activity: {
            type: null, // e.g., 'work'
            name: null, // e.g., '勘探矿洞 (10分钟)'
            endTime: null, // 活动结束的时间戳
        },
        lastUpdate: Date.now(),
    };
    let isDragging = false;
    let hasMoved = false;
    let activityCountdownInterval = null; // (v11.1) 全局倒计时定时器

    // --- 函数定义 ---

    /**
     * 从服务器加载所有宠物的数据
     * @returns {Promise<boolean>} 是否加载成功
     */
    const loadAllPetsData = async () => {
        try {
            allPetsData = await $.getJSON(PETS_JSON_PATH);
            const petNames = Object.keys(allPetsData);
            if (petNames.length > 0) {
                // 如果默认的 petId 未设置或无效，则设置为第一个宠物
                if (
                    !defaultPetState.petId ||
                    !allPetsData[defaultPetState.petId]
                ) {
                    defaultPetState.petId = petNames[0];
                }
                console.log(`成功加载 ${petNames.length} 个宠物数据。`);
                return true;
            } else {
                console.error('酒馆宠物：pets.json 文件为空或格式不正确。');
                return false;
            }
        } catch (error) {
            console.error('酒馆宠物：加载 pets.json 失败！', error);
            $('body').append(
                '<div class="tavern-pet-error">无法加载宠物数据 (pets.json)</div>',
            );
            return false;
        }
    };

    /**
     * 使宠物按钮可拖动
     * @param {jQuery} $button - 要使其可拖动的按钮的jQuery对象
     */
    const makePetButtonDraggable = ($button) => {
        let offsetX, offsetY;

        const move = (e) => {
            if (!isDragging) return;

            // 检查移动距离，防止误触
            const moveX = e.pageX - offsetX;
            const moveY = e.pageY - offsetY;
            if (
                Math.abs(moveX - $button.offset().left) > 5 ||
                Math.abs(moveY - $button.offset().top) > 5
            ) {
                hasMoved = true;
            }

            $button.css({
                left: moveX,
                top: moveY,
                right: 'auto',
                bottom: 'auto',
            });
        };

        $button.on('mousedown', (e) => {
            isDragging = true;
            hasMoved = false;
            offsetX = e.pageX - $button.offset().left;
            offsetY = e.pageY - $button.offset().top;
            $(document).on('mousemove.pet', move);
        });

        $(document).on('mouseup.pet', () => {
            if (isDragging) {
                isDragging = false;
                $(document).off('mousemove.pet');
                // 拖动结束后保存位置
                if (hasMoved) {
                    localStorage.setItem(
                        STORAGE_KEY_BUTTON_POS,
                        JSON.stringify($button.position()),
                    );
                }
            }
        });
    };

    /**
     * 创建宠物按钮
     */
    const createPetButton = () => {
        if ($(`#${PET_BUTTON_ID}`).length > 0) {
            console.log('酒馆宠物：按钮已存在，跳过创建。');
            return;
        }
        console.log('酒馆宠物：正在创建按钮...');
        // 在按钮内部直接创建一个img元素、一个刷新按钮和一个状态文本标签
        const buttonHtml = `
            <div id="${PET_BUTTON_ID}" title="酒馆宠物">
                <img src="" alt="Tavern Pet">
                <div id="tavern-pet-refresh-button" title="切换姿态">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                </div>
                <div id="tavern-pet-status-text"></div>
                <div id="tavern-pet-feedback-box"></div>
            </div>`;
        $('body').append(buttonHtml);
        const $petButton = $(`#${PET_BUTTON_ID}`);

        // 绑定切换姿态事件到新按钮
        $petButton.find('#tavern-pet-refresh-button').on('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，防止触发弹窗
            changePetPose();
        });

        const savedPosition = JSON.parse(
            localStorage.getItem(STORAGE_KEY_BUTTON_POS) || 'null',
        );
        if (savedPosition) {
            console.log('酒馆宠物：应用已保存的位置。', savedPosition);
            $petButton.css({
                top: savedPosition.top,
                left: savedPosition.left,
                right: 'auto',
                bottom: 'auto',
            });
        } else {
            console.log('酒馆宠物：应用默认位置。');
            // 显式设置默认位置以确保一致性
            $petButton.css({
                top: '120px',
                right: '20px',
                left: 'auto',
                bottom: 'auto',
            });
        }

        makePetButtonDraggable($petButton);
        $petButton.on('click', () => {
            if (hasMoved) return; // 如果按钮被拖动过，则不显示弹窗
            showPetPopup();
        });

        // 初始化时更新宠物图片和状态文本
        updatePetImage();
        updatePetStatusText();
        console.log('酒馆宠物：按钮创建成功！');
    };

    /**
     * 处理窗口大小调整
     */
    const handleWindowResize = () => {
        let resizeTimeout;
        $(window).on('resize.pet', function () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function () {
                const button = $(`#${PET_BUTTON_ID}`);
                if (!button.length) return;
                const buttonOffset = button.offset();
                let currentLeft = buttonOffset.left;
                let currentTop = buttonOffset.top;
                const maxLeft = $(window).width() - button.outerWidth();
                const maxTop = $(window).height() - button.outerHeight();
                let positionChanged = false;
                if (currentLeft > maxLeft) {
                    currentLeft = maxLeft;
                    positionChanged = true;
                }
                if (currentLeft < 0) {
                    currentLeft = 0;
                    positionChanged = true;
                }
                if (currentTop > maxTop) {
                    currentTop = maxTop;
                    positionChanged = true;
                }
                if (currentTop < 0) {
                    currentTop = 0;
                    positionChanged = true;
                }
                if (positionChanged) {
                    const newPosition = {
                        top: currentTop + 'px',
                        left: currentLeft + 'px',
                    };
                    button.css(newPosition);
                    localStorage.setItem(
                        STORAGE_KEY_BUTTON_POS,
                        JSON.stringify(newPosition),
                    );
                }
            }, 150);
        });
    };

    /**
     * 加载宠物状态
     */
    const loadPetState = () => {
        const savedState = JSON.parse(
            localStorage.getItem(STORAGE_KEY_PET_STATE) || 'null',
        );

        // 合并默认状态，确保所有属性都存在
        petState = { ...defaultPetState, ...savedState };

        // 数据验证：如果保存的 petId 无效，则重置为默认值
        if (!allPetsData[petState.petId]) {
            console.warn(
                `酒馆宠物：保存的宠物ID "${petState.petId}" 无效，重置为默认宠物。`,
            );
            petState.petId = defaultPetState.petId;
            petState.poseIndex = 0;
        }
        // 数据验证：确保 poseIndex 在有效范围内
        if (petState.poseIndex >= allPetsData[petState.petId].length) {
            console.warn(
                `酒馆宠物：保存的姿态索引 ${petState.poseIndex} 超出范围，重置为0。`,
            );
            petState.poseIndex = 0;
        }

        updatePetImage();
        updatePetStatusText();
    };

    /**
     * 保存宠物状态
     */
    /**
     * 在宠物下方显示一条临时反馈消息 (v10)
     * @param {string} message 要显示的消息
     */
    const showFeedback = (message) => {
        const feedbackBox = $('#tavern-pet-feedback-box');
        if (!feedbackBox.length) return;

        feedbackBox.text(message);
        feedbackBox.addClass('show');

        // 根据文字长度决定显示时间，最短1.5秒，最长5秒
        const displayTime = Math.max(
            1500,
            Math.min(message.length * 150, 5000),
        );

        // 清除之前的定时器以防重叠
        if (feedbackBox.data('feedback-timeout')) {
            clearTimeout(feedbackBox.data('feedback-timeout'));
        }

        const timeoutId = setTimeout(() => {
            feedbackBox.removeClass('show');
        }, displayTime);

        feedbackBox.data('feedback-timeout', timeoutId);
    };

    const savePetState = () => {
        petState.lastUpdate = Date.now();
        localStorage.setItem(STORAGE_KEY_PET_STATE, JSON.stringify(petState));
    };

    /**
     * 更新宠物按钮上的图片
     */
    const updatePetImage = () => {
        const $petImage = $(`#${PET_BUTTON_ID} img`);
        if ($petImage.length) {
            const pet = allPetsData[petState.petId];
            if (pet && pet.length > 0) {
                const imageUrl = pet[petState.poseIndex % pet.length];
                $petImage.attr('src', imageUrl);
            }
        }
    };

    /**
     * 更新宠物按钮下方的状态文本
     */
    /**
     * 格式化毫秒为可读的剩余时间字符串 (v10)
     */
    const formatDuration = (ms) => {
        if (ms <= 0) return '已完成';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        let str = '';
        if (hours > 0) str += `${hours}时`;
        if (minutes > 0) str += `${minutes}分`;
        if (hours === 0 && minutes === 0) str += `${seconds}秒`;
        return `(剩余 ${str})`;
    };

    /**
     * (v11.1) 格式化毫秒为 HH:MM:SS 格式的倒计时
     */
    const formatCountdown = (ms) => {
        if (ms <= 0) return '00:00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
            2,
            '0',
        );
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const updatePetStatusText = () => {
        const $statusText = $('#tavern-pet-status-text');
        if (!$statusText.length) return;

        let text = '';
        switch (petState.status) {
            case 'working':
                const remainingTime = petState.activity.endTime - Date.now();
                text = `${petState.activity.name.split(' ')[0]} ${formatDuration(remainingTime)}`;
                break;
            case 'playing':
                text = '玩耍中...';
                break;
            case 'sick':
                text = '生病了';
                break;
            case 'hosting':
                text = '托管中...';
                break;
            default:
                text = '';
                break;
        }
        $statusText.text(text);
    };

    /**
     * 切换到下一个宠物姿态
     */
    const changePetPose = () => {
        const pet = allPetsData[petState.petId];
        if (!pet || pet.length === 0) return;

        // 循环增加姿态索引
        petState.poseIndex = (petState.poseIndex + 1) % pet.length;

        updatePetImage();
        savePetState();
    };

    /**
     * 增加经验值并处理升级 (v11 重构)
     */
    const addExp = (amount) => {
        if (!amount || amount <= 0) return;

        let maxExp = levelUpConfig[petState.level] || 2000; // 获取当前等级所需经验，如果超过配置则设为默认值
        petState.exp += amount;

        showFeedback(`+${Math.round(amount)} 经验`);

        while (petState.exp >= maxExp) {
            petState.level++;
            petState.exp -= maxExp;
            petState.coins += 100 * petState.level; // 升级奖励随等级提升

            // 获取下一等级所需经验
            maxExp = levelUpConfig[petState.level] || 2000;

            // 使用 setTimeout 延迟显示，避免和经验提示重叠
            setTimeout(() => {
                showFeedback(
                    `恭喜！宠物升到了 ${petState.level} 级！奖励 ${100 * petState.level} 硬币！`,
                );
            }, 1600); // 延迟1.6秒
        }

        savePetState();
        updatePetPopup();
    };

    /**
     * 使用物品
     */
    const useItem = (itemName) => {
        if (
            !petState.inventory[itemName] ||
            petState.inventory[itemName] <= 0
        ) {
            showFeedback(`你没有 ${itemName}。`);
            return;
        }

        let itemData = null;
        for (const category in shopItems) {
            if (shopItems[category][itemName]) {
                itemData = shopItems[category][itemName];
                break;
            }
        }

        if (!itemData) {
            console.error(`物品 ${itemName} 的数据未找到！`);
            return;
        }

        petState.inventory[itemName]--;

        // 应用物品效果
        if (itemData.hunger)
            petState.hunger = Math.min(100, petState.hunger + itemData.hunger);
        if (itemData.happiness)
            petState.happiness = Math.min(
                100,
                petState.happiness + itemData.happiness,
            );
        if (itemData.cleanliness)
            petState.cleanliness = Math.min(
                100,
                petState.cleanliness + itemData.cleanliness,
            );
        if (itemData.health)
            petState.health = Math.min(100, petState.health + itemData.health);

        addExp(10); // 使用任何物品都会获得少量经验
        savePetState();
        updatePetPopup();
        showFeedback(`使用了 ${itemName}。`);
    };

    /**
     * 渲染互动标签页
     */
    const renderInteractTab = () => {
        return `
            <div class="pet-tab-content" id="interact-tab" style="display:none;">
                
                <!-- (v11.1) 新增：活动状态显示 -->
                <div id="pet-activity-status-view" style="display: none;">
                    <p id="pet-activity-name"></p>
                    <div id="pet-activity-countdown"></div>
                    <button id="pet-cancel-activity-button" class="pet-action-button"></button>
                </div>

                <!-- 默认互动按钮 -->
                <div class="pet-actions">
                    <p>在这里和你的宠物互动！</p>
                    <button class="pet-action-button" data-action="feed">喂食</button>
                    <button class="pet-action-button" data-action="play">陪玩</button>
                    <button class="pet-action-button" data-action="clean">洗澡</button>
                    <button class="pet-action-button" data-action="heal">看病</button>
                    <button class="pet-action-button" data-action="work">打工</button>
                    <button class="pet-action-button" data-action="toggleHosting">一键托管</button>
                </div>

            </div>
        `;
    };

    /**
     * 渲染背包标签页
     */
    const renderInventoryTab = () => {
        let itemsHtml = '';
        const inventory = petState.inventory || {};
        const hasItems = Object.values(inventory).some((qty) => qty > 0);

        if (!hasItems) {
            itemsHtml = '<p>你的背包空空如也~</p>';
        } else {
            itemsHtml = Object.entries(inventory)
                .map(([itemName, quantity]) => {
                    if (quantity > 0) {
                        return `<div class="pet-inventory-item" data-item-name="${itemName}"><span>${itemName} x${quantity}</span><button class="pet-action-button use-item-button">使用</button></div>`;
                    }
                    return '';
                })
                .join('');
        }
        return `
            <div class="pet-tab-content" id="inventory-tab" style="display:none;">
                <div class="pet-inventory-grid">${itemsHtml}</div>
            </div>
        `;
    };

    /**
     * 渲染商店标签页
     */
    const renderShopTab = () => {
        let shopHtml = `
                 <div class="pet-coins-display">
                    <span>酒馆硬币: ${Math.round(petState.coins)} 💰</span>
                </div>
        `;
        for (const category in shopItems) {
            const categoryName =
                {
                    food: '食物',
                    medicine: '药品',
                    cleaning: '清洁',
                    toys: '玩具',
                }[category] || category;
            shopHtml += `<h3>${categoryName}</h3>`;
            const itemsInCategory = Object.entries(shopItems[category])
                .map(([itemName, item]) => {
                    const isUnlocked = petState.level >= item.unlockLevel;
                    const canAfford = petState.coins >= item.price;
                    const lockedClass = isUnlocked ? '' : 'locked';
                    const buttonDisabled = !isUnlocked || !canAfford;

                    return `
                    <div class="pet-shop-item ${lockedClass}" data-item-name="${itemName}" data-item-price="${item.price}">
                        <div class="item-info">
                            <div class="item-name">${itemName} - ${item.price}💰</div>
                            <div class="item-desc">${item.description}</div>
                        </div>
                        <button class="pet-action-button buy-item-button" ${buttonDisabled ? 'disabled' : ''}>购买</button>
                        ${!isUnlocked ? `<div class="lock-overlay">🔒 Lv.${item.unlockLevel} 解锁</div>` : ''}
                    </div>
                `;
                })
                .join('');
            shopHtml += `<div class="pet-shop-category">${itemsInCategory}</div>`;
        }
        return `
            <div class="pet-tab-content" id="shop-tab" style="display:none;">
                ${shopHtml}
            </div>
        `;
    };

    /**
     * 渲染状态标签页
     */
    const renderStatusTab = () => {
        const petOptions = Object.keys(allPetsData)
            .map(
                (petName) =>
                    `<option value="${petName}" ${petState.petId === petName ? 'selected' : ''}>${petName}</option>`,
            )
            .join('');

        // (v11) 从配置中获取当前等级的最大经验值
        const maxExp = levelUpConfig[petState.level] || 2000;

        // 二次修复：使用 style.css 中定义的正确 class 恢复进度条的视觉样式
        return `
            <div class="pet-tab-content" id="status-tab">
                <div class="pet-select-container">
                    <label for="pet-select">当前宠物:</label>
                    <select id="pet-select">${petOptions}</select>
                </div>
                <div class="pet-stats">
                    <div class="pet-level-bar">
                        <span>等级: ${petState.level}</span>
                        <div class="pet-progress-bar-container">
                            <div id="pet-exp-bar" class="pet-progress-bar" style="width: ${(petState.exp / maxExp) * 100}%;"></div>
                        </div>
                        <span id="pet-exp-value">${Math.round(petState.exp)} / ${maxExp}</span>
                    </div>
                    <div class="pet-status-bar">
                        <span>饥饿</span>
                        <div class="pet-progress-bar-container">
                            <div id="pet-hunger-bar" class="pet-progress-bar" style="width: ${petState.hunger}%;"></div>
                        </div>
                        <span id="pet-hunger-value">${Math.round(petState.hunger)}/100</span>
                    </div>
                    <div class="pet-status-bar">
                        <span>心情</span>
                        <div class="pet-progress-bar-container">
                           <div id="pet-happiness-bar" class="pet-progress-bar" style="width: ${petState.happiness}%;"></div>
                        </div>
                        <span id="pet-happiness-value">${Math.round(petState.happiness)}/100</span>
                    </div>
                    <div class="pet-status-bar">
                        <span>清洁</span>
                        <div class="pet-progress-bar-container">
                            <div id="pet-cleanliness-bar" class="pet-progress-bar" style="width: ${petState.cleanliness}%;"></div>
                        </div>
                        <span id="pet-cleanliness-value">${Math.round(petState.cleanliness)}/100</span>
                    </div>
                    <div class="pet-status-bar">
                        <span>健康</span>
                        <div class="pet-progress-bar-container">
                            <div id="pet-health-bar" class="pet-progress-bar" style="width: ${petState.health}%;"></div>
                        </div>
                        <span id="pet-health-value">${Math.round(petState.health)}/100</span>
                    </div>
                </div>
                 <div class="pet-coins-display">
                    <span>酒馆硬币: ${Math.round(petState.coins)} 💰</span>
                </div>
            </div>
        `;
    };

    /**
     * 关闭宠物弹窗
     */
    const closePetPopup = () => {
        if (activityCountdownInterval) {
            clearInterval(activityCountdownInterval);
            activityCountdownInterval = null;
        }
        $(`#${PET_POPUP_ID}`).remove();
    };

    /**
     * 更新宠物弹窗UI
     */
    const updatePetPopup = () => {
        if ($(`#${PET_POPUP_ID}`).length === 0) return;

        // 更新状态页
        if ($('#status-tab').is(':visible')) {
            const maxExp = levelUpConfig[petState.level] || 2000; // (v11)
            // 二次修复：调整选择器以匹配正确的HTML结构
            $('.pet-level-bar > span:first-child').text(
                `等级: ${petState.level}`,
            );
            $('#pet-exp-bar').css('width', `${(petState.exp / maxExp) * 100}%`);
            $('#pet-exp-value').text(`${Math.round(petState.exp)} / ${maxExp}`);

            $('#pet-hunger-bar').css('width', `${petState.hunger}%`);
            $('#pet-hunger-value').text(`${Math.round(petState.hunger)}/100`);

            $('#pet-happiness-bar').css('width', `${petState.happiness}%`);
            $('#pet-happiness-value').text(
                `${Math.round(petState.happiness)}/100`,
            );

            $('#pet-cleanliness-bar').css('width', `${petState.cleanliness}%`);
            $('#pet-cleanliness-value').text(
                `${Math.round(petState.cleanliness)}/100`,
            );

            $('#pet-health-bar').css('width', `${petState.health}%`);
            $('#pet-health-value').text(`${Math.round(petState.health)}/100`);

            // 确保所有地方的金币都四舍五入
            $('#status-tab .pet-coins-display').html(
                `<span>酒馆硬币: ${Math.round(petState.coins)} 💰</span>`,
            );
        }

        // 重新渲染背包和商店以反映最新状态
        if ($('#inventory-tab').is(':visible')) {
            $('#inventory-tab').replaceWith($(renderInventoryTab()).show());
        }
        if ($('#shop-tab').is(':visible')) {
            // 在商店标签页中更新金币显示
            $('#shop-tab .pet-coins-display').html(
                `<span>酒馆硬币: ${Math.round(petState.coins)} 💰</span>`,
            );
        }
    };

    /**
     * 显示宠物弹窗
     */
    const showPetPopup = () => {
        if ($(`#${PET_POPUP_ID}`).length > 0) return;

        const popupHtml = `
            <div id="${PET_POPUP_ID}" class="tavern-pet-popup">
                <div class="tavern-pet-popup-header">
                    <div class="tavern-pet-tabs">
                        <button class="tab-button active" data-tab="status-tab">状态</button>
                        <button class="tab-button" data-tab="interact-tab">互动</button>
                        <button class="tab-button" data-tab="inventory-tab">背包</button>
                        <button class="tab-button" data-tab="shop-tab">商店</button>
                    </div>
                    <div class="tavern-pet-popup-close-button">✖</div>
                </div>
                <div class="tavern-pet-popup-body">
                    ${renderStatusTab()}
                    ${renderInteractTab()}
                    ${renderInventoryTab()}
                    ${renderShopTab()}
                </div>
            </div>`;
        $('body').append(popupHtml);

        // (v11.1.5) 终极修复：使用 setProperty 注入带 !important 的样式，覆盖一切
        const popupElement = document.getElementById(PET_POPUP_ID);
        if (popupElement && window.innerWidth <= 768) {
            popupElement.style.setProperty('top', '50%', 'important');
            popupElement.style.setProperty('left', '50%', 'important');
            popupElement.style.setProperty(
                'transform',
                'translate(-50%, -50%)',
                'important',
            );
            // 虽然CSS已有，但为确保万无一失，也在此处强制设置
            popupElement.style.setProperty('width', '90vw', 'important');
            popupElement.style.setProperty('max-width', 'none', 'important');
        }

        // --- 绑定事件 ---
        $(`#${PET_POPUP_ID} .tavern-pet-popup-close-button`).on(
            'click',
            closePetPopup,
        );

        // 标签页切换
        $('.tab-button').on('click', function () {
            const tabId = $(this).data('tab');
            $('.tab-button').removeClass('active');
            $(this).addClass('active');
            $('.pet-tab-content').hide();
            $(`#${tabId}`).show();
            // 切换时重新渲染，确保数据最新
            if (tabId === 'inventory-tab') {
                $('#inventory-tab').replaceWith($(renderInventoryTab()).show());
            } else if (tabId === 'shop-tab') {
                $('#shop-tab').replaceWith($(renderShopTab()).show());
            }
            updatePetPopup();
        });

        // (v10) 更新托管按钮文本的逻辑已移至 updateInteractionLock

        // 宠物选择事件
        $('#pet-select').on('change', function () {
            const newPetId = $(this).val();
            if (newPetId && allPetsData[newPetId]) {
                petState.petId = newPetId;
                petState.poseIndex = 0; // 切换宠物时重置姿态
                updatePetImage();
                savePetState();
            }
        });

        // 商店购买事件 (v11: 增加等级和金币检查)
        $('body').on('click', '#shop-tab .buy-item-button', function () {
            if ($(this).is(':disabled')) return; // 如果按钮被禁用，则不执行任何操作

            const itemElement = $(this).closest('.pet-shop-item');
            const itemName = itemElement.data('item-name');
            const itemPrice = itemElement.data('item-price');

            // 从原始数据获取解锁等级
            let itemData = null;
            for (const category in shopItems) {
                if (shopItems[category][itemName]) {
                    itemData = shopItems[category][itemName];
                    break;
                }
            }

            if (!itemData) {
                console.error(
                    `尝试购买的物品 ${itemName} 未在 shopItems 中找到！`,
                );
                return;
            }

            if (petState.level < itemData.unlockLevel) {
                showFeedback('等级不足，无法购买！');
                return;
            }

            if (petState.coins >= itemPrice) {
                petState.coins -= itemPrice;
                petState.inventory[itemName] =
                    (petState.inventory[itemName] || 0) + 1;
                addExp(itemPrice * 0.5); // 购买物品也能获得少量经验
                savePetState();
                // 重新渲染商店以更新按钮状态
                $('#shop-tab').replaceWith($(renderShopTab()).show());
                showFeedback(`购买 ${itemName} 成功!`);
            } else {
                showFeedback('硬币不足！');
            }
        });

        // (v11.1) 更新互动标签页的显示逻辑
        if ($('#interact-tab').is(':visible')) {
            updateInteractionLock();
        }

        // 其他互动事件和背包使用事件将在这里添加
        $('body').on('click', '#interact-tab [data-action]', function () {
            if ($(this).is(':disabled')) {
                return;
            }
            const action = $(this).data('action');

            // (v10.1) 检查按钮是否处于取消状态
            if ($(this).text() === '取消') {
                cancelActivity();
                return;
            }

            switch (action) {
                case 'play':
                    playWithPet();
                    break;
                case 'clean':
                    handleItemInteraction('cleaning', '清洁');
                    break;
                case 'heal':
                    handleItemInteraction('medicine', '治疗');
                    break;
                case 'work':
                    showActivitySelection('work', '打工');
                    break;
                case 'feed':
                    handleItemInteraction('food', '喂食');
                    break;
                case 'toggleHosting':
                    toggleHosting();
                    break;
            }
        });

        $('body').on('click', '#inventory-tab .use-item-button', function () {
            const itemName = $(this)
                .closest('.pet-inventory-item')
                .data('item-name');
            useItem(itemName);
        });
    };

    /**
     * 显示一个通知弹窗
     * @param {string} message - 要显示的消息
     * @param {Array<{text: string, class: string, callback: function}>|null} [buttons=null] - 按钮配置
     */
    const showNotification = (message, buttons = null) => {
        // 移除已存在的通知
        $('#tavern-pet-notification').remove();

        let buttonsHtml = '';
        if (buttons) {
            buttonsHtml = '<div class="notification-buttons">';
            buttons.forEach((btn, index) => {
                buttonsHtml += `<button class="notification-button ${btn.class}" data-index="${index}">${btn.text}</button>`;
            });
            buttonsHtml += '</div>';
        }

        const notificationHtml = `
            <div id="tavern-pet-notification" class="tavern-pet-notification">
                <p>${message}</p>
                ${buttonsHtml}
            </div>
        `;

        // 将通知添加到主弹窗的 body 中
        $('.tavern-pet-popup-body').append(notificationHtml);

        if (buttons) {
            $('#tavern-pet-notification .notification-button').on(
                'click',
                function () {
                    const index = $(this).data('index');
                    buttons[index].callback();
                    $('#tavern-pet-notification').remove(); // 点击后移除通知
                },
            );
        } else {
            // 如果没有按钮，3秒后自动消失
            setTimeout(() => {
                $('#tavern-pet-notification').fadeOut(500, function () {
                    $(this).remove();
                });
            }, 3000);
        }
    };

    /**
     * 处理需要使用物品的互动（喂食、洗澡、治疗）
     * @param {string} itemCategory - 物品类别 (e.g., 'food', 'cleaning')
     * @param {string} actionName - 互动名称 (e.g., '喂食', '洗澡')
     */
    const handleItemInteraction = (itemCategory, actionName) => {
        const items = Object.keys(petState.inventory).filter(
            (itemName) =>
                petState.inventory[itemName] > 0 &&
                shopItems[itemCategory][itemName],
        );

        if (items.length === 0) {
            showNotification(
                `没有可以用来${actionName}的物品了，要去商店看看吗？`,
                [
                    {
                        text: '去商店',
                        class: 'primary',
                        callback: () =>
                            $('.tab-button[data-tab="shop-tab"]').click(),
                    },
                    { text: '取消', class: 'secondary', callback: () => {} },
                ],
            );
            return;
        }

        // 如果只有一个可用物品，直接使用
        if (items.length === 1) {
            useItem(items[0]);
            showNotification(`使用了 ${items[0]}！`);
            return;
        }

        // 如果有多个物品，显示选择弹窗
        showItemSelection(items, actionName);
    };

    /**
     * 显示物品选择弹窗
     * @param {string[]} items - 可供选择的物品名称列表
     * @param {string} actionName - 互动名称
     */
    const showItemSelection = (items, actionName) => {
        let itemsHtml = items
            .map(
                (itemName) => `
            <div class="selection-item" data-item-name="${itemName}">
                <span>${itemName} (x${petState.inventory[itemName]})</span>
                <button class="pet-action-button select-item-button">选择</button>
            </div>
        `,
            )
            .join('');

        const selectionPopupHtml = `
            <div id="tavern-pet-item-selection" class="tavern-pet-notification">
                <h3>请选择一个物品来${actionName}：</h3>
                <div class="selection-list">${itemsHtml}</div>
                <div class="notification-buttons">
                    <button id="cancel-selection" class="notification-button secondary">取消</button>
                </div>
            </div>
        `;

        $('.tavern-pet-popup-body').append(selectionPopupHtml);

        $('#tavern-pet-item-selection').on(
            'click',
            '.select-item-button',
            function () {
                const itemName = $(this)
                    .closest('.selection-item')
                    .data('item-name');
                useItem(itemName);
                showNotification(`使用了 ${itemName}！`);
                $('#tavern-pet-item-selection').remove();
            },
        );

        $('#cancel-selection').on('click', () => {
            $('#tavern-pet-item-selection').remove();
        });
    };

    /**
     * (v10) 显示持续性活动（如打工）的选择弹窗
     * @param {string} activityType - 活动类型 (e.g., 'work')
     * @param {string} actionName - 互动名称 (e.g., '打工')
     */
    const showActivitySelection = (activityType, actionName) => {
        const options = activityOptions[activityType];
        if (!options) return;

        let itemsHtml = Object.entries(options)
            .map(([name, details]) => {
                const isUnlocked = petState.level >= details.unlockLevel;
                const lockedClass = isUnlocked ? '' : 'locked';
                const buttonDisabled = !isUnlocked;

                return `
            <div class="selection-item ${lockedClass}" data-activity-name="${name}">
                <span>${name}</span>
                <button class="pet-action-button select-activity-button" ${buttonDisabled ? 'disabled' : ''}>选择</button>
                 ${!isUnlocked ? `<div class="lock-overlay">🔒 Lv.${details.unlockLevel} 解锁</div>` : ''}
            </div>
        `;
            })
            .join('');

        const selectionPopupHtml = `
            <div id="tavern-pet-activity-selection" class="tavern-pet-notification">
                <h3>请选择一个${actionName}项目：</h3>
                <div class="selection-list">${itemsHtml}</div>
                <div class="notification-buttons">
                    <button id="cancel-activity-selection" class="notification-button secondary">取消</button>
                </div>
            </div>
        `;

        $('.tavern-pet-popup-body').append(selectionPopupHtml);

        $('#tavern-pet-activity-selection').on(
            'click',
            '.select-activity-button',
            function () {
                if ($(this).is(':disabled')) return;
                const activityName = $(this)
                    .closest('.selection-item')
                    .data('activity-name');
                startActivity(activityType, activityName);
                $('#tavern-pet-activity-selection').remove();
            },
        );

        $('#cancel-activity-selection').on('click', () => {
            $('#tavern-pet-activity-selection').remove();
        });
    };

    /**
     * (v10) 切换一键托管状态
     */
    const toggleHosting = () => {
        if (petState.status === 'hosting') {
            petState.status = 'idle';
            showFeedback('一键托管已关闭。');
        } else if (petState.status === 'idle') {
            petState.status = 'hosting';
            showFeedback('一键托管已开启！');
        } else {
            showFeedback('宠物正在忙，无法开启托管。');
            return;
        }
        savePetState();
        updateInteractionLock(); // 切换后立即更新按钮状态
        updatePetStatusText(); // 切换后立即更新状态文本
    };

    /**
     * 根据宠物当前状态，锁定或解锁互动按钮 (v10.1 重构)
     */
    const updateInteractionLock = () => {
        const $interactTab = $('#interact-tab');
        if ($interactTab.length === 0) return;

        const $buttonsView = $interactTab.find('.pet-actions');
        const $statusView = $interactTab.find('#pet-activity-status-view');
        const status = petState.status;

        // 清除旧的倒计时
        if (activityCountdownInterval) {
            clearInterval(activityCountdownInterval);
            activityCountdownInterval = null;
        }

        if (status === 'idle' || status === 'sick') {
            // 显示按钮，隐藏状态视图
            $buttonsView.show();
            $statusView.hide();

            // 根据状态启用/禁用按钮
            const $buttons = $buttonsView.find('.pet-action-button');
            if (status === 'idle') {
                $buttons.prop('disabled', false);
            } else {
                // sick
                $buttons.prop('disabled', true);
                $buttons.filter('[data-action="heal"]').prop('disabled', false);
            }
        } else {
            // 隐藏按钮，显示状态视图
            $buttonsView.hide();
            $statusView.show();

            const $activityName = $statusView.find('#pet-activity-name');
            const $countdown = $statusView.find('#pet-activity-countdown');
            const $cancelButton = $statusView.find(
                '#pet-cancel-activity-button',
            );

            let activityNameText = '';
            let cancelAction = null;

            switch (status) {
                case 'working':
                case 'playing':
                    activityNameText = `正在进行: ${petState.activity.name || '玩耍'}`;
                    cancelAction = cancelActivity;
                    $cancelButton.text('取消活动');
                    break;
                case 'hosting':
                    activityNameText = '宠物正在被一键托管中...';
                    cancelAction = toggleHosting;
                    $cancelButton.text('取消托管');
                    break;
            }

            $activityName.text(activityNameText);

            // 绑定取消事件
            $cancelButton.off('click').on('click', cancelAction);

            // 启动倒计时
            const updateCountdown = () => {
                const remainingTime = petState.activity.endTime - Date.now();
                if (remainingTime > 0) {
                    $countdown.text(formatCountdown(remainingTime));
                } else {
                    $countdown.text('00:00:00');
                    // 活动结束后，由 checkActivityCompletion 统一处理状态变更和UI刷新
                }
            };

            if (petState.activity.endTime) {
                updateCountdown();
                activityCountdownInterval = setInterval(updateCountdown, 1000);
            } else {
                $countdown.text(''); // 像“托管”这种没有结束时间的，不显示倒计时
            }
        }
    };

    /**
     * 陪宠物玩
     */
    const playWithPet = () => {
        if (petState.status !== 'idle') {
            showFeedback('宠物正在忙，不能陪它玩。');
            return;
        }
        if (petState.hunger < 10) {
            showFeedback('宠物太饿了，不想玩。');
            return;
        }

        petState.status = 'playing';
        updatePetStatusText();
        updateInteractionLock(); // 锁定其他按钮

        // 短暂的玩耍动画效果
        setTimeout(() => {
            petState.status = 'idle';
            petState.happiness = Math.min(100, petState.happiness + 15);
            petState.hunger = Math.max(0, petState.hunger - 10);
            addExp(15);
            savePetState();
            updatePetPopup();
            updatePetStatusText();
            updateInteractionLock(); // 解锁按钮
            showFeedback('你和宠物玩得很开心！');
        }, 3000); // 玩3秒
    };

    /**
     * (v10) 开始一个持续性活动（如打工）
     * @param {string} activityType
     * @param {string} activityName
     */
    const startActivity = (activityType, activityName) => {
        const details = activityOptions[activityType]?.[activityName];
        if (!details) {
            console.error(`活动 ${activityName} 未定义！`);
            return;
        }

        // 检查开始条件
        if (petState.status !== 'idle') {
            showFeedback('宠物已经在忙了！');
            return;
        }
        if (petState.hunger < details.cost.hunger) {
            showFeedback('宠物太饿了，无法进行这项活动。');
            return;
        }

        // 设置活动状态
        petState.status = activityType;
        petState.activity.type = activityType;
        petState.activity.name = activityName;
        petState.activity.endTime = Date.now() + details.duration;

        showFeedback(`宠物开始 ${activityName.split(' ')[0]} 了！`);
        savePetState();
        updatePetStatusText();
        updateInteractionLock();
        closePetPopup(); // 开始活动后自动关闭弹窗
    };

    /**
     * (v10.1) 取消当前正在进行的活动
     */
    const cancelActivity = () => {
        if (petState.status === 'idle' || petState.status === 'hosting') return;

        const activityName =
            petState.activity.name ||
            (petState.status === 'playing' ? '玩耍' : '活动');

        // 重置状态
        petState.status = 'idle';
        petState.activity = { type: null, name: null, endTime: null };

        showFeedback(`${activityName.split(' ')[0]} 已被取消。`);
        savePetState();
        updatePetStatusText();
        updateInteractionLock(); // 立即更新弹窗中的按钮状态
    };

    /**
     * (v10) 检查并完成已结束的活动（核心离线逻辑）
     */
    const checkActivityCompletion = () => {
        if (petState.status === 'idle' || !petState.activity.endTime) {
            return;
        }

        if (Date.now() >= petState.activity.endTime) {
            const details =
                activityOptions[petState.activity.type]?.[
                    petState.activity.name
                ];
            if (!details) {
                console.error(
                    `完成的活动 ${petState.activity.name} 数据丢失！`,
                );
                // 重置状态以避免卡死
                petState.status = 'idle';
                petState.activity = { type: null, name: null, endTime: null };
                savePetState();
                return;
            }

            const reward = details.reward;
            const cost = details.cost;

            // 结算
            petState.coins += reward.coins || 0;
            addExp(reward.exp || 0);
            petState.hunger = Math.max(0, petState.hunger - (cost.hunger || 0));
            petState.cleanliness = Math.max(
                0,
                petState.cleanliness - (cost.cleanliness || 0),
            );

            showFeedback(
                `${petState.activity.name.split(' ')[0]} 完成！获得 ${reward.coins}硬币, ${reward.exp}经验。`,
            );

            // 重置状态
            petState.status = 'idle';
            petState.activity = { type: null, name: null, endTime: null };

            savePetState();
            updatePetPopup();
            updatePetStatusText();
            updateInteractionLock();
        }
    };

    /**
     * 启动状态定时器 (游戏循环)
     */
    /**
     * (v10) 核心托管逻辑
     */
    const run托管Logic = () => {
        // 只在托管状态下运行，并且确保没有其他活动正在进行
        if (petState.status !== 'hosting' || petState.activity.type) return;

        // 托管成本：每分钟 10/60 ~= 0.167 金币
        const cost = 10 / 60;
        if (petState.coins < cost) {
            showFeedback('金币不足，自动取消托管。');
            toggleHosting();
            return;
        }
        petState.coins -= cost;

        // 优先处理紧急状态
        if (petState.health < 50) {
            if (tryToUseOrCreateItem('medicine')) return;
        }
        if (petState.cleanliness < 30) {
            if (tryToUseOrCreateItem('cleaning')) return;
        }
        if (petState.hunger < 40) {
            if (tryToUseOrCreateItem('food')) return;
        }

        // 如果无事可做，就去打工
        // 随机选择一个短时工作
        const workOptions = Object.keys(activityOptions.work).slice(0, 2); // 只选择前两个短时工作
        const randomWork =
            workOptions[Math.floor(Math.random() * workOptions.length)];
        startActivity('work', randomWork);
    };

    /**
     * (v10) 尝试使用或购买物品的辅助函数
     */
    const tryToUseOrCreateItem = (category) => {
        const items = Object.keys(petState.inventory).filter(
            (itemName) =>
                petState.inventory[itemName] > 0 &&
                shopItems[category] &&
                shopItems[category][itemName],
        );

        if (items.length > 0) {
            useItem(items[0]); // 使用第一个可用的
            return true;
        } else {
            // 尝试购买最便宜的物品
            const cheapestItem = Object.entries(shopItems[category] || {}).sort(
                ([, a], [, b]) => a.price - b.price,
            )[0];

            if (cheapestItem && petState.coins >= cheapestItem[1].price) {
                const [itemName, itemDetails] = cheapestItem;
                petState.coins -= itemDetails.price;
                showFeedback(`[托管] 自动购买了 ${itemName}`);
                useItem(itemName); // 购买后立即使用
                return true;
            }
        }
        return false;
    };

    const startPetStatusTimer = () => {
        setInterval(() => {
            // (v10) 优先处理托管逻辑
            if (petState.status === 'hosting') {
                run托管Logic();
            }

            // (v10) 每次循环都检查活动是否完成
            checkActivityCompletion();

            // (v10) 刷新状态文本以更新倒计时
            if (petState.status !== 'idle') {
                updatePetStatusText();
            }

            const now = Date.now();
            const timeDiffMinutes = (now - petState.lastUpdate) / (1000 * 60);

            // 每分钟进行一次状态衰减
            if (timeDiffMinutes >= 1) {
                let needsUpdate = false;

                // 基础衰减
                if (petState.hunger > 0) {
                    petState.hunger = Math.max(0, petState.hunger - 1);
                    needsUpdate = true;
                }
                if (petState.happiness > 0) {
                    petState.happiness = Math.max(0, petState.happiness - 1);
                    needsUpdate = true;
                }
                if (petState.cleanliness > 0) {
                    petState.cleanliness = Math.max(
                        0,
                        petState.cleanliness - 1,
                    );
                    needsUpdate = true;
                }

                // 状态惩罚
                if (petState.hunger < 20) {
                    if (petState.health > 0) {
                        petState.health = Math.max(0, petState.health - 2);
                        needsUpdate = true;
                    }
                }
                if (petState.cleanliness < 20) {
                    if (petState.health > 0) {
                        petState.health = Math.max(0, petState.health - 1);
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    savePetState(); // 保存更新后的状态
                    updatePetPopup(); // 更新UI
                }

                // 随机事件触发 (约每5分钟有25%概率触发)
                if (Math.random() < 0.05) {
                    // 每分钟有5%的几率
                    triggerRandomEvent();
                }
            }
        }, 60 * 1000); // 每分钟检查一次
    };

    /**
     * 触发一个随机事件
     */
    const triggerRandomEvent = () => {
        if (petState.status !== 'idle') return; // 宠物忙碌时不触发事件

        const events = [
            {
                message: `你的宠物在角落里找到了 10 个酒馆硬币！`,
                action: () => {
                    petState.coins += 10;
                },
            },
            {
                message: `一只蝴蝶飞过，宠物看起来很开心。`,
                action: () => {
                    petState.happiness = Math.min(100, petState.happiness + 5);
                },
            },
            {
                message: `呜... 宠物好像不小心着凉了，有点生病。`,
                action: () => {
                    petState.health = Math.max(0, petState.health - 10);
                    if (petState.health < 50) {
                        petState.status = 'sick';
                    }
                },
            },
            {
                message: '宠物今天看起来精神很好！',
                action: () => {}, // 无效果，只是一个氛围事件
            },
        ];

        const event = events[Math.floor(Math.random() * events.length)];

        console.log(`随机事件触发: ${event.message}`);
        event.action();
        showNotification(event.message);

        savePetState();
        updatePetPopup();
        updatePetStatusText();
        updateInteractionLock();
    };

    /**
     * 插件初始化函数
     */
    const initialize = async () => {
        // 1. 首先加载所有宠物数据
        const dataLoaded = await loadAllPetsData();
        if (!dataLoaded) return; // 如果数据加载失败，则不继续

        // 2. 加载本地保存的宠物状态
        loadPetState();

        // (v10) 插件加载时立即检查是否有离线完成的活动
        checkActivityCompletion();

        // 3. 加载设置面板UI并绑定事件
        try {
            const settingsHtml = await $.get(
                `${extensionFolderPath}/settings.html`,
            );
            $('#extensions_settings2').append(settingsHtml);

            const extensionSettings = $(
                `.extension_settings[data-extension-name="${extensionName}"]`,
            );

            extensionSettings
                .find('.inline-drawer-toggle')
                .on('click', function () {
                    $(this).closest('.inline-drawer').toggleClass('open');
                });

            const pluginToggle = extensionSettings.find('#pet-plugin-toggle');
            const isPluginEnabled =
                localStorage.getItem(PLUGIN_ENABLED_KEY) !== 'false';
            pluginToggle.prop('checked', isPluginEnabled);

            pluginToggle.on('change', function () {
                const enabled = $(this).is(':checked');
                localStorage.setItem(PLUGIN_ENABLED_KEY, enabled);
                if (enabled) {
                    // 重新加载状态并创建按钮
                    loadPetState();
                    createPetButton();
                } else {
                    $(`#${PET_BUTTON_ID}`).remove();
                    $(`#${PET_POPUP_ID}`).remove();
                }
            });

            if (isPluginEnabled) {
                console.log('酒馆宠物：插件已启用，创建按钮。');
                createPetButton();
            } else {
                console.log('酒馆宠物：插件已禁用。');
            }
        } catch (error) {
            console.error(
                '加载酒馆宠物扩展的 settings.html 或绑定事件失败：',
                error,
            );
        }

        // 4. 启动定时器和监听器
        startPetStatusTimer();
        handleWindowResize();
    };

    // 运行初始化
    initialize();
});
