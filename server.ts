import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, StoryEngine, scanVisualAssets } from './src/lib/storyEngine.ts';
import { EDGE_DEFAULT_VOICE, EDGE_FALLBACK_VOICES, VoiceManager } from './src/lib/voiceConfig.ts';
import { SceneService } from './src/lib/sceneService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const PUBLIC_FILES = new Set([
  'main_template.html',
  'voice_manager.html',
  'voice_client.js',
  'data.json',
  'story_client.js',
  'story_client.css',
  '存档/全局记忆库.txt',
  '存档/徐志北道具图鉴.txt',
]);

const NO_CACHE_FILES = new Set([
  'main_template.html',
  'voice_manager.html',
  'voice_client.js',
  'story_client.js',
  'story_client.css',
  'data.json',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

export function createApp(rootDir: string = ROOT_DIR) {
  const app = express();
  const story = new StoryEngine(rootDir);
  const voice = new VoiceManager(rootDir);
  const scene = new SceneService(rootDir, story);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  app.use('/api/story', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // =========================================================
  // Story & Progression API (/api/story/*)
  // =========================================================

  app.get('/api/story/live', (req, res, next) => {
    try {
      const before = typeof req.query.before === 'string' ? req.query.before : null;
      res.json(story.getLiveSnapshot(before));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/stream', (req, res) => {
    const rawSince = Number(req.query.since);
    let seq = Number.isInteger(rawSince) ? rawSince : story.hub.seq;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (eventType: string, payload: unknown, id?: number) => {
      if (id !== undefined) res.write(`id: ${id}\n`);
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent('ready', { seq });
    for (const ev of story.hub.missedSince(seq)) {
      seq = ev.seq;
      writeEvent(ev.type, ev.payload, ev.seq);
    }

    const unsubscribe = story.hub.subscribe((ev) => {
      if (ev.seq <= seq) return;
      seq = ev.seq;
      writeEvent(ev.type, ev.payload, ev.seq);
    });

    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  app.post('/api/story/live/progress', (req, res, next) => {
    try {
      res.json(story.advancePlayback(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/new-game', (req, res, next) => {
    try {
      res.json(story.newGame(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/snapshot', (_req, res, next) => {
    try {
      res.json(story.getLegacySnapshot());
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/preferences', (req, res, next) => {
    try {
      res.json(story.updatePreferences(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/tasks', (_req, res, next) => {
    try {
      res.json(story.getStatus());
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/tasks/:key', (req, res, next) => {
    try {
      res.json(story.getStatus(req.params.key));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/tasks', (req, res, next) => {
    try {
      res.json(story.createTask(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/tasks/:key/cancel', (req, res, next) => {
    try {
      res.json(story.cancelTask(req.params.key));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/tasks/:key/retry', (req, res, next) => {
    try {
      res.json(story.retryTask(req.params.key));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/visuals', (_req, res) => {
    const assets = scanVisualAssets(ROOT_DIR);
    const portraits: Record<string, { card?: string; outfits: Record<string, string> }> = {};
    for (const [char, slots] of Object.entries(assets.characters || {})) {
      portraits[char] = {
        card: slots.into || slots.fullbody || slots.fullbody2 || Object.values(slots)[0],
        outfits: { ...slots },
      };
    }
    res.json({ scenes: assets.scenes, characters: assets.characters, portraits });
  });

  app.get('/api/story/shop', (_req, res, next) => {
    try {
      res.json(story.getShopView());
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/shop/redeem', (req, res, next) => {
    try {
      res.json(story.redeemShopItem(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/task/claim', (req, res, next) => {
    try {
      res.json(story.claimTaskReward(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/passive/upgrade', (req, res, next) => {
    try {
      res.json(story.upgradePassive(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/intel/acquire', (req, res, next) => {
    try {
      res.json(story.acquireIntel(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/intel/leverage', (req, res, next) => {
    try {
      res.json(story.toggleLeverage(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/bridge-info', (_req, res) => {
    res.json({ token: story.getBridgeToken() });
  });

  app.post('/api/story/bridge/control', (req, res, next) => {
    try {
      res.json(story.bridgeControl(req.body));
    } catch (err) {
      next(err);
    }
  });

  // Worker bridge routes
  const requireBridgeAuth: express.RequestHandler = (req, _res, next) => {
    const token = req.header('X-Story-Bridge');
    if (!story.authorizeWorker(token)) {
      return next(new HttpError(403, '故事桥接鉴权失败'));
    }
    next();
  };

  app.post('/api/story/worker/control', requireBridgeAuth, (req, res, next) => {
    try {
      res.json(story.workerControl(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/worker/wait', requireBridgeAuth, async (req, res) => {
    const timeoutSec = Math.max(0.2, Math.min(25, Number(req.query.timeout) || 15));
    let flags = story.hasPendingWorkerWork();
    if (!flags.has_task && !flags.has_control) {
      await story.hub.waitWorker(timeoutSec * 1000);
      flags = story.hasPendingWorkerWork();
    }
    res.json({
      wake: flags.has_task || flags.has_control,
      reason: flags.has_task ? 'task' : flags.has_control ? 'control' : 'timeout',
      seq: story.hub.seq,
      worker_seq: story.hub.workerSeq,
      has_task: flags.has_task,
      has_control: flags.has_control,
      service_epoch: story.serviceEpoch,
    });
  });

  app.post('/api/story/worker/claim', requireBridgeAuth, (_req, res) => {
    res.json(story.claimWorkerJob());
  });

  app.post('/api/story/worker/:key/heartbeat', requireBridgeAuth, (req, res, next) => {
    try {
      res.json(story.heartbeatWorkerJob(String(req.params.key), String(req.body?.lease || '')));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/worker/:key/stream', requireBridgeAuth, (req, res, next) => {
    try {
      res.json(story.streamWorkerPreview(String(req.params.key), req.body));
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Isolated Scene Live / Scene Chat API (/api/story/scene/*)
  // =========================================================

  app.get('/api/story/scene/connection', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json(scene.connectionInfo(origin));
  });

  app.get('/api/story/scene/world', (req, res) => {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    res.json(scene.worldStatus(id));
  });

  app.post('/api/story/scene/world/import', (_req, res) => {
    res.json(scene.importWorld());
  });

  app.get('/api/story/scene/list', (_req, res) => {
    res.json(scene.listScenes());
  });

  app.get('/api/story/scene', (req, res) => {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    res.json(scene.getSceneSnapshot(id));
  });

  app.post('/api/story/scene', (req, res, next) => {
    try {
      res.json(scene.createScene(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/scene/messages', (req, res, next) => {
    try {
      res.json(scene.submitMessage(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/scene/request/:key', (req, res, next) => {
    try {
      res.json(scene.getRequest(req.params.key));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/story/scene/retry/:key', (req, res, next) => {
    try {
      res.json(scene.retryRequest(req.params.key));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/story/scene/audit/:key', (req, res, next) => {
    try {
      const task = scene.getRequest(req.params.key).task;
      res.json({
        request_id: req.params.key,
        status: task.status,
        audit_available: false,
        audit: null,
        note: '覆盖校验仅证明资料已读，不证明模型充分运用了设定。',
      });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Voice & Config API (/api/*)
  // =========================================================

  app.get('/api/config', (_req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(voice.loadConfig());
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/config', (req, res, next) => {
    try {
      const cleaned = voice.saveConfig(req.body);
      res.json({ status: 'success', msg: '配置已保存', config: cleaned });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/fish_key', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(voice.getFishKeyStatus());
  });

  app.post('/api/fish_key', async (req, res, next) => {
    try {
      const saved = voice.saveFishKey(req.body?.api_key);
      let verifyOk: boolean | null = null;
      let verifyMsg = '';
      if (req.body?.verify) {
        const wallet = await voice.fetchFishWallet();
        verifyOk = Boolean(wallet.ok || wallet.api_credit);
        verifyMsg = verifyOk ? '密钥已保存且连通正常。' : '密钥已保存，但余额探针未通过（请核对密钥或网络）。';
      }
      res.json({
        status: 'success',
        msg: verifyMsg || '密钥已保存至本机受保护缓存（.cache/fish_api_key.json）。',
        configured: true,
        masked: voice.getFishKeyStatus().masked,
        source: 'local_cache',
        verified: verifyOk,
      });
      void saved;
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/fish_key', (_req, res, next) => {
    try {
      res.json(voice.clearFishKey());
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/voice_tier', (req, res, next) => {
    try {
      res.json(voice.setVoiceTier(req.body?.tier));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/voices', async (req, res) => {
    const search = String(req.query.search || req.query.title || '').trim();
    res.json(await voice.fetchFishVoices(search));
  });

  app.get('/api/edge_voices', (_req, res) => {
    res.json({
      voices: EDGE_FALLBACK_VOICES,
      default: EDGE_DEFAULT_VOICE,
      unavailable_hints: [],
    });
  });

  app.get('/api/fish_wallet', async (_req, res) => {
    res.json(await voice.fetchFishWallet());
  });

  app.get('/api/voice_repo', (_req, res) => {
    res.json(voice.getVoiceRepo());
  });

  app.post('/api/voice_repo', (req, res, next) => {
    try {
      res.json(voice.addVoiceRepo(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/voice_repo', (req, res, next) => {
    try {
      res.json(voice.deleteVoiceRepo(String(req.query.id || '')));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/tts/prefetch', async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const result = await voice.prefetchBatch(items);
    res.json({ status: 'ok', ...result });
  });

  const handleTts: express.RequestHandler = async (req, res, next) => {
    try {
      const params = req.method === 'POST' ? req.body || {} : req.query || {};
      const { buffer, mime, cacheHit } = await voice.synthesizeTts(params as Record<string, any>);
      res.setHeader('Content-Type', mime);
      res.setHeader('X-TTS-Cache', cacheHit ? 'HIT' : 'MISS');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };
  app.get('/api/tts', handleTts);
  app.post('/api/tts', handleTts);

  // =========================================================
  // HTML Entry Points & Whitelisted Public Static Assets
  // =========================================================

  const servePublic = (relPath: string, res: express.Response) => {
    const normalized = relPath.replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.some((p) => p === '..' || p.startsWith('.'))) {
      res.status(404).end();
      return;
    }
    const target = path.resolve(rootDir, normalized);
    const resolvedRoot = path.resolve(rootDir);
    const imageRoot = path.resolve(rootDir, 'txt文件', 'image');
    const inRoot = target === resolvedRoot || target.startsWith(resolvedRoot + path.sep);
    const isImage =
      target.startsWith(imageRoot + path.sep) && IMAGE_EXTENSIONS.has(path.extname(target).toLowerCase());
    if (!inRoot || !(PUBLIC_FILES.has(normalized) || isImage) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.status(404).end();
      return;
    }
    if (NO_CACHE_FILES.has(normalized)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (isImage) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    res.sendFile(target);
  };

  app.get('/', (_req, res) => servePublic('main_template.html', res));
  app.get('/admin', (_req, res) => servePublic('voice_manager.html', res));

  app.get('/scene-live', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(rootDir, 'scene_chat_dev', 'src', 'scene_live', 'index.html'));
  });

  app.get('/scene-live/assets/:name', (req, res) => {
    if (req.params.name !== 'live.css' && req.params.name !== 'live.js') {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(rootDir, 'scene_chat_dev', 'src', 'scene_live', req.params.name));
  });

  app.get('/scene-chat', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(rootDir, 'scene_chat.html'));
  });

  app.get('/*filepath', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    let decoded = '';
    try {
      decoded = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      res.status(400).end();
      return;
    }
    servePublic(decoded, res);
  });

  // =========================================================
  // Unified JSON Error Handler
  // =========================================================
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err instanceof HttpError ? err.status : Number(err?.status || 500);
    const message =
      err instanceof HttpError
        ? err.message
        : status === 400
          ? '请求参数格式无效'
          : '本地故事服务内部异常，请稍后重试。';
    if (req.path.startsWith('/api/')) {
      res.status(status).json({ error: message, status });
      return;
    }
    res.status(status).send(message);
  });

  return { app, story, voice, scene };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const { app } = createApp(ROOT_DIR);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`深渊天平服务已启动: http://0.0.0.0:${PORT}`);
  });
}
