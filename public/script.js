document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Canvas setup
  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = window.innerHeight * 0.7;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Drawing state
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Tool elements
  const colorPicker = document.getElementById("color-picker");
  const brushSize = document.getElementById("brush-size");
  const brushSizeText = document.getElementById("brush-size-text");
  const clearButton = document.getElementById("clear-button");
  const userCountSpan = document.getElementById("user-count");

  // Update brush size text
  brushSize.addEventListener("input", () => {
    brushSizeText.textContent = `${brushSize.value}px`;
  });

  // Drawing functions
  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
  }

  function draw(e) {
    if (!isDrawing) return;

    const [x, y] = getCoordinates(e);
    const drawingData = {
      x0: lastX,
      y0: lastY,
      x1: x,
      y1: y,
      color: colorPicker.value,
      size: brushSize.value,
    };

    drawLine(drawingData);

    // Emit drawing data to server
    socket.emit("draw", drawingData);

    [lastX, lastY] = [x, y];
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function drawLine(data) {
    const { x0, y0, x1, y1, color, size } = data;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.stroke();
  }

  // Event listeners for drawing
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch support for mobile devices
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup");
    canvas.dispatchEvent(mouseEvent);
  });

  // Clear canvas
  clearButton.addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit("clear");
  });

  // Socket.io event handlers
  socket.on("draw", (data) => {
    drawLine(data);
  });

  socket.on("clear", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
  });

  socket.on("userCount", (count) => {
    userCountSpan.textContent = count;
  });
});
