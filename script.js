const STORAGE_KEY = 'xiaozhi-life-os-v2';

const defaultState = {
  activeTab: 'home',
  tasks: [
    { id: 1, text: '回复邮件关于本周的合作', time: '09:00', done: true },
    { id: 2, text: '整理随笔灵感和收集图', time: '11:00', done: true },
    { id: 3, text: '准备下周的轻度模拟稿', time: '14:00', done: false },
    { id: 4, text: '预订周五晚餐', time: '18:30', done: false },
    { id: 5, text: '阅读《跨域设计》第三章', time: '晚上', done: false },
  ],
  memories: [
    { id: 1, date: '今天 08:32', title: '清晨咖啡时光', text: '今天的第一杯咖啡，让我重新找回一点节奏。', tag: '生活' },
    { id: 2, date: '昨天 21:17', title: '城市夜景备忘', text: '下次想把城市夜晚的光，留给一个更慢的散步。', tag: '灵感' },
    { id: 3, date: '9月28日', title: '小智的第一条记忆', text: '真正重要的不是记住所有事，而是记住想成为谁。', tag: '小智' },
  ],
  boxes: [
    { id: 1, icon: '☕', title: '咖啡与生活灵感', count: 12, detail: '记录每一杯咖啡带来的灵感与思考', status: '私密', type: '生活' },
    { id: 2, icon: '◒', title: '旅行与城市', count: 28, detail: '收藏去过的地方和想去的城市', status: '公开', type: '生活' },
    { id: 3, icon: '▣', title: '工作资料库', count: 56, detail: '项目资料、会议记录与灵感整理', status: '私密', type: '工作' },
  ],
  messages: [
    { role: 'assistant', text: '嗨，今天是一个适合慢慢开始的早晨。你刚记录了清晨咖啡的独处时光，有什么想聊的吗？', time: '刚刚' },
  ],
};

let state = loadState();
const viewStack = document.querySelector('#view-stack');
const modal = document.querySelector('[data-modal]');
const modalInput = document.querySelector('#modal-input');
let modalMode = 'memory';

