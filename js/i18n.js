import { ZH } from './i18n-zh.js';

const preferenceKey = 'peaslab.language';
let language = 'en';
const listeners = new Set();
const purposeFields = new Set();
const editedPurposes = new Set();

export function readLanguage(storage) {
  try { return storage?.getItem(preferenceKey) === 'zh-CN' ? 'zh-CN' : 'en'; }
  catch { return 'en'; }
}
export function getLanguage() { return language; }
export function onLanguageChange(callback) { listeners.add(callback); return () => listeners.delete(callback); }

// Anchored templates accept only application-authored sentences. User text is excluded
// at its DOM boundary, rather than guessed from the words a participant writes.
const templates = [
  [/^Programs configured for (\d+) active behavior groups\.$/, a => `已为 ${a} 个当前行为组编写程序。`],
  [/^Unavailable input: (SENSE_\d+) \((.+)\)$/, (a,b) => `输入不可用：${a}（${b}）`],
  [/^Missing actuator: (.+)$/, a => `缺少执行器：${a}`],
  [/^(.+): (Achieved|Partially achieved|Not achieved)$/, (a,b) => `${translate(a, 'zh-CN')}：${ZH[b]}`],
  [/^(.+) — not mounted$/, a => `${a} — 未安装`],
  [/^(.+) — no actuator$/, a => `${a} — 未安装所需 Actuator`],
  [/^(.+); built-in reflex — collision stop and turn$/, a => `${translate(a, 'zh-CN')}；内置反射——碰撞后停车并转向`],
  [/^Stage (\d+) of (\d+) · (.+)$/, (a,b,c) => `阶段 ${a} / ${b} · ${translate(c, 'zh-CN')}`],
  [/^Stage (\d+) · (.+)$/, (a,b) => `阶段 ${a} · ${translate(b, 'zh-CN')}`],
  [/^Stage (\d+): (.+)$/, (a,b) => `阶段 ${a}：${translate(b, 'zh-CN')}`],
  [/^STAGE (\d+) OF (\d+) · STEP (\d+) OF (\d+) • PEAS: (.+)$/, (a,b,c,d,e) => `阶段 ${a} / ${b} · 步骤 ${c} / ${d} • PEAS: ${e}`],
  [/^STEP (\d+) OF (\d+)(.*)$/, (a,b,c) => `步骤 ${a} / ${b}${c}`],
  [/^Success criterion: (.+)$/, a => `成功标准：${translate(a, 'zh-CN')}`],
  [/^Clean at least ([\d.]+)% of initial dirt cells$/, a => `清洁至少 ${a}% 的初始灰尘网格`],
  [/^Correctly sort at least ([\d.]+)% of initial objects$/, a => `正确分类至少 ${a}% 的初始物品`],
  [/^Mop at least ([\d.]+)% of spills; at most (\d+) vacuum-on-liquid events$/, (a,b) => `拖干至少 ${a}% 的液体；吸尘接触液体事件不超过 ${b} 次`],
  [/^Stop in every moving cat encounter \(at least (\d+)\); at most (\d+) unsafe crossings$/, (a,b) => `移动时每次遇猫都停车（至少 ${a} 次相遇）；不安全经过不超过 ${b} 次`],
  [/^Slow in every moving person encounter \(at least (\d+)\), resume at least (\d+) time; at most (\d+) fast passes$/, (a,b,c) => `移动时每次遇人都减速（至少 ${a} 次相遇），恢复正常速度至少 ${b} 次；快速经过不超过 ${c} 次`],
  [/^Below ([\d.]+)% battery, choose DOCK, travel and connect before depletion$/, a => `电量低于 ${a}% 时选择 DOCK，在电量耗尽前移动到充电座并连接`],
  [/^Complete the current tasks within ([\d.]+) seconds$/, a => `在 ${a} 秒内完成当前任务`],
  [/^(\d+) \/ (\d+) (dirt cells cleaned|objects correctly sorted|spills mopped)(; (\d+) vacuum-on-liquid events)?$/, (a,b,c,d,e) => `${a} / ${b} ${ {'dirt cells cleaned':'灰尘网格已清洁','objects correctly sorted':'物品已正确分类','spills mopped':'液体已拖干'}[c]}${d ? `；${e} 次吸尘接触液体事件` : ''}`],
  [/^(\d+) moving encounters; (\d+) stops; (\d+) unsafe crossings$/, (a,b,c) => `${a} 次移动中相遇；${b} 次停车；${c} 次不安全经过`],
  [/^(\d+) moving encounters; (\d+) slow responses; (\d+) resumes; (\d+) fast passes$/, (a,b,c,d) => `${a} 次移动中相遇；${b} 次减速响应；${c} 次恢复正常速度；${d} 次快速经过`],
  [/^Low battery (observed|not observed); (\d+) travel ticks toward selected DOCK; not connected$/, (a,b) => `${a==='observed'?'已观察到':'尚未观察到'}低电量；向选定 DOCK 移动了 ${b} ticks；尚未连接`],
  [/^Connected at ([\d.]+)% battery; (\d+) low-battery travel ticks$/, (a,b) => `连接时电量 ${a}%；低电量时移动了 ${b} ticks`],
  [/^Elapsed duration: ([\d.]+) seconds$/, a => `已用时间：${a} 秒`],
  [/^Inspection without cleaning tools: ([\d.]+) seconds · Vacuum on clean floor: ([\d.]+) seconds\. These observations have no pass threshold\.$/, (a,b) => `未开启清洁工具时的检查：${a} 秒 · 在干净地板上吸尘：${b} 秒。这些观察项没有达标阈值。`],
  [/^([\d.]+) seconds elapsed$/, a => `已用 ${a} 秒`],
  [/^([\d.]+) seconds( to complete tasks| elapsed; tasks incomplete)$/, (a,b) => `${a} 秒${b.includes('incomplete')?'已过去；任务未完成':'完成任务'}`],
  [/^Rules configured for (\d+) current tasks?\.$/, a => `已为 ${a} 项当前任务配置规则。`],
  [/^Stage (\d+) has a recorded passing run \(run (\d+)\)\. You may continue, or revise and test again\.$/, (a,b) => `阶段 ${a} 已记录达标运行（运行 ${b}）。你可以继续，或修改后再次测试。`],
  [/^End a formal run that meets all current criteria to unlock Stage (\d+)\.$/, a => `结束一次达到所有当前标准的正式运行，即可解锁阶段 ${a}。`],
  [/^Run (\d+) ended with an unmet criterion\. Which part of your design would you review\?$/, a => `运行 ${a} 结束时仍有标准未达到。你会检查设计的哪个部分？`],
  [/^(\d+) \/ (\d+) mounted$/, (a,b) => `已安装 ${a} / ${b}`],
  [/^(Stage (\d+) budget: )?Up to (\d+) (sensors|actuators)\. No minimum selection\.$/, (a,b,c,d) => `${a?`阶段 ${b} 数量上限：`:''}最多 ${c} 个 ${d==='sensors'?'Sensors':'Actuators'}。没有最低安装数量。`],
  [/^Stage (\d+) allows up to (\d+) sensors\. Remove or replace a mounted sensor\.$/, (a,b) => `阶段 ${a} 最多允许 ${b} 个 Sensors。请移除或更换已安装的 Sensor。`],
  [/^Up to (\d+) mounted\. Remove or replace a module\.$/, a => `最多安装 ${a} 个。请移除或更换模块。`],
  [/^Mounting point (\d+): empty$/, a => `安装位 ${a}：空`],
  [/^Mounting point (\d+): (.+), remove or replace$/, (a,b) => `安装位 ${a}：${b}，可移除或更换`],
  [/^Stage (\d+)$/, a => `阶段 ${a}`],
  [/^Rule (\d+)$/, a => `规则 ${a}`],
  [/^Add rule for (.+)$/, a => `为${translate(a, 'zh-CN')}添加规则`],
  [/^Remove Rule (\d+) for (.+)$/, (a,b) => `删除${translate(b, 'zh-CN')}的规则 ${a}`],
  [/^Execution priority for (.+)$/, a => `${translate(a, 'zh-CN')}的执行优先级`],
  [/^(.+), Rule (\d+)$/, (a,b) => `${translate(a, 'zh-CN')}，规则 ${b}`],
  [/^Remove (.+) from (.+): (sense|condition|action|control|secondaryAction)$/, (a,b,c) => `从${translate(b, 'zh-CN')}的 ${c} 移除 ${a}`],
  [/^(.+): (sense|condition|action|control|secondaryAction)$/, (a,b) => `${translate(a, 'zh-CN')}：${b}`],
  [/^Recorded passing run: (\d+)\.$/, a => `已记录的达标运行：${a}。`],
  [/^(\d+) formal runs\.$/, a => `${a} 次正式运行。`],
  [/^Tick (\d+)$/, a => `Tick ${a}`],
  [/^(\d+)% Loaded \(([\d.]+) MB\)$/, (a,b) => `已加载 ${a}%（${b} MB）`],
  [/^([\d.]+) MB Loaded$/, a => `已加载 ${a} MB`],
  [/^Cleaned (\d+) of (\d+) dirty cells\.$/, (a,b) => `已清洁 ${a} / ${b} 个灰尘网格。`],
  [/^Sorted (\d+) of (\d+) objects\.$/, (a,b) => `已正确分类 ${a} / ${b} 件物品。`],
  [/^Mopped (\d+) of (\d+) spills\.$/, (a,b) => `已拖干 ${a} / ${b} 处液体。`],
  [/^Vacuumed on a spill (\d+) times\.$/, a => `在液体上吸尘 ${a} 次。`],
  [/^Released (\d+) objects in the wrong place\.$/, a => `将 ${a} 件物品放在了错误地点。`],
  [/^Picked up (\d+), released none at a destination\.$/, a => `已抓取 ${a} 次，但没有在目的地放下物品。`],
  [/^Kept moving with the cat within reach (\d+) times\.$/, a => `猫在近处时仍继续移动 ${a} 次。`],
  [/^Passed the person at full speed (\d+) times\.$/, a => `以全速经过人身边 ${a} 次。`],
  [/^Docked at ([\d.]+)% battery\.$/, a => `对接时电量为 ${a}%。`],
  [/^Step (\d+)$/, a => `步骤 ${a}`],
  [/^⚡ Teleport to (.+)$/, a => `⚡ 传送至${translate(a, 'zh-CN')}`],
  [/^⚡ Press \[SPACE\] or Click to open (.+)$/, a => `⚡ 按 [SPACE] 或点击打开 ${a}`],
  [/^(SENSING|DECIDING|ACTING) (.+)$/, (a,b) => `${ZH[a]} ${translate(b, 'zh-CN')}`],
  [/^⚙️ (READY|STOPPED|IDLE) • 🔋 (\d+)%$/, (a,b) => `⚙️ ${ZH[a]} • 🔋 ${b}%`]
];

