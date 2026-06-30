/**
 * js/drawing-pad.js
 * Logic for the Drawing Pad overlay, including Pro features, SVG styling classes,
 * and an Undo/Redo history stack for Adobe-like workflow.
 */

// We wait for DOM content or rely on `defer` in the script tag
document.addEventListener("DOMContentLoaded", () => {

    const dCanvas = document.getElementById('draw-canvas');
    if (!dCanvas) return;

    const dCtx = dCanvas.getContext('2d', { willReadFrequently: true });

    let isDrawing = false;
    let drawMode = 'pen';
    let drawSymmetry = false;
    let drawPulsar = false;

    // History Stack for Undo/Redo
    let drawHistoryStack = [];
    let historyIndex = -1;
    const MAX_HISTORY = 30;

    // Save initial blank state
    setTimeout(() => {
        saveState();
    }, 100);

    function saveState() {
        // If we undo and then draw, discard future redo branches
        if (historyIndex < drawHistoryStack.length - 1) {
            drawHistoryStack = drawHistoryStack.slice(0, historyIndex + 1);
        }

        drawHistoryStack.push(dCanvas.toDataURL());
        if (drawHistoryStack.length > MAX_HISTORY) {
            drawHistoryStack.shift();
        } else {
            historyIndex++;
        }
    }

    function restoreState(index) {
        if (index < 0 || index >= drawHistoryStack.length) return;
        const img = new Image();
        img.onload = () => {
            // Must clear canvas before restoring transparent overlapping PNGs
            dCtx.clearRect(0, 0, dCanvas.width, dCanvas.height);
            dCtx.globalCompositeOperation = 'source-over';
            dCtx.drawImage(img, 0, 0);

            // Apply live 3D update if the user wants auto-live update, 
            // but for performance we might just let them hit BUILD 3D
        };
        img.src = drawHistoryStack[index];
    }

    window.undoDraw = () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(historyIndex);
        }
    };

    window.redoDraw = () => {
        if (historyIndex < drawHistoryStack.length - 1) {
            historyIndex++;
            restoreState(historyIndex);
        }
    };

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('draw-overlay').style.display !== 'none') {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                if (e.shiftKey) {
                    window.redoDraw(); // Cmd+Shift+Z
                } else {
                    window.undoDraw(); // Cmd+Z
                }
                e.preventDefault();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                window.redoDraw(); // Cmd+Y
                e.preventDefault();
            }
        }
    });

    window.setDrawMode = (mode) => {
        drawMode = mode;
        document.getElementById('btn-draw-pen').classList.toggle('active', mode === 'pen');
        document.getElementById('btn-draw-eraser').classList.toggle('active', mode === 'eraser');
    };

    window.resizeDrawCanvas = () => {
        dCanvas.width = dCanvas.clientWidth;
        dCanvas.height = dCanvas.clientHeight;

        // Context Defaults
        dCtx.lineCap = 'round';
        dCtx.lineJoin = 'round';
    };

    window.toggleDrawSymmetry = () => {
        drawSymmetry = !drawSymmetry;
        const btn = document.getElementById('btn-draw-sym');
        const guide = document.getElementById('symmetry-guide');
        if (drawSymmetry) {
            btn.classList.add('active');
            if (guide) guide.style.display = 'block';
        } else {
            btn.classList.remove('active');
            if (guide) guide.style.display = 'none';
        }
    };

    window.toggleDrawPulsar = () => {
        drawPulsar = !drawPulsar;
        const btn = document.getElementById('btn-draw-pulsar');
        if (drawPulsar) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    };

    window.updateDrawColor = () => {
        if (drawMode === 'pen') {
            dCtx.strokeStyle = document.getElementById('drawColor').value;
        }
    };

    window.openDraw = () => {
        document.getElementById('draw-overlay').style.display = 'flex';
        window.resizeDrawCanvas();
        window.setDrawMode(drawMode);

        // Restore last known state if history exists and canvas was wiped
        if (historyIndex >= 0) {
            restoreState(historyIndex);
        }
    };

    window.closeDraw = () => {
        document.getElementById('draw-overlay').style.display = 'none';
    };

    window.clearDraw = () => {
        dCtx.clearRect(0, 0, dCanvas.width, dCanvas.height);
        saveState();
    };

    // ---- POINTER EVENTS ----

    dCanvas.addEventListener('pointerdown', e => {
        isDrawing = true;
        dCtx.beginPath();
        dCtx.moveTo(e.offsetX, e.offsetY);

        if (drawMode === 'pen') {
            dCtx.globalCompositeOperation = 'source-over';
            dCtx.strokeStyle = document.getElementById('drawColor').value;
            dCtx.lineWidth = 15;
        } else {
            dCtx.globalCompositeOperation = 'destination-out';
            dCtx.lineWidth = 30;
        }
        e.preventDefault();
    });

    dCanvas.addEventListener('pointermove', e => {
        if (!isDrawing) return;

        if (drawPulsar && drawMode === 'pen') {
            const timeVal = Date.now() * 0.01;
            dCtx.lineWidth = 15 + Math.sin(timeVal) * 10;
        } else if (drawMode === 'pen') {
            dCtx.lineWidth = 15;
        }

        dCtx.lineTo(e.offsetX, e.offsetY);
        dCtx.stroke();

        if (drawSymmetry) {
            dCtx.save();
            dCtx.scale(-1, 1);
            dCtx.translate(-dCanvas.width, 0);

            dCtx.lineTo(e.offsetX, e.offsetY);
            dCtx.stroke();

            dCtx.restore();
        }

        // Reset subpath
        dCtx.beginPath();
        dCtx.moveTo(e.offsetX, e.offsetY);

        e.preventDefault();
    });

    dCanvas.addEventListener('pointerup', () => {
        if (isDrawing) {
            isDrawing = false;
            saveState(); // Commit stroke to Undo Stack
        }
    });

    dCanvas.addEventListener('pointerleave', () => {
        if (isDrawing) {
            isDrawing = false;
            saveState();
        }
    });

    // Make drawing canvas globally accessible to main.js for extraction
    window.dCanvas = dCanvas;
});
