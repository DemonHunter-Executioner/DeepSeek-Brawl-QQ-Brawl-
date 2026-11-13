#!/usr/bin/env python3
"""把桌面宠物要用的鲸鱼帧渲染成 PNG。

桌面小窗是 C# WinForms + 分层窗口（UpdateLayeredWindow），没法直接用 HTML/SVG，
所以这里用 Pillow 在 3 倍尺寸上画好再降采样，得到边缘干净的透明位图。

产物（assets/）：
  whale-idle.png    睁眼
  whale-blink.png   闭眼
  whale-happy.png   眯眼笑（心情好的时候用）
  tray.ico          托盘图标
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

# 逻辑坐标 360x280，按 3 倍画再缩小，保证抗锯齿
SCALE = 3
W, H = 720, 560

BODY = (79, 116, 200, 255)
BODY_DARK = (58, 90, 158, 255)
OUTLINE = (47, 74, 133, 255)
BELLY = (230, 238, 251, 255)
EYE = (16, 26, 46, 255)
WHITE = (255, 255, 255, 255)
BLUSH = (255, 159, 191, 90)
SPOUT = (214, 239, 255, 230)


def bezier(p0, p1, p2, p3, steps=36):
    points = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]
        points.append((x, y))
    return points


def path(*segments):
    """segments: ('M', p) 或 ('C', p1, p2, p3)。返回闭合点列。"""
    points = []
    current = None
    for seg in segments:
        if seg[0] == "M":
            current = seg[1]
            points.append(current)
        elif seg[0] == "C":
            pts = bezier(current, seg[1], seg[2], seg[3])
            points.extend(pts[1:])
            current = seg[3]
    return points


def draw_whale(kind):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 水柱（先画，压在身体后面）
    d.arc([250, 40, 310, 130], 200, 340, fill=SPOUT, width=7)
    d.arc([286, 34, 336, 118], 200, 340, fill=(SPOUT[0], SPOUT[1], SPOUT[2], 170), width=6)
    d.ellipse([244, 74, 268, 98], fill=SPOUT)
    d.ellipse([272, 56, 302, 86], fill=SPOUT)
    d.ellipse([304, 78, 324, 98], fill=(SPOUT[0], SPOUT[1], SPOUT[2], 180))

    # 尾巴（两片尾鳍）
    top_fluke = path(("M", (604, 258)), ("C", (656, 202), (700, 186), (716, 206)),
                     ("C", (700, 234), (648, 258), (610, 272)))
    bottom_fluke = path(("M", (610, 292)), ("C", (654, 318), (700, 336), (716, 316)),
                        ("C", (700, 344), (650, 332), (606, 304)))
    d.polygon(top_fluke, fill=BODY_DARK, outline=OUTLINE)
    d.polygon(bottom_fluke, fill=BODY_DARK, outline=OUTLINE)

    # 身体
    body = path(
        ("M", (92, 318)),
        ("C", (92, 206), (196, 148), (334, 148)),
        ("C", (452, 148), (540, 184), (586, 234)),
        ("C", (602, 250), (612, 262), (616, 272)),
        ("C", (610, 302), (594, 342), (554, 382)),
        ("C", (478, 442), (300, 460), (180, 420)),
        ("C", (122, 400), (92, 372), (92, 318)),
    )
    d.polygon(body, fill=BODY, outline=OUTLINE)

    # 背鳍
    dorsal = path(("M", (470, 168)), ("C", (486, 120), (524, 108), (534, 140)),
                  ("C", (540, 164), (512, 178), (492, 186)))
    d.polygon(dorsal, fill=BODY_DARK, outline=OUTLINE)

    # 肚子：一块被身体裁掉的大椭圆，形成浅色下腹
    body_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(body_mask).polygon(body, fill=255)
    belly_shape = Image.new("L", (W, H), 0)
    ImageDraw.Draw(belly_shape).ellipse([96, 300, 610, 500], fill=255)
    belly = Image.composite(belly_shape, Image.new("L", (W, H), 0), body_mask)
    light = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(light).polygon(body, fill=BELLY)
    img.paste(light, (0, 0), belly)

    # 背部高光
    shine = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.polygon(path(("M", (128, 250)), ("C", (200, 178), (320, 158), (420, 178)),
                    ("C", (330, 178), (216, 206), (152, 276))), fill=(255, 255, 255, 46))
    img = Image.alpha_composite(img, shine)
    d = ImageDraw.Draw(img)

    # 胸鳍
    fin = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fin)
    fd.ellipse([258, 356, 402, 420], fill=BODY_DARK, outline=OUTLINE)
    fin = fin.rotate(-18, center=(330, 388), resample=Image.BICUBIC)
    img = Image.alpha_composite(img, fin)
    d = ImageDraw.Draw(img)

    # 腮红
    blush = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(blush).ellipse([136, 320, 186, 348], fill=BLUSH)
    blush = blush.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, blush)
    d = ImageDraw.Draw(img)

    # 眼睛
    if kind == "blink":
        d.arc([172, 286, 232, 316], 200, 340, fill=EYE, width=8)
    elif kind == "happy":
        d.arc([170, 272, 234, 314], 200, 340, fill=EYE, width=9)
    else:
        d.ellipse([170, 262, 234, 326], fill=WHITE, outline=OUTLINE, width=3)
        d.ellipse([190, 282, 222, 314], fill=EYE)
        d.ellipse([186, 274, 200, 288], fill=WHITE)

    # 嘴
    d.arc([130, 336, 216, 382], 15, 70, fill=OUTLINE, width=6)

    # 喷水孔
    d.ellipse([266, 142, 294, 156], fill=BODY_DARK)

    return img.resize((W // SCALE, H // SCALE), Image.LANCZOS)


def main():
    idle = draw_whale("idle")
    idle.save(os.path.join(OUT, "whale-idle.png"))
    draw_whale("blink").save(os.path.join(OUT, "whale-blink.png"))
    draw_whale("happy").save(os.path.join(OUT, "whale-happy.png"))

    # 托盘图标：裁头部再缩小
    head = idle.crop((80, 60, 240, 220)).resize((64, 64), Image.LANCZOS)
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas.paste(head, (0, 0), head)
    canvas.save(os.path.join(OUT, "tray.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    for name in ("whale-idle.png", "whale-blink.png", "whale-happy.png", "tray.ico"):
        size = os.path.getsize(os.path.join(OUT, name))
        print(f"{name}: {size} bytes")


if __name__ == "__main__":
    main()