export function translate(text, target = language) {
  if (target !== 'zh-CN' || typeof text !== 'string' || !text.trim()) return text;
  const source = text.trim();
  let result = ZH[source];
  if (result === undefined) {
    for (const [pattern, render] of templates) {
      const match = source.match(pattern);
      if (match) { result = render(...match.slice(1)); break; }
    }
  }
  // HUD evidence is a sequence of complete authored sentences. Preserve delimiters.
  if (result === undefined) {
    const icon = source.match(/^([\p{Extended_Pictographic}\uFE0F\u200d]+\s+)(.+)$/u);
    if (icon) result = icon[1] + translate(icon[2], target);
  }
  if (result === undefined && source.includes(' • ')) result = source.split(' • ').map(part => translate(part, target)).join(' • ');
  if (result === undefined && source.includes(' · ')) result = source.split(' · ').map(part => translate(part, target)).join(' · ');
  if (result === undefined && /^(No recorded passing run\.|Recorded passing run: \d+\.) \d+ formal runs\.$/.test(source)) result = source.split(/(?<=\.) /).map(part => translate(part, target)).join(' ');
  if (result === undefined && source.startsWith('Latest run: ')) result = `最近一次运行：${translate(source.slice(12), target)}`;
  return result === undefined ? text : text.slice(0, text.indexOf(source)) + result + text.slice(text.indexOf(source) + source.length);
}

