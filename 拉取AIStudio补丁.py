#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 AI Studio 专属同步仓库 (yimisunan/aistudio) 安全拉取前端、知识库与 Operit 桥接补丁。

安全保证：
1. 仅更新白名单内的前端界面、知识库 JSON 与 Operit 桥接源码/安装包；
2. 绝对跳过并禁止覆盖任何 .py 脚本、存档/、txt文件/image/ 头像图库、voice_config.json 与 data.json；
3. 每次覆盖前自动把旧文件完整备份到 .backup/aistudio_sync_<时间戳>/；
4. 仅依赖 Python 3 标准库，手机 Pydroid3 直接点运行即可。
"""

from __future__ import annotations

import hashlib
import json
import os
import posixpath
import shutil
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_OWNER = "yimisunan"
REPO_NAME = "aistudio"
DEFAULT_BRANCHES = ("main", "master")
LOCAL_PATCH_ZIP_NAME = "手机更新补丁_P1P2.zip"
TOKEN_CACHE_REL = Path(".cache") / "aistudio_sync_token.txt"

# 严格白名单：只允许同步这些文件
WHITELIST_FILES = {
    "main_template.html",
    "story_client.css",
    "story_client.js",
    "voice_manager.html",
    "voice_client.js",
    "scene_chat.html",
    "scene_chat_dev/src/scene_live/index.html",
    "scene_chat_dev/src/scene_live/live.css",
    "scene_chat_dev/src/scene_live/live.js",
    "txt文件/知识库/角色类.json",
    "txt文件/知识库/叙事判断.json",
    "txt文件/知识库/世界观类.json",
    "txt文件/知识库/系统标签类.json",
    "P1与P2全部优先分级推进计划.md",
}

# 严格白名单目录前缀：仅允许桥接源码与 .toolpkg 产物
WHITELIST_PREFIXES = (
    "scene_chat_dev/local.story.operit_bridge/",
    "scene_chat_dev/artifacts/",
)

# 双重黑名单锁：无论如何绝不写入这些路径或后缀
FORBIDDEN_PREFIXES = (
    "存档/",
    "txt文件/image/",
    ".git/",
    ".backup/",
    ".cache/",
    ".round-runtime/",
    "语音仓库/",
    "src/",
)
FORBIDDEN_EXACT = {
    "voice_config.json",
    "data.json",
    "server.ts",
    "package.json",
    "bun.lock",
    "tsconfig.json",
    "metadata.json",
}
FORBIDDEN_EXTS = (".py", ".pyc", ".ts", ".tsx")


def normalize_rel(raw_path: str) -> Optional[str]:
    clean = raw_path.replace("\\", "/").lstrip("/")
    if not clean or clean.endswith("/"):
        return None
    norm = posixpath.normpath(clean)
    if norm in (".", "..") or norm.startswith("../") or norm.startswith("/"):
        return None
    return norm


def is_safe_allowed(rel: str) -> bool:
    norm = normalize_rel(rel)
    if not norm:
        return False
    lower = norm.lower()
    if norm in FORBIDDEN_EXACT:
        return False
    if any(norm.startswith(p) for p in FORBIDDEN_PREFIXES):
        return False
    if any(lower.endswith(ext) for ext in FORBIDDEN_EXTS):
        return False
    if norm in WHITELIST_FILES:
        return True
    if any(norm.startswith(p) for p in WHITELIST_PREFIXES):
        # 仅允许非隐藏文件
        base = posixpath.basename(norm)
        return bool(base) and not base.startswith(".")
    return False


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_saved_token(root: Path) -> str:
    env_tok = os.environ.get("GITHUB_TOKEN", "").strip()
    if env_tok:
        return env_tok
    tok_file = root / TOKEN_CACHE_REL
    if tok_file.is_file():
        try:
            return tok_file.read_text("utf-8").strip()
        except OSError:
            return ""
    return ""


def save_token(root: Path, token: str) -> None:
    tok_file = root / TOKEN_CACHE_REL
    tok_file.parent.mkdir(parents=True, exist_ok=True)
    tok_file.write_text(token.strip(), encoding="utf-8")


def download_zip(url: str, token: str = "", timeout: int = 35) -> bytes:
    headers = {
        "User-Agent": "AbyssScale-AIStudio-PatchSync/1.0",
        "Accept": "application/vnd.github+json, application/zip, */*",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read()


def fetch_repo_archive(root: Path, repo: str = f"{REPO_OWNER}/{REPO_NAME}", mirror_prefix: str = "") -> Tuple[bytes, str]:
    token = load_saved_token(root)

    def build_candidates(tok: str) -> List[Tuple[str, str]]:
        urls: List[Tuple[str, str]] = []
        for br in DEFAULT_BRANCHES:
            raw_patch = f"https://raw.githubusercontent.com/{repo}/{br}/{LOCAL_PATCH_ZIP_NAME}"
            codeload = f"https://codeload.github.com/{repo}/zip/refs/heads/{br}"
            api_zip = f"https://api.github.com/repos/{repo}/zipball/{br}"
            if mirror_prefix:
                mp = mirror_prefix.rstrip("/") + "/"
                urls.append((mp + raw_patch, f"镜像纯净补丁包 ({br})"))
                urls.append((mp + codeload, f"镜像仓库归档 ({br})"))
            if tok:
                urls.append((api_zip, f"GitHub API 归档 ({br})"))
            else:
                urls.append((raw_patch, f"GitHub 纯净补丁包 ({br})"))
                urls.append((codeload, f"GitHub 仓库归档 ({br})"))
        return urls

    last_err: Optional[Exception] = None
    saw_auth_error = False

    for attempt in range(2):
        for url, label in build_candidates(token):
            try:
                print(f"→ 尝试下载：{label} ...")
                data = download_zip(url, token=token)
                if len(data) >= 4 and data[:4] == b"PK\x03\x04":
                    print(f"✓ 下载成功（{len(data):,} 字节）")
                    return data, label
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code in (401, 403, 404):
                    saw_auth_error = True
                print(f"  跳过（HTTP {e.code}）")
            except Exception as e:
                last_err = e
                print(f"  跳过（{e}）")

        if attempt == 0 and saw_auth_error and not token and sys.stdin.isatty():
            print("\n提示：若仓库 yimisunan/aistudio 为私有仓库，需要提供 GitHub Token（仅存本机 .cache/）。")
            entered = input("请粘贴 GitHub Token（公开仓库或跳过请直接回车）: ").strip()
            if entered:
                token = entered
                save_token(root, token)
                continue
        break

    raise RuntimeError(f"无法从 GitHub 下载同步归档：{last_err}")


def extract_whitelisted_entries(zip_bytes: bytes) -> Dict[str, bytes]:
    """从纯净补丁包或 GitHub 整仓归档中提取白名单文件，自动剥离顶层仓库目录前缀。"""
    entries: Dict[str, bytes] = {}
    with tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024) as tmp:
        tmp.write(zip_bytes)
        tmp.seek(0)
        with zipfile.ZipFile(tmp, "r") as zf:
            bad = zf.testzip()
            if bad is not None:
                raise RuntimeError(f"压缩包损坏，异常条目：{bad}")
            names = [n for n in zf.namelist() if n and not n.endswith("/")]
            if not names:
                raise RuntimeError("压缩包为空。")

            # 判断是否为 GitHub 整仓 zip（所有条目共享同一个顶层目录前缀，如 aistudio-main/）
            top_dirs = {n.split("/", 1)[0] for n in names if "/" in n}
            has_root_file = any("/" not in n for n in names)
            strip_prefix = ""
            if not has_root_file and len(top_dirs) == 1:
                candidate_prefix = next(iter(top_dirs)) + "/"
                # 确认不是纯净补丁里的 scene_chat_dev/ 或 txt文件/
                if candidate_prefix not in ("scene_chat_dev/", "txt文件/"):
                    strip_prefix = candidate_prefix

            for name in names:
                rel = name[len(strip_prefix):] if (strip_prefix and name.startswith(strip_prefix)) else name
                norm = normalize_rel(rel)
                if not norm or not is_safe_allowed(norm):
                    continue
                entries[norm] = zf.read(name)
    return entries


def apply_patch(root: Path, entries: Dict[str, bytes], dry_run: bool = False) -> Dict[str, object]:
    if not entries:
        raise RuntimeError("压缩包内未找到任何白名单可更新文件。")

    # 预校验所有 JSON 文件，防止写入损坏配置
    for rel, content in entries.items():
        if rel.lower().endswith(".json"):
            try:
                json.loads(content.decode("utf-8"))
            except Exception as e:
                raise RuntimeError(f"JSON 预校验失败（{rel}）：{e}") from e

    stamp = time.strftime("%Y%m%d_%H%M%S")
    backup_root = root / ".backup" / f"aistudio_sync_{stamp}"

    updated: List[str] = []
    skipped: List[str] = []
    archived_old_toolpkgs: List[str] = []
    new_toolpkgs = sorted(
        posixpath.basename(rel)
        for rel in entries
        if rel.startswith("scene_chat_dev/artifacts/") and rel.endswith(".toolpkg")
    )

    for rel in sorted(entries.keys()):
        data = entries[rel]
        target = root / Path(*rel.split("/"))
        if target.is_file():
            try:
                if sha256_bytes(target.read_bytes()) == sha256_bytes(data):
                    skipped.append(rel)
                    continue
            except OSError:
                pass
            if not dry_run:
                bak = backup_root / Path(*rel.split("/"))
                bak.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, bak)
        if not dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp_file = target.with_name(target.name + ".aistudio_tmp")
            tmp_file.write_bytes(data)
            os.replace(tmp_file, target)
        updated.append(rel)

    # 若同步了新的 .toolpkg，把同目录旧版本归档进备份目录避免 Operit 选错包
    if new_toolpkgs:
        art_dir = root / "scene_chat_dev" / "artifacts"
        if art_dir.is_dir():
            for existing in sorted(art_dir.glob("*.toolpkg")):
                if existing.name not in new_toolpkgs:
                    archived_old_toolpkgs.append(existing.name)
                    if not dry_run:
                        bak = backup_root / "scene_chat_dev" / "artifacts" / existing.name
                        bak.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(existing), str(bak))

    return {
        "updated": updated,
        "skipped": skipped,
        "new_toolpkgs": new_toolpkgs,
        "archived_old_toolpkgs": archived_old_toolpkgs,
        "backup_dir": str(backup_root) if (updated or archived_old_toolpkgs) and not dry_run else "",
    }


def main(argv: Optional[List[str]] = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    root = Path(__file__).resolve().parent
    dry_run = "--dry-run" in args
    local_zip: Optional[Path] = None
    mirror_prefix = os.environ.get("GITHUB_MIRROR", "").strip()

    for i, a in enumerate(args):
        if a == "--root" and i + 1 < len(args):
            root = Path(args[i + 1]).resolve()
        elif a == "--local-zip" and i + 1 < len(args):
            local_zip = Path(args[i + 1]).resolve()
        elif a == "--mirror" and i + 1 < len(args):
            mirror_prefix = args[i + 1].strip()

    print("=" * 52)
    print("深渊天平 · AI Studio 安全补丁同步器")
    print(f"目标目录：{root}")
    print(f"同步仓库：{REPO_OWNER}/{REPO_NAME}")
    print("保护区：所有 .py 脚本 / 存档 / 角色头像 / voice_config.json 均绝对不覆盖")
    print("=" * 52)

    if local_zip is not None:
        if not local_zip.is_file():
            print(f"✗ 找不到指定的本地补丁包：{local_zip}")
            return 1
        print(f"→ 使用本地补丁包：{local_zip}")
        zip_bytes = local_zip.read_bytes()
    else:
        try:
            zip_bytes, _ = fetch_repo_archive(root, mirror_prefix=mirror_prefix)
        except Exception as err:
            fallback = root / LOCAL_PATCH_ZIP_NAME
            if fallback.is_file():
                print(f"! 在线拉取失败（{err}），已自动切换使用本地补丁包：{fallback.name}")
                zip_bytes = fallback.read_bytes()
            else:
                print(f"\n✗ 拉取失败：{err}")
                print("排查建议：")
                print("1. 确认已在 AI Studio 点击 Sync 推送到 yimisunan/aistudio；")
                print("2. 若网络直连 GitHub 超时，可设置环境变量 GITHUB_MIRROR（如代理前缀）或从 GitHub 下载")
                print(f"   {LOCAL_PATCH_ZIP_NAME} 放到本目录后再运行本脚本。")
                return 1

    entries = extract_whitelisted_entries(zip_bytes)
    result = apply_patch(root, entries, dry_run=dry_run)

    updated: List[str] = result["updated"]  # type: ignore[assignment]
    skipped: List[str] = result["skipped"]  # type: ignore[assignment]
    new_toolpkgs: List[str] = result["new_toolpkgs"]  # type: ignore[assignment]
    archived_old: List[str] = result["archived_old_toolpkgs"]  # type: ignore[assignment]
    backup_dir: str = result["backup_dir"]  # type: ignore[assignment]

    print("\n" + ("【预演结果，未写入磁盘】" if dry_run else "【同步完成】"))
    print(f"✓ 已更新：{len(updated)} 个文件")
    for rel in updated:
        print(f"   + {rel}")
    print(f"• 无变化跳过：{len(skipped)} 个文件")
    if archived_old:
        print(f"• 旧版桥接包已归档至备份：{', '.join(archived_old)}")
    if backup_dir:
        print(f"• 本次旧文件备份路径：{backup_dir}")

    if new_toolpkgs:
        print("\n下一步操作：")
        print(f"1. 在 Operit 插件管理中导入新版桥接包：scene_chat_dev/artifacts/{new_toolpkgs[-1]}")
        print("2. 在 Pydroid3 重启你的本地故事服务（语音运行.py），刷新网页即可体验更新。")
    else:
        print("\n下一步操作：在 Pydroid3 重启本地故事服务并刷新网页即可生效。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
