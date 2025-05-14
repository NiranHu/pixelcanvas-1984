document.addEventListener('DOMContentLoaded', function() {
    // ===== PixelCanvas 1984 - Main Application =====
    const app = {
        canvas: document.getElementById('pixelCanvas'),
        ctx: null,
        originalImage: null,
        pixelatedImage: null,
        pixelSize: 8, // Default pixel size (changed from 16 to 8)
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
            
            // Create initial blank canvas
            this.clearCanvas();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Initialize UI
            this.initUI();
            
            // Add to history
            this.saveToHistory();
            
            // MAC OS style menu interactions
            this.setupMacOSInteractions();
        },
        
        // Initialize UI elements and interactions
        initUI: function() {
            // Select first tool and brush size
            document.querySelector('.tool[data-tool="pencil"]').classList.add('active');
            document.querySelector('.tool[data-size="1"]').classList.add('active');
            
            // Select first color
            document.querySelector('.color').classList.add('active');
            
            // Update pixel slider with new presets
            const pixelSlider = document.getElementById('pixelSize');
            pixelSlider.min = 2;  // Minimum 2x2
            pixelSlider.max = 8;  // Maximum 8x8
            pixelSlider.step = 2; // Steps of 2 (2,4,6,8)
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
            
            // Pixel slider with fixed presets
            document.getElementById('pixelSize').addEventListener('input', e => {
                this.pixelSize = parseInt(e.target.value);
                // Force values to be only 2, 4, 6, or 8
                if (![2, 4, 6, 8].includes(this.pixelSize)) {
                    // Round to nearest valid preset
                    this.pixelSize = Math.round(this.pixelSize / 2) * 2;
                    if (this.pixelSize < 2) this.pixelSize = 2;
                    if (this.pixelSize > 8) this.pixelSize = 8;
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
            // 清空画布
            this.clearCanvas();
            
            // 移除所有贴纸层
            this.activeLayers = [];
            this.selectedLayer = null;
            this.movingStickerMode = false;
            this.stickerPlacementMode = false;
            
            // 重绘画布
            this.redrawLayers();
            
            // 保存到历史记录
            this.saveToHistory();
            
            // 显示提示
            this.showHint('画布已清空');
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
            // Remove active class from all tools
            document.querySelectorAll('.tool[data-tool]').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to selected tool
            document.querySelector(`.tool[data-tool="${tool}"]`).classList.add('active');
            
            // Update current tool
            this.currentTool = tool;
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
                        // Resize canvas if needed
                        this.canvas.width = img.width;
                        this.canvas.height = img.height;
                        
                        // Draw original image to canvas
                        this.ctx.drawImage(img, 0, 0);
                        
                        // Save original image
                        this.originalImage = img;
                        
                        // Apply pixel effect
                        this.applyPixelEffect();
                        
                        // Update image size display
                        document.querySelector('.image-size').textContent = `${this.canvas.width}x${this.canvas.height}`;
                    };
                    
                    img.src = event.target.result;
                };
                
                reader.readAsDataURL(file);
            } else {
                alert('Please select an image file under 5MB.');
            }
            
            // Clear file input
            e.target.value = '';
        },
        
        // Apply pixel effect to canvas
        applyPixelEffect: function() {
            if (!this.originalImage) return;
            
            // Create a temporary canvas for pixelation
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            
            // Draw original image scaled to canvas size
            tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Apply pixelation effect
            const pixelatedData = this.pixelateImage(imageData, this.pixelSize);
            
            // Put the processed image data back on the canvas
            this.ctx.putImageData(pixelatedData, 0, 0);
            
            // Store the processed image as the current pixelated image
            this.pixelatedImage = new Image();
            this.pixelatedImage.src = this.canvas.toDataURL();
            
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
            
            // 在选择工具模式下检查是否点击了已存在的贴纸
            if (this.currentTool === 'select') {
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
                }
                
                // 如果在选择工具模式下点击空白处且在贴纸放置模式下，放置新贴纸
                if (this.stickerPlacementMode && this.selectedSticker) {
                    this.placeSticker(this.selectedSticker, e);
                    return;
                }
                
                // 如果在选择工具模式下点击空白处，并且有选中的贴纸，则取消贴纸的选中状态
                if (this.selectedLayer || this.activeLayers.some(layer => layer.selected)) {
                    // 取消所有贴纸的选中状态
                    this.activeLayers.forEach(layer => layer.selected = false);
                    // 清除当前选中的贴纸引用
                    this.selectedLayer = null;
                    // 退出移动模式
                    this.movingStickerMode = false;
                    // 重绘以更新视图（移除蓝色虚线框）
                    this.redrawLayers();
                    return;
                }
            }
            
            // 对于其他工具，继续正常的绘制行为
            this.isDragging = true;
            
            // 执行基于当前工具的操作
            if (this.currentTool === 'pencil') {
                this.drawPixel(x, y);
            } else if (this.currentTool === 'eraser') {
                this.erasePixel(x, y);
            } else if (this.currentTool === 'fill') {
                this.fillArea(x, y);
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
            
            // Set current tool to select for sticker placement
            this.selectTool('select');
            
            // 进入贴纸放置模式
            this.stickerPlacementMode = true;
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
                this.selectedLayer = clickedLayer;
                
                // 退出贴纸放置模式
                this.stickerPlacementMode = false;
                
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
            const canvasInfo = document.querySelector('.canvas-info');
            
            // Create hint element if it doesn't exist
            let hint = document.querySelector('.sticker-hint');
            if (!hint) {
                hint = document.createElement('span');
                hint.className = 'sticker-hint';
                hint.style.marginLeft = '15px';
                hint.style.color = '#007BFF';
                canvasInfo.appendChild(hint);
            }
            
            // Set hint text
            hint.textContent = message;
            
            // Hide hint after 3 seconds
            setTimeout(() => {
                hint.textContent = '';
            }, 3000);
        },
        
        // Handle canvas click (for sticker placement)
        handleCanvasClick: function(event) {
            // 不再在这里处理贴纸放置，改为在mousedown中处理
            // 这样可以避免同时触发选中和放置的冲突
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
            
            // Step 1: Enhanced preprocessing - improve detail retention
            const preprocessedData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i += 4) {
                // Convert to grayscale with enhanced luminance formula
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Enhanced grayscale with better detail preservation
                let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                
                // Apply moderate contrast enhancement
                const contrast = 1.2; // 降低对比度以保留更多细节
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                const adjustedGray = factor * (gray - 128) + 128;
                
                preprocessedData[i] = adjustedGray;
                preprocessedData[i + 1] = adjustedGray;
                preprocessedData[i + 2] = adjustedGray;
                preprocessedData[i + 3] = data[i + 3]; // Keep original alpha
            }
            
            // Step 2: Apply more subtle edge detection
            const edgeData = this.detectEdges(preprocessedData, width, height);
            
            // Step 3: Pixelate with improved detail preservation
            // For each pixel block
            for (let y = 0; y < height; y += pixelSize) {
                for (let x = 0; x < width; x += pixelSize) {
                    // Calculate the region boundaries
                    const blockWidth = Math.min(pixelSize, width - x);
                    const blockHeight = Math.min(pixelSize, height - y);
                    
                    // Calculate multiple values for the block
                    let sumIntensity = 0;
                    let sumEdge = 0;
                    let lightCount = 0;
                    let darkCount = 0;
                    let count = 0;
                    
                    for (let dy = 0; dy < blockHeight; dy++) {
                        for (let dx = 0; dx < blockWidth; dx++) {
                            const sourceX = x + dx;
                            const sourceY = y + dy;
                            const sourceIdx = (sourceY * width + sourceX) * 4;
                            
                            sumIntensity += preprocessedData[sourceIdx];
                            sumEdge += edgeData[sourceIdx];
                            
                            // Count light and dark pixels for better thresholding
                            if (preprocessedData[sourceIdx] > 128) {
                                lightCount++;
                            } else {
                                darkCount++;
                            }
                            
                            count++;
                        }
                    }
                    
                    // Calculate average values
                    const avgIntensity = sumIntensity / count;
                    // Reduce edge influence for better detail retention
                    const avgEdge = sumEdge / count;
                    
                    // Adaptive thresholding based on the block's characteristics
                    let threshold = 100; // Default threshold
                    
                    // Dynamic thresholding based on block content
                    if (lightCount > darkCount * 2) {
                        // Mostly light block - use higher threshold to preserve details
                        threshold = 140; // 降低亮区阈值以增加细节
                    } else if (darkCount > lightCount * 2) {
                        // Mostly dark block - use lower threshold to preserve details
                        threshold = 110; // 提高暗区阈值以增加清晰度
                    }
                    
                    // Combine intensity and edge with reduced edge influence
                    const combined = avgIntensity - avgEdge * 1.0; // 降低边缘权重以避免过度强调轮廓
                    
                    // Threshold to black or white
                    const pixelValue = combined < threshold ? 0 : 255;
                    
                    // Apply the black or white color to all pixels in the block
                    for (let dy = 0; dy < blockHeight; dy++) {
                        for (let dx = 0; dx < blockWidth; dx++) {
                            const targetX = x + dx;
                            const targetY = y + dy;
                            const targetIdx = (targetY * width + targetX) * 4;
                            
                            newData[targetIdx] = pixelValue;
                            newData[targetIdx + 1] = pixelValue;
                            newData[targetIdx + 2] = pixelValue;
                            newData[targetIdx + 3] = 255; // Full opacity
                        }
                    }
                }
            }
            
            // Step 4: Apply light post-processing to improve readability
            this.enhanceReadability(newData, width, height, pixelSize);
            
            return new ImageData(newData, width, height);
        },
        
        // Enhance image readability by smoothing isolated pixels
        enhanceReadability: function(data, width, height, pixelSize) {
            // Copy data for reference
            const tempData = new Uint8ClampedArray(data);
            
            // Skip if pixel size is too small (less effective)
            if (pixelSize < 4) return;
            
            // Simple smoothing to remove isolated pixels
            for (let y = pixelSize; y < height - pixelSize; y += pixelSize) {
                for (let x = pixelSize; x < width - pixelSize; x += pixelSize) {
                    const centerIdx = (y * width + x) * 4;
                    const centerValue = tempData[centerIdx];
                    
                    // Check surrounding blocks (in pixel grid)
                    let surroundingSum = 0;
                    let surroundingCount = 0;
                    
                    // Check 4-connected neighbors (top, right, bottom, left)
                    const neighbors = [
                        [(y - pixelSize) * width + x, pixelSize * width], // top
                        [y * width + (x + pixelSize), pixelSize], // right
                        [(y + pixelSize) * width + x, pixelSize * width], // bottom
                        [y * width + (x - pixelSize), pixelSize]  // left
                    ];
                    
                    for (const [neighborIdx, step] of neighbors) {
                        if (neighborIdx >= 0 && neighborIdx < tempData.length / 4) {
                            surroundingSum += tempData[neighborIdx * 4];
                            surroundingCount++;
                        }
                    }
                    
                    // If this is an isolated pixel (opposite to all neighbors)
                    if (surroundingCount >= 3) {
                        const avgSurrounding = surroundingSum / surroundingCount;
                        
                        // If center is very different from surroundings (isolated)
                        if ((centerValue === 0 && avgSurrounding > 200) || 
                            (centerValue === 255 && avgSurrounding < 50)) {
                            
                            // Fill the block with the surrounding value
                            const newValue = (avgSurrounding > 128) ? 255 : 0;
                            
                            // Apply to the block
                            for (let dy = 0; dy < pixelSize && (y + dy) < height; dy++) {
                                for (let dx = 0; dx < pixelSize && (x + dx) < width; dx++) {
                                    const idx = ((y + dy) * width + (x + dx)) * 4;
                                    data[idx] = newValue;
                                    data[idx + 1] = newValue;
                                    data[idx + 2] = newValue;
                                }
                            }
                        }
                    }
                }
            }
        },
        
        // Detect edges in an image
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
            
            // Apply Sobel operator to find edges
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    let gradientX = 0;
                    let gradientY = 0;
                    
                    // Apply convolution with Sobel kernels
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                            
                            gradientX += smoothedData[pixelIdx] * sobelX[kernelIdx];
                            gradientY += smoothedData[pixelIdx] * sobelY[kernelIdx];
                        }
                    }
                    
                    // Calculate gradient magnitude
                    const gradientMagnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
                    
                    // Apply a moderate threshold to reduce noise in edge detection
                    const edgeValue = gradientMagnitude > 20 ? gradientMagnitude : gradientMagnitude * 0.5;
                    
                    // Normalize to 0-255 range
                    result[idx] = Math.min(255, edgeValue);
                    result[idx + 1] = Math.min(255, edgeValue);
                    result[idx + 2] = Math.min(255, edgeValue);
                    result[idx + 3] = data[idx + 3]; // Keep original alpha
                }
            }
            
            return result;
        },
        
        // Apply light smoothing to reduce noise
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
            
            // Simple gaussian-like blur for remaining pixels
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // Apply 3x3 gaussian kernel
                    let sum = 0;
                    const kernel = [
                        0.075, 0.125, 0.075,
                        0.125, 0.2,   0.125,
                        0.075, 0.125, 0.075
                    ];
                    
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                            sum += data[pixelIdx] * kernel[kernelIdx];
                        }
                    }
                    
                    result[idx] = sum;
                    result[idx + 1] = sum;
                    result[idx + 2] = sum;
                    result[idx + 3] = data[idx + 3];
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