// 使用PixiJS实现树叶周长测量应用
class MeasurementApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        
        // 创建PixiJS应用
        this.app = new PIXI.Application({
            view: this.canvas,
            width: 700,
            height: 500,
            backgroundColor: 0xffffff
        });
        
        // 容器
        this.stage = this.app.stage;
        
        // 状态管理
        this.currentTool = 'brush';
        this.appState = 'drawing';   // 'drawing' | 'converting' | 'measuring'
        
        // 描边数据
        this.pathPoints = [];
        this.isDrawing = false;
        this.startPoint = null;
        this.closedPath = false;
        
        // 转换后数据 - 水平直线
        this.straightLine = {
            startX: 0,
            endX: 0,
            y: 0,
            length: 0,
            targetY: 400  // 底部固定位置
        };
        
        // 标尺数据 - 始终水平，长度大于线条
        this.ruler = {
            x: 350,
            y: 400,
            width: 300,    // 默认宽度，会根据线条长度调整
            height: 50,
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            isSnapped: false,  // 是否已吸附
            snapTarget: 'start' // 'start' | 'end' | 'center'
        };
        
        // 图片数据
        this.leafImage = null;
        this.imageLoaded = false;
        
        // 精灵容器
        this.leafSprite = null;
        this.pathGraphics = new PIXI.Graphics();
        this.straightLineGraphics = new PIXI.Graphics();
        this.rulerGraphics = new PIXI.Graphics();
        
        // 动画相关
        this.animationId = null;
        this.conversionProgress = 0;
        this.canvasScale = 1;
        
        // 常量
        this.CLOSE_THRESHOLD = 15;
        this.RULER_EXTRA_LENGTH = 50; // 标尺比线条多出的长度
        this.SNAP_THRESHOLD = 30;     // 吸附阈值
        
        this.init();
    }
    
    init() {
        // 添加图形到舞台
        this.stage.addChild(this.pathGraphics);
        this.stage.addChild(this.straightLineGraphics);
        this.stage.addChild(this.rulerGraphics);
        
        this.setupEventListeners();
        this.loadDefaultImage();
        this.render();
    }
    
    /**
     * 加载默认树叶图片
     */
    loadDefaultImage() {
        // 绘制默认树叶
        this.drawDefaultLeaf();
        
        // 同时尝试加载网络图片
        const texture = PIXI.Texture.from('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=green%20leaf%20on%20white%20background%2C%20realistic%2C%20clear%20edges&image_size=landscape_4_3');
        
        this.leafSprite = new PIXI.Sprite(texture);
        this.leafSprite.anchor.set(0.5);
        this.leafSprite.x = 350;
        this.leafSprite.y = 200;
        
        // 调整大小
        const scale = Math.min(300 / this.leafSprite.width, 300 / this.leafSprite.height);
        this.leafSprite.scale.set(scale);
        
        texture.on('error', () => {
            console.log('树叶图片加载失败，使用默认树叶');
        });
        
        texture.on('update', () => {
            if (texture.valid) {
                this.imageLoaded = true;
                this.stage.addChild(this.leafSprite);
                this.render();
            }
        });
    }
    
    /**
     * 绘制默认树叶
     */
    drawDefaultLeaf() {
        const leafGraphics = new PIXI.Graphics();
        
        leafGraphics.beginFill(0x4CAF50, 0.3);
        leafGraphics.lineStyle(2, 0x2E7D32, 1);
        
        leafGraphics.moveTo(0, 100);
        leafGraphics.quadraticCurveTo(0, 60, -40, 40);
        leafGraphics.quadraticCurveTo(-80, 20, -80, -20);
        leafGraphics.quadraticCurveTo(-80, -60, -40, -60);
        leafGraphics.quadraticCurveTo(-20, -60, 0, -40);
        leafGraphics.quadraticCurveTo(20, -60, 40, -60);
        leafGraphics.quadraticCurveTo(80, -60, 80, -20);
        leafGraphics.quadraticCurveTo(80, 20, 40, 40);
        leafGraphics.quadraticCurveTo(0, 60, 0, 100);
        
        leafGraphics.endFill();
        
        leafGraphics.x = 350;
        leafGraphics.y = 200;
        leafGraphics.scale.set(1.5);
        
        this.stage.addChild(leafGraphics);
        this.imageLoaded = true;
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // 滚轮缩放画布（仅在测量模式）
        this.canvas.addEventListener('wheel', (e) => {
            if (this.appState === 'measuring') {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.canvasScale = Math.max(0.5, Math.min(2, this.canvasScale + delta));
                this.canvasWrapper.style.transform = `scale(${this.canvasScale})`;
            }
        });
        
        // 按钮事件
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDrawing) {
                this.cancelDrawing();
            }
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.reset();
            }
        });
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.canvasScale,
            y: (e.clientY - rect.top) / this.canvasScale
        };
    }
    
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        if (this.appState === 'drawing' && this.currentTool === 'brush') {
            this.isDrawing = true;
            this.pathPoints = [pos];
            this.startPoint = pos;
            this.closedPath = false;
            this.showToast('开始描边，沿树叶轮廓绘制，回到起点自动收口');
        } else if (this.appState === 'measuring' && this.currentTool === 'ruler') {
            if (this.isPointOnRuler(pos)) {
                this.ruler.isDragging = true;
                this.ruler.dragOffset = {
                    x: pos.x - this.ruler.x,
                    y: pos.y - this.ruler.y
                };
                this.ruler.isSnapped = false; // 开始拖拽时解除吸附
                this.hideSnapHint();
            }
        }
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.appState === 'drawing' && this.isDrawing) {
            this.pathPoints.push(pos);
            
            if (this.pathPoints.length > 10) {
                const distToStart = this.distance(pos, this.startPoint);
                if (distToStart < this.CLOSE_THRESHOLD) {
                    this.canvas.style.cursor = 'pointer';
                } else {
                    this.canvas.style.cursor = 'crosshair';
                }
            }
            
            this.render();
        } else if (this.appState === 'measuring' && this.ruler.isDragging) {
            this.ruler.x = pos.x - this.ruler.dragOffset.x;
            this.ruler.y = pos.y - this.ruler.dragOffset.y;
            
            // 检查吸附
            this.checkSnap();
            this.checkMeasurement();
            this.render();
        } else if (this.appState === 'measuring') {
            if (this.isPointOnRuler(pos)) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.appState === 'drawing' && this.isDrawing) {
            const pos = this.getMousePos(e);
            
            if (this.pathPoints.length > 10) {
                const distToStart = this.distance(pos, this.startPoint);
                if (distToStart < this.CLOSE_THRESHOLD) {
                    this.pathPoints.push(this.startPoint);
                    this.closedPath = true;
                    this.isDrawing = false;
                    this.showToast('收口成功！正在转换...');
                    this.startConversion();
                } else {
                    this.showToast('未回到起点，绘制取消');
                    this.cancelDrawing();
                }
            } else {
                this.cancelDrawing();
            }
        } else if (this.appState === 'measuring') {
            this.ruler.isDragging = false;
            // 松开后检查吸附
            this.checkSnap();
        }
    }
    
    cancelDrawing() {
        this.isDrawing = false;
        this.pathPoints = [];
        this.startPoint = null;
        this.canvas.style.cursor = 'crosshair';
        this.render();
    }
    
    /**
     * 开始转换动画 - 生成水平直线
     */
    startConversion() {
        this.appState = 'converting';
        this.updateStatus('converting');
        
        // 计算路径总长度
        let totalLength = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            totalLength += this.distance(this.pathPoints[i-1], this.pathPoints[i]);
        }
        
        // 设置水平直线参数 - 确保在画面内且不超界
        const maxLineWidth = 600; // 最大允许长度
        const actualLength = Math.min(totalLength, maxLineWidth);
        
        // 居中放置
        this.straightLine = {
            startX: (700 - actualLength) / 2,
            endX: (700 + actualLength) / 2,
            y: 250, // 初始Y（动画起始位置）
            length: actualLength,
            targetY: 400 // 最终到底部
        };
        
        // 设置标尺参数 - 必须大于线条
        this.ruler.width = actualLength + this.RULER_EXTRA_LENGTH * 2;
        this.ruler.x = 350;
        this.ruler.y = 400;
        
        // 开始动画
        this.conversionProgress = 0;
        this.animateConversion();
    }
    
    /**
     * 转换动画 - 包含画布缩放
     */
    animateConversion() {
        const duration = 2000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            this.conversionProgress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(this.conversionProgress);
            
            // 阶段1: 路径变形为直线 (0-60%)
            // 阶段2: 直线移动到底部 (60-80%)
            // 阶段3: 画布缩放适应 (80-100%)
            
            if (this.conversionProgress < 0.6) {
                const phaseProgress = this.conversionProgress / 0.6;
                this.renderPathToLine(phaseProgress);
            } else if (this.conversionProgress < 0.8) {
                const phaseProgress = (this.conversionProgress - 0.6) / 0.2;
                this.renderLineMoving(phaseProgress);
            } else {
                const phaseProgress = (this.conversionProgress - 0.8) / 0.2;
                this.canvasScale = 1 + (0.1 * phaseProgress); // 轻微放大确保可见
                this.canvasWrapper.style.transform = `scale(${this.canvasScale})`;
                this.renderLineAtBottom();
            }
            
            if (this.conversionProgress < 1) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.finishConversion();
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * 渲染路径变形为直线
     */
    renderPathToLine(progress) {
        this.clearGraphics();
        
        // 绘制原路径（渐隐）
        if (progress < 1) {
            this.drawRawPath(1 - progress);
        }
        
        // 绘制水平直线（渐显）
        const currentY = 250;
        const lineWidth = this.straightLine.length * progress;
        const startX = 350 - lineWidth / 2;
        const endX = 350 + lineWidth / 2;
        
        this.straightLineGraphics.clear();
        this.straightLineGraphics.lineStyle(4, 0xe74c3c, progress);
        this.straightLineGraphics.moveTo(startX, currentY);
        this.straightLineGraphics.lineTo(endX, currentY);
        
        // 端点
        this.straightLineGraphics.beginFill(0xc0392b, progress);
        this.straightLineGraphics.drawCircle(startX, currentY, 6);
        this.straightLineGraphics.drawCircle(endX, currentY, 6);
        this.straightLineGraphics.endFill();
    }
    
    /**
     * 渲染直线移动到底部
     */
    renderLineMoving(progress) {
        this.clearGraphics();
        
        const startY = 250;
        const endY = this.straightLine.targetY;
        const currentY = startY + (endY - startY) * progress;
        
        // 绘制直线
        this.straightLineGraphics.clear();
        this.straightLineGraphics.lineStyle(4, 0xe74c3c);
        this.straightLineGraphics.moveTo(this.straightLine.startX, currentY);
        this.straightLineGraphics.lineTo(this.straightLine.endX, currentY);
        
        // 端点
        this.straightLineGraphics.beginFill(0xc0392b);
        this.straightLineGraphics.drawCircle(this.straightLine.startX, currentY, 6);
        this.straightLineGraphics.drawCircle(this.straightLine.endX, currentY, 6);
        this.straightLineGraphics.endFill();
    }
    
    /**
     * 渲染直线在底部位置
     */
    renderLineAtBottom() {
        this.clearGraphics();
        this.drawStraightLine();
    }
    
    /**
     * 完成转换
     */
    finishConversion() {
        this.appState = 'measuring';
        this.updateStatus('measuring');
        
        document.getElementById('brushTool').disabled = true;
        document.getElementById('rulerTool').disabled = false;
        this.setTool('ruler');
        
        // 自动吸附标尺到线条起点
        this.snapRulerToLineStart();
        
        // 更新显示
        document.getElementById('lineLength').textContent = this.straightLine.length.toFixed(1) + ' px';
        
        this.showToast('转换完成！标尺已自动对齐，可拖拽移动');
        this.render();
    }
    
    /**
     * 标尺自动吸附到线条起点
     */
    snapRulerToLineStart() {
        this.ruler.x = this.straightLine.startX + this.ruler.width / 2 - this.RULER_EXTRA_LENGTH;
        this.ruler.y = this.straightLine.targetY;
        this.ruler.isSnapped = true;
        this.ruler.snapTarget = 'start';
        this.showSnapHint(this.ruler.x - this.ruler.width/2 + 50, this.ruler.y - 60);
        this.checkMeasurement();
    }
    
    /**
     * 检查并执行吸附
     */
    checkSnap() {
        const lineY = this.straightLine.targetY;
        const distToLine = Math.abs(this.ruler.y - lineY);
        
        // 垂直方向吸附到同一水平线
        if (distToLine < this.SNAP_THRESHOLD) {
            this.ruler.y = lineY;
        }
        
        // 水平方向吸附到起点或终点
        const distToStart = Math.abs(this.ruler.x - this.ruler.width/2 - this.straightLine.startX);
        const distToEnd = Math.abs(this.ruler.x + this.ruler.width/2 - this.straightLine.endX);
        const centerX = (this.straightLine.startX + this.straightLine.endX) / 2;
        const distToCenter = Math.abs(this.ruler.x - centerX);
        
        if (distToStart < this.SNAP_THRESHOLD) {
            // 吸附到起点：标尺左端对齐线条起点
            this.ruler.x = this.straightLine.startX + this.ruler.width / 2 - this.RULER_EXTRA_LENGTH;
            this.ruler.isSnapped = true;
            this.ruler.snapTarget = 'start';
            this.showSnapHint(this.ruler.x - this.ruler.width/2 + 50, this.ruler.y - 60);
        } else if (distToEnd < this.SNAP_THRESHOLD) {
            // 吸附到终点：标尺右端对齐线条终点
            this.ruler.x = this.straightLine.endX - this.ruler.width / 2 + this.RULER_EXTRA_LENGTH;
            this.ruler.isSnapped = true;
            this.ruler.snapTarget = 'end';
            this.showSnapHint(this.ruler.x + this.ruler.width/2 - 50, this.ruler.y - 60);
        } else if (distToCenter < this.SNAP_THRESHOLD && !this.ruler.isSnapped) {
            // 吸附到中心
            this.ruler.x = centerX;
            this.ruler.isSnapped = true;
            this.ruler.snapTarget = 'center';
            this.showSnapHint(this.ruler.x, this.ruler.y - 60);
        } else {
            this.ruler.isSnapped = false;
            this.hideSnapHint();
        }
    }
    
    showSnapHint(x, y) {
        const hint = document.getElementById('snapHint');
        hint.style.left = (x * this.canvasScale + this.canvasWrapper.offsetLeft) + 'px';
        hint.style.top = (y * this.canvasScale + this.canvasWrapper.offsetTop) + 'px';
        hint.classList.add('show');
        
        setTimeout(() => {
            hint.classList.remove('show');
        }, 1500);
    }
    
    hideSnapHint() {
        document.getElementById('snapHint').classList.remove('show');
    }
    
    /**
     * 检查测量结果
     */
    checkMeasurement() {
        if (!this.straightLine.length) return;
        
        // 计算标尺与线条的重叠部分
        const rulerLeft = this.ruler.x - this.ruler.width / 2 + this.RULER_EXTRA_LENGTH;
        const rulerRight = this.ruler.x + this.ruler.width / 2 - this.RULER_EXTRA_LENGTH;
        
        const lineLeft = this.straightLine.startX;
        const lineRight = this.straightLine.endX;
        
        // 计算重叠区间
        const overlapLeft = Math.max(rulerLeft, lineLeft);
        const overlapRight = Math.min(rulerRight, lineRight);
        const overlapLength = Math.max(0, overlapRight - overlapLeft);
        
        // 判断是否对齐
        const isAligned = Math.abs(this.ruler.y - this.straightLine.targetY) < 5;
        
        if (isAligned && overlapLength > 0) {
            const percentage = (overlapLength / this.straightLine.length * 100).toFixed(0);
            document.getElementById('rulerResult').textContent = 
                overlapLength.toFixed(1) + ' px (' + percentage + '%)';
            document.getElementById('rulerResult').style.color = '#27ae60';
        } else {
            document.getElementById('rulerResult').textContent = '未对齐';
            document.getElementById('rulerResult').style.color = '#e74c3c';
        }
    }
    
    isPointOnRuler(pos) {
        const halfWidth = this.ruler.width / 2;
        const halfHeight = this.ruler.height / 2;
        return pos.x >= this.ruler.x - halfWidth && 
               pos.x <= this.ruler.x + halfWidth &&
               pos.y >= this.ruler.y - halfHeight && 
               pos.y <= this.ruler.y + halfHeight;
    }
    
    setTool(tool) {
        this.currentTool = tool;
        document.getElementById('brushTool').classList.toggle('active', tool === 'brush');
        document.getElementById('rulerTool').classList.toggle('active', tool === 'ruler');
        this.canvas.style.cursor = tool === 'brush' ? 'crosshair' : 'default';
    }
    
    updateStatus(state) {
        const badge = document.getElementById('statusBadge');
        const progressFill = document.getElementById('progressFill');
        
        badge.className = 'status-badge';
        
        switch(state) {
            case 'drawing':
                badge.classList.add('status-drawing');
                badge.textContent = '描边中';
                progressFill.style.width = '33%';
                break;
            case 'converting':
                badge.classList.add('status-converting');
                badge.textContent = '转换中';
                progressFill.style.width = '66%';
                break;
            case 'measuring':
                badge.classList.add('status-measuring');
                badge.textContent = '测量中';
                progressFill.style.width = '100%';
                break;
        }
    }
    
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
    
    reset() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.appState = 'drawing';
        this.currentTool = 'brush';
        this.pathPoints = [];
        this.isDrawing = false;
        this.startPoint = null;
        this.closedPath = false;
        this.conversionProgress = 0;
        this.canvasScale = 1;
        this.canvasWrapper.style.transform = 'scale(1)';
        
        this.ruler = {
            x: 350,
            y: 400,
            width: 300,
            height: 50,
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            isSnapped: false,
            snapTarget: 'start'
        };
        
        this.straightLine = {
            startX: 0,
            endX: 0,
            y: 0,
            length: 0,
            targetY: 400
        };
        
        document.getElementById('brushTool').disabled = false;
        document.getElementById('brushTool').classList.add('active');
        document.getElementById('rulerTool').disabled = true;
        document.getElementById('rulerTool').classList.remove('active');
        document.getElementById('lineLength').textContent = '0.0 px';
        document.getElementById('rulerResult').textContent = '未对齐';
        document.getElementById('rulerResult').style.color = '#e74c3c';
        document.getElementById('measureHint').textContent = 
            '使用画笔沿树叶轮廓描边，收口后自动进入测量模式';
        
        this.updateStatus('drawing');
        this.canvas.style.cursor = 'crosshair';
        this.hideSnapHint();
        
        this.clearGraphics();
        this.loadDefaultImage();
        this.render();
        this.showToast('已重置，可以重新开始');
    }
    
    /**
     * 清除图形
     */
    clearGraphics() {
        this.pathGraphics.clear();
        this.straightLineGraphics.clear();
        this.rulerGraphics.clear();
    }
    
    /**
     * 主渲染函数
     */
    render() {
        this.clearGraphics();
        
        if (this.appState === 'drawing') {
            this.drawRawPath();
        } else if (this.appState === 'measuring') {
            this.drawStraightLine();
            this.drawRuler();
        }
    }
    
    /**
     * 绘制路径
     */
    drawRawPath(alpha = 1) {
        if (this.pathPoints.length === 0) return;
        
        this.pathGraphics.clear();
        this.pathGraphics.lineStyle(3, 0xff0000, alpha * 0.6);
        this.pathGraphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
        
        // 使用简单的lineTo方法绘制路径
        for (let i = 1; i < this.pathPoints.length; i++) {
            this.pathGraphics.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
        }
        
        if (this.startPoint) {
            this.pathGraphics.beginFill(0x27ae60, alpha);
            this.pathGraphics.drawCircle(this.startPoint.x, this.startPoint.y, 5);
            this.pathGraphics.endFill();
            
            this.pathGraphics.lineStyle(2, 0x2ecc71, alpha);
            this.pathGraphics.beginFill(0x2ecc71, 0);
            this.pathGraphics.drawCircle(this.startPoint.x, this.startPoint.y, 7);
            this.pathGraphics.endFill();
            
            if (this.pathPoints.length > 10) {
                const lastPoint = this.pathPoints[this.pathPoints.length - 1];
                const dist = this.distance(lastPoint, this.startPoint);
                if (dist < this.CLOSE_THRESHOLD) {
                    this.pathGraphics.lineStyle(2, 0x2ecc71, alpha * 0.5);
                    this.pathGraphics.drawCircle(this.startPoint.x, this.startPoint.y, this.CLOSE_THRESHOLD);
                }
            }
        }
    }
    
    /**
     * 绘制水平直线 - 平行于底部
     */
    drawStraightLine() {
        if (!this.straightLine.length) return;
        
        const { startX, endX, targetY } = this.straightLine;
        
        this.straightLineGraphics.clear();
        
        // 绘制直线
        this.straightLineGraphics.lineStyle(4, 0xe74c3c);
        this.straightLineGraphics.moveTo(startX, targetY);
        this.straightLineGraphics.lineTo(endX, targetY);
        
        // 绘制端点
        this.straightLineGraphics.beginFill(0xc0392b);
        this.straightLineGraphics.drawCircle(startX, targetY, 6);
        this.straightLineGraphics.drawCircle(endX, targetY, 6);
        this.straightLineGraphics.endFill();
        
        // 绘制标签 A B
        this.drawText('A (起点)', startX, targetY - 15, 0x2c3e50, 14, true);
        this.drawText('B (终点)', endX, targetY - 15, 0x2c3e50, 14, true);
        
        // 绘制长度标注（在线条下方）
        this.drawText(`被测长度: ${this.straightLine.length.toFixed(1)}px`, 
                     (startX + endX) / 2, targetY + 25, 0x7f8c8d, 12, true);
    }
    
    /**
     * 绘制水平标尺 - 始终平行于底部，长度大于线条
     */
    drawRuler() {
        const { x, y, width, height } = this.ruler;
        const lineLength = this.straightLine.length;
        const extraLength = this.RULER_EXTRA_LENGTH;
        
        this.rulerGraphics.clear();
        
        // 绘制标尺主体 - 木质风格
        const gradient = new PIXI.Graphics();
        gradient.beginFill(0xf4e4c1);
        gradient.drawRoundedRect(x - width/2, y - height/2, width, height, 5);
        gradient.endFill();
        
        this.rulerGraphics.lineStyle(2, 0x8b7355);
        this.rulerGraphics.drawRoundedRect(x - width/2, y - height/2, width, height, 5);
        
        // 绘制刻度 - 从标尺有效测量区域开始
        const effectiveStart = x - width/2 + extraLength;
        const effectiveEnd = x + width/2 - extraLength;
        
        this.rulerGraphics.lineStyle(1, 0x5d4e37);
        
        // 每10px一个刻度
        const tickSpacing = 10;
        const totalTicks = Math.floor((effectiveEnd - effectiveStart) / tickSpacing);
        
        for (let i = 0; i <= totalTicks; i++) {
            const tickX = effectiveStart + i * tickSpacing;
            let tickHeight = 8;
            
            if (i % 10 === 0) {
                tickHeight = 15;
                // 标注数字（厘米）
                this.drawText((i / 10).toString(), tickX, y - height/2 + tickHeight + 12, 0x5d4e37, 10, true);
            } else if (i % 5 === 0) {
                tickHeight = 12;
            }
            
            this.rulerGraphics.moveTo(tickX, y - height/2);
            this.rulerGraphics.lineTo(tickX, y - height/2 + tickHeight);
        }
        
        // 绘制中心点标记
        this.rulerGraphics.beginFill(0xe74c3c);
        this.rulerGraphics.drawCircle(x, y, 4);
        this.rulerGraphics.endFill();
        
        // 在标尺上直接显示测量结果
        this.updateRulerDisplay(x, y, width, effectiveStart, effectiveEnd);
    }
    
    /**
     * 在标尺上显示测量结果
     */
    updateRulerDisplay(rulerX, rulerY, rulerWidth, effectiveStart, effectiveEnd) {
        const lineStart = this.straightLine.startX;
        const lineEnd = this.straightLine.endX;
        
        // 计算重叠
        const overlapStart = Math.max(effectiveStart, lineStart);
        const overlapEnd = Math.min(effectiveEnd, lineEnd);
        const overlapLength = Math.max(0, overlapEnd - overlapStart);
        
        if (overlapLength > 0 && Math.abs(this.ruler.y - this.straightLine.targetY) < 10) {
            // 已对齐，显示绿色结果
            this.drawText(`✓ ${overlapLength.toFixed(1)}px`, rulerX, rulerY + 5, 0x27ae60, 14, true, true);
            
            // 绘制对齐指示线
            this.rulerGraphics.lineStyle(2, 0x2ecc71, 0.3);
            this.rulerGraphics.moveTo(lineStart, this.straightLine.targetY - 20);
            this.rulerGraphics.lineTo(lineStart, rulerY - this.ruler.height/2);
            this.rulerGraphics.moveTo(lineEnd, this.straightLine.targetY - 20);
            this.rulerGraphics.lineTo(lineEnd, rulerY - this.ruler.height/2);
        } else {
            // 未对齐，显示提示
            this.drawText('移动对齐', rulerX, rulerY + 5, 0x95a5a6, 14, true);
        }
        
        // 在标尺两端标注
        this.drawText('0', effectiveStart, rulerY + this.ruler.height/2 - 8, 0x7f8c8d, 11, true);
        this.drawText(`${this.straightLine.length.toFixed(0)}`, effectiveEnd, rulerY + this.ruler.height/2 - 8, 0x7f8c8d, 11, true);
    }
    
    /**
     * 绘制文本
     */
    drawText(text, x, y, color, size, centered = false, bold = false) {
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: size,
            fill: color,
            fontWeight: bold ? 'bold' : 'normal',
            align: centered ? 'center' : 'left'
        });
        
        const textObject = new PIXI.Text(text, textStyle);
        if (centered) {
            textObject.anchor.set(0.5);
        }
        textObject.x = x;
        textObject.y = y;
        
        this.stage.addChild(textObject);
        
        // 稍后移除文本，避免内存泄漏
        setTimeout(() => {
            if (textObject.parent) {
                textObject.parent.removeChild(textObject);
            }
        }, 100);
    }
}

// 初始化应用
window.onload = function() {
    new MeasurementApp();
};