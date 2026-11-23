import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError, PEOPLE, StoryEngine } from './storyEngine.ts';

interface SceneRecord {
  id: string;
  revision: number;
  cast: string[];
  location: string;
  world_id: string | null;
  history: any[];
  created_at: number;
}

interface SceneJob {
  id: string;
  scene: string;
  base: number;
  input: string;
  status: 'queued' | 'generating' | 'committed' | 'failed' | 'interrupted';
  error: string;
  created_at: number;
}

interface WorldSnapshot {
  world_id: string;
  imported_at: number;
  baseline: string;
  location: string;
  presence: Record<string, any>;
  cast_by_location: Record<string, string[]>;
  panels: string[];
  unresolved_sources: any[];
}

export class SceneService {
  readonly root: string;
  readonly story: StoryEngine;
  private scenes = new Map<string, SceneRecord>();
  private jobs = new Map<string, SceneJob>();
  private worlds = new Map<string, WorldSnapshot>();
  private latestWorldId: string | null = null;
  private latestSceneId: string | null = null;

  constructor(rootDir: string, story: StoryEngine) {
    this.root = path.resolve(rootDir);
    this.story = story;
    this.loadFromDisk();
  }

  private stateFile(): string {
    return path.join(this.root, '.scene-chat', 'state.json');
  }

  private loadFromDisk(): void {
    try {
      const f = this.stateFile();
      if (!fs.existsSync(f)) return;
      const parsed = JSON.parse(fs.readFileSync(f, 'utf-8'));
      for (const s of parsed.scenes || []) this.scenes.set(s.id, s);
      for (const j of parsed.jobs || []) this.jobs.set(j.id, j);
      for (const w of parsed.worlds || []) this.worlds.set(w.world_id, w);
      this.latestWorldId = parsed.latestWorldId || null;
      this.latestSceneId = parsed.latestSceneId || null;
    } catch {
      // start fresh
    }
  }

  private saveToDisk(): void {
    try {
      const f = this.stateFile();
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(
        f,
        JSON.stringify(
          {
            scenes: Array.from(this.scenes.values()),
            jobs: Array.from(this.jobs.values()),
            worlds: Array.from(this.worlds.values()),
            latestWorldId: this.latestWorldId,
            latestSceneId: this.latestSceneId,
          },
          null,
          2,
        ),
        'utf-8',
      );
    } catch {
      // ignore ephemeral errors
    }
  }

  connectionInfo(origin: string): Record<string, any> {
    const status = this.story.getStatus();
    const bridge = status.bridge || {};
    return {
      origin: origin.replace(/\/+$/, ''),
      scene_protocol: 3,
      message_kinds: ['dialogue', 'action', 'narration'],
      live_page: '/scene-live',
      world_state_protocol: 1,
      world_mode: 'isolated_read_only',
      workspace_id: crypto.createHash('sha256').update(this.root).digest('hex').slice(0, 16),
      bridge: {
        present: bridge.present,
        running: bridge.running,
        phase: bridge.phase,
        plugin_version: bridge.plugin_version || '',
        last_error: bridge.last_error || '',
      },
    };
  }

  worldStatus(worldId?: string): Record<string, any> {
    const targetId = worldId || this.latestWorldId;
    if (!targetId || !this.worlds.has(targetId)) {
      return { world: null, source_current: false, source_error: '' };
    }
    const world = this.worlds.get(targetId)!;
    const currentBaseline = this.story.getRevision();
    const current = world.baseline === currentBaseline;
    return {
      world,
      source_current: current,
      source_error: current ? '' : '正式存档已发生变化，请重新导入最新存档快照',
    };
  }

