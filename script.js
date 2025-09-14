class Whiteboard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.brushSize = 5;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.fontSize = 24;
        this.fontFamily = 'Arial';
        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;

        this.init();
    }

    init() {
        this.setCanvasSize();
        this.setupEventListeners();
        this.setupTools();
        this.saveState();

        // Handle window resize
        window.addEventListener('resize', () => {
            const dataUrl = this.canvas.toDataURL();
            this.setCanvasSize();
            const img = new Image();
            img.onload = () => this.ctx.drawImage(img, 0, 0);
            img.src = dataUrl;
        });
    }

    setCanvasSize() {
        const container = document.querySelector('.canvas-container');
        this.canvas.width = container.clientWidth - 40;
        this.canvas.height = container.clientHeight - 40;
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Font size and family controls
        document.getElementById('font-size').addEventListener('input', (e) => {
            this.fontSize = parseInt(e.target.value);
        });
        document.getElementById('font-family').addEventListener('change', (e) => {
            this.fontFamily = e.target.value;
        });

        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Tool selection buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.currentTarget.dataset.tool);
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Color selection buttons
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.addEventListener('click', (e) => {
                this.setColor(e.currentTarget.dataset.color);
                document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                document.getElementById('custom-color-picker').value = e.currentTarget.dataset.color;
            });
        });

        // Custom color picker
        document.getElementById('custom-color-picker').addEventListener('input', (e) => {
            this.setColor(e.target.value);
            document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
        });

        // Brush size control
        document.getElementById('brush-size').addEventListener('input', (e) => {
            this.setBrushSize(e.target.value);
            document.getElementById('brush-size-value').textContent = `${e.target.value}px`;
        });

        // Clear canvas button
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the canvas?')) {
                this.clearCanvas();
            }
        });

        // Save canvas as image
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveCanvas();
        });

        // Undo and redo buttons
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Image upload
        document.getElementById('image-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                this.saveState();
            };
        });
    }

    setupTools() {
        this.setTool('pen');
        this.setColor('#000000');
        document.getElementById('brush-size-value').textContent = `${this.brushSize}px`;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = tool === 'eraser' ? 'crosshair' : 'crosshair';
    }

    setColor(color) {
        this.currentColor = color;
    }

    setBrushSize(size) {
        this.brushSize = parseInt(size);
    }

    startDrawing(e) {
        const pos = this.getMousePos(e);

        if (this.currentTool === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Type here';
            input.style.position = 'absolute';
            input.style.left = `${e.clientX}px`;
            input.style.top = `${e.clientY}px`;
            input.style.fontSize = `${this.fontSize}px`;
            input.style.border = '1px dashed #666';
            input.style.background = 'transparent';
            input.style.color = this.currentColor;
            input.style.zIndex = 1000;
            document.body.appendChild(input);
            input.focus();
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.ctx.fillStyle = this.currentColor;
                    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
                    this.ctx.fillText(input.value, pos.x, pos.y);
                    document.body.removeChild(input);
                    this.saveState();
                }
            });
            return;
        }

        this.isDrawing = true;
        [this.lastX, this.lastY] = [pos.x, pos.y];
        [this.startX, this.startY] = [pos.x, pos.y];
        if (['line', 'rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
            this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getMousePos(e);
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = this.brushSize;
        this.ctx.strokeStyle = this.currentColor;

        if (this.currentTool === 'pen') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
            [this.lastX, this.lastY] = [pos.x, pos.y];
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.brushSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalCompositeOperation = 'source-over';
            [this.lastX, this.lastY] = [pos.x, pos.y];
        } else if (['line', 'rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
            if (this.snapshot) {
                this.ctx.putImageData(this.snapshot, 0, 0);
            }

            this.ctx.beginPath();
            if (this.currentTool === 'line') {
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(pos.x, pos.y);
            } else if (this.currentTool === 'rectangle') {
                const width = pos.x - this.startX;
                const height = pos.y - this.startY;
                this.ctx.rect(this.startX, this.startY, width, height);
            } else if (this.currentTool === 'circle') {
                const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
            } else if (this.currentTool === 'arrow') {
                const dx = pos.x - this.startX;
                const dy = pos.y - this.startY;
                const angle = Math.atan2(dy, dx);
                const headLength = 15;
                const arrowAngle = Math.PI / 7;

                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.lineTo(
                    pos.x - headLength * Math.cos(angle - arrowAngle),
                    pos.y - headLength * Math.sin(angle - arrowAngle)
                );
                this.ctx.moveTo(pos.x, pos.y);
                this.ctx.lineTo(
                    pos.x - headLength * Math.cos(angle + arrowAngle),
                    pos.y - headLength * Math.sin(angle + arrowAngle)
                );
            }
            this.ctx.stroke();
        }
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.snapshot = null;
            this.saveState();
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup');
        this.canvas.dispatchEvent(mouseEvent);
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    saveState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.canvas.toDataURL());
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.redraw();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.redraw();
        }
    }

    redraw() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        img.src = this.history[this.historyIndex];
    }

    saveCanvas() {
        const link = document.createElement('a');
        link.download = 'whiteboard.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Whiteboard();
});
