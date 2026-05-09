"""
下载审查资料到本地工作目录。

用法:
    python download_review_data.py <manifest_url>
    python download_review_data.py <manifest_url> --workdir /custom/path

从 manifest URL 获取审查元信息，下载源文件和规范包，
全部落盘到 workspace/reviews/{reviewId}/（每个审查独立目录）。

目录结构:
    workspace/reviews/{reviewId}/
    ├── meta.json       # 审查元信息
    ├── source.txt      # 源文件内容
    └── standards.json  # 规范包数据
"""

import json
import sys
import time
from pathlib import Path

import httpx

DEFAULT_BASE_DIR = "workspace/reviews"


def download(url: str, timeout: int = 60) -> httpx.Response:
    """带重试的下载，处理 OSS 签名 URL 的 redirect。"""
    last_error = None
    for attempt in range(3):
        try:
            r = httpx.get(url, timeout=timeout, follow_redirects=True)
            r.raise_for_status()
            return r
        except httpx.HTTPError as e:
            last_error = e
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise last_error


def main():
    if len(sys.argv) < 2:
        print(f"用法: python {sys.argv[0]} <manifest_url> [--workdir /custom/path]")
        sys.exit(1)

    manifest_url = sys.argv[1]
    base_dir = Path(DEFAULT_BASE_DIR)

    # 解析可选参数
    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == "--workdir" and i + 1 < len(args):
            base_dir = Path(args[i + 1])
            i += 2
        else:
            i += 1

    # 1. 获取 manifest
    print(f"[1/3] 获取 manifest: {manifest_url}")
    manifest_resp = download(manifest_url, timeout=30)
    manifest = manifest_resp.json()
    # 适配 API 响应包装（data 字段）
    if "data" in manifest:
        manifest = manifest["data"]

    review_id = manifest["reviewId"]
    workdir = base_dir / review_id
    workdir.mkdir(parents=True, exist_ok=True)

    meta = {
        "reviewId": review_id,
        "documentName": manifest["documentName"],
        "reviewFileUrl": manifest["reviewFileUrl"],
        "standardsUrl": manifest["standardsUrl"],
        "dimensions": manifest.get("dimensions", []),
        "strictness": manifest.get("strictness", 1),
    }
    (workdir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ meta.json 已保存 (reviewId={meta['reviewId']}, documentName={meta['documentName']})")
    print(f"  dimensions={meta['dimensions']}, strictness={meta['strictness']}")

    # 2. 下载源文件
    print(f"[2/3] 下载源文件: {meta['reviewFileUrl']}")
    source = download(meta["reviewFileUrl"], timeout=60)
    source_filename = "source.md"
    cd = source.headers.get("Content-Disposition", "")
    if "filename*" in cd:
        # RFC 5987: filename*=UTF-8''encoded_name
        import re
        match = re.search(r"filename\*=UTF-8''(.+)", cd)
        if match:
            source_filename = __import__("urllib.parse").unquote(match.group(1))
    elif "filename=" in cd:
        source_filename = cd.split("filename=")[-1].strip("\"'; ")
    (workdir / source_filename).write_bytes(source.content)
    print(f"  ✓ {source_filename} 已保存 ({len(source.content)} 字节)")

    # 3. 下载规范包
    print(f"[3/3] 下载规范包: {meta['standardsUrl']}")
    standards = download(meta["standardsUrl"], timeout=60)
    (workdir / "standards.json").write_text(standards.text, encoding="utf-8")
    print(f"  ✓ standards.json 已保存 ({len(standards.text)} 字符)")

    print(f"\n准备就绪: {workdir}")
    print("可读取的文件:")
    for f in sorted(workdir.iterdir()):
        print(f"  {f}")


if __name__ == "__main__":
    main()
