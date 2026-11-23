import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './storyEngine.ts';

export const FISH_BASE_URL = 'https://api.fish.audio';
export const FISH_FREE_TTS_MODEL = 's2.1-pro-free';
export const VOICED_HEROINES = ['沈知韫', '苏婉青', '徐念薇'] as const;

export const FISH_ACOUSTIC_ALIASES: Record<string, string> = {
  低声: 'low restrained voice',
  压低声音: 'low hushed voice',
  轻声: 'soft gentle voice',
  耳语: 'near whisper',
  克制: 'cool restrained voice',
  冷淡: 'cool detached voice',
  平静: 'calm steady voice',
  轻叹: 'soft sigh',
  轻笑: 'soft chuckle',
  微颤: 'trembling voice',
  停顿: 'breath catches',
  急促: 'hurried breathless voice',
  哽咽: 'soft sobbing',
  喘息: 'heavy breathing',
  疲惫: 'exhausted',
  敷衍: 'guarded dismissive tone',
};

export const FISH_TTS_MODELS = [
  { id: 's2.1-pro-free', name: 'S2.1 Pro Free（同质零费用主力 · 推荐）' },
  { id: 's2.1-pro', name: 'S2.1 Pro（付费稳定生产档 · $15/M字节）' },
  { id: 'drama-3', name: 'Drama 3（高消费旗舰导演 · 原价$50/M字节）' },
  { id: 's2-pro', name: 'S2 Pro（上一代开源 S2）' },
];

export const VOICE_TIERS: Record<string, { heroine_model: string; narrator_model: string; label: string }> = {
  free: {
    heroine_model: 's2.1-pro-free',
    narrator_model: 's2.1-pro-free',
    label: '标准免费档（推荐 · $0）',
  },
  pro: {
    heroine_model: 's2.1-pro',
    narrator_model: 's2.1-pro-free',
    label: '稳定生产档（三女主 $15/M字节 · 旁白免费）',
  },
  drama: {
    heroine_model: 'drama-3',
    narrator_model: 's2.1-pro-free',
    label: '旗舰导演档（三女主 Drama 3 高消费 · 旁白免费）',
  },
};

export const EDGE_DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
export const EDGE_FALLBACK_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女 · 温暖自然 · zh-CN)' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女 · 柔和清新 · zh-CN)' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男 · 沉稳阳光 · zh-CN)' },
  { id: 'zh-CN-YunjianNeural', name: '云健 (男 · 播音旁白 · zh-CN)' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女 · 知性沉静 · zh-CN)' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵 (女 · 细腻情感 · zh-CN)' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦 (女 · 柔和甜美 · zh-CN)' },
];

export function maskFishKey(key: string): string {
  const s = String(key || '').trim();
  if (!s) return '';
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

export function translateFishAcousticTags(text: string): string {
  return String(text || '').replace(/\[([^\]]{1,60})\]/g, (whole, inner: string) => {
    const raw = String(inner || '').trim();
    if (!raw || !/[\u4e00-\u9fff]/.test(raw)) return whole;
    const parts = raw
      .split(/[,，、/|]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return whole;
    const mapped = parts.map((part) => FISH_ACOUSTIC_ALIASES[part] || part);
    return `[${mapped.join(', ')}]`;
  });
}

export function stripSubtextForTts(text: string): string {
  const cleaned = String(text || '')
    .replace(/[｛{]([^｜|}\r\n]+)[｜|]([^｝}\r\n]+)[｝}]/g, '$1')
    .replace(/[【】*]/g, '')
    .trim();
  return translateFishAcousticTags(cleaned);
}

interface TtsCacheEntry {
  buffer: Buffer;
  mime: string;
  size: number;
}

export class VoiceManager {
  readonly root: string;
  readonly configPath: string;
  readonly keyCachePath: string;
  readonly repoPath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxCacheEntries = 48;
  private readonly maxCacheBytes = 24 * 1024 * 1024;
  private ttsCache = new Map<string, TtsCacheEntry>();
  private ttsCacheBytes = 0;
  private inFlight = new Map<string, Promise<{ buffer: Buffer; mime: string }>>();

  constructor(rootDir: string, fetchImpl: typeof fetch = fetch) {
    this.root = path.resolve(rootDir);
    this.configPath = path.join(this.root, 'voice_config.json');
    this.keyCachePath = path.join(this.root, '.cache', 'fish_api_key.json');
    this.repoPath = path.join(this.root, '语音仓库', 'voice_repo.json');
    this.fetchImpl = fetchImpl;
  }

