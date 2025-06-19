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
    let defaultPetState = {
        hunger: 80,
        happiness: 90,
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
        // 在按钮内部直接创建一个img元素
        const buttonHtml = `
            <div id="${PET_BUTTON_ID}" title="酒馆宠物">
                <img src="${petState.currentGif}" alt="Tavern Pet">
            </div>`;
        $("body").append(buttonHtml);
        const $petButton = $(`#${PET_BUTTON_ID}`);

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
     * 显示宠物弹窗
     */
    const showPetPopup = () => {
        if ($(`#${PET_POPUP_ID}`).length > 0) return;

        // 动态生成宠物选择下拉菜单
        const petOptions = Object.keys(allPetsData).map(name => 
            `<option value="${name}" ${name === petState.petId ? 'selected' : ''}>${name}</option>`
        ).join('');

        const popupHtml = `
            <div id="${PET_POPUP_ID}" class="tavern-pet-popup">
                <div class="tavern-pet-popup-header">
                    <span id="pet-name-display">${petState.petId}</span>
                    <div class="tavern-pet-popup-close-button">✖</div>
                </div>
                <div class="tavern-pet-popup-body">
                    <div class="pet-select-container">
                        <label for="pet-select">选择宠物:</label>
                        <select id="pet-select" class="text_pole">${petOptions}</select>
                    </div>
                    <div class="pet-status-bar"><span>饥饿度:</span><div class="pet-progress-bar-container"><div id="pet-hunger-bar" class="pet-progress-bar"></div></div></div>
                    <div class="pet-status-bar"><span>心情:</span><div class="pet-progress-bar-container"><div id="pet-happiness-bar" class="pet-progress-bar"></div></div></div>
                    <div class="pet-actions">
                        <button id="feed-pet-button" class="menu_button">投喂</button>
                        <button id="play-with-pet-button" class="menu_button">陪玩</button>
                        <button id="change-pose-button" class="menu_button">切换姿态</button>
                    </div>
                </div>
            </div>`;
        $("body").append(popupHtml);
        updatePetPopup();

        // --- 绑定事件 ---
        $(`#${PET_POPUP_ID} .tavern-pet-popup-close-button`).on("click", closePetPopup);
        $('#feed-pet-button').on('click', feedPet);
        $('#play-with-pet-button').on('click', playWithPet);
        $('#change-pose-button').on('click', changePetPose);
        
        // 宠物选择事件
        $('#pet-select').on('change', function() {
            const newPetId = $(this).val();
            if (newPetId && allPetsData[newPetId]) {
                petState.petId = newPetId;
                petState.poseIndex = 0; // 切换宠物时重置姿态
                updatePetImage();
                updatePetPopup(); // 更新弹窗内的名字
                savePetState();
            }
        });
    };

    /**
     * 更新宠物弹窗UI
     */
    const updatePetPopup = () => {
        if ($(`#${PET_POPUP_ID}`).length === 0) return;
        $('#pet-name-display').text(petState.petId); // 使用 petId 作为名字
        $('#pet-hunger-bar').css('width', `${petState.hunger}%`);
        $('#pet-happiness-bar').css('width', `${petState.happiness}%`);
    };

    /**
     * 关闭宠物弹窗
     */
    const closePetPopup = () => {
        $(`#${PET_POPUP_ID}`).remove();
    };

    /**
     * 投喂宠物
     */
    const feedPet = () => {
        petState.hunger = Math.min(100, petState.hunger + 15);
        savePetState();
        updatePetPopup();
    };

    /**
     * 陪宠物玩
     */
    const playWithPet = () => {
        petState.happiness = Math.min(100, petState.happiness + 10);
        petState.hunger = Math.max(0, petState.hunger - 5);
        savePetState();
        updatePetPopup();
    };

    /**
     * 启动状态定时器
     */
    const startPetStatusTimer = () => {
        setInterval(() => {
            const now = Date.now();
            const timeDiffMinutes = (now - petState.lastUpdate) / (1000 * 60);
            if (timeDiffMinutes > 5) {
                petState.hunger = Math.max(0, petState.hunger - 2);
                petState.happiness = Math.max(0, petState.happiness - 1);
                savePetState();
                updatePetPopup();
            }
        }, 60 * 1000);
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
