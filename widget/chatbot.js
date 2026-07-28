(function () {
  const CONFIG = {
    apiUrl: window.ClinicBotConfig?.apiUrl || 'http://localhost:4001/api',
    title: window.ClinicBotConfig?.title || 'Clinic Assistant',
    subtitle: window.ClinicBotConfig?.subtitle || 'Ask us anything about our services',
    greeting: window.ClinicBotConfig?.greeting || 'Hello! How can I help you today? I can answer questions about our services, doctors, and help you book an appointment.',
    bubbleColor: window.ClinicBotConfig?.bubbleColor || '#2563eb',
  };

  let visitorId = localStorage.getItem('clinicbot_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('clinicbot_visitor_id', visitorId);
  }

  let isOpen = false;
  let messages = [];

  function createWidget() {
    const container = document.createElement('div');
    container.className = 'clinicbot-widget';
    container.innerHTML = `
      <button class="clinicbot-bubble" id="clinicbot-bubble">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      <div class="clinicbot-window" id="clinicbot-window">
        <div class="clinicbot-header">
          <div>
            <h3>${CONFIG.title}</h3>
            <p>${CONFIG.subtitle}</p>
          </div>
          <button class="clinicbot-close" id="clinicbot-close">&times;</button>
        </div>
        <div class="clinicbot-messages" id="clinicbot-messages"></div>
        <div class="clinicbot-input-area">
          <input type="text" id="clinicbot-input" placeholder="Type your message..." />
          <button class="clinicbot-send" id="clinicbot-send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    document.getElementById('clinicbot-bubble').addEventListener('click', toggleChat);
    document.getElementById('clinicbot-close').addEventListener('click', toggleChat);
    document.getElementById('clinicbot-send').addEventListener('click', sendMessage);
    document.getElementById('clinicbot-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    addBotMessage(CONFIG.greeting);
  }

  function toggleChat() {
    isOpen = !isOpen;
    document.getElementById('clinicbot-window').classList.toggle('open', isOpen);
    if (isOpen) {
      document.getElementById('clinicbot-input').focus();
    }
  }

  function addBotMessage(text) {
    messages.push({ role: 'bot', text });
    renderMessages();
  }

  function addUserMessage(text) {
    messages.push({ role: 'user', text });
    renderMessages();
  }

  function addTypingIndicator() {
    const el = document.getElementById('clinicbot-messages');
    const typing = document.createElement('div');
    typing.className = 'clinicbot-typing';
    typing.id = 'clinicbot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(typing);
    el.scrollTop = el.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('clinicbot-typing');
    if (el) el.remove();
  }

  function renderMessages() {
    const el = document.getElementById('clinicbot-messages');
    el.innerHTML = messages.map(m =>
      `<div class="clinicbot-msg ${m.role}">${m.text.replace(/\n/g, '<br>')}</div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('clinicbot-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addUserMessage(text);
    addTypingIndicator();

    try {
      const res = await fetch(`${CONFIG.apiUrl}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, visitorId }),
      });

      const data = await res.json();
      removeTypingIndicator();

      if (res.ok) {
        addBotMessage(data.response);
        visitorId = data.visitorId;
      } else {
        addBotMessage('Sorry, I encountered an error. Please try again.');
      }
    } catch (err) {
      removeTypingIndicator();
      addBotMessage('Unable to connect. Please check your connection and try again.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
