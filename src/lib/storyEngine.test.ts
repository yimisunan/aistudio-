import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EventHub,
  StoryEngine,
  chooseOpening,
  createInitialSaveState,
  determineCyclePhase,
  fluidLockFloorForTurns,
  formatPanelLines,
  scanVisualAssets,
} from './storyEngine.ts';
import {
  VoiceManager,
  maskFishKey,
  stripSubtextForTts,
  translateFishAcousticTags,
} from './voiceConfig.ts';
import { SceneService } from './sceneService.ts';

function makeTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-scale-test-'));
  fs.mkdirSync(path.join(dir, '存档'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'txt文件', 'image', 'scenes'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'txt文件', 'image', '沈知韫'), { recursive: true });

  const realRoot = process.cwd();
  for (const rel of [
    'txt文件/互动运行配置.json',
    'txt文件/系统商城目录.json',
    'txt文件/商业情报目录.json',
    'voice_config.json',
  ]) {
    const src = path.join(realRoot, rel);
    const dst = path.join(dir, rel);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
  const initSave = createInitialSaveState();
  fs.writeFileSync(path.join(dir, '存档', 'save_state.json'), JSON.stringify(initSave, null, 2));
  fs.writeFileSync(path.join(dir, '存档', '近期演播.json'), JSON.stringify({ version: 1, playback: null, segments: [] }));
  fs.writeFileSync(
    path.join(dir, 'data.json'),
    JSON.stringify({ round: 0, sceneTitle: '徐家主宅', storyNodes: [], presence: initSave.presence, state_version: 0 }),
  );
  fs.writeFileSync(path.join(dir, 'txt文件', 'image', 'scenes', '徐家主宅_day.webp'), 'stub');
  fs.writeFileSync(path.join(dir, 'txt文件', 'image', '沈知韫', 'fullbody.png'), 'stub');
  return dir;
}

test('chooseOpening selects deterministically and emits 3 messages + 3 choices', () => {
  const a = chooseOpening('req-alpha-001');
  const b = chooseOpening('req-alpha-001');
  assert.equal(a.scenario.id, b.scenario.id);
  assert.equal(a.messages.length, 3);
  assert.equal(a.decision.options.length, 3);
  assert.deepEqual(
    a.decision.options.map((o) => o.id),
    ['A', 'B', 'C'],
  );

  const explicit = chooseOpening('req-explicit', 'zhiyun_friday_study');
  assert.equal(explicit.scenario.id, 'zhiyun_friday_study');
  assert.equal(explicit.clock.time, '23:00');
});

test('physiology cycle phase and fluid lock floor match rule thresholds', () => {
  assert.equal(determineCyclePhase('沈知韫', 1), '安全期');
  assert.equal(determineCyclePhase('沈知韫', 6), '危险期');
  assert.equal(determineCyclePhase('沈知韫', 3), '常规期');
  assert.equal(fluidLockFloorForTurns(0), 0);
  assert.equal(fluidLockFloorForTurns(4), 58);
  assert.equal(fluidLockFloorForTurns(12), 72);
  assert.equal(fluidLockFloorForTurns(20), 85);
});

test('formatPanelLines produces expected bracketed panel snapshot strings', () => {
  const lines = formatPanelLines({
    系统宿主: { 积分: 12, 经验值: 30, 体力: 85, 魅力: 70, 商业嗅觉: 15 },
    沈知韫: { 好感: 95, 堕落: 0, 欲望: 10, 羞耻: 98, 体力: 100, 高潮: 0, 内射: 0, 怀孕: false, 被动: 1 },
    徐念薇: { 好感: 30, 堕落: 0, 欲望: 0, 羞耻: 99, 体力: 65, 高潮: 0, 内射: 0, 怀孕: false, 被动: 0 },
    苏婉青: { 好感: 40, 堕落: 0, 欲望: 0, 羞耻: 99, 体力: 100, 高潮: 0, 内射: 0, 怀孕: false, 被动: 0 },
    徐承邺: { 堕落: 0 },
  });
  assert.equal(lines.length, 5);
  assert.match(lines[0], /^\[系统宿主\] 积分 12 \| 经验值 30 \| 体力 85/);
  assert.match(lines[1], /^\[沈知韫\].*被动 Lv\.1$/);
});