  private writeJsonAtomic(filePath: string, data: unknown, mode?: number): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 4) + '\n', { encoding: 'utf-8', mode });
    fs.renameSync(tmp, filePath);
  }

  resolveFishKey(): { key: string; source: 'local_cache' | 'env' | 'none' } {
    try {
      if (fs.existsSync(this.keyCachePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.keyCachePath, 'utf-8'));
        const cached = String(parsed?.api_key || '').trim();
        if (cached) return { key: cached, source: 'local_cache' };
      }
    } catch {
      // fall through to env
    }
    const envKey = String(process.env.FISH_API_KEY || '').trim();
    if (envKey) return { key: envKey, source: 'env' };
    return { key: '', source: 'none' };
  }

  getFishKeyStatus(): Record<string, any> {
    const { key, source } = this.resolveFishKey();
    return {
      configured: Boolean(key),
      masked: maskFishKey(key),
      source,
      cache_path: '.cache/fish_api_key.json',
    };
  }

  saveFishKey(rawKey: string): string {
    const cleaned = String(rawKey || '').trim();
    if (!cleaned || cleaned.length < 8 || cleaned.length > 256 || /\s/.test(cleaned)) {
      throw new HttpError(400, 'Fish API Key 格式无效');
    }
    this.writeJsonAtomic(this.keyCachePath, { api_key: cleaned, updated_at: Date.now() }, 0o600);
    return cleaned;
  }

  clearFishKey(): Record<string, any> {
    try {
      if (fs.existsSync(this.keyCachePath)) fs.unlinkSync(this.keyCachePath);
    } catch {
      throw new HttpError(503, '清除本地密钥缓存失败');
    }
    const { key, source } = this.resolveFishKey();
    return {
      status: 'success',
      msg: '已清除本地缓存密钥' + (key ? '（当前仍检测到环境变量回退）' : '。'),
      configured: Boolean(key),
      masked: maskFishKey(key),
      source,
    };
  }

  loadConfig(): Record<string, any> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { __settings__: { fish_tts_model: FISH_FREE_TTS_MODEL, voice_tier: 'free' }, default: { voice: 'fish:' } };
      }
      const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid config');
      parsed.__settings__ ||= { fish_tts_model: FISH_FREE_TTS_MODEL, voice_tier: 'free' };
      return parsed;
    } catch {
      throw new HttpError(503, 'voice_config.json 读取失败或格式损坏');
    }
  }

  saveConfig(payload: any): Record<string, any> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, '配置必须是 JSON 对象');
    }
    const cleaned: Record<string, any> = structuredClone(payload);
    for (const [k, v] of Object.entries(cleaned)) {
      if (k !== '__settings__' && v && typeof v === 'object' && !Array.isArray(v)) {
        (v as Record<string, any>).emotion = '';
      }
    }
    cleaned.__settings__ ||= { fish_tts_model: FISH_FREE_TTS_MODEL, voice_tier: 'free' };
    this.writeJsonAtomic(this.configPath, cleaned);
    return cleaned;
  }

  setVoiceTier(tierRaw: string): Record<string, any> {
    const tier = String(tierRaw || '').trim().toLowerCase();
    const spec = VOICE_TIERS[tier];
    if (!spec) throw new HttpError(400, '不支持的语音档位，仅允许 free / pro / drama。');
    const cfg = this.loadConfig();
    cfg.__settings__ ||= {};
    cfg.__settings__.fish_tts_model = spec.heroine_model;
    cfg.__settings__.voice_tier = tier;
    for (const heroine of VOICED_HEROINES) {
      if (cfg[heroine] && typeof cfg[heroine] === 'object' && !String(cfg[heroine].voice || '').startsWith('edge:')) {
        cfg[heroine].tts_model = spec.heroine_model;
      }
    }
    if (cfg['旁白'] && typeof cfg['旁白'] === 'object' && !String(cfg['旁白'].voice || '').startsWith('edge:')) {
      cfg['旁白'].tts_model = spec.narrator_model;
    }
    if (cfg.default && typeof cfg.default === 'object' && !String(cfg.default.voice || '').startsWith('edge:')) {
      cfg.default.tts_model = FISH_FREE_TTS_MODEL;
    }
    const cleaned = this.saveConfig(cfg);
    return { status: 'success', tier, msg: `已切换至 ${spec.label}`, config: cleaned };
  }

  getVoiceRepo(): { items: any[]; count: number } {
    try {
      if (!fs.existsSync(this.repoPath)) return { items: [], count: 0 };
      const parsed = JSON.parse(fs.readFileSync(this.repoPath, 'utf-8'));
      const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
      return { items, count: items.length };
    } catch {
      return { items: [], count: 0 };
    }
  }

  addVoiceRepo(body: Record<string, any>): Record<string, any> {
    const id = String(body?.id || '').trim();
    if (!id || id.length > 128) throw new HttpError(400, '音色 ID 无效');
    const repo = this.getVoiceRepo();
    if (repo.items.some((x: any) => x.id === id)) throw new HttpError(409, '该音色已在收藏列表中');
    const entry = {
      id,
      name: String(body?.name || id).trim().slice(0, 80),
      note: String(body?.note || '').trim().slice(0, 200),
      added_at: Date.now(),
    };
    const next = [...repo.items, entry];
    this.writeJsonAtomic(this.repoPath, { items: next });
    return { status: 'success', item: entry, items: next, count: next.length };
  }

  deleteVoiceRepo(idRaw: string): Record<string, any> {
    const id = String(idRaw || '').trim();
    if (!id) throw new HttpError(400, '缺少音色 ID');
    const repo = this.getVoiceRepo();
    const next = repo.items.filter((x: any) => x.id !== id);
    this.writeJsonAtomic(this.repoPath, { items: next });
    return { status: 'success', items: next, count: next.length };
  }

  async fetchFishVoices(search: string): Promise<Record<string, any>> {
    const { key } = this.resolveFishKey();
    const cfg = this.loadConfig();
    const ttsModel = String(cfg.__settings__?.fish_tts_model || FISH_FREE_TTS_MODEL);
    if (!key) {
      return { voices: [], error: 'missing FISH_API_KEY', tts_model: ttsModel, tts_models: FISH_TTS_MODELS };
    }
    try {
      const qs = new URLSearchParams({ page_size: '50' });
      if (search) qs.set('title', search.slice(0, 80));
      else qs.set('sort_by', 'task_count');
      const res = await fetch(`${FISH_BASE_URL}/model?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      const rawItems = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
      const voices = rawItems
        .map((m: any) => ({ id: String(m._id || m.id || ''), name: String(m.title || m.name || m._id || '') }))
        .filter((v: any) => v.id);
      return {
        voices,
        provider: 'fish',
        search,
        count: voices.length,
        mode: search ? 'search' : 'default',
        tts_model: ttsModel,
        tts_models: FISH_TTS_MODELS,
      };
    } catch {
      return { voices: [], provider: 'fish', search, count: 0, mode: search ? 'search' : 'default', tts_model: ttsModel, tts_models: FISH_TTS_MODELS };
    }
  }

  async fetchFishWallet(): Promise<Record<string, any>> {
    const { key } = this.resolveFishKey();
    if (!key) return { ok: false, error: 'missing FISH_API_KEY' };
    try {
      const [pkgRes, creditRes] = await Promise.all([
        fetch(`${FISH_BASE_URL}/wallet/self/package`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null),
        fetch(`${FISH_BASE_URL}/wallet/self/api-credit?check_free_credit=true`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null),
      ]);
      const pkg = pkgRes && pkgRes.ok ? await pkgRes.json().catch(() => null) : null;
      const credit = creditRes && creditRes.ok ? await creditRes.json().catch(() => null) : null;
      const warnings: string[] = [];
      if (!pkg) warnings.push('套餐查询失败（网络或限流），不影响 TTS 生成');
      if (!credit) warnings.push('API Credit 查询失败（网络或限流），不影响 TTS 生成');
      return { ok: warnings.length === 0, package: pkg, api_credit: credit, warnings };
    } catch {
      return { ok: false, error: 'Fish Audio 钱包查询超时', warnings: ['钱包查询超时'] };
    }
  }

  private getCache(key: string): { buffer: Buffer; mime: string } | null {
    const hit = this.ttsCache.get(key);
    if (!hit) return null;
    // Refresh LRU order
    this.ttsCache.delete(key);
    this.ttsCache.set(key, hit);
    return { buffer: hit.buffer, mime: hit.mime };
  }

  private putCache(key: string, buffer: Buffer, mime: string): void {
    const size = buffer.byteLength;
    if (size === 0 || size > this.maxCacheBytes) return;
    const prev = this.ttsCache.get(key);
    if (prev) {
      this.ttsCacheBytes -= prev.size;
      this.ttsCache.delete(key);
    }
    this.ttsCache.set(key, { buffer, mime, size });
    this.ttsCacheBytes += size;
    while (this.ttsCache.size > this.maxCacheEntries || this.ttsCacheBytes > this.maxCacheBytes) {
      const oldestKey = this.ttsCache.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.ttsCache.get(oldestKey);
      this.ttsCache.delete(oldestKey);
      if (oldest) this.ttsCacheBytes -= oldest.size;
    }
  }

  getCacheStats(): { entries: number; bytes: number; inFlight: number } {
    return { entries: this.ttsCache.size, bytes: this.ttsCacheBytes, inFlight: this.inFlight.size };
  }

  async synthesizeTts(params: Record<string, any>): Promise<{ buffer: Buffer; mime: string; cacheHit?: boolean }> {
    const cleanText = stripSubtextForTts(String(params.text || ''));
    if (!cleanText) throw new HttpError(400, '合成文本为空');
    const { key } = this.resolveFishKey();
    if (!key) {
      throw new HttpError(503, '未配置 FISH_API_KEY，请在声学工坊或环境变量中设置后再试听语音。');
    }
    const cfg = this.loadConfig();
    const speaker = String(params.speaker || '').trim();
    const charCfg = (speaker && cfg[speaker]) || cfg.default || {};
    const voiceRaw = String(params.voice || charCfg.voice || '').trim();
    const refId = voiceRaw.startsWith('fish:') ? voiceRaw.slice(5).trim() : voiceRaw;
    const model = String(params.tts_model || charCfg.tts_model || cfg.__settings__?.fish_tts_model || FISH_FREE_TTS_MODEL);
    const mp3Bitrate = Number(params.mp3_bitrate || charCfg.mp3_bitrate || 128);
    const latency = String(params.latency || charCfg.latency || 'balanced');
    const speed = Number(params.speed ?? charCfg.speed ?? 1);
    const emotion = String(params.emotion || '').trim();

    const cacheKey = crypto
      .createHash('sha256')
      .update(JSON.stringify([speaker, model, refId, cleanText, mp3Bitrate, latency, speed, emotion]))
      .digest('hex');

    const cached = this.getCache(cacheKey);
    if (cached) return { ...cached, cacheHit: true };

    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const payload: Record<string, any> = {
      text: cleanText,
      format: 'mp3',
      mp3_bitrate: mp3Bitrate,
      normalize: true,
      latency,
    };
    if (refId) payload.reference_id = refId;

    const task = (async () => {
      const upstream = await this.fetchImpl(`${FISH_BASE_URL}/v1/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          model,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      if (!upstream.ok) {
        throw new HttpError(upstream.status === 429 ? 429 : 502, `Fish Audio 合成失败 (HTTP ${upstream.status})`);
      }
      const arr = await upstream.arrayBuffer();
      const buffer = Buffer.from(arr);
      const mime = 'audio/mpeg';
      this.putCache(cacheKey, buffer, mime);
      return { buffer, mime };
    })();

    this.inFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      if (this.inFlight.get(cacheKey) === task) this.inFlight.delete(cacheKey);
    }
  }

  async prefetchBatch(items: Array<Record<string, any>>): Promise<{ prefetched: number; skipped: number }> {
    const { key } = this.resolveFishKey();
    if (!key || !Array.isArray(items) || !items.length) {
      return { prefetched: 0, skipped: Array.isArray(items) ? items.length : 0 };
    }
    const queue = items.slice(0, 6);
    let prefetched = 0;
    let skipped = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const idx = cursor++;
        const item = queue[idx];
        try {
          if (!item || !String(item.text || '').trim()) {
            skipped += 1;
            continue;
          }
          await this.synthesizeTts(item);
          prefetched += 1;
        } catch {
          skipped += 1;
        }
      }
    };
    await Promise.all([worker(), worker()]);
    return { prefetched, skipped };
  }
}
