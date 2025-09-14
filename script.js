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

        // Resize handling: keep content by redrawing snapshot
        window.addEventListener('resize', () => {
            const dataUrl = this.canvas.toDataURL();
            this.setCanvasSize();
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            };
            img.src = dataUrl;
        });
    }

    setCanvasSize() {
        const container = document.querySelector('.canvas-container');
        // leave some padding so canvas is visible inside container
        const padding = 40;
        this.canvas.width = Math.max(300, container.clientWidth - padding);
        this.canvas.height = Math.max(200, container.clientHeight - padding);
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Touch events (map to mouse)
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.setTool(tool);
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Color pickers
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.addEventListener('click', (e) => {
                const color = e.currentTarget.dataset.color;
                this.setColor(color);
                document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const custom = document.getElementById('custom-color-picker');
                if (custom) custom.value = color;
            });
        });

        // Custom color input
        const customColor = document.getElementById('custom-color-picker');
        if (customColor) {
            customColor.addEventListener('input', (e) => {
                this.setColor(e.target.value);
                document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
            });
        }

        // Brush size
        const brush = document.getElementById('brush-size');
        if (brush) {
            brush.addEventListener('input', (e) => {
                this.setBrushSize(e.target.value);
                const label = document.getElementById('brush-size-value');
                if (label) label.textContent = `${e.target.value}px`;
            });
        }

        // Clear / Save / Undo / Redo
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the canvas?')) {
                    this.clearCanvas();
                }
            });
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCanvas());

        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());

        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

        // Image upload
        const imgInput = document.getElementById('image-upload');
        if (imgInput) {
            imgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const img = new Image();
                img.onload = () => {
                    // Draw image centered and scaled to canvas while preserving aspect ratio
                    const ratio = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
                    const w = img.width * ratio;
                    const h = img.height * ratio;
                    const x = (this.canvas.width - w) / 2;
                    const y = (this.canvas.height - h) / 2;
                    this.ctx.drawImage(img, x, y, w, h);
                    this.saveState();
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(file);
            });
        }
    }

    setupTools() {
        this.setTool('pen');
        this.setColor('#000000');
        document.getElementById('brush-size-value').textContent = `${this.brushSize}px`;
    }

    setTool(tool) {
        this.currentTool = tool;

        // Cursor styling according to tool
        if (tool === 'pen') {
            this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,\
                <svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\' fill=\'black\'>\
                <path d=\'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z\'/>\
                </svg>") 0 24, auto';
        } else if (tool === 'eraser') {
            this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,\
            <svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\' fill=\'black\'>\
            <path d=\'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0z\'/>\
            </svg>") 0 24, auto';
        } else {
            // line, rectangle, circle, arrow
            this.canvas.style.cursor = 'crosshair';
        }
    }
    setColor(color) {
        this.currentColor = color;
    }

    setBrushSize(size) {
        this.brushSize = parseInt(size, 10) || 1;
    }

    startDrawing(e) {
        const pos = this.getPointerPos(e);

        this.isDrawing = true;
        [this.lastX, this.lastY] = [pos.x, pos.y];
        [this.startX, this.startY] = [pos.x, pos.y];

        if (['line', 'rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
            // keep a snapshot to draw shape preview
            this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPointerPos(e);

        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = this.brushSize;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = this.currentColor;

        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
            [this.lastX, this.lastY] = [pos.x, pos.y];
        } else if (this.currentTool === 'eraser') {
            // erase by drawing with destination-out
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
                const headLength = Math.min(25, Math.sqrt(dx * dx + dy * dy) * 0.2);
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
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
        this.canvas.dispatchEvent(mouseEvent);
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // If it's a MouseEvent, clientX/clientY are present; for safety support touch's changedTouches
        const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    saveState() {
        try {
            // trim future history if any
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }
            this.history.push(this.canvas.toDataURL());
            this.historyIndex = this.history.length - 1;

            // limit history size to avoid memory bloat
            const maxHistory = 50;
            if (this.history.length > maxHistory) {
                this.history = this.history.slice(this.history.length - maxHistory);
                this.historyIndex = this.history.length - 1;
            }
        } catch (err) {
            console.error('Failed to save state:', err);
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.redraw();
        } else {
            // clear if at first state
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.redraw();
        }
    }

    redraw() {
        const src = this.history[this.historyIndex];
        if (!src) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        img.src = src;
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
