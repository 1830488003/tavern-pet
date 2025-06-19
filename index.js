// 使用 jQuery 确保在 DOM 加载完毕后执行
jQuery(async () => {
    // 定义扩展名称和路径
    const extensionName = "tavern-pet";
    const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

    // 在控制台打印消息，确认插件已加载
    console.log("酒馆宠物扩展已加载！");

    // --- 常量 ---
    const PET_BUTTON_ID = "tavern-pet-button";
    const STORAGE_KEY_BUTTON_POS = "tavern-pet-button-pos";
    const PLUGIN_ENABLED_KEY = 'tavern-pet-enabled';
    const PET_POPUP_ID = "tavern-pet-popup";
    const STORAGE_KEY_PET_STATE = 'tavern-pet-state';
    const PETS_JSON_PATH = `${extensionFolderPath}/gif/pets.json`;

    // --- 全局状态 ---
    let allPetsData = {}; // 存储从 pets.json 加载的所有宠物数据
    let petState = {}; // 当前宠物的状态

    // --- 商店和物品定义 ---
    const shopItems = {
        food: {
            '普通饼干': { price: 5, description: '恢复15点饥饿度', hunger: 15 },
            '豪华大餐': { price: 20, description: '恢复60点饥饿度，10点心情', hunger: 60, happiness: 10 },
        },
        medicine: {
            '药丸': { price: 30, description: '恢复全部健康值', health: 100 },
        },
        cleaning: {
            '肥皂': { price: 15, description: '恢复全部清洁度', cleanliness: 100 },
        },
        toys: {
            '小皮球': { price: 50, description: '增加30点心情', happiness: 30 },
        }
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
        maxExp: 100,
        // 经济系统
        coins: 50,
        inventory: {}, // { '普通饼干': 2, '肥皂': 1 }
        // 宠物身份
        petId: null, // 当前宠物的ID (即名字)
        poseIndex: 0, // 当前姿态的索引
        lastUpdate: Date.now(),
    };
    let isDragging = false;
    let hasMoved = false;

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
                if (!defaultPetState.petId || !allPetsData[defaultPetState.petId]) {
                    defaultPetState.petId = petNames[0];
                }
                console.log(`成功加载 ${petNames.length} 个宠物数据。`);
                return true;
            } else {
                console.error("酒馆宠物：pets.json 文件为空或格式不正确。");
                return false;
            }
        } catch (error) {
            console.error("酒馆宠物：加载 pets.json 失败！", error);
            $('body').append('<div class="tavern-pet-error">无法加载宠物数据 (pets.json)</div>');
            return false;
        }
    };

    /**
     * 使宠物按钮可拖动
     */
    const makePetButtonDraggable = (button) => {
        let offset = { x: 0, y: 0 };
        const dragStart = (e) => {
            isDragging = true;
            hasMoved = false; // 重置移动标记
            button.css("cursor", "grabbing");
            const event = e.type === "touchstart" ? e.originalEvent.touches[0] : e;
            const buttonPos = button.offset();
            offset.x = event.pageX - buttonPos.left;
            offset.y = event.pageY - buttonPos.top;
            e.preventDefault();
        };
        const dragMove = (e) => {
            if (!isDragging) return;
            hasMoved = true; // 只要移动了，就设置标记
            const event = e.type === "touchmove" ? e.originalEvent.touches[0] : e;
            button.css({
                top: event.pageY - offset.y + "px",
                left: event.pageX - offset.x + "px",
                right: "auto",
                bottom: "auto",
            });
        };
        const dragEnd = () => {
            if (!isDragging) return;
            isDragging = false; // 拖动结束，立即设置isDragging为false
            button.css("cursor", "grab");
            localStorage.setItem(STORAGE_KEY_BUTTON_POS, JSON.stringify({ top: button.css("top"), left: button.css("left") }));
        };
        button.on("mousedown.pet touchstart.pet", dragStart);
        $(document).on("mousemove.pet touchmove.pet", dragMove);
        $(document).on("mouseup.pet touchend.pet", dragEnd);
    };

    /**
     * 创建宠物按钮
     */
    const createPetButton = () => {
        if ($(`#${PET_BUTTON_ID}`).length > 0) {
            console.log("酒馆宠物：按钮已存在，跳过创建。");
            return;
        }
        console.log("酒馆宠物：正在创建按钮...");
        // 在按钮内部直接创建一个img元素和一个刷新按钮
        const buttonHtml = `
            <div id="${PET_BUTTON_ID}" title="酒馆宠物">
                <img src="${petState.currentGif}" alt="Tavern Pet">
                <div id="tavern-pet-refresh-button" title="切换姿态">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                </div>
            </div>`;
        $("body").append(buttonHtml);
        const $petButton = $(`#${PET_BUTTON_ID}`);

        // 绑定切换姿态事件到新按钮
        $petButton.find('#tavern-pet-refresh-button').on('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，防止触发弹窗
            changePetPose();
        });

        const savedPosition = JSON.parse(localStorage.getItem(STORAGE_KEY_BUTTON_POS) || "null");
        if (savedPosition) {
            console.log("酒馆宠物：应用已保存的位置。", savedPosition);
            $petButton.css({ top: savedPosition.top, left: savedPosition.left, right: "auto", bottom: "auto" });
        } else {
            console.log("酒馆宠物：应用默认位置。");
            // 显式设置默认位置以确保一致性
            $petButton.css({ top: '120px', right: '20px', left: 'auto', bottom: 'auto' });
        }

        makePetButtonDraggable($petButton);
        $petButton.on("click", () => {
            if (hasMoved) return; // 如果按钮被拖动过，则不显示弹窗
            showPetPopup();
        });
        console.log("酒馆宠物：按钮创建成功！");
    };

    /**
     * 处理窗口大小调整
     */
    const handleWindowResize = () => {
        let resizeTimeout;
        $(window).on("resize.pet", function () {
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
                if (currentLeft > maxLeft) { currentLeft = maxLeft; positionChanged = true; }
                if (currentLeft < 0) { currentLeft = 0; positionChanged = true; }
                if (currentTop > maxTop) { currentTop = maxTop; positionChanged = true; }
                if (currentTop < 0) { currentTop = 0; positionChanged = true; }
                if (positionChanged) {
                    const newPosition = { top: currentTop + "px", left: currentLeft + "px" };
                    button.css(newPosition);
                    localStorage.setItem(STORAGE_KEY_BUTTON_POS, JSON.stringify(newPosition));
                }
            }, 150);
        });
    };

    /**
     * 加载宠物状态
     */
    const loadPetState = () => {
        const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY_PET_STATE) || 'null');
        
        // 合并默认状态，确保所有属性都存在
        petState = { ...defaultPetState, ...savedState };

        // 数据验证：如果保存的 petId 无效，则重置为默认值
        if (!allPetsData[petState.petId]) {
            console.warn(`酒馆宠物：保存的宠物ID "${petState.petId}" 无效，重置为默认宠物。`);
            petState.petId = defaultPetState.petId;
            petState.poseIndex = 0;
        }
        // 数据验证：确保 poseIndex 在有效范围内
        if (petState.poseIndex >= allPetsData[petState.petId].length) {
            console.warn(`酒馆宠物：保存的姿态索引 ${petState.poseIndex} 超出范围，重置为0。`);
            petState.poseIndex = 0;
        }
        
        updatePetImage();
    };

    /**
     * 保存宠物状态
     */
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
     * 增加经验值并处理升级
     */
    const addExp = (amount) => {
        petState.exp += amount;
        while (petState.exp >= petState.maxExp) {
            petState.level++;
            petState.exp -= petState.maxExp;
            petState.maxExp = Math.floor(petState.maxExp * 1.5); // 升级所需经验增加
            petState.coins += 100; // 升级奖励
            console.log(`恭喜！宠物升到了 ${petState.level} 级！`);
        }
    };

    /**
     * 使用物品
     */
    const useItem = (itemName) => {
        if (!petState.inventory[itemName] || petState.inventory[itemName] <= 0) {
            console.log(`你没有 ${itemName}。`);
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
        if (itemData.hunger) petState.hunger = Math.min(100, petState.hunger + itemData.hunger);
        if (itemData.happiness) petState.happiness = Math.min(100, petState.happiness + itemData.happiness);
        if (itemData.cleanliness) petState.cleanliness = Math.min(100, petState.cleanliness + itemData.cleanliness);
        if (itemData.health) petState.health = Math.min(100, petState.health + itemData.health);

        addExp(10); // 使用任何物品都会获得少量经验
        savePetState();
        updatePetPopup();
        console.log(`使用了 ${itemName}。`);
    };

    /**
     * 关闭宠物弹窗
     */
    const closePetPopup = () => {
        $(`#${PET_POPUP_ID}`).remove();
    };

    /**
     * 渲染状态标签页
     */
    const renderStatusTab = () => {
        const petOptions = Object.keys(allPetsData).map(name => 
            `<option value="${name}" ${name === petState.petId ? 'selected' : ''}>${name}</option>`
        ).join('');

        return `
            <div class="pet-tab-content" id="status-tab">
                <div class="pet-select-container">
                    <label for="pet-select">当前宠物:</label>
                    <select id="pet-select" class="text_pole">${petOptions}</select>
                </div>
                <div class="pet-level-bar">
                    <span>等级: ${petState.level}</span>
                    <div class="pet-progress-bar-container"><div id="pet-exp-bar" class="pet-progress-bar" style="width: ${petState.exp / petState.maxExp * 100}%;"></div></div>
                    <span>${petState.exp} / ${petState.maxExp}</span>
                </div>
                <div class="pet-status-grid">
                    <div class="pet-status-bar"><span>饥饿度:</span><div class="pet-progress-bar-container"><div id="pet-hunger-bar" class="pet-progress-bar" style="width: ${petState.hunger}%;"></div></div></div>
                    <div class="pet-status-bar"><span>心情:</span><div class="pet-progress-bar-container"><div id="pet-happiness-bar" class="pet-progress-bar" style="width: ${petState.happiness}%;"></div></div></div>
                    <div class="pet-status-bar"><span>清洁度:</span><div class="pet-progress-bar-container"><div id="pet-cleanliness-bar" class="pet-progress-bar" style="width: ${petState.cleanliness}%;"></div></div></div>
                    <div class="pet-status-bar"><span>健康值:</span><div class="pet-progress-bar-container"><div id="pet-health-bar" class="pet-progress-bar" style="width: ${petState.health}%;"></div></div></div>
                </div>
                <div class="pet-coins-display">
                    <span>酒馆硬币: ${petState.coins} 💰</span>
                </div>
            </div>
        `;
    };

    /**
     * 渲染互动标签页
     */
    const renderInteractTab = () => {
        // 在这里可以根据宠物的状态（如是否生病/打工）禁用某些按钮
        return `
            <div class="pet-tab-content" id="interact-tab" style="display:none;">
                <p>在这里和你的宠物互动！</p>
                <div class="pet-actions">
                    <button class="menu_button" data-action="feed">喂食 (从背包)</button>
                    <button class="menu_button" data-action="play">陪玩</button>
                    <button class="menu_button" data-action="clean">洗澡 (消耗肥皂)</button>
                    <button class="menu_button" data-action="heal">看病 (消耗药丸)</button>
                    <button class="menu_button" data-action="work">打工 (15分钟)</button>
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
        const hasItems = Object.values(inventory).some(qty => qty > 0);

        if (!hasItems) {
            itemsHtml = '<p>你的背包空空如也~</p>';
        } else {
            itemsHtml = Object.entries(inventory).map(([itemName, quantity]) => {
                if (quantity > 0) {
                    return `<div class="pet-inventory-item" data-item-name="${itemName}"><span>${itemName} x${quantity}</span><button class="menu_button use-item-button">使用</button></div>`;
                }
                return '';
            }).join('');
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
        let shopHtml = '';
        for (const category in shopItems) {
            const categoryName = { food: '食物', medicine: '药品', cleaning: '清洁', toys: '玩具' }[category] || category;
            shopHtml += `<h3>${categoryName}</h3>`;
            const itemsInCategory = Object.entries(shopItems[category]).map(([itemName, item]) => {
                return `
                    <div class="pet-shop-item" data-item-name="${itemName}" data-item-price="${item.price}">
                        <div class="item-name">${itemName} - ${item.price}💰</div>
                        <div class="item-desc">${item.description}</div>
                        <button class="menu_button buy-item-button">购买</button>
                    </div>
                `;
            }).join('');
            shopHtml += `<div class="pet-shop-category">${itemsInCategory}</div>`;
        }
        return `
            <div class="pet-tab-content" id="shop-tab" style="display:none;">
                ${shopHtml}
            </div>
        `;
    };

    /**
     * 更新宠物弹窗UI
     */
    const updatePetPopup = () => {
        if ($(`#${PET_POPUP_ID}`).length === 0) return;
        
        // 更新状态页
        if ($('#status-tab').is(':visible')) {
            $('#pet-exp-bar').css('width', `${(petState.exp / petState.maxExp) * 100}%`).parent().next().text(`${petState.exp} / ${petState.maxExp}`);
            $('#pet-level-bar > span:first-child').text(`等级: ${petState.level}`);
            $('#pet-hunger-bar').css('width', `${petState.hunger}%`);
            $('#pet-happiness-bar').css('width', `${petState.happiness}%`);
            $('#pet-cleanliness-bar').css('width', `${petState.cleanliness}%`);
            $('#pet-health-bar').css('width', `${petState.health}%`);
            $('.pet-coins-display').html(`<span>酒馆硬币: ${petState.coins} 💰</span>`);
        }
        
        // 重新渲染背包和商店以反映最新状态
        if ($('#inventory-tab').is(':visible')) {
            $('#inventory-tab').replaceWith($(renderInventoryTab()).show());
        }
         if ($('#shop-tab').is(':visible')) {
            // 只更新金币显示，避免重绘整个商店
            // 如果需要更复杂的更新，可以只重新渲染部分内容
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
        $("body").append(popupHtml);
        
        // --- 绑定事件 ---
        $(`#${PET_POPUP_ID} .tavern-pet-popup-close-button`).on("click", closePetPopup);
        
        // 标签页切换
        $('.tab-button').on('click', function() {
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

        // 宠物选择事件
        $('#pet-select').on('change', function() {
            const newPetId = $(this).val();
            if (newPetId && allPetsData[newPetId]) {
                petState.petId = newPetId;
                petState.poseIndex = 0; // 切换宠物时重置姿态
                updatePetImage();
                savePetState();
            }
        });
        
        // 商店购买事件
        $('body').on('click', '#shop-tab .buy-item-button', function() {
            const itemElement = $(this).closest('.pet-shop-item');
            const itemName = itemElement.data('item-name');
            const itemPrice = itemElement.data('item-price');

            if (petState.coins >= itemPrice) {
                petState.coins -= itemPrice;
                petState.inventory[itemName] = (petState.inventory[itemName] || 0) + 1;
                savePetState();
                updatePetPopup();
                console.log(`购买 ${itemName} 成功!`);
            } else {
                console.log("硬币不足！");
            }
        });
        
        // 其他互动事件和背包使用事件将在这里添加
        $('body').on('click', '#interact-tab [data-action]', function() {
            const action = $(this).data('action');
            switch (action) {
                case 'play':
                    playWithPet();
                    break;
                case 'clean':
                    useItem('肥皂');
                    break;
                case 'heal':
                    useItem('药丸');
                    break;
                case 'work':
                    workWithPet();
                    break;
                case 'feed':
                    // 提示用户去背包选择食物
                    console.log("请到【背包】标签页选择食物来喂食。");
                    $('.tab-button[data-tab="inventory-tab"]').click();
                    break;
            }
        });

        $('body').on('click', '#inventory-tab .use-item-button', function() {
            const itemName = $(this).closest('.pet-inventory-item').data('item-name');
            useItem(itemName);
        });

    };

    /**
     * 陪宠物玩
     */
    const playWithPet = () => {
        if (petState.hunger < 10) {
            console.log("宠物太饿了，不想玩。");
            return;
        }
        petState.happiness = Math.min(100, petState.happiness + 15);
        petState.hunger = Math.max(0, petState.hunger - 10);
        addExp(15);
        savePetState();
        updatePetPopup();
        console.log("你和宠物玩得很开心！");
    };

    /**
     * 宠物去打工
     */
    const workWithPet = () => {
        // 简单实现：立即获得奖励，未来可以加入定时器
        if (petState.hunger < 20) {
            console.log("宠物太饿了，不能去打工。");
            return;
        }
        console.log("宠物努力打工，赚了30个硬币！");
        petState.coins += 30;
        petState.hunger = Math.max(0, petState.hunger - 20);
        petState.cleanliness = Math.max(0, petState.cleanliness - 10);
        addExp(25);
        savePetState();
        updatePetPopup();
    };

    /**
     * 启动状态定时器 (游戏循环)
     */
    const startPetStatusTimer = () => {
        setInterval(() => {
            const now = Date.now();
            const timeDiffMinutes = (now - petState.lastUpdate) / (1000 * 60);

            // 每分钟进行一次状态衰减
            if (timeDiffMinutes >= 1) {
                let needsUpdate = false;
                
                // 基础衰减
                if (petState.hunger > 0) { petState.hunger = Math.max(0, petState.hunger - 1); needsUpdate = true; }
                if (petState.happiness > 0) { petState.happiness = Math.max(0, petState.happiness - 1); needsUpdate = true; }
                if (petState.cleanliness > 0) { petState.cleanliness = Math.max(0, petState.cleanliness - 1); needsUpdate = true; }

                // 状态惩罚
                if (petState.hunger < 20) {
                    if (petState.health > 0) { petState.health = Math.max(0, petState.health - 2); needsUpdate = true; }
                }
                if (petState.cleanliness < 20) {
                    if (petState.health > 0) { petState.health = Math.max(0, petState.health - 1); needsUpdate = true; }
                }

                if (needsUpdate) {
                    savePetState(); // 保存更新后的状态
                    updatePetPopup(); // 更新UI
                }
            }
        }, 30 * 1000); // 每30秒检查一次，保证分钟级衰减的准确性
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

        // 3. 加载设置面板UI并绑定事件
        try {
            const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
            $("#extensions_settings2").append(settingsHtml);

            const extensionSettings = $(`.extension_settings[data-extension-name="${extensionName}"]`);
            
            extensionSettings.find('.inline-drawer-toggle').on('click', function() {
                $(this).closest('.inline-drawer').toggleClass('open');
            });

            const pluginToggle = extensionSettings.find('#pet-plugin-toggle');
            const isPluginEnabled = localStorage.getItem(PLUGIN_ENABLED_KEY) !== 'false';
            pluginToggle.prop('checked', isPluginEnabled);

            pluginToggle.on('change', function() {
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
                console.log("酒馆宠物：插件已启用，创建按钮。");
                createPetButton();
            } else {
                console.log("酒馆宠物：插件已禁用。");
            }

        } catch (error) {
            console.error("加载酒馆宠物扩展的 settings.html 或绑定事件失败：", error);
        }

        // 4. 启动定时器和监听器
        startPetStatusTimer();
        handleWindowResize();
    };

    // 运行初始化
    initialize();
});