export function createTextLocalizer() {
  const originals = new WeakMap();
  return (node, target) => {
    const cached = originals.get(node);
    const source = cached && node.data === cached.display ? cached.source : node.data;
    const display = translate(source, target);
    originals.set(node, { source, display });
    if (node.data !== display) node.data = display;
  };
}

// An untouched factory default is a display value. Editing it makes it literal user
// text; reading an untouched translated display returns the original model value.
export function isFactoryPurpose(canonical, factory, key) { return canonical === factory && !editedPurposes.has(key); }
export function bindPurposeField(input, canonical, factory, key) {
  for (const field of purposeFields) if (!field.input.isConnected) purposeFields.delete(field);
  const field = { input, canonical, factory, edited: !isFactoryPurpose(canonical, factory, key), display: canonical };
  purposeFields.add(field);
  input.addEventListener('input', () => { field.edited = true; if (key) editedPurposes.add(key); });
  input.addEventListener('blur', () => refreshPurpose(field));
  refreshPurpose(field);
  return () => !field.edited && input.value === field.display ? canonical : input.value;
}
function refreshPurpose(field) {
  const { input } = field;
  if (!input.isConnected) { purposeFields.delete(field); return; }
  if (field.edited || input.ownerDocument.activeElement === input || input.value !== field.display) return;
  field.display = translate(field.factory);
  if (input.value !== field.display) input.value = field.display;
}