  importWorld(): Record<string, any> {
    const view = this.story.buildWorldView();
    const presence = view.presence || {};
    const castByLoc: Record<string, string[]> = {};
    for (const name of PEOPLE) {
      const loc = presence[name]?.location;
      if (loc) {
        castByLoc[loc] ||= [];
        castByLoc[loc].push(name);
      }
    }
    const snap: WorldSnapshot = {
      world_id: 'world-' + crypto.randomBytes(8).toString('hex'),
      imported_at: Math.floor(Date.now() / 1000),
      baseline: this.story.getRevision(),
      location: view.location,
      presence,
      cast_by_location: castByLoc,
      panels: view.panels || [],
      unresolved_sources: [],
    };
    this.worlds.set(snap.world_id, snap);
    this.latestWorldId = snap.world_id;
    this.saveToDisk();
    return { world: snap, source_current: true, source_error: '' };
  }

  listScenes(): Record<string, any> {
    const list = Array.from(this.scenes.values())
      .sort((a, b) => b.created_at - a.created_at)
      .map((s) => ({
        id: s.id,
        revision: s.revision,
        cast: s.cast,
        location: s.location,
        world_id: s.world_id,
        turns: s.history.length,
        created_at: s.created_at,
      }));
    return { scenes: list };
  }

  getSceneSnapshot(sceneId?: string): Record<string, any> {
    const targetId = sceneId || this.latestSceneId;
    const scene = targetId ? this.scenes.get(targetId) || null : null;
    if (!scene) return { scene: null, task: null };
    const latestJob = Array.from(this.jobs.values())
      .filter((j) => j.scene === scene.id)
      .sort((a, b) => b.created_at - a.created_at)[0] || null;
    return { scene, task: latestJob };
  }

  createScene(body: Record<string, any>): Record<string, any> {
    const cast: string[] = Array.isArray(body?.cast) ? body.cast.filter((x) => typeof x === 'string') : [];
    const validCast = Array.from(new Set(cast)).filter((c) => (PEOPLE as readonly string[]).includes(c));
    if (validCast.length < 1 || validCast.length > 2) {
      throw new HttpError(400, '请选择一至两位有效在场人物');
    }
    let location = String(body?.location || '').trim();
    const worldId = typeof body?.world_id === 'string' && body.world_id ? body.world_id : null;
    if (worldId) {
      const world = this.worlds.get(worldId);
      if (!world) throw new HttpError(404, '指定的旧档快照不存在');
      location = world.location;
    }
    if (!location || location.length > 80) throw new HttpError(400, '地点名称无效');
    const scene: SceneRecord = {
      id: 'scene-' + crypto.randomBytes(8).toString('hex'),
      revision: 0,
      cast: validCast,
      location,
      world_id: worldId,
      history: [],
      created_at: Math.floor(Date.now() / 1000),
    };
    this.scenes.set(scene.id, scene);
    this.latestSceneId = scene.id;
    this.saveToDisk();
    return { scene, task: null };
  }

  submitMessage(body: Record<string, any>): Record<string, any> {
    const reqId = String(body?.request_id || '');
    const sceneId = String(body?.scene_id || '');
    const input = String(body?.input || '').trim();
    if (!reqId.startsWith('scene-')) throw new HttpError(400, '实验请求编号须以 scene- 开头');
    if (!input) throw new HttpError(400, '发言内容不能为空');
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new HttpError(404, '实验场景不存在');
    if (this.jobs.has(reqId)) return { task: this.jobs.get(reqId) };
    const job: SceneJob = {
      id: reqId,
      scene: scene.id,
      base: scene.revision,
      input,
      status: 'queued',
      error: '',
      created_at: Date.now() / 1000,
    };
    this.jobs.set(reqId, job);
    this.saveToDisk();
    this.story.hub.publish('scene_task', { request_id: reqId, scene_id: scene.id }, true);
    return { task: job };
  }

  getRequest(key: string): Record<string, any> {
    const job = this.jobs.get(key);
    if (!job) throw new HttpError(404, '交流任务不存在');
    return { task: job };
  }

  retryRequest(key: string): Record<string, any> {
    const job = this.jobs.get(key);
    if (!job) throw new HttpError(404, '交流任务不存在');
    job.status = 'queued';
    job.error = '';
    this.saveToDisk();
    this.story.hub.publish('scene_task', { request_id: key, scene_id: job.scene }, true);
    return { task: job };
  }
}
