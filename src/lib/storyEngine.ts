import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const HEROINES = ['沈知韫', '苏婉青', '徐念薇'] as const;
export const PEOPLE = ['沈知韫', '徐念薇', '苏婉青'] as const;
export const ALL_PRESENCE_NAMES = ['沈知韫', '徐念薇', '苏婉青', '徐志北'] as const;

export const CYCLE_OFFSETS: Record<string, number> = {
  沈知韫: 0,
  苏婉青: 3,
  徐念薇: 6,
};

export const COSTS: Record<string, number> = {
  A: 5,
  B: 10,
  C: 15,
  CUSTOM: 15,
  REST: 0,
  BEGIN: 0,
};

export interface PassiveTier {
  level: number;
  tag: string;
  name: string;
  cost: number;
  effect: string;
}

export const DEFAULT_PASSIVE_LEVELS: PassiveTier[] = [
  { level: 0, tag: 'Lv.0', name: '凡人体质', cost: 0, effect: '无被动增益；越界面临正常防御或反击' },
  { level: 1, tag: 'Lv.1', name: '洞察之瞳', cost: 20, effect: '精准捕捉目标生理伪装、心虚停顿与微小动摇' },
  { level: 2, tag: 'Lv.2', name: '认知欺诈滤镜', cost: 50, effect: 'C烈度越界好感惩罚减半（可与商业杠杆叠加）；目标潜意识优先合理化宿主行为' },
  { level: 3, tag: 'Lv.3', name: '疲劳诱导', cost: 200, effect: '精准触发焦虑锚点；目标焦虑/劳作/剧烈抗拒体力消耗翻倍' },
  { level: 4, tag: 'Lv.4', name: '防线支配', cost: 800, effect: '全景测绘；精准命中最脆弱节点（遗嘱焦虑/背德恐惧等）' },
];

export interface OpeningScenario {
  id: string;
  title: string;
  presence: Record<string, [string, string]>;
  l1_body: string;
  weekday: string;
  time: string;
  speaker: string;
  action: string;
  line: string;
  choices: [string, string, string];
  starter_task: {
    title: string;
    target: string;
    attr: string;
    value: number;
    tier: string;
    item_desc: string;
  };
}