export function initLanguage(root = document) {
  try { language = readLanguage(root.defaultView.localStorage); } catch { language = 'en'; }
  const localizeText = createTextLocalizer();
  const attributes = new WeakMap();
  const skip = 'script,style,textarea,input,[contenteditable],[data-i18n-skip],.robot-sensor-channels';
  const visit = node => {
    if (node.nodeType === 3) {
      if (!node.parentElement?.closest(skip)) localizeText(node, language);
      return;
    }
    if (node.nodeType !== 1 || node.closest(skip.replace(',textarea,input',''))) return;
    let cache = attributes.get(node);
    if (!cache) { cache = {}; attributes.set(node, cache); }
    for (const key of ['title','placeholder','aria-label']) {
      const current = node.getAttribute(key);
      if (current === null) continue;
      const source = cache[key]?.display === current ? cache[key].source : current;
      const display = translate(source);
      cache[key] = { source, display };
      if (current !== display) node.setAttribute(key, display);
    }
    if (node.matches('textarea,input')) return;
    for (const child of node.childNodes) visit(child);
  };
  const observer = new MutationObserver(records => {
    observer.disconnect();
    const changed = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) changed.add(node);
      else changed.add(record.target);
    }
    for (const node of changed) if (node.isConnected) visit(node);
    observe();
  });
  const observe = () => observer.observe(root.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','placeholder','aria-label'] });
  const buttons = root.querySelectorAll('[data-language]');
  const update = () => {
    root.documentElement.lang = language;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  };
  const setLanguage = next => {
    if (!['en','zh-CN'].includes(next) || next === language) return;
    observer.disconnect();
    const scrollPositions = [...root.querySelectorAll('.step-modal-body,.mounting-library,.palette-list,.task-zones-column')].map(node => [node, node.scrollTop, node.scrollLeft]);
    language = next;
    try { root.defaultView.localStorage.setItem(preferenceKey, language); } catch { /* Presentation still works with storage blocked. */ }
    update();
    visit(root.documentElement);
    for (const field of purposeFields) refreshPurpose(field);
    for (const callback of listeners) callback(language);
    for (const [node, top, left] of scrollPositions) { node.scrollTop = top; node.scrollLeft = left; }
    observe();
  };
  for (const button of buttons) {
    button.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) event.stopPropagation(); });
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  }
  update(); visit(root.documentElement); observe();
  return setLanguage;
}
