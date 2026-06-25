import './style.css';
import { io } from 'socket.io-client';

// --- DYNAMIC COUNTDOWN ANIMATION INJECTION ---
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .intro-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 15, 20, 0.93);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 999;
    border-radius: 16px;
    transition: opacity 0.4s ease;
  }
  .intro-title {
    font-size: 1.25rem;
    color: #ff4757;
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 5px;
    text-transform: uppercase;
  }
  .intro-sub {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 25px;
  }
  .intro-number {
    font-size: 6rem;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 0 20px rgba(255, 71, 87, 0.6);
    animation: pulsePop 1s ease-in-out infinite;
  }
  @keyframes pulsePop {
    0% { transform: scale(0.5); opacity: 0; }
    15% { transform: scale(1.1); opacity: 1; }
    30% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.2; }
  }
`;
document.head.appendChild(styleSheet);

// --- ESTABLISH LIVE BACKEND CONNECTION ---
const socket = io('http://localhost:5000');

// --- DOM ELEMENT SELECTORS ---
const lobbyScreen = document.getElementById('lobby-screen');
const chatScreen = document.getElementById('chat-screen');
const statusBox = document.getElementById('status-box');
const actionBtn = document.getElementById('action-btn');
const skipBtn = document.getElementById('skip-btn');
const sendBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');
const messageBox = document.getElementById('message-box');
const timerElement = document.getElementById('timer');
const controlRow = document.querySelector('.control-row');
const chatInputArea = document.querySelector('.chat-input-area');

let timerInterval = null;
let introInterval = null;
let timeRemaining = 120;
let currentRoom = null;

// --- LIVE NETWORK CONNECTION MONITORING ---
socket.on('connect', () => {
  statusBox.classList.remove('disconnected');
  statusBox.classList.add('connected');
  statusBox.textContent = '● Connected to Server (Ready)';
  actionBtn.disabled = false;
});

socket.on('disconnect', () => {
  statusBox.classList.remove('connected');
  statusBox.classList.add('disconnected');
  statusBox.textContent = 'Disconnected. Retrying connection...';
  actionBtn.disabled = true;
  handleRoomTeardown();
});

// --- GLOBAL UI EVENT LISTENERS ---
actionBtn.addEventListener('click', () => {
  actionBtn.disabled = true;
  actionBtn.textContent = 'Searching for a match... ⚡';
  statusBox.textContent = 'In matchmaking queue...';
  socket.emit('join-queue');
});

skipBtn.addEventListener('click', () => {
  if (currentRoom) {
    socket.emit('skip-match', { room: currentRoom });
  }
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// --- REAL-TIME SERVER EVENT LISTENERS ---

// 1. Triggered when backend finds an available pair in the array queue
socket.on('match-found', (data) => {
  currentRoom = data.room;
  
  // Transition views instantly
  lobbyScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  
  // Wipe out remnants of old chats
  messageBox.innerHTML = '';
  
  // Launch our animated 10-second setup overlay
  runIntroCountdown();
});

// 2. Triggered when your partner emits text payload packages through port 5000
socket.on('receive-message', (data) => {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg them';
  msgDiv.textContent = data.text;
  messageBox.appendChild(msgDiv);
  scrollToBottom();
});

// 3. Triggered when both clients register a true boolean match validation state
socket.on('mutual-match', () => {
  clearInterval(timerInterval); // Stop the expiration countdown completely
  
  timerElement.textContent = `🔒 Connected!`;
  addSystemMessage('🎉 MUTUAL MATCH! Profiles unlocked. Keep chatting without time limits!');
  
  // Upgrade the Like button to locked status
  const likeBtn = document.getElementById('like-btn');
  if (likeBtn) {
    likeBtn.className = 'btn btn-like connected-state';
    likeBtn.innerHTML = '❤️ Connected!';
    likeBtn.disabled = true;
  }

  // ✨ NEW UPGRADE: Rebrand the Skip mechanism to an elegant End Date button
  if (skipBtn) {
    skipBtn.innerHTML = '🛑 End Date';
  }
});

// 4. Triggered if user calls skip-match or breaks connection socket
socket.on('match-terminated', () => {
  handleRoomTeardown();
  addSystemMessage('Match dissolved. Returning to lobby...');
  
  setTimeout(() => {
    chatScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    actionBtn.disabled = false;
    actionBtn.textContent = 'Find a Match ⚡';
    statusBox.textContent = '● Connected to Server (Ready)';
    
    // ✨ SAFETY CLEAN UP: Restore button layout back to default for the next connection
    if (skipBtn) {
      skipBtn.innerHTML = '➡️ Skip';
    }
  }, 2000);
});

// --- COMPONENT HANDLERS & HELPERS ---

function runIntroCountdown() {
  // Lock interface interactive environments during introduction
  if(chatInputArea) chatInputArea.style.pointerEvents = 'none';
  if(controlRow) controlRow.style.pointerEvents = 'none';
  timerElement.textContent = `⏱️ --:--`;

  // Create overlay markup dynamically
  const overlay = document.createElement('div');
  overlay.className = 'intro-overlay';
  overlay.innerHTML = `
    <div class="intro-title">🔥 Match Found!</div>
    <div class="intro-sub">Get ready to chat...</div>
    <div class="intro-number" id="intro-countdown-num">10</div>
  `;
  chatScreen.appendChild(overlay);

  let introCount = 10;
  clearInterval(introInterval);
  
  introInterval = setInterval(() => {
    introCount--;
    const numDisplay = document.getElementById('intro-countdown-num');
    
    if(numDisplay) {
      numDisplay.textContent = introCount;
    }

    if (introCount <= 0) {
      clearInterval(introInterval);
      
      // Animate overlay removal smoothly
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        
        // Restore interaction controls
        if(chatInputArea) chatInputArea.style.pointerEvents = 'auto';
        if(controlRow) controlRow.style.pointerEvents = 'auto';
        
        // Initialize conversational engines and layout configurations
        addSystemMessage('Connected with a live partner! Say hello... 💬');
        setupLikeButton();
        startRoomTimer();
      }, 400); // Dynamic transition clip speed
    }
  }, 1000);
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !currentRoom) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg me';
  msgDiv.textContent = text;
  messageBox.appendChild(msgDiv);
  
  socket.emit('send-message', { room: currentRoom, text: text });
  
  chatInput.value = '';
  scrollToBottom();
}

function setupLikeButton() {
  const existingLike = document.getElementById('like-btn');
  if (existingLike) existingLike.remove();

  const likeBtn = document.createElement('button');
  likeBtn.id = 'like-btn';
  likeBtn.className = 'btn btn-like';
  likeBtn.innerHTML = '❤️ Like';
  controlRow.appendChild(likeBtn);

  likeBtn.addEventListener('click', () => {
    likeBtn.disabled = true;
    likeBtn.innerHTML = 'Liked! Waiting... ⏳';
    socket.emit('like-match', { room: currentRoom });
  });
}

function startRoomTimer() {
  timeRemaining = 120;
  updateTimerDisplay();
  clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      addSystemMessage('Time expired! Match closing...');
      socket.emit('skip-match', { room: currentRoom });
    }
  }, 1000);
}

function handleRoomTeardown() {
  clearInterval(timerInterval);
  clearInterval(introInterval);
  currentRoom = null;
  
  // Wipe intro overlays if user leaves mid-countdown
  const activeOverlay = document.querySelector('.intro-overlay');
  if(activeOverlay) activeOverlay.remove();
  
  if(chatInputArea) chatInputArea.style.pointerEvents = 'auto';
  if(controlRow) controlRow.style.pointerEvents = 'auto';

  const likeBtn = document.getElementById('like-btn');
  if (likeBtn) likeBtn.remove();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
  const seconds = (timeRemaining % 60).toString().padStart(2, '0');
  timerElement.textContent = `⏱️ ${minutes}:${seconds}`;
}

function addSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg system';
  msgDiv.textContent = text;
  messageBox.appendChild(msgDiv);
  scrollToBottom();
}

function scrollToBottom() {
  messageBox.scrollTop = messageBox.scrollHeight;
}