export const OPENING_SCENARIOS: OpeningScenario[] = [
  {
    id: 'zhiyun_friday_study',
    title: '周五深夜 · 主宅书房 · 母亲',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['徐家主宅', '晚间在家休息'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周五深夜十一时，徐家主宅二楼书房。冷气开得偏低，实木书桌上摊着压了红签的并购简报。沈知韫穿着淡紫色细肩带缎面上衣与同色薄纱开衫，米白提花短裤配露趾拖鞋，正伏案翻阅文件。房门半掩，徐志北端着温水站在门边，扑面而来的是空调冷风与纸墨微苦的气息。',
    weekday: '周五',
    time: '23:00',
    speaker: '沈知韫',
    action: '她把并购简报的一角压回文件夹下，摘下无框眼镜轻按了半秒眉心，才抬眼望向门边。',
    line: '[low restrained voice] 这么晚还没睡？外头冷气大，顺手把门带上，过来坐会儿。',
    choices: [
      '顺口问起桌上那份压了红签的并购简报，试探公司近况',
      '把温水搁到她手边，俯身替她把滑落的薄纱衣角搭回肩头',
      '走近书桌站定，直问她深夜还在为大哥外地那单项目兜底吗',
    ],
    starter_task: { title: '深夜灯下', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '素银云纹书签' },
  },
  {
    id: 'nianwei_saturday_studio',
    title: '周六凌晨 · 主宅北窗 · 姐姐',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['徐家主宅', '周末在家'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周六凌晨一时，徐家主宅二楼北窗画架旁。落地灯压出一方冷白光圈，窗缝漏进夜风和淡淡炭笔灰味。徐念薇穿着浅蓝色方领抽绳长泡泡袖居家裙、脚踩银色蝴蝶结凉拖，坐在高脚凳上整理周末带回的速写本，脚边斜倚着装满画稿的牛皮纸袋；徐志北停在门廊边，脚底木板微凉，能闻到纸页间散出的松节油残味。',
    weekday: '周六',
    time: '01:00',
    speaker: '徐念薇',
    action: '她停下翻检速写本的手，合拢封面压住边角，侧眼瞥向门廊，顺手把脚边的牛皮纸袋往椅下收了半寸。',
    line: '[cool restrained voice] 还没睡？别踩到地上的画稿，有事直接说。',
    choices: [
      '靠在门框边，问起她刚才匆忙合上的那本速写里画的是什么',
      '蹲身替她把脚边歪斜的牛皮纸袋扶正，顺手递过滚到地毯边的炭笔',
      '拉开一旁高脚凳坐近半步，直问她美院青年画展那边是不是出了变故',
    ],
    starter_task: { title: '北窗微光', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '便携炭笔素描本' },
  },
  {
    id: 'wanqing_apartment_night',
    title: '周中夜 · 顶层公寓 · 嫂子',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['工作室', '工作日傍晚在画室'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['市中心顶层公寓', '到访'],
    },
    l1_body:
      '周三晚九时，市中心顶层公寓客厅。落地窗外车河静流，暖灯映着茶几上一杯未动过的温水和滑出一角的便签纸。苏婉青穿着浅黄色碎花吊带睡裙与白色蝴蝶结平底凉拖，坐在沙发外侧；玄关门已从内侧带上，徐志北刚在近旁落步，空气里浮着淡淡的沐浴露甜香与高楼室内的安静。',
    weekday: '周三',
    time: '21:00',
    speaker: '苏婉青',
    action: '她把茶几上那杯没动过的温水朝徐志北这边轻推了一寸，指尖撤回时顺手把露出一角的便签压回杂志底下。',
    line: '[soft timid voice] 这么晚还跑一趟，先坐吧。承邺这周在外地忙，屋里怪冷清的……要换杯热茶吗？',
    choices: [
      '接过水杯落座，顺着话头打听大哥在外地最近到底在忙什么项目',
      '递回滑落在沙发边的小披肩，指尖轻擦过她手背，留心她一瞬停顿',
      '目光落在杂志下露出的一角便签上，笑问她平时记着主宅琐事累不累',
    ],
    starter_task: { title: '夜色初叙', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '手作安神香囊' },
  },
  {
    id: 'wanqing_friday_visit',
    title: '周五傍晚 · 主宅请安 · 嫂子',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['工作室', '工作日傍晚在画室'],
      苏婉青: ['徐家主宅', '周五请安窗'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周五傍晚五时，徐家主宅一楼玄关至起居室。苏婉青穿着浅黄色细肩带修身短裙外搭白色宽松长袖开衫与米白细跟鞋，按请安惯例拎着点心礼袋到访，未作过夜打算；提袋刚搁上边几，徐志北从楼梯转角走下，撞见她微红的手腕和带进门的一缕晚风。',
    weekday: '周五',
    time: '17:00',
    speaker: '苏婉青',
    action: '她把带给主宅的点心礼袋搁上玄关边几，听见脚步声便回过身，下意识理了理白色开衫的袖口，笑意客气又带着几分拘谨。',
    line: '[polite, careful] 志北，今天也在家呀。我按规矩过来看看妈，顺便带了些她爱吃的点心。',
    choices: [
      '迎上前寒暄两句，随口问起她每周五来主宅是不是大哥特意交代的',
      '伸手接过她手里沉甸甸的礼盒，顺势托稳她被提袋勒红的手腕',
      '压低声音留住正要往餐厅走的嫂子，问她今天除了请安还带了什么口信',
    ],
    starter_task: { title: '主宅请安', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '釉白瓷小茶匙' },
  },
  {
    id: 'zhiyun_sunday_noon',
    title: '周日午间 · 主宅餐厅 · 家庭',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['徐家主宅', '周末在家'],
      苏婉青: ['徐家主宅', '周日家庭午餐窗'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周日十一时五十分，徐家主宅餐厅。家庭午餐尚未开席，长桌上茶具温热。沈知韫着淡紫色缎面薄纱居家服居中，徐念薇着浅蓝色泡泡袖居家裙坐在较远一侧，苏婉青一身浅黄短裙配白开衫外出装依周日惯例到宅，手边放着伴手礼；徐志北站在桌旁，席间礼貌与暗流并存。',
    weekday: '周日',
    time: '11:50',
    speaker: '沈知韫',
    action: '她扫过一圈餐桌，目光在苏婉青手边的伴手礼和念薇略远一格的座椅间掠过，自己拉开主位座椅。',
    line: '[warm but guarded] 都到齐了，先落座吧。厨房那边还要一会儿，志北坐妈手边。',
    choices: [
      '顺势在母亲身旁落座，聊起大哥外地项目风声，暗中观察三人的神色',
      '先替母亲与二姐斟好热茶，转手把温热茶盏递给略显拘谨的苏婉青',
      '趁开席前的空当，当众挑起主宅与公司近期的安排，试探各自的口风',
    ],
    starter_task: { title: '同席家宴', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '银杏叶金属餐巾扣' },
  },
  {
    id: 'zhiyun_rain_balcony',
    title: '工作日雨后 · 主宅阳台 · 母亲',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['大学', '工作日在大学'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周四十六时三十分，雷阵雨刚歇，潮湿土腥顺着廊沿漫上二楼阳台内侧。沈知韫提前从公司回到徐家主宅，已换上淡紫色细肩带缎面居家服与薄纱开衫，背对玻璃门望向积水庭院，手机还攥在指间。徐志北走近玻璃门，冷湿水汽沾上袖口，能听见檐角滴水的轻响。',
    weekday: '周四',
    time: '16:30',
    speaker: '沈知韫',
    action: '听见身后脚步声，她没有立刻回头，只微微侧脸，把玻璃门内侧避风的位置让开半步。',
    line: '[controlled breath] 雨刚歇，风里还带着潮气。怎么这个点上来找我？',
    choices: [
      '走到她身侧半步处，轻声问她今天提前回来是不是公司遇到了棘手事',
      '伸手替她把被湿风吹散的薄纱衣角拢稳，顺带试探她微凉的指尖温度',
      '合上身后的玻璃门隔开走廊，直问她刚才电话里压着火气是在替谁善后',
    ],
    starter_task: { title: '雨歇微凉', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '细棉格子手帕' },
  },
  {
    id: 'nianwei_sunday_evening_studio',
    title: '周日傍晚 · 主宅露台侧厅 · 姐姐',
    presence: {
      沈知韫: ['徐家主宅', '常住'],
      徐念薇: ['徐家主宅', '周末在家'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['徐家主宅', '常住'],
    },
    l1_body:
      '周日傍晚六时，徐家主宅二楼露台侧厅。天光转冷，长桌上摊着未收完的水彩草稿与洗笔瓷筒。徐念薇穿着浅蓝色方领抽绳长泡泡袖居家裙，肩头搭着一条薄毯，正慢条斯理擦净画笔；侧厅门虚开一掌宽，徐志北推门入内，晚风带着颜料的微苦气味掠过指尖。',
    weekday: '周日',
    time: '18:00',
    speaker: '徐念薇',
    action: '她把最后两支画笔插进瓷筒，指尖蹭掉一点干掉的蓝灰颜料，拢紧肩上薄毯，隔着长桌看了过来。',
    line: '[quiet detached tone] 门没锁，进来就行。晚饭前我还要收完这些习作。',
    choices: [
      '停在长桌对面扫过摊开的习作，问她周末宁可在主宅赶稿也不去画室的缘由',
      '顺手递过桌边干净的擦手巾，替她把滑到肩下的薄毯往上拉稳',
      '拿起桌角一张未干透的冷调草稿细看，直问画里那把空椅子是不是主宅长桌',
    ],
    starter_task: { title: '暮色收笔', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '亚麻画稿收纳袋' },
  },
  {
    id: 'wanqing_apartment_morning',
    title: '工作日上午 · 公寓 · 嫂子',
    presence: {
      沈知韫: ['公司', '工作日上班中'],
      徐念薇: ['大学', '工作日在大学'],
      苏婉青: ['市中心顶层公寓', '常住'],
      徐志北: ['市中心顶层公寓', '到访'],
    },
    l1_body:
      '周二上午九时，市中心顶层公寓开放式餐厨。意式咖啡机轻响，落地窗外是工作日密集车流。苏婉青穿着浅黄色碎花吊带睡裙、踩着白色蝴蝶结凉拖，正在岛台边准备早餐，台面上的手机屏幕刚暗下去；徐志北靠在岛台外侧，现磨咖啡焦香混着清晨阳光落进手边。',
    weekday: '周二',
    time: '09:00',
    speaker: '苏婉青',
    action: '她按停嗡嗡作响的咖啡机，把温热的骨瓷杯挪到岛台边，眼角余光扫过亮了一瞬又暗下的手机屏幕。',
    line: '[gentle breathy voice] 早餐再等几分钟就好。你难得上午过来，先喝杯黑咖啡，还是兑点牛奶？',
    choices: [
      '靠在岛台边要了杯黑咖啡，漫不经心问起刚才手机是不是大哥又在催问家里',
      '上前接过她刚倒满的烫手骨瓷杯，自然托住杯底，留意她泛红的耳尖',
      '绕到岛台内侧挡住她要收手机的动作，轻声问她独守这间空公寓到底图什么',
    ],
    starter_task: { title: '晨间破冰', target: '系统宿主', attr: '积分', value: 4, tier: 'small', item_desc: '手冲咖啡滤纸礼盒' },
  },
];

export function determineCyclePhase(charName: string, currentDay: number | null | undefined): string {
  const day = Number(currentDay || 0);
  if (!Number.isFinite(day) || day <= 0) return '常规期';
  const offset = CYCLE_OFFSETS[charName] ?? 0;
  const pos = (Math.floor(day) + offset) % 10;
  if (pos === 0 || pos === 1) return '安全期';
  if (pos === 6 || pos === 7) return '危险期';
  return '常规期';
}

export function fluidLockFloorForTurns(turns: number | null | undefined): number {
  const t = Math.floor(Number(turns || 0));
  if (t >= 17) return 85;
  if (t >= 9) return 72;
  if (t >= 1) return 58;
  return 0;
}

export function chooseOpening(requestId: string, scenarioId?: string): {
  scenario: OpeningScenario;
  clock: { day: number; time: string };
  messages: Array<{ kind: 'narration' | 'action' | 'dialogue'; speaker: string; text: string }>;
  decision: { prompt: string; options: Array<{ id: string; text: string }> };
} {
  if (typeof requestId !== 'string' || !requestId.trim()) {
    throw new HttpError(400, '序幕须有稳定新档编号');
  }
  let chosen: OpeningScenario | undefined;
  if (scenarioId) {
    chosen = OPENING_SCENARIOS.find((s) => s.id === scenarioId);
    if (!chosen) throw new HttpError(400, '序幕场景未登记');
  } else {
    const digest = crypto.createHash('sha256').update(requestId).digest();
    const index = digest.readUInt32BE(0) % OPENING_SCENARIOS.length;
    chosen = OPENING_SCENARIOS[index];
  }
  return {
    scenario: chosen,
    clock: { day: 1, time: chosen.time },
    messages: [
      { kind: 'narration', speaker: '', text: chosen.l1_body },
      { kind: 'action', speaker: chosen.speaker, text: chosen.action },
      { kind: 'dialogue', speaker: chosen.speaker, text: chosen.line },
    ],
    decision: {
      prompt: '此刻，你准备怎么回应？',
      options: [
        { id: 'A', text: chosen.choices[0] },
        { id: 'B', text: chosen.choices[1] },
        { id: 'C', text: chosen.choices[2] },
      ],
    },
  };
}

export function formatPanelLines(panels: Record<string, Record<string, any>>): string[] {
  const host = panels['系统宿主'] || {};
  const lines: string[] = [
    `[系统宿主] 积分 ${host['积分'] ?? 0} | 经验值 ${host['经验值'] ?? 0} | 体力 ${host['体力'] ?? 100} | 魅力 ${host['魅力'] ?? 70} | 商业嗅觉 ${host['商业嗅觉'] ?? 0}`,
  ];
  for (const name of ['沈知韫', '徐念薇', '苏婉青']) {
    const p = panels[name] || {};
    const preg = p['怀孕'] ? 'True' : 'False';
    lines.push(
      `[${name}] 好感 ${p['好感'] ?? 0} | 堕落 ${p['堕落'] ?? 0} | 欲望 ${p['欲望'] ?? 0} | 羞耻 ${p['羞耻'] ?? 99} | 体力 ${p['体力'] ?? 100} | 高潮 ${p['高潮'] ?? 0}% | 内射 ${p['内射'] ?? 0}次 | 怀孕 ${preg} | 被动 Lv.${p['被动'] ?? 0}`,
    );
  }
  const xc = panels['徐承邺'] || {};
  lines.push(`[徐承邺] 堕落 ${xc['堕落'] ?? 0}`);
  return lines;
}

const VISUAL_EXT_PRIORITY: Record<string, number> = {
  '.webp': 7,
  '.avif': 6,
  '.jpg': 5,
  '.jpeg': 4,
  '.png': 3,
  '.gif': 2,
  '.svg': 1,
};
const SCENE_TIME_SLOTS = new Set(['day', 'night', 'dawn', 'dusk']);

export function scanVisualAssets(rootDir: string): {
  scenes: Record<string, Record<string, string>>;
  characters: Record<string, Record<string, string>>;
} {
  const imageRoot = path.join(rootDir, 'txt文件', 'image');
  const scenes: Record<string, Record<string, string>> = {};
  const characters: Record<string, Record<string, string>> = {};
  if (!fs.existsSync(imageRoot)) return { scenes, characters };

  type RankEntry = { mtimeMs: number; prio: number; url: string };
  const pick = (bucket: Record<string, RankEntry>, key: string, fullPath: string, relParts: string[]) => {
    const ext = path.extname(fullPath).toLowerCase();
    const prio = VISUAL_EXT_PRIORITY[ext] ?? 0;
    if (!prio) return;
    let st: fs.Stats;
    try {
      st = fs.statSync(fullPath);
    } catch {
      return;
    }
    if (!st.isFile()) return;
    const prev = bucket[key];
    const url =
      '/txt文件/image/' +
      relParts.map((p) => encodeURIComponent(p)).join('/') +
      `?v=${Math.floor(st.mtimeMs / 1000)}`;
    if (!prev || st.mtimeMs > prev.mtimeMs || (st.mtimeMs === prev.mtimeMs && prio > prev.prio)) {
      bucket[key] = { mtimeMs: st.mtimeMs, prio, url };
    }
  };

  const scenesDir = path.join(imageRoot, 'scenes');
  if (fs.existsSync(scenesDir)) {
    const sceneBuckets: Record<string, Record<string, RankEntry>> = {};
    for (const name of fs.readdirSync(scenesDir).sort()) {
      if (name.startsWith('.')) continue;
      const fullPath = path.join(scenesDir, name);
      const stem = path.parse(name).name;
      let place = stem;
      let slot = 'default';
      const idx = stem.lastIndexOf('_');
      if (idx > 0) {
        const suffix = stem.slice(idx + 1).toLowerCase();
        if (SCENE_TIME_SLOTS.has(suffix)) {
          place = stem.slice(0, idx);
          slot = suffix;
        }
      }
      place = place.trim();
      if (!place) continue;
      sceneBuckets[place] ||= {};
      pick(sceneBuckets[place], slot, fullPath, ['scenes', name]);
    }
    for (const [place, slots] of Object.entries(sceneBuckets)) {
      scenes[place] = {};
      for (const [slot, entry] of Object.entries(slots)) {
        scenes[place][slot] = entry.url;
      }
    }
  }

  for (const entryName of fs.readdirSync(imageRoot).sort()) {
    if (entryName.startsWith('.') || entryName === 'scenes') continue;
    const entryPath = path.join(imageRoot, entryName);
    let st: fs.Stats;
    try {
      st = fs.statSync(entryPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const charBucket: Record<string, RankEntry> = {};
    for (const fname of fs.readdirSync(entryPath).sort()) {
      if (fname.startsWith('.')) continue;
      const fullPath = path.join(entryPath, fname);
      const slot = path.parse(fname).name.trim();
      if (!slot) continue;
      pick(charBucket, slot, fullPath, [entryName, fname]);
    }
    if (Object.keys(charBucket).length > 0) {
      characters[entryName] = {};
      for (const [slot, entry] of Object.entries(charBucket)) {
        characters[entryName][slot] = entry.url;
      }
    }
  }

  return { scenes, characters };
}

export interface EventRecord {
  seq: number;
  type: string;
  payload: Record<string, any>;
}

export class EventHub {
  seq = 0;
  workerSeq = 0;
  private events: EventRecord[] = [];
  private listeners = new Set<(ev: EventRecord) => void>();
  private workerWaiters = new Set<() => void>();

  publish(type: string, payload: Record<string, any> = {}, wakeWorker = false): EventRecord {
    this.seq += 1;
    if (wakeWorker) this.workerSeq += 1;
    const record: EventRecord = { seq: this.seq, type, payload };
    this.events.push(record);
    if (this.events.length > 96) this.events.shift();
    for (const fn of this.listeners) {
      try {
        fn(record);
      } catch {
        // ignore listener errors
      }
    }
    if (wakeWorker) {
      for (const wake of this.workerWaiters) wake();
      this.workerWaiters.clear();
    }
    return record;
  }

  missedSince(sinceSeq: number): EventRecord[] {
    return this.events.filter((e) => e.seq > sinceSeq);
  }

  subscribe(fn: (ev: EventRecord) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  waitWorker(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.workerWaiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, Math.max(200, Math.min(25000, timeoutMs)));
      this.workerWaiters.add(done);
    });
  }
}

export interface StoryJob {
  request_id: string;
  base_revision: string;
  action: string;
  entry_mode: string;
  selection: Record<string, any> | null;
  operation: Record<string, any> | null;
  status: 'queued' | 'generating' | 'validating' | 'committed' | 'failed' | 'cancelled' | 'interrupted' | 'conflict';
  error: string;
  lease: string | null;
  lease_until: number;
  reservation: { status: 'held' | 'settled' | 'refunded'; quote: { cost: number; tier: string } } | null;
  receipt: Record<string, any> | null;
  created_at: number;
}

export function createInitialSaveState(): Record<string, any> {
  return {
    version: 2,
    buffs: { 徐念薇: [], 沈知韫: [], 苏婉青: [] },
    counters: {
      破局_张力淤积: 0,
      破局_日常冗余: 0,
      破局_模式重复: 0,
      破局_社交淤积: 0,
      空耗_连续未纾解_徐念薇: 0,
      空耗_连续未纾解_沈知韫: 0,
      空耗_连续未纾解_苏婉青: 0,
      连续守护回合: 0,
    },
    director: {
      active_threads: [],
      calm_streak: 0,
      clock_tick_acc: 0,
      consumed_once: [],
      event_cooldowns: {},
      global_cooldown: 0,
      last_time_slot: '',
      next_thread_seq: 1,
      offstage_clocks: {},
      pending_seeds: [],
      recent_channels: [],
      scene_location: '',
      scene_turns: 0,
      turns_since_beat: 99,
    },
    intel: { consumed: [], held: [], leverage_armed: '', su_ab_contacts: 0 },
    items: { active: [], delivered: [], history: [], next_seq: 1 },
    lifecycle: { ab_streak: 0, legacy_counters: {}, micro: {}, round: 0, scopes: {}, version: 1 },
    mechanics: {
      c_streak: {
        徐念薇: { count: 0, tier: '' },
        沈知韫: { count: 0, tier: '' },
        苏婉青: { count: 0, tier: '' },
      },
      depravity_unlocked_caps: { 徐念薇: 30, 沈知韫: 30, 苏婉青: 30 },
      first_triggers: { 徐念薇: [], 沈知韫: [], 苏婉青: [] },
      insomnia_applied: { 徐念薇: false, 沈知韫: false, 苏婉青: false },
      masturbation_trace: { 徐念薇: 0, 沈知韫: 0, 苏婉青: 0 },
      nap_last_day: { 徐念薇: 0, 沈知韫: 0, 苏婉青: 0 },
      pregnancy_latent_until: { 徐念薇: 0, 沈知韫: 0, 苏婉青: 0 },
      secrets_unlocked: [],
      su_affection_85_unlocked: false,
    },
    micro_states: {
      徐念薇: { confusion_debt: false, momentary_ease: false, residual_tension: false },
      沈知韫: { confusion_debt: false, momentary_ease: false, residual_tension: false },
      苏婉青: { confusion_debt: false, momentary_ease: false, residual_tension: false },
    },
    panels: {
      徐念薇: { 体力: 65, 内射: 0, 堕落: 0, 好感: 30, 怀孕: false, 欲望: 0, 羞耻: 99, 被动: 0, 高潮: 0 },
      徐承邺: { 堕落: 0 },
      沈知韫: { 体力: 100, 内射: 0, 堕落: 0, 好感: 95, 怀孕: false, 欲望: 0, 羞耻: 100, 被动: 0, 高潮: 0 },
      系统宿主: { 体力: 100, 商业嗅觉: 0, 积分: 0, 经验值: 0, 魅力: 70 },
      苏婉青: { 体力: 100, 内射: 0, 堕落: 0, 好感: 40, 怀孕: false, 欲望: 0, 羞耻: 99, 被动: 0, 高潮: 0 },
    },
    presence: {
      徐志北: { location: '徐家主宅', reason: '常住' },
      徐念薇: { location: '大学', reason: '工作日在大学' },
      沈知韫: { location: '徐家主宅', reason: '常住' },
      苏婉青: { location: '市中心顶层公寓', reason: '常住' },
    },
    runtime: {
      action_index: 0,
      clock: null,
      closed_by: '',
      item_recovered: 0,
      last_closed: 0,
      last_segment_id: '',
      last_sequence: 0,
      memory_round: 1,
      phase: 'ready',
      prologue: null,
      weekday: '',
    },
    shop: { echoes: [], recent: [], redeemed: {} },
    tasks: { current: null, history: [], pending_items: [] },
    vigilance: {
      位置: '外地',
      目标: {
        徐志北: { 发现: 0, 发现几率: 0, 警惕: 0 },
        徐念薇: { 发现: 0, 发现几率: 0, 警惕: 0 },
        沈知韫: { 发现: 0, 发现几率: 0, 警惕: 0 },
        苏婉青: { 发现: 0, 发现几率: 0, 警惕: 0 },
      },
    },
  };
}

export class StoryEngine {
  readonly root: string;
  readonly hub = new EventHub();
  readonly serviceEpoch = crypto.randomBytes(16).toString('hex');
  private saveState: Record<string, any>;
  private recentPlayback: { version: number; playback: Record<string, any> | null; segments: any[] };
  private dataSnapshot: Record<string, any>;
  private saveEpoch = 'legacy';
  private lastResetRequestId = '';
  private stateVersion = 0;
  private preferences: { protagonist_style: 'faithful' | 'silent'; settlement_thinking_mode: 'auto' | 'off' | 'on' } = {
    protagonist_style: 'faithful',
    settlement_thinking_mode: 'auto',
  };
  private jobs: Record<string, StoryJob> = {};
  private latestJobId: string | null = null;
  private receipts: Record<string, Record<string, any>> = {};
  private bridgeToken: string;
  private bridgeMonitor: Record<string, any> | null = null;
  private bridgeControlCmd: Record<string, any> | null = null;
  private streamPreview: Record<string, any> = {};

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
    this.bridgeToken = crypto.randomBytes(24).toString('hex');
    this.saveState = this.readJsonSafe(path.join(this.root, '存档', 'save_state.json')) || createInitialSaveState();
    this.recentPlayback = this.readJsonSafe(path.join(this.root, '存档', '近期演播.json')) || {
      version: 1,
      playback: null,
      segments: [],
    };
    this.dataSnapshot = this.readJsonSafe(path.join(this.root, 'data.json')) || {
      round: 0,
      sceneTitle: '徐家主宅',
      storyNodes: [],
      presence: structuredClone(this.saveState.presence),
      state_version: 0,
    };
    this.stateVersion = Number(this.dataSnapshot.state_version || 0);
    const epochFile = this.readJsonSafe(path.join(this.root, '.round-runtime', 'save-epoch.json'));
    if (epochFile && typeof epochFile.epoch === 'string' && /^[0-9a-f]{32}$/.test(epochFile.epoch)) {
      this.saveEpoch = epochFile.epoch;
      this.lastResetRequestId = String(epochFile.request_id || '');
    }
    const prefsFile = this.readJsonSafe(path.join(this.root, '.round-runtime', 'story', 'prefs.json'));
    if (prefsFile) {
      if (prefsFile.protagonist_style === 'faithful' || prefsFile.protagonist_style === 'silent') {
        this.preferences.protagonist_style = prefsFile.protagonist_style;
      }
      if (
        prefsFile.settlement_thinking_mode === 'auto' ||
        prefsFile.settlement_thinking_mode === 'off' ||
        prefsFile.settlement_thinking_mode === 'on'
      ) {
        this.preferences.settlement_thinking_mode = prefsFile.settlement_thinking_mode;
      }
    }
    const bridgeKeyFile = this.readJsonSafe(path.join(this.root, '.round-runtime', 'story', 'bridge-key.json'));
    if (bridgeKeyFile && typeof bridgeKeyFile.token === 'string' && bridgeKeyFile.token.length >= 16) {
      this.bridgeToken = bridgeKeyFile.token;
    }
  }

  private readJsonSafe(filePath: string): any | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private writeJsonAtomic(filePath: string, data: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, filePath);
  }

  private persistSave(): void {
    try {
      this.writeJsonAtomic(path.join(this.root, '存档', 'save_state.json'), this.saveState);
      this.writeJsonAtomic(path.join(this.root, '存档', '近期演播.json'), this.recentPlayback);
      this.writeJsonAtomic(path.join(this.root, 'data.json'), this.dataSnapshot);
    } catch {
      // Ephemeral filesystem write errors should never crash in-memory operation
    }
  }

  getPolicy(): Record<string, any> {
    return (
      this.readJsonSafe(path.join(this.root, 'txt文件', '互动运行配置.json')) || {
        version: 2,
        locations: ['徐家主宅', '市中心顶层公寓', '大学', '工作室', '公司'],
        operations: ['move_player', 'transfer_item', 'use_recovery_item'],
        resource: { status: 'active', scheme: 'fixed_tiers', costs: { A: 5, B: 10, C: 15 }, custom_reserve: 15, maximum: 100 },
      }
    );
  }

  getShopCatalog(): { version: number; tiers: Record<string, any>; items: any[] } {
    return (
      this.readJsonSafe(path.join(this.root, 'txt文件', '系统商城目录.json')) || {
        version: 1,
        tiers: {},
        items: [],
      }
    );
  }

  getIntelCatalog(): { version: number; leverage_min_biz: number; items: any[] } {
    return (
      this.readJsonSafe(path.join(this.root, 'txt文件', '商业情报目录.json')) || {
        version: 1,
        leverage_min_biz: 60,
        items: [],
      }
    );
  }

  getPassiveTiers(): PassiveTier[] {
    const policy = this.getPolicy();
    const costs = (policy.passive && policy.passive.costs) || {};
    return DEFAULT_PASSIVE_LEVELS.map((tier) => {
      const override = costs[String(tier.level)];
      return {
        ...tier,
        cost: typeof override === 'number' && override >= 0 ? override : tier.cost,
      };
    });
  }

  private expectedPluginVersion(): string {
    const manifest = this.readJsonSafe(path.join(this.root, 'scene_chat_dev', 'local.story.operit_bridge', 'manifest.json'));
    return manifest && typeof manifest.version === 'string' ? manifest.version : '2.1.5';
  }

  getRevision(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this.saveState));
    hash.update(JSON.stringify(this.dataSnapshot));
    hash.update(String(this.stateVersion));
    return hash.digest('hex');
  }

  getSaveEpoch(): string {
    return this.saveEpoch;
  }

  getBridgeToken(): string {
    try {
      this.writeJsonAtomic(path.join(this.root, '.round-runtime', 'story', 'bridge-key.json'), {
        token: this.bridgeToken,
      });
    } catch {
      // ignore
    }
    return this.bridgeToken;
  }

  authorizeWorker(token: string | undefined): boolean {
    if (!token || typeof token !== 'string') return false;
    const a = Buffer.from(token);
    const b = Buffer.from(this.bridgeToken);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  private expireJobs(): void {
    const now = Date.now() / 1000;
    for (const job of Object.values(this.jobs)) {
      if (job.status === 'generating' && job.lease_until > 0 && job.lease_until < now) {
        job.status = 'interrupted';
        job.error = '生成连接已中断。原行动已保留，可重试。';
        job.lease = null;
      }
    }
  }

  private getBridgeView(): Record<string, any> {
    const now = Date.now() / 1000;
    const expected = this.expectedPluginVersion();
    const cmd = this.bridgeControlCmd ? { ...this.bridgeControlCmd } : null;
    if (cmd && cmd.status === 'requested' && now - Number(cmd.issued_at || 0) > 120) {
      cmd.status = 'expired';
    }
    if (!this.bridgeMonitor) {
      return {
        control_supported: true,
        present: false,
        phase: 'offline',
        running: false,
        busy: false,
        last_error: '',
        expected_plugin_version: expected,
        control: cmd,
      };
    }
    const present = now - Number(this.bridgeMonitor.received_at || 0) < 15;
    return {
      control_supported: true,
      present,
      running: Boolean(this.bridgeMonitor.running),
      busy: Boolean(this.bridgeMonitor.busy),
      last_error: String(this.bridgeMonitor.last_error || ''),
      plugin_version: String(this.bridgeMonitor.plugin_version || ''),
      expected_plugin_version: expected,
      session: this.bridgeMonitor.session || null,
      dual_stage: this.bridgeMonitor.dual_stage,
      primary_model_mode: this.bridgeMonitor.primary_model_mode,
      primary_function_type: this.bridgeMonitor.primary_function_type,
      settlement_function_type: this.bridgeMonitor.settlement_function_type,
      settlement_model: this.bridgeMonitor.settlement_model,
      settlement_fallback: this.bridgeMonitor.settlement_fallback,
      settlement_thinking: this.bridgeMonitor.settlement_thinking,
      settlement_thinking_mode: this.bridgeMonitor.settlement_thinking_mode,
      available_models: this.bridgeMonitor.available_models,
      function_bindings: this.bridgeMonitor.function_bindings,
      phase: present ? this.bridgeMonitor.phase : 'offline',
      control: cmd,
    };
  }

  private publicJob(job: StoryJob | null | undefined): Record<string, any> | null {
    if (!job) return null;
    return {
      request_id: job.request_id,
      base_revision: job.base_revision,
      action: job.action,
      entry_mode: job.entry_mode,
      selection: job.selection,
      operation: job.operation,
      status: job.status,
      error: job.error,
      receipt: job.receipt,
      ...(job.reservation ? { reservation: job.reservation } : {}),
    };
  }

  getStatus(requestId?: string): Record<string, any> {
    this.expireJobs();
    if (requestId !== undefined) {
      const job = this.jobs[requestId];
      if (!job) throw new HttpError(404, '任务不存在');
      return { task: this.publicJob(job) };
    }
    const bridge = this.getBridgeView();
    const connected = Boolean(
      bridge.present && bridge.running && ['ready', 'generating', 'legacy'].includes(bridge.phase) && !bridge.last_error,
    );
    return {
      task: this.publicJob(this.latestJobId ? this.jobs[this.latestJobId] : null),
      bridge_connected: connected,
      bridge,
      reading_preflight: 1,
      live_reading_revision: 2,
      action_contract_revision: 1,
      material_delivery_revision: 1,
      material_delivery_v2: 1,
      dual_stage_protocol: 1,
      worker_wait_supported: true,
      sse_supported: true,
      service_epoch: this.serviceEpoch,
      story_protocol: 2,
      bridge_model: this.bridgeMonitor?.model || null,
      save_epoch: this.saveEpoch,
      interaction_protocol: 3,
    };
  }

  private currentSegment(): any | null {
    const segs = this.recentPlayback.segments || [];
    if (segs.length === 0) return null;
    return segs[segs.length - 1];
  }

  private getPlayback(row: any | null): Record<string, any> {
    if (!row) {
      return { segment_id: '', revealed: 0, total: 0, completed: true, bootstrap: true };
    }
    const total = Array.isArray(row.messages) ? row.messages.length : 0;
    const pb = this.recentPlayback.playback;
    if (pb && pb.segment_id === row.id) {
      return {
        version: 1,
        segment_id: row.id,
        revealed: Math.min(total, Math.max(0, Number(pb.revealed || 0))),
        completed: Boolean(pb.completed),
        total,
        bootstrap: false,
      };
    }
    return {
      version: 1,
      segment_id: row.id,
      revealed: total,
      completed: true,
      total,
      bootstrap: false,
    };
  }

  buildWorldView(): Record<string, any> {
    const st = this.saveState;
    const presence = st.presence || {};
    const location = (presence['徐志北'] && presence['徐志北'].location) || '徐家主宅';
    const cast: string[] = PEOPLE.filter((n) => presence[n]?.location === location);
    const vigPos = String(st.vigilance?.['位置'] || '外地');
    if (
      (location === '徐家主宅' && (vigPos === '徐家主宅' || vigPos === '徐家住宅')) ||
      (location === '市中心顶层公寓' && vigPos === '市中心顶层公寓')
    ) {
      cast.push('徐承邺');
    }

    const activeItems = (st.items?.active || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      quantity: Number(it.quantity ?? 1),
      remaining_turns: it.remaining_turns ?? null,
      giftable: it.giftable !== false,
      fields: {
        道具名称: it.name,
        道具ID: it.id,
        类型: it.type || '永久性',
        描述: it.desc || '',
        数量: String(it.quantity ?? 1),
        获得回合: String(it.obtained_round ?? 1),
        当前状态: it.status || '仓库中',
        位置: it.location || '随身',
        使用对象: it.target || '未使用',
        时效: it.duration || '无',
        剩余时效: it.remaining_turns != null ? `${it.remaining_turns}回合` : '无',
        过期规则: it.expire_rule || '无',
        使用记录: it.usage_log || '无',
        备注: it.remark || '',
        系统效果: it.system_effect || '',
        可赠予: it.giftable === false ? '否' : '是',
      },
    }));

    const deliveredItems = (st.items?.delivered || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      quantity: Number(it.quantity ?? 1),
      target: it.target || '',
      type: it.type || '永久性',
      desc: it.desc || '',
      note: it.note || it.remark || '',
      remark: it.remark || it.note || '',
      status: it.status || '已交付',
    }));

    const rt = st.runtime || {};
    const runtimeView = {
      version: 1,
      clock: rt.clock || null,
      memory_round: Number(rt.memory_round || 1),
      last_closed: Number(rt.last_closed || 0),
      phase: rt.phase || 'ready',
      item_recovered: Number(rt.item_recovered || 0),
      action_index: Number(rt.action_index || 0),
      closed_by: rt.closed_by || '',
    };
    const staminaVal = Number(st.panels?.['系统宿主']?.['体力'] ?? 100);
    const curDay = Number(rt.clock?.day || 1);
    const mech = st.mechanics || {};
    const latentMap = mech.pregnancy_latent_until || {};
    const traceMap = mech.masturbation_trace || {};
    const countersMap = st.counters || {};

    const physiology: Record<string, any> = {};
    for (const hname of HEROINES) {
      const hpanel = st.panels?.[hname] || {};
      const isPreg = Boolean(hpanel['怀孕']);
      const latUntil = Number(latentMap[hname] || 0);
      const latLeft = !isPreg && latUntil > curDay ? Math.max(0, latUntil - curDay) : 0;
      const buffsForHeroine = st.buffs?.[hname] || [];
      let flTurns = 0;
      for (const b of buffsForHeroine) {
        if (b && typeof b === 'object' && String(b.name || '').includes('持续_体液锁定')) {
          flTurns = Number(b.turns || 0);
          break;
        }
      }
      physiology[hname] = {
        cycle_phase: isPreg ? '孕期停经' : determineCyclePhase(hname, curDay),
        pregnancy_stage: isPreg ? 'confirmed' : latLeft > 0 ? 'latent' : 'none',
        latent_days_left: latLeft,
        creampie_count: Number(hpanel['内射'] || 0),
        unrelieved_streak: Number(countersMap[`空耗_连续未纾解_${hname}`] || 0),
        masturbation_trace: Number(traceMap[hname] || 0),
        fluid_lock_turns: flTurns,
        fluid_lock_floor: fluidLockFloorForTurns(flTurns),
      };
    }

    const vigTargets = Object.entries(st.vigilance?.['目标'] || {}).map(([name, vals]: [string, any]) => ({
      name,
      vigilance: Number(vals?.['警惕'] || 0),
      discovery: Number(vals?.['发现'] || 0),
    }));

    const intelCat = this.getIntelCatalog();
    const intelState = st.intel || { held: [], consumed: [], su_ab_contacts: 0, leverage_armed: '' };
    const tasksRaw = st.tasks || { current: null, history: [], pending_items: [] };
    const pendingItems: string[] = Array.isArray(tasksRaw.pending_items) ? tasksRaw.pending_items : [];

    return {
      progression: {
        runtime: runtimeView,
        stamina: staminaVal,
        costs: COSTS,
        item_budget: Math.max(0, 20 - runtimeView.item_recovered),
      },
      weekday: rt.weekday || '',
      location,
      cast,
      presence: structuredClone(presence),
      panels: formatPanelLines(st.panels || {}),
      items: activeItems,
      delivered_items: deliveredItems,
      buffs: structuredClone(st.buffs || { 沈知韫: [], 苏婉青: [], 徐念薇: [] }),
      micro_states: structuredClone(
        st.micro_states || {
          沈知韫: { confusion_debt: false, momentary_ease: false, residual_tension: false },
          苏婉青: { confusion_debt: false, momentary_ease: false, residual_tension: false },
          徐念薇: { confusion_debt: false, momentary_ease: false, residual_tension: false },
        },
      ),
      physiology,
      visual_assets: scanVisualAssets(this.root),
      vigilance: { position: vigPos, targets: vigTargets },
      passive_tiers: this.getPassiveTiers(),
      secrets_unlocked: Array.isArray(mech.secrets_unlocked) ? [...mech.secrets_unlocked] : [],
      intel: {
        held: [...(intelState.held || [])],
        consumed: [...(intelState.consumed || [])],
        su_ab_contacts: Number(intelState.su_ab_contacts || 0),
        leverage_armed: String(intelState.leverage_armed || ''),
        leverage_min_biz: intelCat.leverage_min_biz ?? 60,
        catalog: intelCat.items || [],
      },
      tasks: {
        current: tasksRaw.current ? structuredClone(tasksRaw.current) : null,
        history: [...(tasksRaw.history || [])],
        pending_items: [...pendingItems],
        pending_item: pendingItems[0] || null,
      },
      shop_state: structuredClone(st.shop || { redeemed: {}, recent: [], echoes: [] }),
      interaction: this.dataSnapshot.interaction || {
        count: (this.recentPlayback.segments || []).length,
        actions: Number(rt.action_index || 0),
        ...(rt.last_sequence ? { last_sequence: rt.last_sequence } : {}),
        ...(rt.last_segment_id ? { segment_id: rt.last_segment_id } : {}),
      },
      policy: this.getPolicy(),
    };
  }

  getLiveSnapshot(beforeParam?: string | null): Record<string, any> {
    this.expireJobs();
    const current = this.currentSegment();
    const progress = this.getPlayback(current);
    let rows = [...(this.recentPlayback.segments || [])];
    if (beforeParam !== undefined && beforeParam !== null && beforeParam !== '') {
      const boundary = Number(beforeParam);
      if (!Number.isInteger(boundary)) throw new HttpError(400, '历史游标无效');
      rows = rows.filter((r) => Number(r.sequence || 0) < boundary);
    }
    const selected = rows.slice(-60);
    const history = selected.map((value) => {
      const pub: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === 'audit' || k === 'before_world' || k === 'resolution') continue;
        pub[k] = structuredClone(v);
      }
      if (current && value.id === current.id && !progress.completed) {
        pub.messages = (pub.messages || []).slice(0, progress.revealed);
        pub.handoff = '';
        delete pub.decision;
        delete pub.settlement;
      }
      return pub;
    });

    const world =
      current && !progress.completed && current.before_world
        ? structuredClone(current.before_world)
        : this.buildWorldView();
    const settlement = current && progress.completed ? current.settlement || null : null;
    const latestJob = this.latestJobId ? this.jobs[this.latestJobId] : null;
    const preview =
      latestJob && (latestJob.status === 'generating' || latestJob.status === 'validating')
        ? this.streamPreview[latestJob.request_id] || null
        : null;

    return {
      world,
      settlement,
      playback: progress,
      history,
      has_older: rows.length > selected.length,
      stream_preview: preview,
      preferences: { ...this.preferences },
      revision: this.getRevision(),
      state_version: this.stateVersion,
      ...this.getStatus(),
    };
  }

  getLegacySnapshot(): Record<string, any> {
    this.expireJobs();
    let memoryText = '';
    let itemsText = '';
    try {
      memoryText = fs.readFileSync(path.join(this.root, '存档', '全局记忆库.txt'), 'utf-8');
    } catch {
      memoryText = formatPanelLines(this.saveState.panels || {}).join('\n');
    }
    try {
      itemsText = fs.readFileSync(path.join(this.root, '存档', '徐志北道具图鉴.txt'), 'utf-8');
    } catch {
      itemsText = '';
    }
    return {
      revision: this.getRevision(),
      settlement: null,
      state_version: this.stateVersion,
      data: structuredClone(this.dataSnapshot),
      memory_text: memoryText,
      items_text: itemsText,
      preferences: { ...this.preferences },
      ...this.getStatus(),
    };
  }

  newGame(body: Record<string, any>): Record<string, any> {
    if (!body || typeof body !== 'object') throw new HttpError(400, '请求必须是JSON对象');
    const { request_id, save_epoch, confirm, scenario_id } = body;
    if (
      confirm !== 'new_game' ||
      typeof request_id !== 'string' ||
      !/^[A-Za-z0-9-]{1,100}$/.test(request_id)
    ) {
      throw new HttpError(400, '新档确认信息无效');
    }
    if (this.lastResetRequestId && this.lastResetRequestId === request_id) {
      return { status: 'reset', save_epoch: this.saveEpoch, replayed: true, prologue: this.dataSnapshot.prologue };
    }
    if (save_epoch !== this.saveEpoch) {
      throw new HttpError(409, '当前存档已改变，请刷新后重新确认新档');
    }
    this.expireJobs();
    const hasBlockingJob = Object.values(this.jobs).some((j) =>
      ['queued', 'generating', 'validating'].includes(j.status),
    );
    if (hasBlockingJob) {
      throw new HttpError(409, '仍有行动在处理，请等待完成后再开新档');
    }

    const opening = chooseOpening(request_id, typeof scenario_id === 'string' ? scenario_id : undefined);
    const sc = opening.scenario;
    const fresh = createInitialSaveState();
    for (const [name, [loc, reason]] of Object.entries(sc.presence)) {
      fresh.presence[name] = { location: loc, reason };
    }
    fresh.director.scene_location = fresh.presence['徐志北'].location;
    fresh.tasks = {
      current: {
        id: 'TASK-001',
        title: sc.starter_task.title,
        target: sc.starter_task.target,
        attr: sc.starter_task.attr,
        value: sc.starter_task.value,
        tier: sc.starter_task.tier,
        item_desc: sc.starter_task.item_desc,
        status: '进行中',
        issue_round: 1,
        complete_round: null,
      },
      history: [],
      pending_items: [],
    };

    const ident = 'prologue-' + crypto.createHash('sha256').update(request_id).digest('hex').slice(0, 32);
    const prologueMeta = {
      request_id,
      scenario_id: sc.id,
      weekday: sc.weekday,
      title: sc.title,
    };
    fresh.runtime = {
      action_index: 0,
      clock: opening.clock,
      closed_by: '',
      item_recovered: 0,
      last_closed: 0,
      last_segment_id: ident,
      last_sequence: 1,
      memory_round: 1,
      phase: 'ready',
      prologue: prologueMeta,
      weekday: sc.weekday,
    };

    this.saveState = fresh;
    this.stateVersion = 1;
    this.saveEpoch = crypto.randomBytes(16).toString('hex');
    this.lastResetRequestId = request_id;
    this.jobs = {};
    this.latestJobId = null;
    this.receipts = {};
    this.streamPreview = {};

    this.dataSnapshot = {
      round: 1,
      sceneTitle: fresh.presence['徐志北'].location,
      presence: structuredClone(fresh.presence),
      request_id: ident,
      state_version: 1,
      options_text: '',
      story_runtime: {
        version: 1,
        clock: opening.clock,
        memory_round: 1,
        last_closed: 0,
        phase: 'ready',
        item_recovered: 0,
        action_index: 0,
        closed_by: '',
      },
      prologue: prologueMeta,
      interaction: { count: 1, actions: 0, last_sequence: 1, segment_id: ident },
      storyNodes: opening.messages.map((m) =>
        m.kind === 'dialogue'
          ? { type: 'dialogue', speaker: m.speaker, text: m.text }
          : { type: 'narration', text: m.text },
      ),
    };

    const worldBefore = this.buildWorldView();
    const listeners = ['徐志北', ...(worldBefore.cast || [])];
    const row = {
      version: 2,
      id: ident,
      sequence: 1,
      count: 1,
      input: '',
      input_kind: 'system',
      selection: { segment_id: '', option_id: 'BEGIN' },
      messages: opening.messages,
      decision: opening.decision,
      operation: null,
      handoff: '',
      known_by: listeners,
      input_known_by: ['徐志北'],
      messages_known_by: listeners,
      location: worldBefore.location,
      after_location: worldBefore.location,
      created_at: Math.floor(Date.now() / 1000),
      cost: { status: 'active', kind: 'prologue', total: 0 },
      audit: { origin: 'registered_prologue', scenario_id: sc.id },
      before_world: worldBefore,
    };
    this.recentPlayback = {
      version: 1,
      playback: { version: 1, segment_id: ident, revealed: 0, completed: false },
      segments: [row],
    };

    this.persistSave();
    try {
      this.writeJsonAtomic(path.join(this.root, '.round-runtime', 'save-epoch.json'), {
        version: 1,
        epoch: this.saveEpoch,
        request_id,
      });
    } catch {
      // ignore
    }
    this.hub.publish('save_reset', { save_epoch: this.saveEpoch });
    return { status: 'reset', save_epoch: this.saveEpoch, replayed: false, prologue: prologueMeta };
  }

  advancePlayback(body: Record<string, any>): Record<string, any> {
    const { save_epoch, segment_id, revealed, completed, catchup } = body || {};
    if (save_epoch !== this.saveEpoch) {
      throw new HttpError(409, '已切换新档，旧演播进度无效');
    }
    const row = this.currentSegment();
    if (!row || row.id !== segment_id) {
      throw new HttpError(409, '本段已更新，旧演播进度无效');
    }
    const total = Array.isArray(row.messages) ? row.messages.length : 0;
    if (!Number.isInteger(revealed) || revealed < 0 || revealed > total || typeof completed !== 'boolean') {
      throw new HttpError(400, '演播进度参数无效');
    }
    if (completed && revealed !== total) {
      throw new HttpError(400, '完成演播时已展示句数须等于总句数');
    }
    const prev = this.getPlayback(row);
    if (revealed < prev.revealed || (prev.completed && !completed)) {
      throw new HttpError(409, '演播进度不可回退');
    }
    if (!catchup && revealed > prev.revealed + 1) {
      throw new HttpError(400, '演播进度须逐句推进');
    }
    this.recentPlayback.playback = {
      version: 1,
      segment_id: row.id,
      revealed,
      completed,
    };
    this.persistSave();
    return this.getLiveSnapshot();
  }

  updatePreferences(body: Record<string, any>): Record<string, any> {
    if (!body || typeof body !== 'object') throw new HttpError(400, '偏好参数无效');
    if (body.protagonist_style !== undefined) {
      if (body.protagonist_style !== 'faithful' && body.protagonist_style !== 'silent') {
        throw new HttpError(400, '主角演绎模式仅支持 faithful 或 silent');
      }
      this.preferences.protagonist_style = body.protagonist_style;
    }
    if (body.settlement_thinking_mode !== undefined) {
      if (!['auto', 'off', 'on'].includes(body.settlement_thinking_mode)) {
        throw new HttpError(400, '结算思考模式仅支持 auto / off / on');
      }
      this.preferences.settlement_thinking_mode = body.settlement_thinking_mode;
    }
    try {
      this.writeJsonAtomic(path.join(this.root, '.round-runtime', 'story', 'prefs.json'), this.preferences);
    } catch {
      // ignore
    }
    this.hub.publish('preferences_updated', { ...this.preferences });
    return { preferences: { ...this.preferences } };
  }

  private assertCanTransact(body: Record<string, any>): void {
    this.expireJobs();
    if (body.save_epoch !== undefined && body.save_epoch !== this.saveEpoch) {
      throw new HttpError(409, '存档已更新，请刷新后重试');
    }
    const busy = Object.values(this.jobs).some((j) => ['queued', 'generating', 'validating'].includes(j.status));
    if (busy) throw new HttpError(409, '当前仍有推演在进行，请稍后操作');
    const row = this.currentSegment();
    const prog = this.getPlayback(row);
    if (row && !prog.completed) {
      throw new HttpError(409, '请先演播完本段再执行事务');
    }
  }

  getShopView(): Record<string, any> {
    this.expireJobs();
    const catalog = this.getShopCatalog();
    const points = Number(this.saveState.panels?.['系统宿主']?.['积分'] ?? 0);
    const shopState = this.saveState.shop || { redeemed: {}, recent: [], echoes: [] };
    const row = this.currentSegment();
    const prog = this.getPlayback(row);
    const busy = Object.values(this.jobs).some((j) => ['queued', 'generating', 'validating'].includes(j.status));
    const canTransact = !busy && (row === null || prog.completed);
    const items = (catalog.items || []).map((item: any) => {
      const bought = Number(shopState.redeemed?.[item.id] || 0);
      const cap = item.max_per_save ?? null;
      const remaining = cap === null ? null : Math.max(0, cap - bought);
      return {
        ...item,
        redeemed_count: bought,
        remaining,
        sold_out: cap !== null && bought >= cap,
        affordable: points >= Number(item.price || 0),
      };
    });
    return {
      version: catalog.version || 1,
      tiers: catalog.tiers || {},
      items,
      points,
      recent: [...(shopState.recent || [])],
      can_transact: canTransact,
      busy,
      revision: this.getRevision(),
      save_epoch: this.saveEpoch,
    };
  }

  redeemShopItem(body: Record<string, any>): Record<string, any> {
    const { request_id, item_id } = body || {};
    if (typeof request_id !== 'string' || !request_id) throw new HttpError(400, '缺少请求编号');
    if (this.receipts[request_id]) {
      return { status: 'committed', receipt: this.receipts[request_id], replayed: true, snapshot: this.getLiveSnapshot() };
    }
    this.assertCanTransact(body);
    const catalog = this.getShopCatalog();
    const item = (catalog.items || []).find((i: any) => i.id === item_id);
    if (!item) throw new HttpError(400, '商城中未找到该商品');

    const shopState = (this.saveState.shop ||= { redeemed: {}, recent: [], echoes: [] });
    const bought = Number(shopState.redeemed[item.id] || 0);
    if (item.max_per_save !== null && item.max_per_save !== undefined && bought >= item.max_per_save) {
      throw new HttpError(400, '该商品已达到本档限购上限');
    }
    const hostPanel = this.saveState.panels['系统宿主'];
    const points = Number(hostPanel['积分'] ?? 0);
    const price = Number(item.price || 0);
    if (points < price) {
      throw new HttpError(400, `积分不足（当前 ${points}，需要 ${price}）`);
    }

    hostPanel['积分'] = points - price;
    shopState.redeemed[item.id] = bought + 1;
    const recentEntry = `${item.id} ${item.name} (-${price}积分)`;
    shopState.recent = [recentEntry, ...(shopState.recent || [])].slice(0, 12);

    const active = (this.saveState.items.active ||= []);
    const existing = active.find((x: any) => x.name === item.name && x.status === '仓库中');
    if (existing) {
      existing.quantity = Number(existing.quantity || 1) + 1;
    } else {
      const seq = Number(this.saveState.items.next_seq || 1);
      this.saveState.items.next_seq = seq + 1;
      active.push({
        id: `ITEM-${String(seq).padStart(3, '0')}`,
        name: item.name,
        type: item.type || '永久性',
        desc: item.desc || '',
        quantity: 1,
        obtained_round: Number(this.saveState.runtime?.memory_round || 1),
        status: '仓库中',
        location: item.type === '永久性' ? '随身' : '无',
        target: '未使用',
        duration: item.duration || '无',
        remaining_turns: null,
        expire_rule: item.expire_rule || '无',
        usage_log: '商城兑换',
        remark: `来源：系统商城 ${item.id}`,
        system_effect: item.system_effect || '',
        giftable: item.giftable !== false,
      });
    }

    this.stateVersion += 1;
    this.dataSnapshot.state_version = this.stateVersion;
    const receipt = {
      request_id,
      revision: this.getRevision(),
      state_version: this.stateVersion,
      kind: 'shop_redeem',
      item_id: item.id,
      item_name: item.name,
      cost_points: price,
    };
    this.receipts[request_id] = receipt;
    this.persistSave();
    this.hub.publish('committed', { request_id, kind: 'shop_redeem' });
    return { status: 'committed', receipt, replayed: false, snapshot: this.getLiveSnapshot() };
  }

  claimTaskReward(body: Record<string, any>): Record<string, any> {
    const { request_id } = body || {};
    if (typeof request_id !== 'string' || !request_id) throw new HttpError(400, '缺少请求编号');
    if (this.receipts[request_id]) {
      return { status: 'committed', receipt: this.receipts[request_id], replayed: true, snapshot: this.getLiveSnapshot() };
    }
    this.assertCanTransact(body);
    const pending: string[] = this.saveState.tasks?.pending_items || [];
    if (pending.length === 0) throw new HttpError(400, '当前没有待领取的委托奖励');
    const head = pending.shift()!;
    const parts = head.split('|').map((s) => s.trim());
    const taskId = parts[0] || 'TASK';
    const desc = parts[1] || '委托奖励道具';
    const seq = Number(this.saveState.items.next_seq || 1);
    this.saveState.items.next_seq = seq + 1;
    this.saveState.items.active.push({
      id: `ITEM-${String(seq).padStart(3, '0')}`,
      name: desc,
      type: '永久性',
      desc: `委托 ${taskId} 完成奖励`,
      quantity: 1,
      obtained_round: Number(this.saveState.runtime?.memory_round || 1),
      status: '仓库中',
      location: '随身',
      target: '未使用',
      duration: '无',
      remaining_turns: null,
      expire_rule: '无',
      usage_log: `领取自 ${taskId}`,
      remark: head,
      system_effect: '',
      giftable: true,
    });
    this.stateVersion += 1;
    this.dataSnapshot.state_version = this.stateVersion;
    const receipt = {
      request_id,
      revision: this.getRevision(),
      state_version: this.stateVersion,
      kind: 'task_claim',
      claimed: head,
    };
    this.receipts[request_id] = receipt;
    this.persistSave();
    this.hub.publish('committed', { request_id, kind: 'task_claim' });
    return { status: 'committed', receipt, replayed: false, snapshot: this.getLiveSnapshot() };
  }

  upgradePassive(body: Record<string, any>): Record<string, any> {
    const { request_id, target } = body || {};
    if (typeof request_id !== 'string' || !request_id) throw new HttpError(400, '缺少请求编号');
    if (this.receipts[request_id]) {
      return { status: 'committed', receipt: this.receipts[request_id], replayed: true, snapshot: this.getLiveSnapshot() };
    }
    this.assertCanTransact(body);
    if (!HEROINES.includes(target)) throw new HttpError(400, '被动升级目标无效');
    const charPanel = this.saveState.panels[target];
    const currentLv = Number(charPanel['被动'] ?? 0);
    const nextLv = currentLv + 1;
    const tiers = this.getPassiveTiers();
    const tier = tiers.find((t) => t.level === nextLv);
    if (!tier) throw new HttpError(400, `${target} 的被动已达最高等级`);
    const hostPanel = this.saveState.panels['系统宿主'];
    const exp = Number(hostPanel['经验值'] ?? 0);
    if (exp < tier.cost) {
      throw new HttpError(400, `经验值不足（当前 ${exp}，升级至 ${tier.tag} 需要 ${tier.cost}）`);
    }
    hostPanel['经验值'] = exp - tier.cost;
    charPanel['被动'] = nextLv;
    this.stateVersion += 1;
    this.dataSnapshot.state_version = this.stateVersion;
    const receipt = {
      request_id,
      revision: this.getRevision(),
      state_version: this.stateVersion,
      kind: 'passive_upgrade',
      target,
      from_level: currentLv,
      to_level: nextLv,
      cost_exp: tier.cost,
    };
    this.receipts[request_id] = receipt;
    this.persistSave();
    this.hub.publish('committed', { request_id, kind: 'passive_upgrade' });
    return { status: 'committed', receipt, replayed: false, snapshot: this.getLiveSnapshot() };
  }

  acquireIntel(body: Record<string, any>): Record<string, any> {
    const { request_id, intel_id } = body || {};
    if (typeof request_id !== 'string' || !request_id) throw new HttpError(400, '缺少请求编号');
    if (this.receipts[request_id]) {
      return { status: 'committed', receipt: this.receipts[request_id], replayed: true, snapshot: this.getLiveSnapshot() };
    }
    this.assertCanTransact(body);
    const catalog = this.getIntelCatalog();
    const item = (catalog.items || []).find((x: any) => x.id === intel_id);
    if (!item) throw new HttpError(400, '商业情报不存在');
    const intel = (this.saveState.intel ||= { held: [], consumed: [], su_ab_contacts: 0, leverage_armed: '' });
    if (intel.held.includes(intel_id) || intel.consumed.includes(intel_id)) {
      throw new HttpError(400, '该商业情报已获取或已消耗');
    }
    const biz = Number(this.saveState.panels['系统宿主']?.['商业嗅觉'] ?? 0);
    if (biz < Number(item.min_biz || 0)) {
      throw new HttpError(400, `商业嗅觉不足（需达到 ${item.min_biz}）`);
    }
    if (Number(intel.su_ab_contacts || 0) < Number(item.min_su_ab_contacts || 0)) {
      throw new HttpError(400, `与苏婉青接触次数不足（需达到 ${item.min_su_ab_contacts}）`);
    }
    intel.held.push(intel_id);
    this.stateVersion += 1;
    this.dataSnapshot.state_version = this.stateVersion;
    const receipt = {
      request_id,
      revision: this.getRevision(),
      state_version: this.stateVersion,
      kind: 'intel_acquire',
      intel_id,
      name: item.name,
    };
    this.receipts[request_id] = receipt;
    this.persistSave();
    this.hub.publish('committed', { request_id, kind: 'intel_acquire' });
    return { status: 'committed', receipt, replayed: false, snapshot: this.getLiveSnapshot() };
  }

  toggleLeverage(body: Record<string, any>): Record<string, any> {
    const { request_id, armed, intel_id } = body || {};
    if (typeof request_id !== 'string' || !request_id) throw new HttpError(400, '缺少请求编号');
    if (this.receipts[request_id]) {
      return { status: 'committed', receipt: this.receipts[request_id], replayed: true, snapshot: this.getLiveSnapshot() };
    }
    this.assertCanTransact(body);
    const catalog = this.getIntelCatalog();
    const intel = (this.saveState.intel ||= { held: [], consumed: [], su_ab_contacts: 0, leverage_armed: '' });
    if (armed) {
      const biz = Number(this.saveState.panels['系统宿主']?.['商业嗅觉'] ?? 0);
      const minBiz = Number(catalog.leverage_min_biz ?? 60);
      if (biz < minBiz) throw new HttpError(400, `开启商业杠杆需商业嗅觉达到 ${minBiz}`);
      const chosen = typeof intel_id === 'string' && intel_id ? intel_id : intel.held[0];
      if (!chosen || !intel.held.includes(chosen)) throw new HttpError(400, '需持有至少一条可用商业情报');
      intel.leverage_armed = chosen;
    } else {
      intel.leverage_armed = '';
    }
    this.stateVersion += 1;
    this.dataSnapshot.state_version = this.stateVersion;
    const receipt = {
      request_id,
      revision: this.getRevision(),
      state_version: this.stateVersion,
      kind: 'business_leverage',
      leverage_armed: intel.leverage_armed,
    };
    this.receipts[request_id] = receipt;
    this.persistSave();
    this.hub.publish('committed', { request_id, kind: 'business_leverage' });
    return { status: 'committed', receipt, replayed: false, snapshot: this.getLiveSnapshot() };
  }

  createTask(body: Record<string, any>): Record<string, any> {
    this.expireJobs();
    const { request_id, base_revision, action, entry_mode, selection, operation, save_epoch } = body || {};
    if (typeof request_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(request_id)) {
      throw new HttpError(400, '请求编号无效');
    }
    if (this.jobs[request_id]) {
      return { task: this.publicJob(this.jobs[request_id]), replayed: true };
    }
    if (save_epoch !== undefined && save_epoch !== this.saveEpoch) {
      throw new HttpError(409, '存档已变更，请刷新后重试');
    }
    const active = Object.values(this.jobs).find((j) => ['queued', 'generating', 'validating'].includes(j.status));
    if (active) {
      throw new HttpError(409, '上一条行动尚未完成，请等待或取消后再提交');
    }

    // Synchronous recovery item handling (0 cost, instant commit)
    if (operation && operation.code === 'use_recovery_item') {
      const itemId = String(operation.item_id || '');
      const activeList: any[] = this.saveState.items?.active || [];
      const idx = activeList.findIndex((x) => x.id === itemId);
      if (idx === -1) throw new HttpError(400, '未找到该恢复道具');
      const item = activeList[idx];
      const match = /^host_stamina:(\d+)$/.exec(String(item.system_effect || '').trim());
      if (!match) throw new HttpError(400, '该道具未登记体力恢复效果');
      const gain = Number(match[1]);
      const recovered = Number(this.saveState.runtime?.item_recovered || 0);
      const budgetLeft = Math.max(0, 20 - recovered);
      if (budgetLeft <= 0) throw new HttpError(400, '当夜免费恢复额度（20点）已用尽');
      const actualGain = Math.min(gain, budgetLeft);
      const host = this.saveState.panels['系统宿主'];
      host['体力'] = Math.min(100, Number(host['体力'] ?? 0) + actualGain);
      this.saveState.runtime.item_recovered = recovered + actualGain;
      item.quantity = Number(item.quantity || 1) - 1;
      if (item.quantity <= 0) {
        activeList.splice(idx, 1);
        this.saveState.items.history.push({ ...item, status: '已消耗' });
      }
      this.stateVersion += 1;
      this.dataSnapshot.state_version = this.stateVersion;
      const receipt = {
        request_id,
        revision: this.getRevision(),
        state_version: this.stateVersion,
        status: 'committed',
        recovered: actualGain,
      };
      const job: StoryJob = {
        request_id,
        base_revision: String(base_revision || ''),
        action: String(action || ''),
        entry_mode: String(entry_mode || 'live_interaction'),
        selection: selection || null,
        operation,
        status: 'committed',
        error: '',
        lease: null,
        lease_until: 0,
        reservation: { status: 'settled', quote: { cost: 0, tier: 'ITEM' } },
        receipt,
        created_at: Date.now() / 1000,
      };
      this.jobs[request_id] = job;
      this.latestJobId = request_id;
      this.persistSave();
      this.hub.publish('committed', { request_id, status: 'committed' });
      return { task: this.publicJob(job), replayed: false };
    }

    const optId = String(selection?.option_id || 'CUSTOM').toUpperCase();
    const tier = ['A', 'B', 'C', 'REST', 'BEGIN'].includes(optId) ? optId : 'CUSTOM';
    const cost = COSTS[tier] ?? 15;
    const hostPanel = this.saveState.panels['系统宿主'];
    const currentStamina = Number(hostPanel['体力'] ?? 100);
    if (cost > 0 && currentStamina < cost) {
      throw new HttpError(400, `体力不足（当前 ${currentStamina}，该行动需 ${cost}）`);
    }
    if (cost > 0) {
      hostPanel['体力'] = currentStamina - cost;
    }

    const job: StoryJob = {
      request_id,
      base_revision: String(base_revision || this.getRevision()),
      action: String(action || ''),
      entry_mode: String(entry_mode || 'live_interaction'),
      selection: selection || null,
      operation: operation || null,
      status: 'queued',
      error: '',
      lease: null,
      lease_until: 0,
      reservation: { status: 'held', quote: { cost, tier } },
      receipt: null,
      created_at: Date.now() / 1000,
    };
    this.jobs[request_id] = job;
    this.latestJobId = request_id;
    this.persistSave();
    this.hub.publish('task_state', { request_id, status: 'queued' }, true);
    return { task: this.publicJob(job), replayed: false };
  }

  cancelTask(requestId: string): Record<string, any> {
    const job = this.jobs[requestId];
    if (!job) throw new HttpError(404, '任务不存在');
    if (job.status === 'committed') throw new HttpError(409, '该行动已提交，无法取消');
    if (job.reservation && job.reservation.status === 'held') {
      const refund = Number(job.reservation.quote?.cost || 0);
      if (refund > 0) {
        const host = this.saveState.panels['系统宿主'];
        host['体力'] = Math.min(100, Number(host['体力'] ?? 0) + refund);
      }
      job.reservation.status = 'refunded';
    }
    job.status = 'cancelled';
    job.error = '已取消并退还预扣体力。';
    job.lease = null;
    delete this.streamPreview[requestId];
    this.persistSave();
    this.hub.publish('task_state', { request_id: requestId, status: 'cancelled' });
    return { task: this.publicJob(job) };
  }

  retryTask(requestId: string): Record<string, any> {
    const job = this.jobs[requestId];
    if (!job) throw new HttpError(404, '任务不存在');
    if (!['failed', 'interrupted', 'conflict', 'cancelled'].includes(job.status)) {
      throw new HttpError(409, '当前任务状态不可重试');
    }
    if (job.reservation && job.reservation.status === 'refunded') {
      const cost = Number(job.reservation.quote?.cost || 0);
      const host = this.saveState.panels['系统宿主'];
      const cur = Number(host['体力'] ?? 0);
      if (cur < cost) throw new HttpError(400, `体力不足（当前 ${cur}，重试需 ${cost}）`);
      host['体力'] = cur - cost;
      job.reservation.status = 'held';
    }
    job.status = 'queued';
    job.error = '';
    job.lease = null;
    job.lease_until = 0;
    this.latestJobId = requestId;
    this.persistSave();
    this.hub.publish('task_state', { request_id: requestId, status: 'queued' }, true);
    return { task: this.publicJob(job) };
  }

  bridgeControl(body: Record<string, any>): Record<string, any> {
    const action = body?.action;
    const valid = [
      'start',
      'stop',
      'reset_session',
      'session_policy',
      'dual_stage',
      'settlement_slot',
      'settlement_thinking',
      'primary_model',
      'bind_function_slot',
      'max_turns',
    ];
    if (typeof action !== 'string' || !valid.includes(action)) {
      throw new HttpError(400, '桥接控制操作无效');
    }
    const { action: _a, ...rest } = body;
    this.bridgeControlCmd = {
      id: crypto.randomBytes(16).toString('hex'),
      action,
      issued_at: Date.now() / 1000,
      status: 'requested',
      ...rest,
    };
    this.hub.publish('bridge_control', { action }, true);
    return this.getStatus();
  }

  workerControl(body: Record<string, any>): Record<string, any> {
    if (!body || typeof body.runtime !== 'object') throw new HttpError(400, '桥接状态无效');
    const monitor: Record<string, any> = { ...body.runtime, received_at: Date.now() / 1000 };
    this.bridgeMonitor = monitor;
    if (this.bridgeControlCmd && this.bridgeControlCmd.id === body.ack_id && this.bridgeControlCmd.status === 'requested') {
      this.bridgeControlCmd.status = body.ack_error ? 'failed' : 'applied';
      this.bridgeControlCmd.completed_at = Date.now() / 1000;
      if (body.ack_error) this.bridgeControlCmd.error = String(body.ack_error);
    }
    this.hub.publish('bridge_state', { phase: monitor.phase, running: monitor.running });
    const pending = this.getBridgeView().control;
    return {
      command: pending && pending.status === 'requested' ? pending : null,
      story_protocol: 2,
      service_epoch: this.serviceEpoch,
    };
  }

  hasPendingWorkerWork(): { has_task: boolean; has_control: boolean } {
    this.expireJobs();
    const has_task = Object.values(this.jobs).some((j) => j.status === 'queued');
    const cmd = this.getBridgeView().control;
    const has_control = Boolean(cmd && cmd.status === 'requested');
    return { has_task, has_control };
  }

  claimWorkerJob(): Record<string, any> {
    this.expireJobs();
    const queued = Object.values(this.jobs).find((j) => j.status === 'queued');
    if (!queued) return { task: null };
    queued.status = 'generating';
    queued.lease = crypto.randomBytes(16).toString('hex');
    queued.lease_until = Date.now() / 1000 + 120;
    this.hub.publish('task_state', { request_id: queued.request_id, status: 'generating' });
    return {
      task: {
        ...this.publicJob(queued),
        lease: queued.lease,
      },
      service_epoch: this.serviceEpoch,
    };
  }

  heartbeatWorkerJob(key: string, lease: string): Record<string, any> {
    const job = this.jobs[key];
    if (!job || job.lease !== lease) throw new HttpError(409, '租约无效或已过期');
    job.lease_until = Date.now() / 1000 + 120;
    return { ok: true, lease_until: job.lease_until };
  }

  streamWorkerPreview(key: string, body: Record<string, any>): Record<string, any> {
    const job = this.jobs[key];
    if (!job || job.lease !== body?.lease || job.status !== 'generating') {
      throw new HttpError(409, '无效的流式预览租约');
    }
    const prev = this.streamPreview[key];
    const rev = Number(body.revision ?? 0);
    if (prev && rev < Number(prev.revision ?? 0)) return { ok: true, ignored: true };
    this.streamPreview[key] = {
      request_id: key,
      stage: String(body.stage || 'streaming'),
      messages: Array.isArray(body.messages) ? body.messages : [],
      revision: rev,
      updated_at: Date.now(),
    };
    this.hub.publish('story_stream', this.streamPreview[key]);
    return { ok: true };
  }
}
