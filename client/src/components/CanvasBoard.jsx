import React, { useRef, useEffect, useState } from 'react';
import { socket } from '../utils/socket';
import { Edit2, Square, Circle, Minus, RotateCcw, Trash2 } from 'lucide-react';

export default function CanvasBoard({ roomId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, eraser, rect, circle, line
  const [color, setColor] = useState('#7F77DD');
  const [lineWidth, setLineWidth] = useState(3);
  
  const startPosRef = useRef({ x: 0, y: 0 });
  const prevPosRef = useRef({ x: 0, y: 0 });
  
  // Keep track of canvas history for undo/redo locally
  const [history, setHistory] = useState([]);
  const [redoList, setRedoList] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    contextRef.current = context;

    // Socket receivers for drawing events
    socket.on('draw', (data) => {
      drawRemote(data);
    });

    socket.on('whiteboard-clear', () => {
      clearCanvasLocal();
    });

    // Resize handler
    const handleResize = () => {
      // Create backup of current canvas
      const backup = canvas.cloneNode(true);
      const backupCtx = backup.getContext('2d');
      backupCtx.drawImage(canvas, 0, 0);

      const newRect = canvas.getBoundingClientRect();
      canvas.width = newRect.width * 2;
      canvas.height = newRect.height * 2;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = `${newRect.height}px`;

      context.scale(2, 2);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.lineWidth = lineWidth;

      // Draw backup back
      context.drawImage(backup, 0, 0, backup.width / 2, backup.height / 2);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      socket.off('draw');
      socket.off('whiteboard-clear');
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update stroke styles on change
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      contextRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth, tool]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and touch events
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    startPosRef.current = coords;
    prevPosRef.current = coords;
    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser') {
      const context = contextRef.current;
      context.beginPath();
      context.moveTo(coords.x, coords.y);
      context.lineTo(coords.x, coords.y);
      context.stroke();
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const context = contextRef.current;

    if (tool === 'pen' || tool === 'eraser') {
      context.beginPath();
      context.moveTo(prevPosRef.current.x, prevPosRef.current.y);
      context.lineTo(coords.x, coords.y);
      context.stroke();

      // Emit freehand draw segment to other room participants
      socket.emit('draw', {
        type: 'freehand',
        x0: prevPosRef.current.x,
        y0: prevPosRef.current.y,
        x1: coords.x,
        y1: coords.y,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        width: lineWidth
      });

      prevPosRef.current = coords;
    } else {
      // Shapes preview: draw them using a temporary canvas logic,
      // or for simplicity, draw preview overlays (using standard Canvas method)
      // For this collaborative whiteboard, drawing the completed shape on release is robust.
    }
  };

  const endDrawing = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const coords = getCoordinates(e);
    const context = contextRef.current;

    // Draw final shapes on mouse release
    if (tool === 'rect') {
      const width = coords.x - startPosRef.current.x;
      const height = coords.y - startPosRef.current.y;
      context.strokeRect(startPosRef.current.x, startPosRef.current.y, width, height);

      socket.emit('draw', {
        type: 'rect',
        x0: startPosRef.current.x,
        y0: startPosRef.current.y,
        width,
        height,
        color,
        lineWidth
      });
    } else if (tool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(coords.x - startPosRef.current.x, 2) + 
        Math.pow(coords.y - startPosRef.current.y, 2)
      );
      context.beginPath();
      context.arc(startPosRef.current.x, startPosRef.current.y, radius, 0, 2 * Math.PI);
      context.stroke();

      socket.emit('draw', {
        type: 'circle',
        x0: startPosRef.current.x,
        y0: startPosRef.current.y,
        radius,
        color,
        lineWidth
      });
    } else if (tool === 'line') {
      context.beginPath();
      context.moveTo(startPosRef.current.x, startPosRef.current.y);
      context.lineTo(coords.x, coords.y);
      context.stroke();

      socket.emit('draw', {
        type: 'line',
        x0: startPosRef.current.x,
        y0: startPosRef.current.y,
        x1: coords.x,
        y1: coords.y,
        color,
        lineWidth
      });
    }
  };

  // Draw data broadcasted from other peers
  const drawRemote = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');

    // Store state
    const currentStrokeStyle = context.strokeStyle;
    const currentLineWidth = context.lineWidth;

    context.strokeStyle = data.color;
    context.lineWidth = data.width || data.lineWidth;

    if (data.type === 'freehand' || data.type === 'line') {
      context.beginPath();
      context.moveTo(data.x0, data.y0);
      context.lineTo(data.x1, data.y1);
      context.stroke();
    } else if (data.type === 'rect') {
      context.strokeRect(data.x0, data.y0, data.width, data.height);
    } else if (data.type === 'circle') {
      context.beginPath();
      context.arc(data.x0, data.y0, data.radius, 0, 2 * Math.PI);
      context.stroke();
    }

    // Restore state
    context.strokeStyle = currentStrokeStyle;
    context.lineWidth = currentLineWidth;
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearAll = () => {
    clearCanvasLocal();
    socket.emit('whiteboard-clear');
  };

  return (
    <div className="whiteboard-container">
      {/* Toolbar */}
      <div className="whiteboard-toolbar">
        <button 
          title="Pen"
          className={`wb-tool-btn ${tool === 'pen' ? 'active' : ''}`} 
          onClick={() => setTool('pen')}
        >
          <Edit2 size={16} />
        </button>

        <button 
          title="Eraser"
          className={`wb-tool-btn ${tool === 'eraser' ? 'active' : ''}`} 
          onClick={() => setTool('eraser')}
        >
          <Trash2 size={16} />
        </button>

        <button 
          title="Rectangle"
          className={`wb-tool-btn ${tool === 'rect' ? 'active' : ''}`} 
          onClick={() => setTool('rect')}
        >
          <Square size={16} />
        </button>

        <button 
          title="Circle"
          className={`wb-tool-btn ${tool === 'circle' ? 'active' : ''}`} 
          onClick={() => setTool('circle')}
        >
          <Circle size={16} />
        </button>

        <button 
          title="Line"
          className={`wb-tool-btn ${tool === 'line' ? 'active' : ''}`} 
          onClick={() => setTool('line')}
        >
          <Minus size={16} />
        </button>

        {/* Separator */}
        <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />

        {/* Color picker */}
        {tool !== 'eraser' && (
          <div className="flex items-center gap-1">
            {['#7F77DD', '#534AB7', '#1D9E75', '#E24B4A', '#F5A623', '#1A1A1E'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: color === c ? '2px solid #000' : '1px solid #CCC',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            ))}
          </div>
        )}

        <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />

        {/* Stroke width */}
        <div className="flex items-center gap-2" style={{ padding: '0 4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Size:</span>
          <input
            type="range"
            min="1"
            max="15"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            style={{ width: '60px', accentColor: 'var(--primary-accent)' }}
          />
        </div>

        {/* Clear all */}
        <button 
          title="Clear Board"
          className="wb-tool-btn" 
          onClick={handleClearAll}
          style={{ marginLeft: 'auto', color: 'var(--danger)' }}
        >
          <Trash2 size={16} />
          <span style={{ fontSize: '11px', marginLeft: '4px' }}>Clear All</span>
        </button>
      </div>

      {/* Canvas Area */}
      <div className="canvas-area">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair'
          }}
        />
      </div>
    </div>
  );
}
