"""Pixelorama 프로젝트 파일(.pxo) 쓰기·읽기 도구 (Pixelorama 1.x, pxo_version 8 형식).

.pxo = ZIP: data.json(프로젝트 정보) + image_data/frames/<프레임>/layer_<레이어>(RGBA8 날 데이터, 1부터 셈)
     + image_data/final_images/<프레임>(합친 그림) + preview.png + mimetype.
형식 근거: Pixelorama 소스 src/Autoload/OpenSave.gd (save_pxo_file / open_pxo_file),
          src/Classes/Project.gd (serialize / deserialize).

쓰는 법:
    from pxo import write_pxo, read_pxo
    write_pxo("nightmare.pxo", frames, tags=[("walk", 1, 4)], fps=8)   # frames: 같은 크기의 PIL RGBA 그림 목록
    frames, tags, fps = read_pxo("nightmare.pxo")
"""
import io
import json
import zipfile

from PIL import Image

PIXELORAMA_VERSION = "v1.2.1"
PXO_VERSION = 8
FORMAT_RGBA8 = 5          # Godot Image.FORMAT_RGBA8
LAYER_PIXEL = 0           # Global.LayerTypes.PIXEL
TAG_COLORS = ["ff5a5aff", "5ab4ffff", "ffd60aff", "5aff8cff"]


def write_pxo(path, frames, tags=(), fps=8, layer_name="Layer 1"):
    """frames: 같은 크기의 RGBA 그림 목록. tags: (이름, 처음 프레임, 끝 프레임) 목록 — 프레임 번호는 1부터."""
    if not frames:
        raise ValueError("frames 가 비어 있음")
    w, h = frames[0].size
    frames = [f.convert("RGBA") for f in frames]
    if any(f.size != (w, h) for f in frames):
        raise ValueError("프레임 크기가 서로 다름")
    data = {
        "pixelorama_version": PIXELORAMA_VERSION,
        "pxo_version": PXO_VERSION,
        "size_x": w,
        "size_y": h,
        "color_mode": FORMAT_RGBA8,
        "tile_mode_x_basis_x": w,
        "tile_mode_x_basis_y": 0,
        "tile_mode_y_basis_x": 0,
        "tile_mode_y_basis_y": h,
        "layers": [{
            "name": layer_name, "visible": True, "locked": False, "blend_mode": 0,
            "clipping_mask": False, "opacity": 1.0, "parent": -1, "effects": [],
            "animated_params": "{}", "type": LAYER_PIXEL, "new_cels_linked": False,
        }],
        "next_keyframe_id": 0,
        "tags": [{"name": n, "color": TAG_COLORS[i % len(TAG_COLORS)], "from": a, "to": b} for i, (n, a, b) in enumerate(tags)],
        "guides": [],
        "symmetry_points": [w, h],
        "frames": [{"cels": [{"opacity": 1.0, "z_index": 0, "offset": "(0, 0)", "image_size": f"Vector2i({w}, {h})"}],
                    "duration": 1.0} for _ in frames],
        "current_frame": 0,
        "current_layer": 0,
        "brushes": [],
        "palettes": [],
        "project_current_palette_name": "",
        "reference_images": [],
        "tilesets": [],
        "vanishing_points": [],
        "fps": float(fps),
        "include_blended_images": True,
        "license": "",
        "user_data": "",
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("data.json", json.dumps(data, ensure_ascii=False))
        z.writestr("mimetype", "application/x-pixelorama")
        scale = max(1, 256 // max(w, h))
        buf = io.BytesIO()
        frames[0].resize((w * scale, h * scale), Image.NEAREST).save(buf, "PNG")
        z.writestr("preview.png", buf.getvalue())
        for i, f in enumerate(frames, start=1):
            raw = f.tobytes()
            z.writestr(f"image_data/final_images/{i}", raw)
            z.writestr(f"image_data/frames/{i}/layer_1", raw)


def read_pxo(path):
    """write_pxo 로 만든(또는 레이어 하나짜리) .pxo 를 다시 읽음 → (프레임 그림 목록, 태그 목록, fps)."""
    with zipfile.ZipFile(path) as z:
        data = json.loads(z.read("data.json"))
        w, h = data["size_x"], data["size_y"]
        frames = [Image.frombytes("RGBA", (w, h), z.read(f"image_data/frames/{i}/layer_1")) for i in range(1, len(data["frames"]) + 1)]
    return frames, [(t["name"], t["from"], t["to"]) for t in data.get("tags", [])], data.get("fps", 8)


def sheet(frames):
    """프레임을 가로로 이어 붙인 한 장 (게임이 읽는 그림)."""
    w, h = frames[0].size
    out = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out
