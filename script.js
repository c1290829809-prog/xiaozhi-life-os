import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const STORAGE_KEY = 'xiaozhi-life-os-v3';
let supabase;
let cloudSdkAvailable = true;
try {
  const cloudSdk = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = cloudSdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
} catch {
  try {
    const cloudSdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = cloudSdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch {
    cloudSdkAvailable = false;
    supabase = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: '云端服务暂时无法加载，当前仍可使用本地模式。' } }),
        signUp: async () => ({ data: null, error: { message: '云端服务暂时无法加载，请刷新后重试。' } }),
        resend: async () => ({ data: null, error: { message: '云端服务暂时无法加载，请刷新后重试。' } }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }) }), upsert: async () => ({ error: null }) }),
    };
  }
}

const defaultState = {
  activeTab: 'home',
  memoryView: 'calendar',
  dismissedSuggestion: false,
  tasks: [],
  memories: [],
  boxes: [],
  messages: [],
  profile: { displayName: '', avatarKey: 'pink-blue' },
};

let state = loadState();
state.profile = { ...defaultState.profile, ...(state.profile || {}) };
const viewStack = document.querySelector('#view-stack');
const modal = document.querySelector('[data-modal]');
const modalInput = document.querySelector('#modal-input');
const authModal = document.querySelector('[data-auth-modal]');
let cloudUser = null;
let cloudSyncing = false;
let modalMode = 'memory';