function loadState() { try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return structuredClone(defaultState); } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function esc(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function todayText() { const now = new Date(); const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']; return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`; }
function mascotMarkup(className = '') { return `<img class="${className}" src="assets/xiaozhi-mascot-pink-blue.png" alt="粉蓝色小智伙伴" />`; }

function render() {
  document.querySelector('[data-date-line]').textContent = todayText();
  document.querySelectorAll('.nav-item[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === state.activeTab));
  viewStack.innerHTML = renderView(state.activeTab); bindViewEvents();
}

function renderView(tab) { if (tab === 'memory') return renderMemory(); if (tab === 'chat') return renderChat(); if (tab === 'box') return renderBox(); if (tab === 'me') return renderMe(); return renderHome(); }

function renderHome() {
  const completed = state.tasks.filter((task) => task.done).length;
  return `<section class="view home-view"><article class="glass-card companion-card"><div class="mascot-wrap">${mascotMarkup()}</div><div class="companion-copy"><p class="micro-label">小智陪伴你</p><h2>和你一起，慢慢成长</h2><p>Level 7 · 我正在更懂你</p><div class="progress-track"><span></span></div><div class="progress-meta"><span>成长进度</span><strong>70%</strong></div></div></article><div class="section-title-row"><div><h2>小智日报</h2><p>Daily Report</p></div><span class="report-date">今天</span></div><article class="glass-card report-card"><button class="report-row" type="button" data-tab="memory"><span class="row-symbol">♡</span><span class="report-row-copy"><small>昨日记忆</small><strong>探索 ${state.memories.length + 2} 条记忆</strong></span><span class="row-chevron">›</span></button><button class="report-row" type="button" data-scroll-tasks><span class="row-symbol">ϟ</span><span class="report-row-copy"><small>今日优先</small><strong>${state.tasks.filter((task) => !task.done).length} 件重要事项待完成</strong></span><span class="row-chevron">›</span></button><button class="report-row" type="button" data-tab="chat"><span class="row-symbol">✧</span><span class="report-row-copy"><small>小智洞察</small><strong>识别到新的兴趣趋势</strong></span><span class="row-chevron">›</span></button></article><article class="glass-card suggestion-card"><div class="suggestion-top"><span class="suggestion-icon">♧</span><div><strong>小智发现</strong><small>Xiaozhi Suggests</small></div></div><p>你最近的状态经常在咖啡馆，<b>要不要创建一个“咖啡馆主题”？</b></p><div class="suggestion-actions"><button class="warm-button" type="button" data-create-box>创建主题</button><button class="ghost-light" type="button" data-dismiss>稍后</button></div></article><div class="section-title-row" id="tasks-heading"><div><h2>今日行动</h2><p>Today's Tasks</p></div><span class="report-date">${completed} / ${state.tasks.length}</span></div><article class="glass-card tasks-card" id="tasks-card">${state.tasks.map((task) => `<button class="task-item ${task.done ? 'is-done' : ''}" type="button" data-task-id="${task.id}"><span class="task-check">${task.done ? '✓' : ''}</span><span class="task-text">${esc(task.text)}</span><span class="task-time">${esc(task.time)}</span></button>`).join('')}</article><button class="quick-capture" type="button" data-open-modal><span>写一句话，剩下的交给我</span><strong>＋</strong></button></section>`;
}

function renderCalendar() { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const first = new Date(year, month, 1).getDay(); const total = new Date(year, month + 1, 0).getDate(); const cells = []; for (let i = 0; i < first; i += 1) cells.push('<span></span>'); for (let day = 1; day <= total; day += 1) { const today = day === now.getDate(); const hasMemory = day === now.getDate() || day === now.getDate() - 1 || day === 28; cells.push(`<span class="day ${today ? 'is-today' : ''} ${hasMemory ? 'has-memory' : ''}">${day}</span>`); } return `<div class="calendar-grid"><span class="weekday">日</span><span class="weekday">一</span><span class="weekday">二</span><span class="weekday">三</span><span class="weekday">四</span><span class="weekday">五</span><span class="weekday">六</span>${cells.join('')}</div>`; }
function renderMemory() { return `<section class="view memory-view"><div class="page-header"><div><p>2026年${new Date().getMonth() + 1}月</p><h1>记忆</h1></div><div class="page-header-actions"><button class="round-action" type="button" data-open-modal aria-label="添加记忆">＋</button><button class="round-action" type="button" data-memory-search aria-label="搜索记忆">⌕</button></div></div><div class="segmented"><button class="segment is-active" type="button">日历</button><button class="segment" type="button">时间轴</button></div><article class="glass-card calendar-card"><div class="calendar-head"><strong>本月记录</strong><span class="report-date">${state.memories.length} 条记忆</span></div>${renderCalendar()}</article><div class="section-title-row"><div><h2>今天的记忆</h2><p>Ordinary days, extraordinary memories.</p></div></div><div class="timeline">${state.memories.map((memory) => `<article class="glass-card memory-card"><div class="memory-meta"><span>${esc(memory.date)}</span><span class="memory-tag">${esc(memory.tag)}</span></div><h3>${esc(memory.title)}</h3><p>${esc(memory.text)}</p></article>`).join('')}</div><button class="quick-capture" type="button" data-open-modal><span>添加一条新的记忆</span><strong>＋</strong></button></section>`; }
function renderChat() { return `<section class="view chat-view"><div class="chat-header"><div class="chat-avatar">${mascotMarkup()}</div><div><h1>小智</h1><p>在线 · 正在了解你</p></div><button class="round-action chat-more" type="button" aria-label="更多选项">···</button></div><div class="messages">${state.messages.map((message) => `<div class="message ${message.role}">${esc(message.text)}<small>${esc(message.time)}</small></div>`).join('')}</div><div class="quick-prompts"><button class="prompt-chip" type="button" data-prompt="小智，我最近的状态怎么样？">我最近的状态怎么样？</button><button class="prompt-chip" type="button" data-prompt="帮我安排今天的重点">安排今天的重点</button><button class="prompt-chip" type="button" data-prompt="我想整理一条记忆">整理一条记忆</button></div><form class="chat-composer" data-chat-form><textarea rows="1" name="message" placeholder="和小智说点什么…" aria-label="和小智说点什么"></textarea><button class="send-button" type="submit" aria-label="发送">➤</button></form></section>`; }
function renderBox() { return `<section class="view box-view"><div class="page-header"><div><p>${todayText()}</p><h1>Box</h1></div><button class="round-action" type="button" data-create-box aria-label="创建 Box">＋</button></div><p class="page-description">收集 · 整理 · 延续</p><label class="search-box"><span>⌕</span><input type="search" placeholder="搜索你的 Box…" data-box-search /></label><div class="filter-row"><button class="filter-chip is-active" type="button" data-box-filter="全部">全部</button><button class="filter-chip" type="button" data-box-filter="生活">生活</button><button class="filter-chip" type="button" data-box-filter="工作">工作</button><button class="filter-chip" type="button" data-box-filter="灵感">灵感</button></div><article class="glass-card box-suggestion"><span class="box-suggestion-icon">♧</span><div class="box-suggestion-copy"><strong>小智推荐</strong><p>你最近收藏了 7 个有趣想法，不如建立一个灵感 Box？</p></div><button type="button" data-create-box>创建</button></article><div class="section-title-row"><div><h2>我收藏的 Box</h2><p>My Boxes</p></div><button class="section-action" type="button" data-create-box>查看全部 ›</button></div><div class="box-list" data-box-list>${state.boxes.map((box) => `<button class="glass-card box-item" type="button" data-box-item data-box-type="${esc(box.type)}"><span class="box-thumb">${box.icon}</span><span class="box-copy"><strong>${esc(box.title)}</strong><p>${box.count} 条内容 · ${esc(box.detail)}</p></span><span class="box-status">${esc(box.status)}</span><span class="box-chevron">›</span></button>`).join('')}</div><div class="section-title-row"><div><h2>创建新的 Box</h2><p>New Box</p></div></div><div class="new-box-grid"><button class="glass-card new-box-button" type="button" data-create-box><span>☘</span><strong>生活</strong><small>Life</small></button><button class="glass-card new-box-button" type="button" data-create-box><span>▣</span><strong>工作</strong><small>Work</small></button><button class="glass-card new-box-button" type="button" data-create-box><span>✧</span><strong>灵感</strong><small>Inspiration</small></button></div></section>`; }
function renderMe() { return `<section class="view me-view"><div class="page-header"><div><p>保持热爱，记录生活的美好。</p><h1>我的</h1></div><button class="round-action" type="button" aria-label="设置">⚙</button></div><article class="glass-card profile-card"><div class="profile-large">${mascotMarkup()}</div><div><h2>朋友</h2><p>设计师 · 把创意写成生活</p></div><span class="profile-arrow">›</span><div class="stat-row"><span><strong>${state.memories.length + 244}</strong>条记录</span><span><strong>${state.boxes.length + 9}</strong>个主题</span><span><strong>93</strong>天相伴</span></div></article><article class="glass-card settings-group"><p class="settings-title">记忆与数据</p>${settingRow('♧', '记忆设置', 'Memory Settings', '›')}${settingRow('▣', '隐私权限', 'Privacy & Permissions', '›')}${settingRow('▤', '本地备份', 'Local Backup', '已备份')}</article><article class="glass-card settings-group"><p class="settings-title">个人偏好</p>${settingRow('◐', '主题外观', 'Appearance', '柔和')}${settingRow('♢', '通知提醒', 'Notifications', '开启')}${settingRow('文', '语言设置', 'Language', '中文')}</article><article class="glass-card settings-group"><p class="settings-title">订阅</p>${settingRow('✦', '小智 Pro', '无限记忆 · 更强分析 · 多设备同步', '了解更多')}</article></section>`; }
function settingRow(icon, title, subtitle, value) { return `<button class="setting-row" type="button"><span class="setting-icon">${icon}</span><span class="setting-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="setting-value">${value}</span><span class="setting-chevron">›</span></button>`; }

function bindViewEvents() {
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.activeTab = button.dataset.tab; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', openModal));
  document.querySelector('[data-scroll-tasks]')?.addEventListener('click', () => document.querySelector('#tasks-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  document.querySelectorAll('[data-task-id]').forEach((button) => button.addEventListener('click', () => { const task = state.tasks.find((item) => item.id === Number(button.dataset.taskId)); if (task) task.done = !task.done; saveState(); render(); }));
  document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
  document.querySelector('[data-chat-form]')?.addEventListener('submit', (event) => { event.preventDefault(); const input = event.currentTarget.elements.message; sendMessage(input.value); input.value = ''; });
  document.querySelector('[data-box-search]')?.addEventListener('input', (event) => filterBoxes(event.target.value));
  document.querySelectorAll('[data-box-filter]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-box-filter]').forEach((item) => item.classList.remove('is-active')); button.classList.add('is-active'); filterBoxes('', button.dataset.boxFilter); }));
  document.querySelectorAll('[data-create-box]').forEach((button) => button.addEventListener('click', () => { state.activeTab = 'box'; saveState(); render(); openModal('创建一个新的 Box', 'box'); }));
  document.querySelector('[data-memory-search]')?.addEventListener('click', () => openModal('搜索你的记忆', 'search'));
}

function filterBoxes(query = '', type = '全部') { document.querySelectorAll('[data-box-item]').forEach((item) => { const matchesQuery = item.textContent.toLowerCase().includes(query.toLowerCase()); const matchesType = type === '全部' || item.dataset.boxType === type; item.hidden = !(matchesQuery && matchesType); }); }
function sendMessage(text) { const clean = text.trim(); if (!clean) return; state.messages.push({ role: 'user', text: clean, time: '刚刚' }); const reply = clean.includes('重点') ? '今天可以先完成第三项任务。它的阻力最小，完成后再决定是否继续。' : clean.includes('记忆') ? '我建议先把它放进记忆里，之后再补充时间、地点和你当时的感受。' : '我听到了。先不用急着给它下结论，我会把这条上下文留在今天。'; state.messages.push({ role: 'assistant', text: reply, time: '小智刚刚' }); saveState(); render(); }
function openModal(title = '把此刻交给小智', mode = 'memory') { modalMode = mode; document.querySelector('#modal-title').textContent = title; document.querySelector('[data-modal-copy]').textContent = mode === 'box' ? '先给这个主题一个名字，之后再慢慢往里收集内容。' : mode === 'search' ? '输入关键词后回车，快速找到你已经记录的内容。' : '先记录，不急着分类。之后可以在记忆里慢慢整理。'; document.querySelector('[data-save-modal]').textContent = mode === 'box' ? '创建 Box ↗' : mode === 'search' ? '开始搜索 ↗' : '保存记忆 ↗'; modal.hidden = false; document.body.style.overflow = 'hidden'; window.setTimeout(() => modalInput.focus(), 40); }
function closeModal() { modal.hidden = true; document.body.style.overflow = ''; modalInput.value = ''; }
function saveModal() { const value = modalInput.value.trim(); if (!value) { modalInput.focus(); return; } if (modalMode === 'box') { state.boxes.unshift({ id: Date.now(), icon: '✧', title: value.slice(0, 18), count: 0, detail: '刚刚创建，等待你的第一条内容', status: '私密', type: '灵感' }); saveState(); closeModal(); state.activeTab = 'box'; render(); return; } if (modalMode === 'search') { closeModal(); state.activeTab = 'memory'; render(); window.setTimeout(() => { const firstMatch = [...document.querySelectorAll('.memory-card')].find((card) => card.textContent.toLowerCase().includes(value.toLowerCase())); firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); return; } state.memories.unshift({ id: Date.now(), date: '刚刚', title: value.slice(0, 18), text: value, tag: '新记录' }); saveState(); closeModal(); state.activeTab = 'memory'; render(); }

document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
document.querySelector('[data-save-modal]').addEventListener('click', saveModal); modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
render();
