document.addEventListener('DOMContentLoaded', function() {
    // ===== PixelCanvas 1984 - Main Application =====
    const app = {
        canvas: document.getElementById('pixelCanvas'),
        ctx: null,
        originalImage: null,
        pixelatedImage: null,
        pixelSize: 4, // Default pixel size (changed from 8 to 1)
        zoom: 1, // Default zoom level
        currentTool: 'pencil',
        currentColor: '#000000',
        brushSize: 1,
        history: [],
        historyIndex: -1,
        maxHistorySteps: 10,
        activeLayers: [],
        isDragging: false,
        lastX: 0,
        lastY: 0,
        selectedSticker: null,
        movingStickerMode: false, // 移动贴纸模式
        selectedLayer: null, // 当前选中的贴纸层
        stickerPlacementMode: false, // 贴纸放置模式
        customStickers: [], // 用户自定义的贴纸
        
        // Initialize application
        init: function() {
            // Setup canvas context
            this.ctx = this.canvas.getContext('2d');
            
            // Adjust canvas size to match container dimensions
            const canvasContainer = document.querySelector('.canvas-container');
            if (canvasContainer) {
                // Use setTimeout to ensure the container is fully rendered
                setTimeout(() => {
                    this.adjustCanvasSize();
                }, 100); // Small delay to ensure layout is complete
            }
            
            // Create initial blank canvas (with default size first)
            this.clearCanvas();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Initialize UI
            this.initUI();
            
            // Add to history
            this.saveToHistory();
            
            // MAC OS style menu interactions
            this.setupMacOSInteractions();
            
            // 检测移动设备并显示提示
            this.detectMobileDevice();
        },
        
        // 检测移动设备
        detectMobileDevice: function() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // 创建移动提示元素
                const mobileHint = document.createElement('div');
                mobileHint.className = 'mobile-hint';
                mobileHint.innerHTML = `
                    <div class="mobile-hint-content">
                        <p>检测到移动设备</p>
                        <p>提示: 横屏操作体验更佳</p>
                        <button class="mobile-hint-close">了解</button>
                    </div>
                `;
                
                document.body.appendChild(mobileHint);
                
                // 添加关闭按钮事件
                const closeButton = mobileHint.querySelector('.mobile-hint-close');
                closeButton.addEventListener('click', () => {
                    mobileHint.style.display = 'none';
                    
                    // 保存到本地存储，避免再次显示
                    try {
                        localStorage.setItem('pixelCanvasMobileHintShown', 'true');
                    } catch (e) {
                        console.log('无法保存设置');
                    }
                });
                
                // 检查是否已显示过
                try {
                    const hintShown = localStorage.getItem('pixelCanvasMobileHintShown');
                    if (hintShown === 'true') {
                        mobileHint.style.display = 'none';
                    }
                } catch (e) {
                    console.log('无法读取设置');
                }
            }
        },
        
        // Adjust canvas size to match container dimensions
        adjustCanvasSize: function(preserveContent = true) {
            const canvasContainer = document.querySelector('.canvas-container');
            if (!canvasContainer) return;
            
            // Get current canvas content if needed
            let currentContent = null;
            if (preserveContent && this.canvas.width > 0 && this.canvas.height > 0) {
                currentContent = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            }
            
            // 固定画布尺寸为720x418
            const newWidth = 720;
            const newHeight = 418;
            
            // Resize canvas
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            
            // Restore content if we had previous content
            if (currentContent) {
                this.ctx.putImageData(currentContent, 0, 0);
            } else {
                // If no content to preserve, clear to white
                this.clearCanvas();
            }
            
            // Update display text - 始终显示固定尺寸
            document.querySelector('.image-size').textContent = `${newWidth}x${newHeight}`;
            
            // Redraw layers if any
            if (this.activeLayers && this.activeLayers.length > 0) {
                this.redrawLayers();
            }
            
            // Add to history if this is not part of initialization
            if (preserveContent) {
                this.saveToHistory();
            }
        },
        
        // Initialize UI elements and interactions
        initUI: function() {
            // Select first tool and brush size - 默认选中铅笔工具
            document.querySelector('.tool[data-tool="pencil"]').classList.add('active');
            document.querySelector('.tool[data-size="1"]').classList.add('active');
            this.currentTool = 'pencil'; // 确保初始化时设置默认工具
            
            // Select first color
            document.querySelector('.color').classList.add('active');
            
            // Update pixel slider with new presets
            const pixelSlider = document.getElementById('pixelSize');
            pixelSlider.min = 1;  // Minimum 1x1
            pixelSlider.max = 6;  // Maximum 6x6
            pixelSlider.step = 1; // Steps of 1 (1,2,3,4,5,6)
            pixelSlider.value = this.pixelSize;
            this.updateSliderValue();
            
            // Initialize stickers
            this.initStickers();
            
            // 添加清除自定义贴纸按钮
            const stickerToolbar = document.querySelector('.sticker-toolbar');
            if (stickerToolbar) {
                const clearButtonContainer = document.createElement('div');
                clearButtonContainer.id = 'clear-stickers-container';
                clearButtonContainer.style.display = 'none';
                clearButtonContainer.style.marginTop = '10px';
                clearButtonContainer.style.textAlign = 'center';
                
                const clearButton = document.createElement('button');
                clearButton.textContent = '清除自定义贴纸';
                clearButton.className = 'clear-stickers-btn';
                clearButton.style.padding = '5px 10px';
                clearButton.style.borderRadius = '4px';
                clearButton.style.backgroundColor = '#ff5252';
                clearButton.style.color = 'white';
                clearButton.style.border = 'none';
                clearButton.style.cursor = 'pointer';
                
                clearButton.addEventListener('click', () => {
                    this.clearCustomStickers();
                });
                
                clearButtonContainer.appendChild(clearButton);
                stickerToolbar.appendChild(clearButtonContainer);
            }
        },
        
        // Attach all event listeners
        attachEventListeners: function() {
            // Tool selection
            document.querySelectorAll('.tool[data-tool]').forEach(tool => {
                tool.addEventListener('click', e => {
                    this.selectTool(e.currentTarget.dataset.tool);
                    this.macClickSound();
                });
            });
            
            // Brush size selection
            document.querySelectorAll('.tool[data-size]').forEach(size => {
                size.addEventListener('click', e => {
                    this.selectBrushSize(parseInt(e.currentTarget.dataset.size));
                    this.macClickSound();
                });
            });
            
            // Color selection
            document.querySelectorAll('.color').forEach(color => {
                color.addEventListener('click', e => {
                    this.selectColor(e.currentTarget.style.backgroundColor);
                    this.macClickSound();
                });
            });
            
            // Canvas interactions
            this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
            this.canvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleCanvasMouseLeave.bind(this));
            
            // Add canvas click handler for stickers
            this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
            
            // Keyboard controls for sticker rotation
            document.addEventListener('keydown', e => {
                // Rotate selected sticker with R key (15° clockwise)
                if (e.key === 'r' || e.key === 'R') {
                    this.rotateSelectedSticker(15);
                }
                
                // Rotate selected sticker with L key (15° counter-clockwise)
                if (e.key === 'l' || e.key === 'L') {
                    this.rotateSelectedSticker(-15);
                }
                
                // Delete selected sticker with Delete or Backspace key
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    this.deleteSelectedSticker();
                }
                
                // Move selected sticker with arrow keys (1px at a time, 10px with shift)
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    const selectedLayer = this.activeLayers.find(layer => layer.selected);
                    if (selectedLayer && this.currentTool === 'select') {
                        const step = e.shiftKey ? 10 : 1;
                        
                        if (e.key === 'ArrowUp') selectedLayer.y -= step;
                        else if (e.key === 'ArrowDown') selectedLayer.y += step;
                        else if (e.key === 'ArrowLeft') selectedLayer.x -= step;
                        else if (e.key === 'ArrowRight') selectedLayer.x += step;
                        
                        // Redraw layers
                        this.redrawLayers();
                        
                        // Prevent default behavior (page scrolling)
                        e.preventDefault();
                    }
                }
            });
            
            // Window resize event to adjust canvas size
            window.addEventListener('resize', () => {
                // Debounce the resize event to avoid excessive calculations
                if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
                
                this.resizeTimeout = setTimeout(() => {
                    this.adjustCanvasSize(true); // Preserve content
                }, 200); // Debounce delay
            });
            
            // Pixel slider with fixed presets
            document.getElementById('pixelSize').addEventListener('input', e => {
                this.pixelSize = parseInt(e.target.value);
                // Force values to be only 1, 2, 4, or 6
                if (![1, 2, 4, 6].includes(this.pixelSize)) {
                    // Round to nearest valid preset
                    if (this.pixelSize < 1) this.pixelSize = 1;
                    else if (this.pixelSize < 2) this.pixelSize = 1;
                    else if (this.pixelSize < 4) this.pixelSize = 2;
                    else if (this.pixelSize < 6) this.pixelSize = 4;
                    else this.pixelSize = 6;
                    
                    e.target.value = this.pixelSize;
                }
                this.updateSliderValue();
                if (this.originalImage) {
                    this.applyPixelEffect();
                }
            });
            
            // Zoom controls
            document.querySelectorAll('.zoom-button').forEach(button => {
                button.addEventListener('click', e => {
                    this.handleZoom(e.currentTarget.dataset.zoom);
                    this.macClickSound();
                });
            });
            
            // 添加导出按钮事件监听
            document.querySelector('.export-button').addEventListener('click', () => {
                this.exportImage();
                this.macClickSound();
            });
            
            // 创建清空按钮
            const canvasControls = document.querySelector('.canvas-controls');
            if (canvasControls) {
                // 检查是否已存在清空按钮
                if (!document.querySelector('.clear-button')) {
                    const clearButton = document.createElement('button');
                    clearButton.className = 'clear-button';
                    clearButton.textContent = '🗑️';
                    clearButton.title = '清空画布';
                    clearButton.style.marginLeft = '5px';
                    
                    // 在保存按钮之后插入
                    const exportButton = document.querySelector('.export-button');
                    if (exportButton) {
                        exportButton.insertAdjacentElement('afterend', clearButton);
                    } else {
                        canvasControls.appendChild(clearButton);
                    }
                    
                    // 添加清空画布事件
                    clearButton.addEventListener('click', () => {
                        if (confirm('确定要清空画布吗？此操作不可撤销。')) {
                            this.clearAll();
                            this.macClickSound();
                        }
                    });
                }
            }
            
            // Upload image
            document.querySelector('.upload-button').addEventListener('click', () => {
                document.getElementById('imageUpload').click();
                this.macClickSound();
            });
            
            document.getElementById('imageUpload').addEventListener('change', this.handleImageUpload.bind(this));
            
            // History control
            document.querySelector('.tool[data-tool="undo"]').addEventListener('click', () => {
                this.undo();
                this.macClickSound();
            });
            
            document.querySelector('.tool[data-tool="redo"]').addEventListener('click', () => {
                this.redo();
                this.macClickSound();
            });
            
            // Sticker tabs
            document.querySelectorAll('.sticker-tab').forEach(tab => {
                tab.addEventListener('click', e => {
                    this.switchStickerTab(e.currentTarget.dataset.category);
                    this.macClickSound();
                });
            });
            
            // Sticker upload
            document.querySelector('.sticker-upload').addEventListener('click', () => {
                document.getElementById('stickerUpload').click();
                this.macClickSound();
            });
            
            document.getElementById('stickerUpload').addEventListener('change', this.handleStickerUpload.bind(this));
        },
        
        // Clear canvas to white
        clearCanvas: function() {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        },
        
        // 清空整个画布和所有贴纸
        clearAll: function() {
            // 询问用户是否同时清除贴纸
            const clearStickers = confirm('是否同时清除贴纸？点击"确定"清除全部内容，点击"取消"仅清除图片保留贴纸。');
            
            // 清空画布
            this.clearCanvas();
            
            // 清除原始图像和像素化图像
            this.originalImage = null;
            this.pixelatedImage = null;
            
            if (clearStickers) {
                // 移除所有贴纸层
                this.activeLayers = [];
                this.selectedLayer = null;
                this.movingStickerMode = false;
                this.stickerPlacementMode = false;
                
                // 显示提示
                this.showHint('画布和贴纸已全部清空');
            } else {
                // 保留贴纸，仅重绘图层
                this.redrawLayers();
                
                // 显示提示
                this.showHint('画布已清空，贴纸已保留');
            }
            
            // 重绘画布
            this.redrawLayers();
            
            // 保存到历史记录
            this.saveToHistory();
        },
        
        // 导出图像功能
        exportImage: function() {
            try {
                // 创建临时画布以便绘制最终图像（包括所有贴纸）
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // 绘制主画布内容
                tempCtx.drawImage(this.canvas, 0, 0);
                
                // 创建临时链接并触发下载
                const link = document.createElement('a');
                link.download = `pixelcanvas_${new Date().toISOString().slice(0,10)}.png`;
                
                // 使用toBlob而不是toDataURL以提高性能
                tempCanvas.toBlob(blob => {
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    
                    // 释放URL对象
                    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
                    
                    // 显示提示
                    this.showHint('图像已保存');
                }, 'image/png');
            } catch (error) {
                console.error('导出图像失败:', error);
                alert('导出图像失败，请重试');
            }
        },
        
        // Select active tool
        selectTool: function(tool) {
            // 检查是否点击已选中的工具（铅笔或橡皮擦）- 实现二次点击取消选择
            if ((tool === 'pencil' || tool === 'eraser') && this.currentTool === tool) {
                // 当前工具已被选中，取消选择
                document.querySelector(`.tool[data-tool="${tool}"]`).classList.remove('active');
                this.currentTool = 'none'; // 设置为无工具选中状态
                return; // 退出函数，不执行后续步骤
            }
            
            // Remove active class from all tools
            document.querySelectorAll('.tool[data-tool]').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to selected tool
            document.querySelector(`.tool[data-tool="${tool}"]`).classList.add('active');
            
            // Update current tool
            this.currentTool = tool;
            
            // 如果选择了绘图工具，取消贴纸选中和放置模式
            if (tool === 'pencil' || tool === 'eraser') {
                // 取消贴纸选中状态
                if (this.selectedLayer || this.activeLayers.some(layer => layer.selected)) {
                    this.activeLayers.forEach(layer => layer.selected = false);
                    this.selectedLayer = null;
                    this.movingStickerMode = false;
                    this.redrawLayers();
                }
                
                // 退出贴纸放置模式
                this.stickerPlacementMode = false;
                this.selectedSticker = null;
            }
        },
        
        // Select brush size
        selectBrushSize: function(size) {
            // Remove active class from all size tools
            document.querySelectorAll('.tool[data-size]').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to selected size
            document.querySelector(`.tool[data-size="${size}"]`).classList.add('active');
            
            // Update current brush size
            this.brushSize = size;
        },
        
        // Select color
        selectColor: function(color) {
            // Remove active class from all colors
            document.querySelectorAll('.color').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to selected color
            event.currentTarget.classList.add('active');
            
            // Update current color
            this.currentColor = color;
        },
        
        // Update slider value display
        updateSliderValue: function() {
            document.querySelector('.slider-value').textContent = `${this.pixelSize}x${this.pixelSize}`;
        },
        
        // Handle image upload
        handleImageUpload: function(e) {
            const file = e.target.files[0];
            
            if (file && file.type.match('image.*') && file.size <= 5 * 1024 * 1024) { // 5MB max
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // 保存现有的贴纸层，以便稍后恢复
                        const savedLayers = [...this.activeLayers];
                        
                        // 清空画布，但不清除贴纸层
                        this.ctx.fillStyle = '#FFFFFF';
                        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                        
                        // 计算图片的缩放比例，使其适应画布
                        const scale = Math.min(
                            this.canvas.width / img.width,
                            this.canvas.height / img.height
                        );
                        
                        // 计算居中位置
                        const x = (this.canvas.width - img.width * scale) / 2;
                        const y = (this.canvas.height - img.height * scale) / 2;
                        
                        // 按比例缩放并居中绘制图片
                        this.ctx.drawImage(
                            img,
                            0, 0, img.width, img.height,
                            x, y, img.width * scale, img.height * scale
                        );
                        
                        // 保存原始图像
                        this.originalImage = img;
                        
                        // 应用像素效果，但不要重绘贴纸层
                        this.applyPixelEffectWithoutLayers();
                        
                        // 添加调试日志
                        console.log('图片处理完成，pixelatedImage类型:', this.pixelatedImage ? (this.pixelatedImage.nodeName || '非DOM对象') : 'null');
                        
                        // 恢复贴纸层
                        this.activeLayers = savedLayers;
                        
                        // 重绘所有贴纸层
                        this.redrawLayers();
                        
                        // 保存到历史记录（包含图片和贴纸）
                        this.saveToHistory();
                        
                        // 显示提示
                        this.showHint('图片已应用，贴纸已保留');
                    };
                    
                    img.src = event.target.result;
                };
                
                reader.readAsDataURL(file);
            } else {
                alert('请选择5MB以内的图片文件。');
            }
            
            // Clear file input
            e.target.value = '';
        },
        
        // 应用像素效果但不处理贴纸层 - 供handleImageUpload使用
        applyPixelEffectWithoutLayers: function() {
            if (!this.originalImage) return;
            
            // Create a temporary canvas for pixelation
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            
            // 计算图片的缩放比例，使其适应画布
            const scale = Math.min(
                this.canvas.width / this.originalImage.width,
                this.canvas.height / this.originalImage.height
            );
            
            // 计算居中位置
            const x = (this.canvas.width - this.originalImage.width * scale) / 2;
            const y = (this.canvas.height - this.originalImage.height * scale) / 2;
            
            // 清空临时画布
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 按比例缩放并居中绘制图片到临时画布
            tempCtx.drawImage(
                this.originalImage,
                0, 0, this.originalImage.width, this.originalImage.height,
                x, y, this.originalImage.width * scale, this.originalImage.height * scale
            );
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Apply pixelation effect
            const pixelatedData = this.pixelateImage(imageData, this.pixelSize);
            
            // Put the processed image data back on the canvas
            this.ctx.putImageData(pixelatedData, 0, 0);
            
            // 直接在主画布上应用像素化效果，而不是创建新图像
            // 这样可以避免图像加载的异步问题
            this.pixelatedImage = null; // 清除旧的图像引用
            
            // 创建一个副本来存储像素化后的图像数据
            const pixelatedCanvas = document.createElement('canvas');
            pixelatedCanvas.width = this.canvas.width;
            pixelatedCanvas.height = this.canvas.height;
            const pixelatedCtx = pixelatedCanvas.getContext('2d');
            pixelatedCtx.putImageData(pixelatedData, 0, 0);
            
            // 直接将Canvas作为pixelatedImage使用，避免异步加载问题
            this.pixelatedImage = pixelatedCanvas;
            
            // 注意：此函数不保存历史记录，也不重绘贴纸层
            // 由调用者处理贴纸层和历史记录
        },
        
        // Apply pixel effect to canvas
        applyPixelEffect: function() {
            if (!this.originalImage) return;
            
            // 保存现有的贴纸层，以便稍后恢复
            const savedLayers = [...this.activeLayers];
            
            // Create a temporary canvas for pixelation
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            
            // 计算图片的缩放比例，使其适应画布
            const scale = Math.min(
                this.canvas.width / this.originalImage.width,
                this.canvas.height / this.originalImage.height
            );
            
            // 计算居中位置
            const x = (this.canvas.width - this.originalImage.width * scale) / 2;
            const y = (this.canvas.height - this.originalImage.height * scale) / 2;
            
            // 清空临时画布
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 按比例缩放并居中绘制图片到临时画布
            tempCtx.drawImage(
                this.originalImage,
                0, 0, this.originalImage.width, this.originalImage.height,
                x, y, this.originalImage.width * scale, this.originalImage.height * scale
            );
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Apply pixelation effect
            const pixelatedData = this.pixelateImage(imageData, this.pixelSize);
            
            // Put the processed image data back on the canvas
            this.ctx.putImageData(pixelatedData, 0, 0);
            
            // 直接在主画布上应用像素化效果，而不是创建新图像
            // 这样可以避免图像加载的异步问题
            this.pixelatedImage = null; // 清除旧的图像引用
            
            // 创建一个副本来存储像素化后的图像数据
            const pixelatedCanvas = document.createElement('canvas');
            pixelatedCanvas.width = this.canvas.width;
            pixelatedCanvas.height = this.canvas.height;
            const pixelatedCtx = pixelatedCanvas.getContext('2d');
            pixelatedCtx.putImageData(pixelatedData, 0, 0);
            
            // 直接将Canvas作为pixelatedImage使用，避免异步加载问题
            this.pixelatedImage = pixelatedCanvas;
            
            // 恢复贴纸层
            this.activeLayers = savedLayers;
            
            // Save to history
            this.saveToHistory();
            
            // Redraw layers if any exist
            if (this.activeLayers && this.activeLayers.length > 0) {
            this.redrawLayers();
            }
        },
        
        // Handle canvas mouse down
        handleCanvasMouseDown: function(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.zoom);
            const y = Math.floor((e.clientY - rect.top) / this.zoom);
            
            this.lastX = x;
            this.lastY = y;
            
            // 处理贴纸放置模式
            if (this.stickerPlacementMode && this.selectedSticker) {
                this.placeSticker(this.selectedSticker, e);
                return;
            }
            
            // 检查是否点击了已存在的贴纸
            const clickedLayer = this.findLayerAtPosition(x, y);
            if (clickedLayer) {
                // 选择该贴纸，取消选择其他贴纸
                this.activeLayers.forEach(layer => layer.selected = false);
                clickedLayer.selected = true;
                this.selectedLayer = clickedLayer; // 设置为当前选中贴纸
                
                // 进入移动模式
                this.movingStickerMode = true;
                
                // 退出贴纸放置模式
                this.stickerPlacementMode = false;
                
                // 重绘以显示选择状态
                this.redrawLayers();
                
                // 阻止继续处理，避免绘制到画布上
                return;
            } else {
                // 点击空白处，取消贴纸选中状态
                if (this.selectedLayer || this.activeLayers.some(layer => layer.selected)) {
                    // 取消所有贴纸的选中状态
                    this.activeLayers.forEach(layer => layer.selected = false);
                    // 清除当前选中的贴纸引用
                    this.selectedLayer = null;
                    // 退出移动模式
                    this.movingStickerMode = false;
                    // 重绘以更新视图（移除蓝色虚线框）
                    this.redrawLayers();
                }
            }
            
            // 如果没有工具被选中或处于"none"状态，不执行绘图操作
            if (this.currentTool === 'none') {
                return;
            }
            
            // 对于其他工具，继续正常的绘制行为
            this.isDragging = true;
            
            // 执行基于当前工具的操作
            if (this.currentTool === 'pencil') {
                this.drawPixel(x, y);
            } else if (this.currentTool === 'eraser') {
                this.erasePixel(x, y);
            }
            
            // 更新光标位置
            this.updateCursorPosition(x, y);
        },
        
        // Handle canvas mouse move
        handleCanvasMouseMove: function(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.zoom);
            const y = Math.floor((e.clientY - rect.top) / this.zoom);
            
            // 处理贴纸移动
            if (this.movingStickerMode && this.selectedLayer) {
                // 计算移动距离
                const deltaX = x - this.lastX;
                const deltaY = y - this.lastY;
                
                // 移动贴纸（可选是否对齐网格）
                if (e.shiftKey) {
                    // 对齐网格
                    this.selectedLayer.x = Math.floor((this.selectedLayer.x + deltaX) / this.pixelSize) * this.pixelSize;
                    this.selectedLayer.y = Math.floor((this.selectedLayer.y + deltaY) / this.pixelSize) * this.pixelSize;
                } else {
                    // 自由移动
                    this.selectedLayer.x += deltaX;
                    this.selectedLayer.y += deltaY;
                }
                
                // 重绘图层
                this.redrawLayers();
                
                this.lastX = x;
                this.lastY = y;
                return;
            }
            
            // 更新光标位置
            this.updateCursorPosition(x, y);
            
            // 如果没有工具被选中或处于"none"状态，不执行绘图操作
            if (this.currentTool === 'none') {
                return;
            }
            
            if (!this.isDragging) return;
            
            // 执行绘制操作
            if (this.currentTool === 'pencil') {
                this.drawLine(this.lastX, this.lastY, x, y);
            } else if (this.currentTool === 'eraser') {
                this.eraseLine(this.lastX, this.lastY, x, y);
            }
            
            this.lastX = x;
            this.lastY = y;
        },
        
        // Handle canvas mouse up
        handleCanvasMouseUp: function() {
            // 如果正在移动贴纸，保存贴纸位置
            if (this.movingStickerMode) {
                this.movingStickerMode = false;
                this.saveToHistory();
            }
            
            if (this.isDragging) {
                this.isDragging = false;
                this.saveToHistory();
            }
        },
        
        // Handle canvas mouse leave
        handleCanvasMouseLeave: function() {
            // 如果鼠标离开画布，取消移动模式
            if (this.movingStickerMode) {
                this.movingStickerMode = false;
                this.saveToHistory();
            }
            
            if (this.isDragging) {
                this.isDragging = false;
                this.saveToHistory();
            }
        },
        
        // Update cursor position display
        updateCursorPosition: function(x, y) {
            document.querySelector('.cursor-position').textContent = `X: ${x} Y: ${y}`;
        },
        
        // Draw a pixel at specified coordinates
        drawPixel: function(x, y) {
            const size = this.brushSize * this.pixelSize;
            const snap = this.pixelSize;
            
            // Snap to grid
            const snapX = Math.floor(x / snap) * snap;
            const snapY = Math.floor(y / snap) * snap;
            
            this.ctx.fillStyle = this.currentColor;
            this.ctx.fillRect(snapX, snapY, size, size);
        },
        
        // Draw a line using Bresenham algorithm
        drawLine: function(x0, y0, x1, y1) {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;
            
            while (true) {
                this.drawPixel(x0, y0);
                
                if (x0 === x1 && y0 === y1) break;
                
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x0 += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y0 += sy;
                }
            }
        },
        
        // Erase at specific position (draw white)
        erasePixel: function(x, y) {
            const size = this.brushSize * this.pixelSize;
            const snap = this.pixelSize;
            
            // Snap to grid
            const snapX = Math.floor(x / snap) * snap;
            const snapY = Math.floor(y / snap) * snap;
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(snapX, snapY, size, size);
        },
        
        // Erase along a line
        eraseLine: function(x0, y0, x1, y1) {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;
            
            while (true) {
                this.erasePixel(x0, y0);
                
                if (x0 === x1 && y0 === y1) break;
                
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x0 += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y0 += sy;
                }
            }
        },
        
        // Fill area with current color (flood fill)
        fillArea: function(x, y) {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Get color at starting position
            const startPos = (y * width + x) * 4;
            const startR = data[startPos];
            const startG = data[startPos + 1];
            const startB = data[startPos + 2];
            const startA = data[startPos + 3];
            
            // Convert current color to rgba
            const colorDiv = document.createElement('div');
            colorDiv.style.color = this.currentColor;
            document.body.appendChild(colorDiv);
            const colorStyle = window.getComputedStyle(colorDiv).color;
            document.body.removeChild(colorDiv);
            
            const rgbaMatch = colorStyle.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.?\d*))?\)/);
            const targetR = parseInt(rgbaMatch[1]);
            const targetG = parseInt(rgbaMatch[2]);
            const targetB = parseInt(rgbaMatch[3]);
            const targetA = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) * 255 : 255;
            
            // If target color is the same as start color, do nothing
            if (startR === targetR && startG === targetG && startB === targetB && startA === targetA) {
                return;
            }
            
            // Queue for flood fill
            const queue = [];
            queue.push([x, y]);
            
            // Visited pixels
            const visited = new Set();
            visited.add(`${x},${y}`);
            
            // Flood fill
            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                const pos = (cy * width + cx) * 4;
                
                // Change pixel color
                data[pos] = targetR;
                data[pos + 1] = targetG;
                data[pos + 2] = targetB;
                data[pos + 3] = targetA;
                
                // Check adjacent pixels
                const neighbors = [
                    [cx + 1, cy], // right
                    [cx - 1, cy], // left
                    [cx, cy + 1], // bottom
                    [cx, cy - 1]  // top
                ];
                
                for (const [nx, ny] of neighbors) {
                    // Check if pixel is within canvas bounds
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                        continue;
                    }
                    
                    // Check if already visited
                    const key = `${nx},${ny}`;
                    if (visited.has(key)) {
                        continue;
                    }
                    
                    // Check if color matches start color
                    const npos = (ny * width + nx) * 4;
                    if (
                        data[npos] === startR &&
                        data[npos + 1] === startG &&
                        data[npos + 2] === startB &&
                        data[npos + 3] === startA
                    ) {
                        queue.push([nx, ny]);
                        visited.add(key);
                    }
                }
            }
            
            // Update canvas with new image data
            this.ctx.putImageData(imageData, 0, 0);
        },
        
        // Handle zoom controls
        handleZoom: function(direction) {
            if (direction === 'in' && this.zoom < 4) {
                this.zoom += 0.25;
            } else if (direction === 'out' && this.zoom > 0.25) {
                this.zoom -= 0.25;
            }
            
            // Apply zoom to canvas
            this.canvas.style.transform = `scale(${this.zoom})`;
            
            // Update zoom level display
            document.querySelector('.zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
        },
        
        // Save current state to history
        saveToHistory: function() {
            // If we're not at the end of history, truncate
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }
            
            // Add current state to history
            this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
            
            // Limit history size
            if (this.history.length > this.maxHistorySteps) {
                this.history.shift();
            } else {
                this.historyIndex++;
            }
            
            // Update history steps display
            this.updateHistorySteps();
        },
        
        // Update history steps display
        updateHistorySteps: function() {
            document.querySelector('.history-steps').textContent = `${this.historyIndex + 1}/${this.history.length}`;
        },
        
        // Undo last action
        undo: function() {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
                this.updateHistorySteps();
            }
        },
        
        // Redo last undone action
        redo: function() {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
                this.updateHistorySteps();
            }
        },
        
        // Initialize stickers
        initStickers: function() {
            // 从本地存储加载自定义贴纸
            this.loadCustomStickers();
            
            // 输出调试信息
            console.log('初始化时加载的自定义贴纸数量:', this.customStickers.length);
            
            // 从mac_icons文件夹加载图标
            const macStickers = [];
            // 加载32个本地mac图标（基于文件夹中的实际数量）
            for (let i = 1; i <= 32; i++) {
                macStickers.push(`mac_icons/Icon Frame${i === 1 ? '' : '-' + i}.png`);
            }
            
            // Emoji stickers
            const emojiStickers = [
                '😀', '😎', '🤖', '👾', '🐱', '🐶', '🍎', '🍕', '🚀', '⭐', '💾', '📱',
                '🔍', '🎮', '🎲', '🎨'
            ];
            
            // Frame stickers - decorative borders for pixel art
            const frameStickers = [
                'https://i.ibb.co/QPY9DpK/frame-simple.png',
                'https://i.ibb.co/0JNXJ2y/frame-double.png',
                'https://i.ibb.co/kqR0VSL/frame-dashed.png',
                'https://i.ibb.co/n73tPcN/frame-retro.png',
                'https://i.ibb.co/kD4qxVc/frame-pixel.png',
                'https://i.ibb.co/mzw0gpB/frame-round.png',
                'https://i.ibb.co/tYGf8VK/frame-shadow.png',
                'https://i.ibb.co/P5xzSMn/frame-window.png',
                'https://i.ibb.co/DgLv3CC/frame-square.png',
                'https://i.ibb.co/sPmRVg1/frame-mac.png',
                'https://i.ibb.co/1d1jfT9/frame-classic.png',
                'https://i.ibb.co/6YwWvqH/frame-dots.png'
            ];
            
            // 合并默认图标和自定义图标
            const combinedMacStickers = [...macStickers, ...this.customStickers];
            
            // 清空容器
            const macContainer = document.querySelector('.sticker-group[data-category="mac"]');
            const emojiContainer = document.querySelector('.sticker-group[data-category="emoji"]');
            const framesContainer = document.querySelector('.sticker-group[data-category="frames"]');
            
            if (macContainer) macContainer.innerHTML = '';
            if (emojiContainer) emojiContainer.innerHTML = '';
            if (framesContainer) framesContainer.innerHTML = '';
            
            // Create stickers
            this.createStickers('mac', combinedMacStickers);
            this.createEmojiStickers('emoji', emojiStickers);
            this.createStickers('frames', frameStickers);
            
            // Initialize layer system
            this.activeLayers = [];
            
            // 默认显示mac标签
            this.switchStickerTab('mac');
        },
        
        // Create sticker elements
        createStickers: function(category, stickerUrls) {
            const container = document.querySelector(`.sticker-group[data-category="${category}"]`);
            
            stickerUrls.forEach(url => {
                const sticker = document.createElement('div');
                sticker.className = 'sticker';
                sticker.dataset.src = url;
                
                // 添加初始加载状态
                sticker.classList.add('loading');
                
                const img = document.createElement('img');
                img.width = 48;
                img.height = 48;
                
                // 优化图片加载错误处理
                img.onerror = () => {
                    console.error(`无法加载贴纸图片: ${url}`);
                    sticker.classList.remove('loading');
                    sticker.classList.add('loading-error');
                    sticker.innerHTML = '<span style="font-size: 24px; color: #ff5252;">⚠️</span>';
                };
                
                // 图片成功加载时
                img.onload = () => {
                    sticker.classList.remove('loading');
                };
                
                // 设置图片源
                img.src = url;
                
                sticker.appendChild(img);
                container.appendChild(sticker);
                
                // 添加点击事件
                sticker.addEventListener('click', () => {
                    this.selectSticker(sticker);
                    this.macClickSound();
                });
            });
            
            // 如果是mac类别且没有任何图标显示，显示错误信息
            if (category === 'mac' && stickerUrls.length === 0) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'sticker-error-message';
                errorMsg.textContent = '无法加载mac_icons文件夹中的图片';
                errorMsg.style.color = '#ff5252';
                errorMsg.style.textAlign = 'center';
                errorMsg.style.width = '100%';
                errorMsg.style.padding = '10px';
                container.appendChild(errorMsg);
            }
        },
        
        // Create emoji stickers
        createEmojiStickers: function(category, emojis) {
            const container = document.querySelector(`.sticker-group[data-category="${category}"]`);
            
            emojis.forEach(emoji => {
                const sticker = document.createElement('div');
                sticker.className = 'sticker';
                sticker.dataset.emoji = emoji;
                sticker.style.fontSize = '32px';
                sticker.textContent = emoji;
                
                container.appendChild(sticker);
                
                // Add click event
                sticker.addEventListener('click', () => {
                    this.selectSticker(sticker);
                    this.macClickSound();
                });
            });
        },
        
        // Switch sticker tab
        switchStickerTab: function(category) {
            // Hide all tabs
            document.querySelectorAll('.sticker-group').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // Show selected tab
            const selectedTab = document.querySelector(`.sticker-group[data-category="${category}"]`);
            if (selectedTab) {
                selectedTab.style.display = 'flex';
            }
            
            // Update active tab
            document.querySelectorAll('.sticker-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            document.querySelector(`.sticker-tab[data-category="${category}"]`).classList.add('active');
            
            // 如果是Mac标签，显示清除按钮
            const clearButtonContainer = document.getElementById('clear-stickers-container');
            if (clearButtonContainer) {
                if (category === 'mac' && this.customStickers.length > 0) {
                    clearButtonContainer.style.display = 'block';
                } else {
                    clearButtonContainer.style.display = 'none';
                }
            }
        },
        
        // Select sticker
        selectSticker: function(sticker) {
            // Remove active class from all stickers
            document.querySelectorAll('.sticker').forEach(s => {
                s.classList.remove('active');
            });
            
            // Add active class to selected sticker
            sticker.classList.add('active');
            
            // Set as selected sticker
            this.selectedSticker = sticker;
            
            // 保存当前工具，以便稍后恢复
            this.previousTool = this.currentTool;
            
            // 进入贴纸放置模式（不再需要select工具）
            this.stickerPlacementMode = true;
            
            // 在贴纸放置模式下，停用其他绘图功能
            // 但不更改工具栏的视觉显示，仅在功能上禁用
        },
        
        // Place sticker on canvas
        placeSticker: function(sticker, event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left) / this.zoom);
            const y = Math.floor((event.clientY - rect.top) / this.zoom);
            
            // 当点击时，如果不是在放置模式，则尝试选中贴纸，而不是创建新贴纸
            if (!this.stickerPlacementMode) {
                return;
            }
            
            // Check if we clicked on an existing sticker
            const clickedLayer = this.findLayerAtPosition(x, y);
            if (clickedLayer) {
                // Select this layer instead of placing a new sticker
                this.activeLayers.forEach(layer => layer.selected = false);
                clickedLayer.selected = true;
                this.selectedLayer = clickedLayer; // 设置为当前选中贴纸
                
                // 退出贴纸放置模式
                this.stickerPlacementMode = false;
                
                // 进入移动模式
                this.movingStickerMode = true;
                
                // Redraw to show selection
                this.redrawLayers();
                
                // Show hint
                this.showHint('已选中贴纸。拖动可移动贴纸，按R/L键可旋转。');
                
                return;
            }
            
            // Snap to grid based on pixel size
            const snapX = Math.floor(x / this.pixelSize) * this.pixelSize;
            const snapY = Math.floor(y / this.pixelSize) * this.pixelSize;
            
            // Create a new layer for the sticker
            const layer = {
                type: 'sticker',
                x: snapX,
                y: snapY,
                rotation: 0,
                scale: 1,
                zIndex: this.activeLayers.length + 1,
                selected: true // New sticker is selected by default
            };
            
            // 为所有贴纸类型统一添加宽高属性，便于后续碰撞检测和绘制
            if (sticker.dataset.emoji) {
                layer.emoji = sticker.dataset.emoji;
                layer.width = 42;  // emoji的标准宽度
                layer.height = 42; // emoji的标准高度
            } else if (sticker.dataset.src) {
                layer.src = sticker.dataset.src;
                // 对于图片贴纸，假设标准尺寸为48x48
                layer.width = 48;
                layer.height = 48;
                
                // 可选：加载图片获取实际尺寸
                const img = new Image();
                img.onload = () => {
                    layer.width = img.width;
                    layer.height = img.height;
                    // 图片加载后重绘
                    this.redrawLayers();
                };
                img.src = sticker.dataset.src;
            }
            
            // Deselect all other layers
            this.activeLayers.forEach(layer => layer.selected = false);
            
            // Add to active layers
            this.activeLayers.push(layer);
            this.selectedLayer = layer;
            
            // 放置后退出贴纸放置模式，避免意外创建多个贴纸
            this.stickerPlacementMode = false;
            
            // 放置后启用移动模式，方便用户立即调整位置
            this.movingStickerMode = true;
            
            // Redraw all layers
            this.redrawLayers();
            
            // Save to history
            this.saveToHistory();
            
            // Play Mac click sound
            this.macClickSound();
            
            // Show hint about moving the placed sticker
            this.showHint('贴纸已放置。拖动可移动贴纸，按R/L键可旋转。');
        },
        
        // Delete the currently selected sticker
        deleteSelectedSticker: function() {
            const selectedIndex = this.activeLayers.findIndex(layer => layer.selected);
            if (selectedIndex !== -1) {
                // Remove the selected layer
                this.activeLayers.splice(selectedIndex, 1);
                this.selectedLayer = null;
                
                // Redraw all layers
                this.redrawLayers();
                
                // Save to history
                this.saveToHistory();
                
                // Play Mac click sound
                this.macClickSound();
                
                // Show hint
                this.showHint('Sticker deleted.');
            }
        },
        
        // Show hint message
        showHint: function(message) {
            // 禁止显示提示信息
            return;
        },
        
        // Handle canvas click (for sticker placement)
        handleCanvasClick: function(event) {
            // 如果是在贴纸放置模式，则已在mousedown中处理
            if (this.stickerPlacementMode) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left) / this.zoom);
            const y = Math.floor((event.clientY - rect.top) / this.zoom);
            
            // 检查是否点击了已存在的贴纸
            const clickedLayer = this.findLayerAtPosition(x, y);
            
            if (!clickedLayer) {
                // 点击空白处，取消贴纸选中状态
                if (this.selectedLayer || this.activeLayers.some(layer => layer.selected)) {
                    // 取消所有贴纸的选中状态
                    this.activeLayers.forEach(layer => layer.selected = false);
                    // 清除当前选中的贴纸引用
                    this.selectedLayer = null;
                    // 退出移动模式
                    this.movingStickerMode = false;
                    // 重绘以更新视图（移除蓝色虚线框）
                    this.redrawLayers();
                }
            }
        },
        
        // Redraw all layers
        redrawLayers: function() {
            // Create a copy of the current canvas state
            const baseCanvas = document.createElement('canvas');
            baseCanvas.width = this.canvas.width;
            baseCanvas.height = this.canvas.height;
            const baseCtx = baseCanvas.getContext('2d');
            
            // Draw the pixel art background
            if (this.pixelatedImage) {
                baseCtx.drawImage(this.pixelatedImage, 0, 0);
            } else {
                baseCtx.fillStyle = '#FFFFFF';
                baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
            }
            
            // Copy to main canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(baseCanvas, 0, 0);
            
            // Sort layers by z-index
            const sortedLayers = [...this.activeLayers].sort((a, b) => a.zIndex - b.zIndex);
            
            // Process each layer
            sortedLayers.forEach(layer => {
                if (layer.type === 'sticker') {
                    if (layer.src) {
                        // Image sticker
                        const img = new Image();
                        
                        // 为图片添加加载完成的处理
                        img.onload = () => {
                            // 更新图片的实际尺寸
                            if (!layer.width) layer.width = img.width;
                            if (!layer.height) layer.height = img.height;
                            
                            // Apply sticker with shadow effect
                            this.ctx.save();
                            
                            // 居中定位方式 - 与emoji一致
                            const centerX = layer.x + layer.width / 2;
                            const centerY = layer.y + layer.height / 2;
                            this.ctx.translate(centerX, centerY);
                            
                            // Apply rotation if any (in 15° steps)
                            if (layer.rotation) {
                                this.ctx.rotate(layer.rotation * Math.PI / 180);
                            }
                            
                            // Scale if needed
                            if (layer.scale !== 1) {
                                this.ctx.scale(layer.scale, layer.scale);
                            }
                            
                            // Draw selection highlight if selected
                            if (layer.selected) {
                                this.ctx.strokeStyle = '#0095ff';
                                this.ctx.lineWidth = 2 / (layer.scale || 1);
                                this.ctx.setLineDash([5 / (layer.scale || 1), 3 / (layer.scale || 1)]);
                                this.ctx.strokeRect(-layer.width/2 - 4 / (layer.scale || 1), 
                                                  -layer.height/2 - 4 / (layer.scale || 1), 
                                                  layer.width + 8 / (layer.scale || 1), 
                                                  layer.height + 8 / (layer.scale || 1));
                            }
                            
                            // Draw shadow (1px offset)
                            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                            this.ctx.shadowBlur = 0;
                            this.ctx.shadowOffsetX = 1;
                            this.ctx.shadowOffsetY = 1;
                            
                            // Draw the sticker
                            this.ctx.drawImage(img, -layer.width/2, -layer.height/2, layer.width, layer.height);
                            
                            this.ctx.restore();
                        };
                        
                        // 设置图片源
                        img.src = layer.src;
                        
                        // 如果已经缓存，立即触发加载
                        if (img.complete) {
                            img.onload();
                        }
                    } else if (layer.emoji) {
                        // Emoji sticker
                        this.ctx.save();
                        
                        // Position and styling - 与MAC图标保持一致的居中绘制
                        const centerX = layer.x + layer.width / 2;
                        const centerY = layer.y + layer.height / 2;
                        this.ctx.translate(centerX, centerY);
                        
                        this.ctx.font = '32px Arial';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.textAlign = 'center';
                        
                        // Apply rotation if any
                        if (layer.rotation) {
                            this.ctx.rotate(layer.rotation * Math.PI / 180);
                        }
                        
                        // Draw selection highlight if selected
                        if (layer.selected) {
                            this.ctx.strokeStyle = '#0095ff';
                            this.ctx.lineWidth = 2;
                            this.ctx.setLineDash([5, 3]);
                            // 居中绘制选中框
                            this.ctx.strokeRect(-layer.width/2 - 4, -layer.height/2 - 4, 
                                              layer.width + 8, layer.height + 8);
                        }
                        
                        // Draw shadow (1px offset)
                        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                        this.ctx.shadowBlur = 0;
                        this.ctx.shadowOffsetX = 1;
                        this.ctx.shadowOffsetY = 1;
                        
                        // Draw the emoji - 居中绘制
                        this.ctx.fillText(layer.emoji, 0, 0);
                        
                        this.ctx.restore();
                    }
                }
            });
            
            // Update layer UI (if needed)
            if (document.querySelector('.history-steps')) {
                const layerInfo = this.activeLayers.length > 0 ? 
                    ` (${this.activeLayers.length} layer${this.activeLayers.length > 1 ? 's' : ''})` : '';
                document.querySelector('.history-steps').textContent = 
                    `${this.historyIndex + 1}/${this.history.length}${layerInfo}`;
            }
        },
        
        // Find layer at position (for sticker selection)
        findLayerAtPosition: function(x, y) {
            // 从顶层（最后添加）向下搜索
            for (let i = this.activeLayers.length - 1; i >= 0; i--) {
                const layer = this.activeLayers[i];
                
                if (layer.type === 'sticker') {
                    // 获取贴纸的中心点
                    const centerX = layer.x + (layer.width || 48) / 2;
                    const centerY = layer.y + (layer.height || 48) / 2;
                    
                    // 考虑旋转和缩放的半径
                    const scale = layer.scale || 1;
                    const radius = Math.max((layer.width || 48), (layer.height || 48)) / 2 * scale;
                    
                    // 点击点到中心点的距离
                    const distance = Math.sqrt(
                        Math.pow(x - centerX, 2) + 
                        Math.pow(y - centerY, 2)
                    );
                    
                    // 使用圆形碰撞检测，统一emoji和Mac图标的检测方式
                    // 增加点击区域容差
                    if (distance <= radius * 1.2) {
                        return layer;
                    }
                }
            }
            
            return null;
        },
        
        // Rotate selected sticker
        rotateSelectedSticker: function(degrees) {
            // Find selected layer
            const selectedLayer = this.activeLayers.find(layer => layer.selected);
            
            if (selectedLayer) {
                // Apply rotation in 15° steps
                selectedLayer.rotation = (selectedLayer.rotation + degrees) % 360;
                
                // Play Mac click sound
                this.macClickSound();
                
                // Redraw layers
                this.redrawLayers();
                
                // Save to history
                this.saveToHistory();
            }
        },
        
        // Handle sticker upload
        handleStickerUpload: function(e) {
            const file = e.target.files[0];
            
            if (file && file.type === 'image/png') {
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const imageDataUrl = event.target.result;
                    
                    // 添加到自定义贴纸数组
                    this.customStickers.push(imageDataUrl);
                    
                    // 保存到本地存储
                    this.saveCustomStickers();
                    
                    // 清空MAC图标容器
                    const container = document.querySelector('.sticker-group[data-category="mac"]');
                    container.innerHTML = '';
                    
                    // 从mac_icons文件夹加载图标
                    const macStickers = [];
                    // 加载32个本地mac图标（基于文件夹中的实际数量）
                    for (let i = 1; i <= 32; i++) {
                        macStickers.push(`mac_icons/Icon Frame${i === 1 ? '' : '-' + i}.png`);
                    }
                    
                    // 合并默认图标和自定义图标
                    const combinedMacStickers = [...macStickers, ...this.customStickers];
                    
                    // 重新创建所有MAC贴纸
                    this.createStickers('mac', combinedMacStickers);
                    
                    // 创建刚上传的贴纸的引用
                    const newStickerElement = document.querySelector(`.sticker[data-src="${imageDataUrl}"]`);
                    
                    // Switch to mac tab
                    this.switchStickerTab('mac');
                    
                    // Select the new sticker
                    if (newStickerElement) {
                        this.selectSticker(newStickerElement);
                    }
                    
                    // 显示成功提示
                    this.showHint('贴纸已添加到Mac图标集合中');
                    
                    // 输出调试信息
                    console.log('自定义贴纸数量:', this.customStickers.length);
                    
                    // 更新清除按钮显示状态
                    const clearButtonContainer = document.getElementById('clear-stickers-container');
                    if (clearButtonContainer && this.customStickers.length > 0) {
                        clearButtonContainer.style.display = 'block';
                    }
                };
                
                reader.readAsDataURL(file);
            } else {
                alert('请选择PNG格式的图片文件作为贴纸');
            }
            
            // Clear file input
            e.target.value = '';
        },
        
        // 保存自定义贴纸到本地存储
        saveCustomStickers: function() {
            try {
                // 只保存最近添加的10个贴纸，防止localStorage超过限制
                const stickersToSave = this.customStickers.slice(-10);
                localStorage.setItem('pixelStudioCustomStickers', JSON.stringify(stickersToSave));
                console.log('保存了', stickersToSave.length, '个贴纸到本地存储');
            } catch (e) {
                console.error('保存自定义贴纸失败:', e);
                // 如果是存储空间不足的错误，尝试只保存最后几个
                if (e.name === 'QuotaExceededError') {
                    try {
                        const stickersToSave = this.customStickers.slice(-5);
                        localStorage.setItem('pixelStudioCustomStickers', JSON.stringify(stickersToSave));
                        console.log('存储空间有限，只保存了最后5个贴纸');
                    } catch (error) {
                        console.error('尝试保存较少贴纸也失败:', error);
                    }
                }
            }
        },
        
        // 从本地存储加载自定义贴纸
        loadCustomStickers: function() {
            try {
                const savedStickers = localStorage.getItem('pixelStudioCustomStickers');
                if (savedStickers) {
                    this.customStickers = JSON.parse(savedStickers);
                    console.log('从本地存储加载了', this.customStickers.length, '个自定义贴纸');
                    
                    // 验证加载的贴纸
                    this.customStickers = this.customStickers.filter(url => {
                        return typeof url === 'string' && url.startsWith('data:image/');
                    });
                    
                    console.log('验证后剩余', this.customStickers.length, '个有效贴纸');
                } else {
                    console.log('没有找到保存的自定义贴纸');
                    this.customStickers = [];
                }
            } catch (e) {
                console.error('加载自定义贴纸失败:', e);
                this.customStickers = [];
            }
        },
        
        // Setup Mac OS style interactions
        setupMacOSInteractions: function() {
            // Close button interaction
            const closeButton = document.querySelector('.close-button');
            closeButton.addEventListener('click', () => {
                const header = document.querySelector('header');
                header.classList.add('closing');
                this.macClickSound();
                
                setTimeout(() => {
                    header.classList.remove('closing');
                }, 500);
            });
            
            // Menu items
            const menuItems = document.querySelectorAll('.menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    // Remove open class from all menu items
                    menuItems.forEach(i => i.classList.remove('open'));
                    
                    // Add open class to clicked menu item
                    item.classList.add('open');
                    this.macClickSound();
                    
                    // Close after 3 seconds
                    setTimeout(() => {
                        item.classList.remove('open');
                    }, 3000);
                });
            });
        },
        
        // Mac click sound
        macClickSound: function() {
            const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAZABgA');
            audio.volume = 0.2;
            audio.play().catch(e => console.log('Sound play failed: Browser requires user interaction first'));
        },
        
        // Pixelate image with specified pixel size
        pixelateImage: function(imageData, pixelSize) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            const newData = new Uint8ClampedArray(data.length);
            
            // 先检测图像中的重要特征（如人脸、眼睛、轮廓等）
            const featureMap = this.detectFeatures(data, width, height);
            
            // 直接像素化彩色图像，保留原始颜色
            // 对每个像素块进行处理
            for (let y = 0; y < height; y += pixelSize) {
                for (let x = 0; x < width; x += pixelSize) {
                    // 计算区域边界
                    const blockWidth = Math.min(pixelSize, width - x);
                    const blockHeight = Math.min(pixelSize, height - y);
                    
                    // 为块内每个颜色通道计算平均值
                    let sumR = 0, sumG = 0, sumB = 0;
                    let count = 0;
                    let hasFeature = false;
                    let featureWeight = 0;
                    
                    // 收集块内所有像素的颜色值
                    for (let dy = 0; dy < blockHeight; dy++) {
                        for (let dx = 0; dx < blockWidth; dx++) {
                            const sourceX = x + dx;
                            const sourceY = y + dy;
                            const sourceIdx = (sourceY * width + sourceX) * 4;
                            
                            sumR += data[sourceIdx];
                            sumG += data[sourceIdx + 1];
                            sumB += data[sourceIdx + 2];
                            
                            // 检查此像素是否为重要特征
                            const featureIdx = sourceY * width + sourceX;
                            if (featureMap[featureIdx] > 0) {
                                hasFeature = true;
                                featureWeight += featureMap[featureIdx];
                            }
                            
                            count++;
                        }
                    }
                    
                    // 计算平均色值
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);
                    
                    let finalR = avgR, finalG = avgG, finalB = avgB;
                    
                    // 对于包含重要特征的区域，使用更高的饱和度和更精细的处理
                    if (hasFeature) {
                        const weight = Math.min(1, featureWeight / (count * 3)); // 特征重要性权重
                        
                        // 增强特征区域的色彩
                        const hsv = this.rgbToHsv(avgR, avgG, avgB);
                        
                        // 根据特征权重调整饱和度和亮度
                        hsv.s = Math.min(1, hsv.s * (1.2 + weight * 0.4)); // 增加饱和度
                        hsv.v = Math.min(1, hsv.v * (1 + weight * 0.2));   // 轻微增加亮度
                        
                        const enhancedRgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
                        finalR = enhancedRgb.r;
                        finalG = enhancedRgb.g;
                        finalB = enhancedRgb.b;
                    } else {
                        // 非特征区域使用标准的颜色增强
                        const hsv = this.rgbToHsv(avgR, avgG, avgB);
                        hsv.s = Math.min(1, hsv.s * 1.2); // 增加饱和度
                        
                        const enhancedRgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
                        finalR = enhancedRgb.r;
                        finalG = enhancedRgb.g;
                        finalB = enhancedRgb.b;
                    }
                    
                    // 颜色量化，减少颜色数量，更接近经典像素艺术
                    const quantizedColor = this.quantizeColor(finalR, finalG, finalB);
                    finalR = quantizedColor.r;
                    finalG = quantizedColor.g;
                    finalB = quantizedColor.b;
                    
                    // 将增强的颜色应用到块内所有像素
                    for (let dy = 0; dy < blockHeight; dy++) {
                        for (let dx = 0; dx < blockWidth; dx++) {
                            const targetX = x + dx;
                            const targetY = y + dy;
                            const targetIdx = (targetY * width + targetX) * 4;
                            
                            newData[targetIdx] = finalR;
                            newData[targetIdx + 1] = finalG;
                            newData[targetIdx + 2] = finalB;
                            newData[targetIdx + 3] = 255; // 完全不透明
                        }
                    }
                }
            }
            
            // 应用边缘增强，让像素之间的边界更明显
            this.enhancePixelEdges(newData, width, height, pixelSize);
            
            // 最后一步：应用对比度增强，让像素艺术更清晰
            this.enhanceContrast(newData, width, height);
            
            // 应用轻微的特效滤镜，模拟像素艺术风格
            this.applyPixelArtFilter(newData, width, height);
            
            return new ImageData(newData, width, height);
        },
        
        // 颜色量化 - 减少颜色数量，更接近经典像素艺术
        quantizeColor: function(r, g, b) {
            // 定义量化级别 - 较低的值会产生更强的像素艺术风格
            const levels = 6; // 每个通道的颜色级别数
            
            // 量化每个通道
            const quantR = Math.round(Math.round(r * (levels - 1) / 255) * 255 / (levels - 1));
            const quantG = Math.round(Math.round(g * (levels - 1) / 255) * 255 / (levels - 1));
            const quantB = Math.round(Math.round(b * (levels - 1) / 255) * 255 / (levels - 1));
            
            return { r: quantR, g: quantG, b: quantB };
        },
        
        // 应用像素艺术风格滤镜
        applyPixelArtFilter: function(data, width, height) {
            // 轻微的"陈旧"效果，提高怀旧感
            for (let i = 0; i < data.length; i += 4) {
                // 轻微偏黄，模拟老式游戏机屏幕
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 提高暖色调，减少蓝色
                data[i] = Math.min(255, r * 1.05);                   // 轻微增加红色
                data[i + 1] = Math.min(255, g * 1.02);               // 轻微增加绿色
                data[i + 2] = Math.max(0, b * 0.95);                 // 轻微减少蓝色
                
                // 提高对比度
                for (let c = 0; c < 3; c++) {
                    if (data[i + c] > 180) {
                        data[i + c] = Math.min(255, data[i + c] * 1.05);
                    } else if (data[i + c] < 80) {
                        data[i + c] = Math.max(0, data[i + c] * 0.95);
                    }
                }
            }
        },
        
        // 检测图像中的重要特征（如人脸、眼睛、轮廓等）
        detectFeatures: function(data, width, height) {
            // 创建特征权重图，初始化为0
            const featureMap = new Array(width * height).fill(0);
            
            // 1. 计算图像的边缘信息
            const edgeData = this.detectEdges(data, width, height);
            
            // 2. 计算局部色彩变化（可以指示皮肤、眼睛等）
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    const mapIdx = y * width + x;
                    
                    // 计算边缘强度的平均值作为特征检测的一部分
                    let edgeStrength = (edgeData[idx] + edgeData[idx + 1] + edgeData[idx + 2]) / 3;
                    
                    // 皮肤色检测 - 简单启发式方法
                    // 皮肤具有特定的红色和绿色比例
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    
                    // 皮肤色检测启发式规则
                    const isSkin = (r > 95 && g > 40 && b > 20 &&
                                   r > g && r > b &&
                                   Math.abs(r - g) > 15 &&
                                   r - g > 0 && r - b > 0);
                    
                    // 眼睛检测 - 简单启发式方法
                    // 眼睛往往具有较高的对比度和特定的颜色分布
                    let eyeDetection = 0;
                    
                    // 计算周围像素的对比度
                    let contrast = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            const dr = Math.abs(data[idx] - data[nIdx]);
                            const dg = Math.abs(data[idx + 1] - data[nIdx + 1]);
                            const db = Math.abs(data[idx + 2] - data[nIdx + 2]);
                            
                            contrast += Math.max(dr, Math.max(dg, db));
                        }
                    }
                    contrast /= 8; // 平均对比度
                    
                    // 较暗区域 + 高对比度 可能是眼睛
                    if (r < 100 && g < 100 && b < 100 && contrast > 50) {
                        eyeDetection = 0.8;
                    }
                    
                    // 组合不同的特征检测
                    featureMap[mapIdx] = 
                        edgeStrength * 0.3 +           // 边缘权重
                        (isSkin ? 0.5 : 0) +           // 皮肤检测权重
                        eyeDetection +                  // 眼睛检测权重
                        (contrast / 255) * 0.3;         // 对比度权重
                }
            }
            
            return featureMap;
        },
        
        // 增强像素之间的边缘，让像素风格更明显
        enhancePixelEdges: function(data, width, height, pixelSize) {
            // 只在像素之间创建边缘
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // 检查是否在像素块的边缘
                    const isEdgeX = (x % pixelSize === 0);
                    const isEdgeY = (y % pixelSize === 0);
                    
                    // 如果是像素边缘，稍微调暗该点（轻微描边效果）
                    if ((isEdgeX || isEdgeY) && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
                        // 减淡颜色以创建细微的边缘效果，但不要太明显
                        const darkenFactor = 0.92; // 轻微暗化
                        data[idx] = Math.floor(data[idx] * darkenFactor);
                        data[idx + 1] = Math.floor(data[idx + 1] * darkenFactor);
                        data[idx + 2] = Math.floor(data[idx + 2] * darkenFactor);
                    }
                }
            }
        },
        
        // 增强图像对比度和色彩
        enhanceContrast: function(data, width, height) {
            // 找出亮度的最小值和最大值
            let min = 255;
            let max = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 计算亮度
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                
                if (luma < min) min = luma;
                if (luma > max) max = luma;
            }
            
            // 如果没有足够的对比度范围，跳过处理
            if (max - min < 30) return;
            
            // 计算对比度调整因子
            const contrast = 1.2; // 增加对比度
            
            // 应用对比度调整
            for (let i = 0; i < data.length; i += 4) {
                for (let c = 0; c < 3; c++) {
                    // 归一化到0-1范围
                    let value = data[i + c];
                    
                    // 应用对比度调整公式
                    value = ((value - 128) * contrast) + 128;
                    
                    // 裁剪到有效范围
                    data[i + c] = Math.max(0, Math.min(255, Math.round(value)));
                }
            }
        },
        
        // RGB转HSV颜色模型（用于颜色增强）
        rgbToHsv: function(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s, v = max;
            
            const d = max - min;
            s = max === 0 ? 0 : d / max;
            
            if (max === min) {
                h = 0; // 灰色
            } else {
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            
            return { h, s, v };
        },
        
        // HSV转RGB颜色模型
        hsvToRgb: function(h, s, v) {
            let r, g, b;
            
            const i = Math.floor(h * 6);
            const f = h * 6 - i;
            const p = v * (1 - s);
            const q = v * (1 - f * s);
            const t = v * (1 - (1 - f) * s);
            
            switch (i % 6) {
                case 0: r = v; g = t; b = p; break;
                case 1: r = q; g = v; b = p; break;
                case 2: r = p; g = v; b = t; break;
                case 3: r = p; g = q; b = v; break;
                case 4: r = t; g = p; b = v; break;
                case 5: r = v; g = p; b = q; break;
            }
            
            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255)
            };
        },
        
        // Detect edges in an image for color images
        detectEdges: function(data, width, height) {
            const result = new Uint8ClampedArray(data.length);
            
            // Apply light smoothing before edge detection to reduce noise
            const smoothedData = this.smoothImage(data, width, height);
            
            // Sobel operator kernels
            const sobelX = [
                -1, 0, 1,
                -2, 0, 2,
                -1, 0, 1
            ];
            
            const sobelY = [
                -1, -2, -1,
                 0,  0,  0,
                 1,  2,  1
            ];
            
            // Apply Sobel operator to find edges - for each color channel
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // Process each color channel
                    for (let c = 0; c < 3; c++) {
                        let gradientX = 0;
                        let gradientY = 0;
                        
                        // Apply convolution with Sobel kernels
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                                const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
                                
                                gradientX += smoothedData[pixelIdx] * sobelX[kernelIdx];
                                gradientY += smoothedData[pixelIdx] * sobelY[kernelIdx];
                            }
                        }
                        
                        // Calculate gradient magnitude for this channel
                        const gradientMagnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
                        
                        // Apply a moderate threshold to reduce noise in edge detection
                        const edgeValue = gradientMagnitude > 20 ? gradientMagnitude : gradientMagnitude * 0.5;
                        
                        // Normalize to 0-255 range and store result for this channel
                        result[idx + c] = Math.min(255, edgeValue);
                    }
                    
                    result[idx + 3] = data[idx + 3]; // Keep original alpha
                }
            }
            
            return result;
        },
        
        // Apply light smoothing to reduce noise - works on color images
        smoothImage: function(data, width, height) {
            const result = new Uint8ClampedArray(data.length);
            
            // Copy edges directly (can't apply kernel)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                        const idx = (y * width + x) * 4;
                        result[idx] = data[idx];
                        result[idx + 1] = data[idx + 1];
                        result[idx + 2] = data[idx + 2];
                        result[idx + 3] = data[idx + 3];
                    }
                }
            }
            
            // Simple gaussian-like blur for remaining pixels - each color channel separately
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // Apply 3x3 gaussian kernel to each color channel
                    const kernel = [
                        0.075, 0.125, 0.075,
                        0.125, 0.2,   0.125,
                        0.075, 0.125, 0.075
                    ];
                    
                    // Process each RGB channel
                    for (let c = 0; c < 3; c++) {
                        let sum = 0;
                        
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                                const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
                                sum += data[pixelIdx] * kernel[kernelIdx];
                            }
                        }
                        
                        result[idx + c] = sum;
                    }
                    
                    result[idx + 3] = data[idx + 3]; // Keep original alpha
                }
            }
            
            return result;
        },
        
        // 添加清除所有自定义贴纸的功能
        clearCustomStickers: function() {
            if (confirm('确定要清除所有自定义贴纸吗？此操作不可撤销。')) {
                // 清空自定义贴纸数组
                this.customStickers = [];
                
                // 更新本地存储
                this.saveCustomStickers();
                
                // 重新初始化贴纸
                this.initStickers();
                
                // 切换到MAC标签
                this.switchStickerTab('mac');
                
                // 显示提示
                this.showHint('所有自定义贴纸已清除');
            }
        }
    };
    
    // Initialize the application
    app.init();
}); 