function loadState() { try { return { ...structuredClone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return structuredClone(defaultState); } }
function saveLocalState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function saveState() { saveLocalState(); if (cloudUser) void syncStateToCloud(); }
function esc(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function todayText() { const now = new Date(); const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']; return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`; }
const avatarKeys = ['pink-blue', 'sky', 'lilac', 'peach', 'mint'];
function safeAvatarKey(value) { return avatarKeys.includes(value) ? value : 'pink-blue'; }
function mascotMarkup(className = '') { const avatarKey = safeAvatarKey(state.profile?.avatarKey); return `<img class="${className} avatar-${avatarKey}" src="assets/xiaozhi-mascot-pink-blue.png" alt="粉蓝色小智伙伴" />`; }
function formatCloudDate(value) { if (!value) return '刚刚'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '刚刚'; return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function setCloudStatus(text, tone = '') { const node = document.querySelector('[data-cloud-status]'); if (node) { node.textContent = text; node.dataset.tone = tone; } }

async function syncStateToCloud() {
  if (!cloudUser || cloudSyncing) return;
  cloudSyncing = true;
  setCloudStatus('同步中…');
  const user_id = cloudUser.id;
  const operations = [
    supabase.from('profiles').upsert({ id: user_id, display_name: state.profile.displayName || cloudUser.email?.split('@')[0] || '新用户', avatar_url: safeAvatarKey(state.profile.avatarKey), updated_at: new Date().toISOString() }, { onConflict: 'id' }),
    supabase.from('memories').upsert(state.memories.map((item) => ({ user_id, id: String(item.id), title: item.title, body: item.text, tag: item.tag, occurred_at: new Date().toISOString() })), { onConflict: 'user_id,id' }),
    supabase.from('tasks').upsert(state.tasks.map((item, index) => ({ user_id, id: String(item.id), text: item.text, time_text: item.time, done: item.done, sort_order: index })), { onConflict: 'user_id,id' }),
    supabase.from('boxes').upsert(state.boxes.map((item) => ({ user_id, id: String(item.id), icon: item.icon, title: item.title, item_count: item.count, detail: item.detail, status: item.status, box_type: item.type })), { onConflict: 'user_id,id' }),
    supabase.from('chat_messages').upsert(state.messages.map((item, index) => ({ user_id, id: `${index}-${item.time}-${item.role}`, message_role: item.role, body: item.text, display_time: item.time })), { onConflict: 'user_id,id' }),
  ];
  const results = await Promise.all(operations);
  const failure = results.find((result) => result.error);
  cloudSyncing = false;
  if (failure) { setCloudStatus('同步失败', 'error'); console.error(failure.error); return; }
  setCloudStatus('已同步', 'ok');
}

async function hydrateFromCloud() {
  if (!cloudUser) return;
  setCloudStatus('读取云端数据…');
  const [profile, memories, tasks, boxes, messages] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('memories').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
    supabase.from('boxes').select('*').order('created_at', { ascending: false }),
    supabase.from('chat_messages').select('*').order('created_at', { ascending: true }),
  ]);
  const failure = [profile, memories, tasks, boxes, messages].find((result) => result.error);
  if (failure) { setCloudStatus('云端读取失败', 'error'); console.error(failure.error); return; }
  state.profile = { displayName: profile.data?.display_name || cloudUser.user_metadata?.display_name || cloudUser.email?.split('@')[0] || '新用户', avatarKey: safeAvatarKey(profile.data?.avatar_url) };
  const hasCloudRows = [memories.data, tasks.data, boxes.data, messages.data].some((rows) => rows.length > 0);
  if (!hasCloudRows) { await syncStateToCloud(); return; }
  state.memories = memories.data.map((item) => ({ id: item.id, date: formatCloudDate(item.occurred_at), title: item.title, text: item.body, tag: item.tag }));
  state.tasks = tasks.data.map((item) => ({ id: item.id, text: item.text, time: item.time_text, done: item.done }));
  state.boxes = boxes.data.map((item) => ({ id: item.id, icon: item.icon, title: item.title, count: item.item_count, detail: item.detail, status: item.status, type: item.box_type }));
  state.messages = messages.data.map((item) => ({ role: item.message_role, text: item.body, time: item.display_time }));
  saveLocalState();
  setCloudStatus('已同步', 'ok');
  render();
}

async function initCloud() {
  if (!cloudSdkAvailable) { setCloudStatus('未登录 · 本地模式'); return; }
  setCloudStatus('连接云端…');
  const { data, error } = await supabase.auth.getSession();
  if (error) { setCloudStatus('本地模式', 'error'); return; }
  cloudUser = data.session?.user || null;
  if (cloudUser) await hydrateFromCloud(); else setCloudStatus('未登录 · 本地模式');
  supabase.auth.onAuthStateChange((_event, session) => {
    cloudUser = session?.user || null;
    if (cloudUser) void hydrateFromCloud(); else { setCloudStatus('未登录 · 本地模式'); render(); }
    updateAuthUI();
  });
  updateAuthUI();
}

function render() {
  document.querySelector('[data-date-line]').textContent = todayText();
  const headerAvatar = document.querySelector('[data-header-avatar]');
  if (headerAvatar) headerAvatar.className = `avatar-${safeAvatarKey(state.profile?.avatarKey)}`;
  document.querySelectorAll('.nav-item[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === state.activeTab));
  viewStack.innerHTML = renderView(state.activeTab); bindViewEvents(); updateAuthUI();
}

function renderView(tab) { if (tab === 'memory') return renderMemory(); if (tab === 'chat') return renderChat(); if (tab === 'box') return renderBox(); if (tab === 'me') return renderMe(); return renderHome(); }

function renderHome() {
  const completed = state.tasks.filter((task) => task.done).length;
  const hasActivity = state.memories.length > 0 || state.tasks.length > 0 || state.boxes.length > 0 || state.messages.length > 0;
  const report = hasActivity ? `<article class="glass-card report-card"><button class="report-row" type="button" data-tab="memory"><span class="row-symbol">♡</span><span class="report-row-copy"><small>你的记忆</small><strong>查看 ${state.memories.length} 条记录</strong></span><span class="row-chevron">›</span></button><button class="report-row" type="button" data-scroll-tasks><span class="row-symbol">ϟ</span><span class="report-row-copy"><small>今日行动</small><strong>${state.tasks.filter((task) => !task.done).length} 件待完成事项</strong></span><span class="row-chevron">›</span></button><button class="report-row" type="button" data-tab="chat"><span class="row-symbol">✧</span><span class="report-row-copy"><small>和小智聊聊</small><strong>继续你的生活记录</strong></span><span class="row-chevron">›</span></button></article>` : `<article class="glass-card empty-state report-empty"><strong>还没有日报</strong><p>记录第一件生活小事后，小智会在这里整理你的今日摘要。</p></article>`;
  const suggestion = state.memories.length > 0 && !state.dismissedSuggestion ? `<article class="glass-card suggestion-card"><div class="suggestion-top"><span class="suggestion-icon">♧</span><div><strong>小智发现</strong><small>Xiaozhi Suggests</small></div></div><p>根据你刚刚的记录，想建立一个专属 Box 吗？</p><div class="suggestion-actions"><button class="warm-button" type="button" data-create-box>创建主题</button><button class="ghost-light" type="button" data-dismiss>稍后</button></div></article>` : '';
  const companion = hasActivity ? `<p>已记录 ${state.memories.length} 条生活片段</p><div class="progress-meta"><span>继续记录，慢慢认识自己</span><strong>${state.memories.length}</strong></div>` : `<p>还没有成长记录</p><p class="empty-copy">从第一条记忆开始，建立属于你的生活节奏。</p><button class="warm-button companion-action" type="button" data-open-modal>记录第一件小事 ↗</button>`;
  const tasks = state.tasks.length ? state.tasks.map((task) => `<button class="task-item ${task.done ? 'is-done' : ''}" type="button" data-task-id="${task.id}"><span class="task-check">${task.done ? '✓' : ''}</span><span class="task-text">${esc(task.text)}</span><span class="task-time">${esc(task.time)}</span></button>`).join('') : `<div class="empty-state"><strong>还没有今日行动</strong><p>完成记录后，再决定今天想做什么。</p></div>`;
  return `<section class="view home-view"><article class="glass-card companion-card"><div class="mascot-wrap">${mascotMarkup()}</div><div class="companion-copy"><p class="micro-label">小智陪伴你</p><h2>和你一起，慢慢成长</h2>${companion}</div></article><div class="section-title-row"><div><h2>小智日报</h2><p>Daily Report</p></div><span class="report-date">今天</span></div>${report}${suggestion}<div class="section-title-row" id="tasks-heading"><div><h2>今日行动</h2><p>Today's Tasks</p></div><span class="report-date">${completed} / ${state.tasks.length}</span></div><article class="glass-card tasks-card" id="tasks-card">${tasks}</article><button class="quick-capture" type="button" data-open-modal><span>写一句话，剩下的交给我</span><strong>＋</strong></button></section>`;
}

function renderCalendar() { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const first = new Date(year, month, 1).getDay(); const total = new Date(year, month + 1, 0).getDate(); const cells = []; for (let i = 0; i < first; i += 1) cells.push('<span></span>'); for (let day = 1; day <= total; day += 1) { const today = day === now.getDate(); const hasMemory = state.memories.length > 0 && (day === now.getDate() || day === now.getDate() - 1); cells.push(`<span class="day ${today ? 'is-today' : ''} ${hasMemory ? 'has-memory' : ''}">${day}</span>`); } return `<div class="calendar-grid"><span class="weekday">日</span><span class="weekday">一</span><span class="weekday">二</span><span class="weekday">三</span><span class="weekday">四</span><span class="weekday">五</span><span class="weekday">六</span>${cells.join('')}</div>`; }
function renderMemory() { const timelineMode = state.memoryView === 'timeline'; const memoryCards = state.memories.length ? state.memories.map((memory) => `<article class="glass-card memory-card" data-memory-id="${memory.id}" role="button" tabindex="0"><div class="memory-meta"><span>${esc(memory.date)}</span><span class="memory-tag">${esc(memory.tag)}</span></div><h3>${esc(memory.title)}</h3><p>${esc(memory.text)}</p><span class="memory-open">查看详情 ›</span></article>`).join('') : '<div class="glass-card empty-state"><strong>还没有记忆</strong><p>把今天的一句话交给小智，之后再慢慢回看。</p></div>'; return `<section class="view memory-view"><div class="page-header"><div><p>${new Date().getFullYear()}年${new Date().getMonth() + 1}月</p><h1>记忆</h1></div><div class="page-header-actions"><button class="round-action" type="button" data-open-modal aria-label="添加记忆">＋</button><button class="round-action" type="button" data-memory-search aria-label="搜索记忆">⌕</button></div></div><div class="segmented"><button class="segment ${timelineMode ? '' : 'is-active'}" type="button" data-memory-view="calendar">日历</button><button class="segment ${timelineMode ? 'is-active' : ''}" type="button" data-memory-view="timeline">时间轴</button></div>${timelineMode ? `<article class="glass-card timeline-intro"><strong>按时间回看</strong><p>把生活里的小片段串起来，看看最近的节奏。</p></article>` : `<article class="glass-card calendar-card"><div class="calendar-head"><strong>本月记录</strong><span class="report-date">${state.memories.length} 条记忆</span></div>${renderCalendar()}</article>`}<div class="section-title-row"><div><h2>${timelineMode ? '全部记忆' : '今天的记忆'}</h2><p>Ordinary days, extraordinary memories.</p></div></div><div class="timeline">${memoryCards}</div><button class="quick-capture" type="button" data-open-modal><span>添加一条新的记忆</span><strong>＋</strong></button></section>`; }
function renderChat() { const messages = state.messages.length ? state.messages.map((message) => `<div class="message ${message.role}">${esc(message.text)}<small>${esc(message.time)}</small></div>`).join('') : '<div class="chat-empty"><strong>从一句话开始</strong><p>告诉小智今天发生了什么，或者只是说说你此刻的心情。</p></div>'; return `<section class="view chat-view"><div class="chat-header"><div class="chat-avatar">${mascotMarkup()}</div><div><h1>小智</h1><p>在线 · 等你开始记录</p></div><button class="round-action chat-more" type="button" data-chat-more aria-label="更多选项">···</button></div><div class="messages">${messages}</div><div class="quick-prompts"><button class="prompt-chip" type="button" data-prompt="我今天想记录一件小事">记录一件小事</button><button class="prompt-chip" type="button" data-prompt="帮我整理今天的重点">整理今天的重点</button><button class="prompt-chip" type="button" data-prompt="我想聊聊最近的状态">聊聊最近的状态</button></div><form class="chat-composer" data-chat-form><textarea rows="1" name="message" placeholder="和小智说点什么…" aria-label="和小智说点什么"></textarea><button class="send-button" type="submit" aria-label="发送">➤</button></form></section>`; }
function renderBox() { const boxList = state.boxes.length ? state.boxes.map((box) => `<button class="glass-card box-item" type="button" data-box-item data-box-id="${box.id}" data-box-type="${esc(box.type)}"><span class="box-thumb">${box.icon}</span><span class="box-copy"><strong>${esc(box.title)}</strong><p>${box.count} 条内容 · ${esc(box.detail)}</p></span><span class="box-status">${esc(box.status)}</span><span class="box-chevron">›</span></button>`).join('') : '<div class="glass-card empty-state"><strong>还没有 Box</strong><p>创建一个主题，把之后想持续收集的内容放在一起。</p></div>'; const suggestion = state.memories.length || state.boxes.length ? `<article class="glass-card box-suggestion"><span class="box-suggestion-icon">♧</span><div class="box-suggestion-copy"><strong>创建一个主题</strong><p>为你正在关注的生活、工作或灵感建立一个专属 Box。</p></div><button type="button" data-create-box>创建</button></article>` : ''; return `<section class="view box-view"><div class="page-header"><div><p>${todayText()}</p><h1>Box</h1></div><button class="round-action" type="button" data-create-box aria-label="创建 Box">＋</button></div><p class="page-description">收集 · 整理 · 延续</p><label class="search-box"><span>⌕</span><input type="search" placeholder="搜索你的 Box…" data-box-search /></label><div class="filter-row"><button class="filter-chip is-active" type="button" data-box-filter="全部">全部</button><button class="filter-chip" type="button" data-box-filter="生活">生活</button><button class="filter-chip" type="button" data-box-filter="工作">工作</button><button class="filter-chip" type="button" data-box-filter="灵感">灵感</button></div>${suggestion}<div class="section-title-row"><div><h2>我收藏的 Box</h2><p>My Boxes</p></div>${state.boxes.length ? '<button class="section-action" type="button" data-view-all-boxes>查看全部 ›</button>' : ''}</div><div class="box-list" data-box-list>${boxList}</div><div class="section-title-row"><div><h2>创建新的 Box</h2><p>New Box</p></div></div><div class="new-box-grid"><button class="glass-card new-box-button" type="button" data-create-box><span>☘</span><strong>生活</strong><small>Life</small></button><button class="glass-card new-box-button" type="button" data-create-box><span>▣</span><strong>工作</strong><small>Work</small></button><button class="glass-card new-box-button" type="button" data-create-box><span>✧</span><strong>灵感</strong><small>Inspiration</small></button></div></section>`; }
function renderMe() { const accountLabel = cloudUser ? `已连接 · ${esc(cloudUser.email || '云端账号')}` : '登录并同步云端'; const displayName = state.profile?.displayName || cloudUser?.user_metadata?.display_name || cloudUser?.email?.split('@')[0] || '新用户'; return `<section class="view me-view"><div class="page-header"><div><p>保持热爱，记录生活的美好。</p><h1>我的</h1></div><div class="page-header-actions"><button class="account-pill" type="button" data-auth-open>${accountLabel}</button><button class="round-action" type="button" data-open-modal data-info-title="设置" data-info-copy="这里会集中放置主题、通知和语言等偏好设置。" aria-label="设置">⚙</button></div></div><article class="glass-card profile-card" data-open-profile role="button" tabindex="0"><div class="profile-large">${mascotMarkup()}</div><div><h2>${esc(displayName)}</h2><p>${cloudUser ? '云端账号 · 个人资料与记忆正在同步' : '本机资料 · 登录后可跨设备同步'}</p></div><span class="profile-arrow">›</span><div class="stat-row"><span><strong>${state.memories.length}</strong>条记录</span><span><strong>${state.boxes.length}</strong>个主题</span><span><strong>${state.messages.filter((item) => item.role === 'user').length}</strong>次对话</span></div></article><article class="glass-card settings-group"><p class="settings-title">记忆与数据</p>${settingRow('♧', '记忆设置', 'Memory Settings', '›', '管理记忆的保留方式与分类偏好。')}${settingRow('▣', '隐私权限', 'Privacy & Permissions', '›', cloudUser ? '当前数据按账号隔离，只有你能读取自己的记录。' : '登录后可以启用账号隔离的云端数据。')}${settingRow('▤', '本地备份', 'Local Backup', cloudUser ? '云端' : '本地', cloudUser ? '当前账号已启用 Supabase 云端保存。' : '当前仅保存到这台设备，登录后可以同步到云端。')}</article><article class="glass-card settings-group"><p class="settings-title">个人偏好</p>${settingRow('◐', '主题外观', 'Appearance', '默认', '当前使用粉蓝与暖橙的柔和主题。')}${settingRow('♢', '通知提醒', 'Notifications', '未设置', '登录并完成个人设置后，可以选择是否开启提醒。')}${settingRow('文', '语言设置', 'Language', '中文', '当前界面语言为简体中文。')}</article><article class="glass-card settings-group"><p class="settings-title">订阅</p>${settingRow('✦', '小智 Pro', '无限记忆 · 更强分析 · 多设备同步', '了解更多', 'Pro 能力将在接入账号和云端服务后开放。')}</article></section>`; }
function settingRow(icon, title, subtitle, value, detail) { return `<button class="setting-row" type="button" data-setting-title="${esc(title)}" data-setting-copy="${esc(detail)}"><span class="setting-icon">${icon}</span><span class="setting-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="setting-value">${value}</span><span class="setting-chevron">›</span></button>`; }

function bindViewEvents() {
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.activeTab = button.dataset.tab; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  document.querySelectorAll('[data-auth-open]').forEach((button) => button.addEventListener('click', openAuth));
  document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', () => button.dataset.infoTitle ? openInfoModal(button.dataset.infoTitle, button.dataset.infoCopy) : openModal()));
  document.querySelector('[data-scroll-tasks]')?.addEventListener('click', () => document.querySelector('#tasks-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  document.querySelectorAll('[data-task-id]').forEach((button) => button.addEventListener('click', () => { const task = state.tasks.find((item) => item.id === Number(button.dataset.taskId)); if (task) task.done = !task.done; saveState(); render(); }));
  document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
  document.querySelector('[data-chat-form]')?.addEventListener('submit', (event) => { event.preventDefault(); const input = event.currentTarget.elements.message; sendMessage(input.value); input.value = ''; });
  document.querySelector('[data-chat-more]')?.addEventListener('click', () => openInfoModal('对话设置', '这里会保留你和小智的对话上下文。当前版本使用本地演示回复，后续可以接入真实 AI。'));
  document.querySelectorAll('[data-memory-view]').forEach((button) => button.addEventListener('click', () => { state.memoryView = button.dataset.memoryView; saveState(); render(); }));
  document.querySelectorAll('[data-memory-id]').forEach((card) => { const open = () => { const memory = state.memories.find((item) => String(item.id) === card.dataset.memoryId); if (memory) openModal(memory.title, 'detail', memory.text); }; card.addEventListener('click', open); card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); });
  document.querySelector('[data-box-search]')?.addEventListener('input', (event) => filterBoxes(event.target.value));
  document.querySelectorAll('[data-box-filter]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-box-filter]').forEach((item) => item.classList.remove('is-active')); button.classList.add('is-active'); filterBoxes('', button.dataset.boxFilter); }));
  document.querySelectorAll('[data-create-box]').forEach((button) => button.addEventListener('click', () => { state.activeTab = 'box'; saveState(); render(); openModal('创建一个新的 Box', 'box'); }));
  document.querySelectorAll('[data-box-item]').forEach((button) => button.addEventListener('click', () => { const box = state.boxes.find((item) => String(item.id) === button.dataset.boxId); if (box) openInfoModal(box.title, `${box.count} 条内容 · ${box.detail} · ${box.status}`); }));
  document.querySelector('[data-view-all-boxes]')?.addEventListener('click', () => { const search = document.querySelector('[data-box-search]'); if (search) search.value = ''; document.querySelectorAll('[data-box-filter]').forEach((item) => item.classList.remove('is-active')); document.querySelector('[data-box-filter="全部"]')?.classList.add('is-active'); filterBoxes(); document.querySelector('[data-box-list]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.querySelector('[data-dismiss]')?.addEventListener('click', (event) => event.currentTarget.closest('.suggestion-card')?.remove());
  document.querySelector('[data-open-profile]')?.addEventListener('click', openProfileEditor);
  document.querySelector('[data-open-profile]')?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfileEditor(); } });
  document.querySelectorAll('[data-setting-title]').forEach((button) => button.addEventListener('click', () => openInfoModal(button.dataset.settingTitle, button.dataset.settingCopy)));
  document.querySelector('[data-memory-search]')?.addEventListener('click', () => openModal('搜索你的记忆', 'search'));
}

function filterBoxes(query = '', type = '全部') { document.querySelectorAll('[data-box-item]').forEach((item) => { const matchesQuery = item.textContent.toLowerCase().includes(query.toLowerCase()); const matchesType = type === '全部' || item.dataset.boxType === type; item.hidden = !(matchesQuery && matchesType); }); }
function sendMessage(text) { const clean = text.trim(); if (!clean) return; state.messages.push({ role: 'user', text: clean, time: '刚刚' }); const reply = clean.includes('重点') ? '今天可以先完成第三项任务。它的阻力最小，完成后再决定是否继续。' : clean.includes('记忆') ? '我建议先把它放进记忆里，之后再补充时间、地点和你当时的感受。' : '我听到了。先不用急着给它下结论，我会把这条上下文留在今天。'; state.messages.push({ role: 'assistant', text: reply, time: '小智刚刚' }); saveState(); render(); }
function openInfoModal(title, copy) { openModal(title, 'detail', copy); }
const profileEditor = document.querySelector('[data-profile-editor]');
const profileNameInput = document.querySelector('#profile-name');
let selectedAvatarKey = 'pink-blue';
function openProfileEditor() { selectedAvatarKey = safeAvatarKey(state.profile?.avatarKey); profileNameInput.value = state.profile?.displayName || ''; document.querySelector('[data-profile-status]').textContent = ''; document.querySelectorAll('[data-avatar-option]').forEach((button) => { const selected = button.dataset.avatarOption === selectedAvatarKey; button.classList.toggle('is-selected', selected); button.setAttribute('aria-checked', String(selected)); }); profileEditor.hidden = false; document.body.style.overflow = 'hidden'; window.setTimeout(() => profileNameInput.focus(), 40); }
function closeProfileEditor() { profileEditor.hidden = true; document.body.style.overflow = ''; document.querySelector('[data-profile-status]').textContent = ''; }
function saveProfile() { const name = profileNameInput.value.trim(); if (!name) { document.querySelector('[data-profile-status]').textContent = '请先输入一个昵称。'; profileNameInput.focus(); return; } state.profile = { displayName: name.slice(0, 24), avatarKey: safeAvatarKey(selectedAvatarKey) }; saveState(); closeProfileEditor(); render(); }
function openModal(title = '把此刻交给小智', mode = 'memory', prefill = '') { modalMode = mode; document.querySelector('#modal-title').textContent = title; document.querySelector('[data-modal-copy]').textContent = mode === 'box' ? '先给这个主题一个名字，之后再慢慢往里收集内容。' : mode === 'search' ? '输入关键词后回车，快速找到你已经记录的内容。' : mode === 'detail' ? '这是当前原型中的说明信息，你可以继续探索其他入口。' : '先记录，不急着分类。之后可以在记忆里慢慢整理。'; document.querySelector('[data-modal-label]').textContent = mode === 'search' ? '关键词' : mode === 'detail' ? '详情' : '内容'; document.querySelector('[data-modal-cancel]').textContent = mode === 'detail' ? '关闭' : '暂时不记'; document.querySelector('[data-save-modal]').textContent = mode === 'box' ? '创建 Box ↗' : mode === 'search' ? '开始搜索 ↗' : mode === 'detail' ? '知道了' : '保存记忆 ↗'; modalInput.value = prefill; modalInput.readOnly = mode === 'detail'; modal.hidden = false; document.body.style.overflow = 'hidden'; window.setTimeout(() => modalInput.focus(), 40); }
function closeModal() { modal.hidden = true; document.body.style.overflow = ''; modalInput.value = ''; modalInput.readOnly = false; }
function saveModal() { const value = modalInput.value.trim(); if (modalMode === 'detail') { closeModal(); return; } if (!value) { modalInput.focus(); return; } if (modalMode === 'box') { state.boxes.unshift({ id: Date.now(), icon: '✧', title: value.slice(0, 18), count: 0, detail: '刚刚创建，等待你的第一条内容', status: '私密', type: '灵感' }); saveState(); closeModal(); state.activeTab = 'box'; render(); return; } if (modalMode === 'search') { closeModal(); state.activeTab = 'memory'; render(); window.setTimeout(() => { const firstMatch = [...document.querySelectorAll('.memory-card')].find((card) => card.textContent.toLowerCase().includes(value.toLowerCase())); firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); return; } state.memories.unshift({ id: Date.now(), date: '刚刚', title: value.slice(0, 18), text: value, tag: '新记录' }); saveState(); closeModal(); state.activeTab = 'memory'; render(); }

let authMode = 'login';
let authPendingEmail = '';
function authRedirectUrl() { return `${window.location.origin}${window.location.pathname}`; }
function openAuth() { authModal.hidden = false; document.body.style.overflow = 'hidden'; updateAuthUI(); window.setTimeout(() => document.querySelector('#auth-email')?.focus(), 40); }
function closeAuth() { authModal.hidden = true; document.body.style.overflow = ''; document.querySelector('[data-auth-status]').textContent = ''; document.querySelector('[data-auth-resend]').hidden = true; }
function updateAuthUI() { if (!authModal) return; const loggedIn = Boolean(cloudUser); const title = document.querySelector('#auth-title'); const copy = document.querySelector('[data-auth-copy]'); const switchButton = document.querySelector('[data-auth-switch]'); const submitButton = document.querySelector('[data-auth-submit]'); const logoutButton = document.querySelector('[data-auth-logout]'); const resendButton = document.querySelector('[data-auth-resend]'); const email = document.querySelector('#auth-email'); const password = document.querySelector('#auth-password'); const toggle = document.querySelector('[data-password-toggle]'); password.type = 'password'; toggle.textContent = '显示'; toggle.setAttribute('aria-label', '显示密码'); if (loggedIn) { title.textContent = '云端账号已连接'; copy.textContent = `${cloudUser.email || '当前账号'} 的数据正在 Supabase 中保存。`; switchButton.hidden = true; submitButton.hidden = true; logoutButton.hidden = false; resendButton.hidden = true; email.hidden = true; password.hidden = true; toggle.hidden = true; } else { title.textContent = authMode === 'login' ? '登录小智云端' : '注册小智账号'; copy.textContent = authMode === 'login' ? '登录后，记忆、任务、Box 和对话可以跨设备保存。' : '注册后请打开邮箱中的验证链接，再回来登录。'; switchButton.hidden = false; submitButton.hidden = false; logoutButton.hidden = true; email.hidden = false; password.hidden = false; toggle.hidden = false; switchButton.textContent = authMode === 'login' ? '还没有账号？注册' : '已有账号？登录'; submitButton.textContent = authMode === 'login' ? '登录并同步 ↗' : '注册账号 ↗'; password.autocomplete = authMode === 'login' ? 'current-password' : 'new-password'; } }
function friendlyAuthError(error) { const message = error?.message || '操作失败，请稍后再试。'; if (/email not confirmed/i.test(message)) return '这个邮箱还没有完成验证，请先查收验证邮件，或点击下方重新发送。'; if (/rate limit|too many requests/i.test(message)) return '邮件发送过于频繁，请稍等几分钟后再试。'; if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确；如果刚注册，请先完成邮箱验证。'; return message; }
async function submitAuth() { const emailInput = document.querySelector('#auth-email'); const passwordInput = document.querySelector('#auth-password'); const email = emailInput.value.trim(); const password = passwordInput.value; const status = document.querySelector('[data-auth-status]'); const resendButton = document.querySelector('[data-auth-resend]'); resendButton.hidden = true; if (!emailInput.checkValidity() || !email || password.length < 6) { status.textContent = '请输入有效邮箱和至少 6 位密码。'; return; } authPendingEmail = email; status.textContent = authMode === 'login' ? '登录中…' : '注册中…'; try { const result = authMode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } }); if (result.error) { status.textContent = friendlyAuthError(result.error); if (/email not confirmed/i.test(result.error.message || '')) resendButton.hidden = false; return; } if (authMode === 'login') { status.textContent = '登录成功，正在读取云端数据…'; closeAuth(); } else if (result.data.session) { status.textContent = '注册成功，正在连接云端…'; closeAuth(); } else { status.textContent = '注册成功。请查收邮箱，点击验证链接后，再回到这里登录。邮件可能在垃圾邮件/广告邮件里。'; resendButton.hidden = false; } } catch (error) { status.textContent = friendlyAuthError(error); } }
async function resendConfirmation() { const email = authPendingEmail || document.querySelector('#auth-email').value.trim(); const status = document.querySelector('[data-auth-status]'); if (!email) { status.textContent = '请先填写注册邮箱。'; return; } status.textContent = '验证邮件发送中…'; const result = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } }); if (result.error) { status.textContent = friendlyAuthError(result.error); return; } status.textContent = '验证邮件已重新发送，请查收邮箱，也请检查垃圾邮件/广告邮件。'; }
function togglePassword() { const input = document.querySelector('#auth-password'); const button = document.querySelector('[data-password-toggle]'); const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.textContent = visible ? '显示' : '隐藏'; button.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码'); }
async function logoutAuth() { await supabase.auth.signOut(); closeAuth(); }

document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
document.querySelector('[data-save-modal]').addEventListener('click', saveModal); modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.querySelectorAll('[data-auth-close]').forEach((button) => button.addEventListener('click', closeAuth));
document.querySelector('[data-auth-submit]').addEventListener('click', submitAuth);
document.querySelector('[data-auth-switch]').addEventListener('click', () => { authMode = authMode === 'login' ? 'signup' : 'login'; document.querySelector('[data-auth-status]').textContent = ''; updateAuthUI(); });
document.querySelector('[data-password-toggle]').addEventListener('click', togglePassword);
document.querySelector('[data-auth-resend]').addEventListener('click', resendConfirmation);
document.querySelector('[data-auth-logout]').addEventListener('click', logoutAuth);
authModal.addEventListener('click', (event) => { if (event.target === authModal) closeAuth(); });
document.querySelector('[data-profile-close]').addEventListener('click', closeProfileEditor);
document.querySelector('[data-profile-cancel]').addEventListener('click', closeProfileEditor);
document.querySelector('[data-profile-save]').addEventListener('click', saveProfile);
document.querySelectorAll('[data-avatar-option]').forEach((button) => button.addEventListener('click', () => { selectedAvatarKey = safeAvatarKey(button.dataset.avatarOption); document.querySelectorAll('[data-avatar-option]').forEach((item) => { const selected = item === button; item.classList.toggle('is-selected', selected); item.setAttribute('aria-checked', String(selected)); }); }));
profileEditor.addEventListener('click', (event) => { if (event.target === profileEditor) closeProfileEditor(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !authModal.hidden) closeAuth(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !profileEditor.hidden) closeProfileEditor(); });
render();
void initCloud();