test('voice utilities mask keys and strip subtext ruby annotations', () => {
  assert.equal(maskFishKey('sk-1234567890abcdef'), 'sk-1****cdef');
  assert.equal(maskFishKey(''), '');
  assert.equal(stripSubtextForTts('【测试】｛没关系｜其实很在意｝*轻声*'), '测试没关系轻声');
});

test('StoryEngine newGame, playback progression, task reserve & cancel refund', () => {
  const dir = makeTempWorkspace();
  try {
    const assets = scanVisualAssets(dir);
    assert.ok(assets.scenes['徐家主宅']?.day?.includes('/txt文件/image/scenes/'));
    assert.ok(assets.characters['沈知韫']?.fullbody?.includes('/txt文件/image/'));

    const engine = new StoryEngine(dir);
    const initial = engine.getLiveSnapshot();
    assert.equal(initial.playback.bootstrap, true);
    assert.equal(initial.world.progression.stamina, 100);

    const reset = engine.newGame({
      request_id: 'newgame-test-1',
      save_epoch: initial.save_epoch,
      confirm: 'new_game',
      scenario_id: 'zhiyun_friday_study',
    });
    assert.equal(reset.status, 'reset');
    assert.equal(reset.replayed, false);
    assert.equal(reset.prologue.scenario_id, 'zhiyun_friday_study');

    const afterReset = engine.getLiveSnapshot();
    assert.equal(afterReset.playback.revealed, 0);
    assert.equal(afterReset.playback.total, 3);
    assert.equal(afterReset.playback.completed, false);
    assert.equal(afterReset.world.tasks.current.id, 'TASK-001');

    // Step through playback to completion
    const segId = afterReset.playback.segment_id;
    const ep = afterReset.save_epoch;
    engine.advancePlayback({ save_epoch: ep, segment_id: segId, revealed: 1, completed: false });
    engine.advancePlayback({ save_epoch: ep, segment_id: segId, revealed: 2, completed: false });
    const done = engine.advancePlayback({ save_epoch: ep, segment_id: segId, revealed: 3, completed: true });
    assert.equal(done.playback.completed, true);
    assert.equal(done.history[0].decision.options.length, 3);

    // Submit choice B (-10 stamina) and then cancel for full refund
    const created = engine.createTask({
      request_id: 'act-001',
      base_revision: done.revision,
      action: done.history[0].decision.options[1].text,
      entry_mode: 'live_interaction',
      selection: { segment_id: segId, option_id: 'B' },
      save_epoch: ep,
    });
    assert.equal(created.task.status, 'queued');
    assert.equal(engine.getLiveSnapshot().world.progression.stamina, 90);

    const cancelled = engine.cancelTask('act-001');
    assert.equal(cancelled.task.status, 'cancelled');
    assert.equal(engine.getLiveSnapshot().world.progression.stamina, 100);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('VoiceManager tier switching and SceneService world import + scene creation', () => {
  const dir = makeTempWorkspace();
  try {
    const vm = new VoiceManager(dir);
    const tierRes = vm.setVoiceTier('pro');
    assert.equal(tierRes.tier, 'pro');
    assert.equal(tierRes.config['沈知韫'].tts_model, 's2.1-pro');
    assert.equal(tierRes.config['旁白'].tts_model, 's2.1-pro-free');

    const engine = new StoryEngine(dir);
    const scene = new SceneService(dir, engine);
    const imported = scene.importWorld();
    assert.equal(imported.source_current, true);
    assert.equal(imported.world.location, '徐家主宅');

    const created = scene.createScene({ cast: ['沈知韫'], location: '客厅' });
    assert.equal(created.scene.location, '客厅');
    assert.deepEqual(created.scene.cast, ['沈知韫']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('translateFishAcousticTags maps Chinese aliases while preserving English tags', () => {
  assert.equal(translateFishAcousticTags('[低声] 这么晚还没睡？'), '[low restrained voice] 这么晚还没睡？');
  assert.equal(translateFishAcousticTags('[耳语，微颤] 别再靠近了'), '[near whisper, trembling voice] 别再靠近了');
  assert.equal(
    translateFishAcousticTags('[cool restrained voice] 别踩到画稿'),
    '[cool restrained voice] 别踩到画稿',
  );
  assert.equal(
    stripSubtextForTts('[克制] ｛没什么｜其实很在意｝'),
    '[cool restrained voice] 没什么',
  );
});

test('VoiceManager singleflight dedupe, LRU cache hit, and prefetchBatch work deterministically', async () => {
  const dir = makeTempWorkspace();
  try {
    let fetchCalls = 0;
    const fakeFetch: typeof fetch = (async (_url: any, init?: any) => {
      fetchCalls += 1;
      await new Promise((r) => setTimeout(r, 15));
      const body = JSON.parse(String(init?.body || '{}'));
      const payload = Buffer.from(`MP3:${body.text}`);
      return new Response(payload, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    }) as typeof fetch;

    const vm = new VoiceManager(dir, fakeFetch);
    // Without key, prefetchBatch skips safely without throwing
    const noKeyPrefetch = await vm.prefetchBatch([{ text: '测试', speaker: '沈知韫' }]);
    assert.equal(noKeyPrefetch.prefetched, 0);
    assert.equal(fetchCalls, 0);

    // Save a dummy test key inside isolated temp workspace
    vm.saveFishKey('test-fish-key-1234567890');

    // Two concurrent identical requests must coalesce into 1 upstream fetch (singleflight)
    const [r1, r2] = await Promise.all([
      vm.synthesizeTts({ text: '[低声] 过来坐会儿', speaker: '沈知韫' }),
      vm.synthesizeTts({ text: '[低声] 过来坐会儿', speaker: '沈知韫' }),
    ]);
    assert.equal(fetchCalls, 1);
    assert.equal(r1.buffer.toString(), 'MP3:[low restrained voice] 过来坐会儿');
    assert.equal(r2.buffer.toString(), 'MP3:[low restrained voice] 过来坐会儿');

    // Subsequent identical request hits memory LRU cache with zero extra upstream fetch
    const r3 = await vm.synthesizeTts({ text: '[低声] 过来坐会儿', speaker: '沈知韫' });
    assert.equal(r3.cacheHit, true);
    assert.equal(fetchCalls, 1);
    assert.equal(vm.getCacheStats().entries, 1);

    // Prefetch batch warms new sentences and hits cache for existing ones
    const pref = await vm.prefetchBatch([
      { text: '[低声] 过来坐会儿', speaker: '沈知韫' },
      { text: '[轻叹] 算了', speaker: '苏婉青' },
    ]);
    assert.equal(pref.prefetched, 2);
    assert.equal(fetchCalls, 2);
    assert.equal(vm.getCacheStats().entries, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('EventHub maintains monotonic seq and replays missed events since seq', () => {
  const hub = new EventHub();
  const e1 = hub.publish('task_state', { id: 1 });
  const e2 = hub.publish('story_stream', { id: 2 });
  const e3 = hub.publish('committed', { id: 3 });
  assert.deepEqual([e1.seq, e2.seq, e3.seq], [1, 2, 3]);
  assert.deepEqual(
    hub.missedSince(1).map((e) => e.type),
    ['story_stream', 'committed'],
  );
  assert.equal(hub.missedSince(3).length, 0);
});

test('knowledge base files have zero contradictory hardcoded [D:徐志北] ban', () => {
  const realRoot = process.cwd();
  const paceDoc = fs.readFileSync(path.join(realRoot, 'txt文件/知识库/叙事判断.json'), 'utf-8');
  const charDoc = fs.readFileSync(path.join(realRoot, 'txt文件/知识库/角色类.json'), 'utf-8');
  // Both files must parse as valid JSON and align to protagonist_style instead of hardcoded bans
  JSON.parse(paceDoc);
  JSON.parse(charDoc);
  assert.equal(paceDoc.includes('且零出现 [D:徐志北]'), false);
  assert.equal(charDoc.includes('且正式互动严禁输出 [D:徐志北] 对白行'), false);
  assert.equal(paceDoc.includes('protagonist_style'), true);
  assert.equal(charDoc.includes('protagonist_style'), true);
});

