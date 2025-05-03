document.addEventListener("DOMContentLoaded", () => {
  let socket;
  let username = null;
  let token = null;

  // Auth elements
  const authModal = document.getElementById("auth-modal");
  const authForm = document.getElementById("auth-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submit-btn");
  const toggleAuth = document.getElementById("toggle-auth");
  const toggleLink = document.getElementById("toggle-link");
  const modalTitle = document.getElementById("modal-title");

  // Main app elements
  const container = document.querySelector(".container");
  const currentUserSpan = document.getElementById("current-user");
  const logoutBtn = document.getElementById("logout-btn");
  const statusMessages = document.getElementById("status-messages");

  // Canvas setup
  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");

  // Drawing history for undo/redo
  const drawingHistory = [];
  let historyStep = -1;

  // Set canvas size
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
  const undoButton = document.getElementById("undo-button");
  const redoButton = document.getElementById("redo-button");
  const userCountSpan = document.getElementById("user-count");

  // Save canvas state to history
  function saveState() {
    historyStep++;
    if (historyStep < drawingHistory.length) {
      drawingHistory.length = historyStep;
    }
    drawingHistory.push(canvas.toDataURL());
  }

  // Undo/Redo functions
  function undo() {
    if (historyStep > 0) {
      historyStep--;
      restoreState(historyStep);
    }
  }

  function redo() {
    if (historyStep < drawingHistory.length - 1) {
      historyStep++;
      restoreState(historyStep);
    }
  }

  function restoreState(step) {
    let img = new Image();
    img.src = drawingHistory[step];
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
  }

  // Authentication toggle
  let isLogin = true;
  toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    if (isLogin) {
      modalTitle.textContent = "Login";
      submitBtn.textContent = "Login";
      toggleAuth.innerHTML =
        'Don\'t have an account? <a href="#" id="toggle-link">Register</a>';
    } else {
      modalTitle.textContent = "Register";
      submitBtn.textContent = "Register";
      toggleAuth.innerHTML =
        'Already have an account? <a href="#" id="toggle-link">Login</a>';
    }
  });

  // Authentication form submit
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usernameInput.value,
          password: passwordInput.value,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        token = data.token;
        username = data.username;
        startApp();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert("Authentication failed");
    }
  });

  // Start the app after authentication
  function startApp() {
    authModal.style.display = "none";
    container.style.display = "flex";
    currentUserSpan.textContent = `User: ${username}`;

    // Connect to Socket.io
    socket = io();

    // Join the room
    socket.emit("join", { username, token });

    // Setup event listeners
    setupEventListeners();
    setupSocketListeners();

    // Save initial canvas state
    saveState();
  }

  // Logout
  logoutBtn.addEventListener("click", () => {
    container.style.display = "none";
    authModal.style.display = "flex";
    socket.disconnect();
    token = null;
    username = null;
  });

  // Setup all event listeners
  function setupEventListeners() {
    brushSize.addEventListener("input", () => {
      brushSizeText.textContent = `${brushSize.value}px`;
    });

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);

    // Touch support
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

    clearButton.addEventListener("click", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      socket.emit("clear");
      saveState();
    });

    undoButton.addEventListener("click", undo);
    redoButton.addEventListener("click", redo);
  }

  // Setup socket listeners
  function setupSocketListeners() {
    socket.on("draw", (data) => {
      drawLine(data);
    });

    socket.on("clear", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
    });

    socket.on("userCount", (count) => {
      userCountSpan.textContent = count;
    });

    socket.on("userJoined", (message) => {
      showStatusMessage(message);
    });

    socket.on("userLeft", (message) => {
      showStatusMessage(message);
    });
  }

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
    socket.emit("draw", drawingData);

    [lastX, lastY] = [x, y];
  }

  function stopDrawing() {
    isDrawing = false;
    saveState();
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

  function showStatusMessage(message) {
    statusMessages.textContent = message;
    setTimeout(() => {
      statusMessages.textContent = "";
    }, 3000);
  }
});