// Floyd-Steinberg dithering algorithm implementation
const dithering = {
    // Apply Floyd-Steinberg dithering to an image
    applyFloydSteinberg: function(imageData, colors, width, height) {
        // JavaScript implementation
        const data = new Uint8ClampedArray(imageData.data);
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Get current pixel color
                const oldR = data[idx];
                const oldG = data[idx + 1];
                const oldB = data[idx + 2];
                
                // Find nearest color in palette
                const newColor = this.findNearestColor(oldR, oldG, oldB, colors);
                
                // Set new pixel color
                newData[idx] = newColor.r;
                newData[idx + 1] = newColor.g;
                newData[idx + 2] = newColor.b;
                newData[idx + 3] = data[idx + 3]; // Keep original alpha
                
                // Calculate quantization error
                const errR = oldR - newColor.r;
                const errG = oldG - newColor.g;
                const errB = oldB - newColor.b;
                
                // Distribute error to neighboring pixels (Floyd-Steinberg pattern)
                if (x + 1 < width) {
                    data[idx + 4] = this.clamp(data[idx + 4] + errR * 7 / 16);
                    data[idx + 5] = this.clamp(data[idx + 5] + errG * 7 / 16);
                    data[idx + 6] = this.clamp(data[idx + 6] + errB * 7 / 16);
                }
                
                if (y + 1 < height) {
                    if (x > 0) {
                        data[idx + 4 * width - 4] = this.clamp(data[idx + 4 * width - 4] + errR * 3 / 16);
                        data[idx + 4 * width - 3] = this.clamp(data[idx + 4 * width - 3] + errG * 3 / 16);
                        data[idx + 4 * width - 2] = this.clamp(data[idx + 4 * width - 2] + errB * 3 / 16);
                    }
                    
                    data[idx + 4 * width] = this.clamp(data[idx + 4 * width] + errR * 5 / 16);
                    data[idx + 4 * width + 1] = this.clamp(data[idx + 4 * width + 1] + errG * 5 / 16);
                    data[idx + 4 * width + 2] = this.clamp(data[idx + 4 * width + 2] + errB * 5 / 16);
                    
                    if (x + 1 < width) {
                        data[idx + 4 * width + 4] = this.clamp(data[idx + 4 * width + 4] + errR * 1 / 16);
                        data[idx + 4 * width + 5] = this.clamp(data[idx + 4 * width + 5] + errG * 1 / 16);
                        data[idx + 4 * width + 6] = this.clamp(data[idx + 4 * width + 6] + errB * 1 / 16);
                    }
                }
            }
        }
        
        return new ImageData(newData, width, height);
    },
    
    // Find the nearest color in the palette
    findNearestColor: function(r, g, b, colors) {
        let minDistance = Infinity;
        let nearestColor = { r: 0, g: 0, b: 0 };
        
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const dr = r - color.r;
            const dg = g - color.g;
            const db = b - color.b;
            const distance = dr * dr + dg * dg + db * db;
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestColor = color;
            }
        }
        
        return nearestColor;
    },
    
    // Clamp value to 0-255 range
    clamp: function(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }
}; 