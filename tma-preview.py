"""Генерация tma-preview.png 640×360 для BotFather Mini App.

Композиция:
  • Фон #0a0a1a + тонкий cyan-глоу по центру колеса
  • Слева: 8-кружковое колесо (как фавикон), цвета аспектов
  • Справа: «Соционическое / Колесо Баланса» + теглайн

Рендер: рисуем в 4x (2560×1440), потом LANCZOS-даунсэмпл — даёт мягкие
антиалиасные круги без специальных либ.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT_PATH = os.path.join(os.path.dirname(__file__), "tma-preview.png")

# Цвета аспектов — синхрон с public/favicon.svg и data/aspects.js.
ASPECT_COLORS = [
    "#8FA8BD",  # Te (12:00)
    "#DCE2EB",  # Ti (1:30)
    "#D85160",  # Fe (3:00)
    "#E6C158",  # Fi (4:30)
    "#CC7152",  # Se (6:00)
    "#A8D97B",  # Si (7:30)
    "#8975DD",  # Ne (9:00)
    "#B97FD2",  # Ni (10:30)
]

BG_COLOR = "#0a0a1a"
ACCENT = "#4cc9f0"   # из welcome-экрана
TEXT_FG = "#FFFFFF"
TEXT_DIM = "#9aa3b2"

# Финальный размер — 640×360. Рисуем в 4x для AA.
SCALE = 4
W, H = 640 * SCALE, 360 * SCALE


def find_font(size: int, bold: bool = False):
    """Подобрать системный шрифт с кириллицей на Windows / fallback."""
    candidates_bold = [
        "C:/Windows/Fonts/seguisb.ttf",   # Segoe UI Semibold
        "C:/Windows/Fonts/segoeuib.ttf",  # Segoe UI Bold
        "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
    ]
    candidates_reg = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    paths = candidates_bold if bold else candidates_reg
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    img = Image.new("RGB", (W, H), BG_COLOR)

    # ── Cyan-глоу по центру колеса ──────────────────────────────────────────
    glow = Image.new("RGB", (W, H), BG_COLOR)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(170 * SCALE), int(180 * SCALE)
    glow_r = int(150 * SCALE)
    # рисуем градиентом — несколько концентрических кругов с убывающей альфой
    for i in range(20, 0, -1):
        alpha = int(8 * i / 20)  # 0..8 насыщ.
        rr = int(glow_r * (i / 20))
        # смешиваем accent с фоном
        r1, g1, b1 = 0x4C, 0xC9, 0xF0
        r0, g0, b0 = 0x0A, 0x0A, 0x1A
        mix = lambda c0, c1: int(c0 + (c1 - c0) * alpha / 32)
        gd.ellipse(
            (cx - rr, cy - rr, cx + rr, cy + rr),
            fill=(mix(r0, r1), mix(g0, g1), mix(b0, b1)),
        )
    glow = glow.filter(ImageFilter.GaussianBlur(40 * SCALE / 4))
    img = Image.blend(img, glow, 0.6)

    draw = ImageDraw.Draw(img)

    # ── 8-кружковое колесо ──────────────────────────────────────────────────
    ring_r = int(100 * SCALE)       # радиус кольца, на котором сидят круги
    dot_r = int(20 * SCALE)         # радиус каждого круга

    # Тонкий контурный обод (едва видно, добавляет глубины).
    draw.ellipse(
        (cx - ring_r - dot_r, cy - ring_r - dot_r,
         cx + ring_r + dot_r, cy + ring_r + dot_r),
        outline=(255, 255, 255, 18),
        width=max(1, int(SCALE / 2)),
    )

    # 8 точек, начиная с 12:00, по часовой.
    for i, color in enumerate(ASPECT_COLORS):
        angle = -math.pi / 2 + i * (2 * math.pi / 8)
        x = cx + ring_r * math.cos(angle)
        y = cy + ring_r * math.sin(angle)
        # лёгкая «полутеневая» подложка для объёма
        shadow_r = dot_r + int(SCALE * 1.5)
        draw.ellipse(
            (x - shadow_r, y - shadow_r, x + shadow_r, y + shadow_r),
            fill=(0, 0, 0, 40),
        )
        # сам круг
        draw.ellipse(
            (x - dot_r, y - dot_r, x + dot_r, y + dot_r),
            fill=color,
        )

    # Центральный маленький символ — точка-«ось». Создаёт ощущение центра.
    core_r = int(8 * SCALE)
    draw.ellipse(
        (cx - core_r, cy - core_r, cx + core_r, cy + core_r),
        fill=ACCENT,
    )

    # ── Текст справа ────────────────────────────────────────────────────────
    text_x = int(330 * SCALE)
    right_padding = int(20 * SCALE)
    avail_w = W - text_x - right_padding

    eyebrow_font = find_font(int(13 * SCALE), bold=False)
    tagline_font = find_font(int(14 * SCALE), bold=False)

    # Авто-подбор размера заголовка: уменьшаем пока самая длинная строка лезет.
    title_lines = ["Соционическое", "Колесо Баланса"]
    title_size = int(32 * SCALE)
    while title_size > int(20 * SCALE):
        f = find_font(title_size, bold=True)
        widths = [draw.textbbox((0, 0), s, font=f)[2] for s in title_lines]
        if max(widths) <= avail_w:
            title_font = f
            break
        title_size -= int(1 * SCALE)
    else:
        title_font = find_font(int(20 * SCALE), bold=True)

    eyebrow_y = int(112 * SCALE)
    draw.text((text_x, eyebrow_y), "SLW", fill=ACCENT, font=eyebrow_font)

    # Заголовок: 2 строки с line-height ~ 1.18
    line_h = int(title_size * 1.18 / SCALE) * SCALE
    title1_y = int(133 * SCALE)
    draw.text((text_x, title1_y), title_lines[0],
              fill=TEXT_FG, font=title_font)
    draw.text((text_x, title1_y + line_h), title_lines[1],
              fill=TEXT_FG, font=title_font)

    tagline_y = title1_y + line_h * 2 + int(10 * SCALE)
    draw.text((text_x, tagline_y), "Познай себя через 8 аспектов",
              fill=TEXT_DIM, font=tagline_font)

    # ── Финиш: даунсэмпл 4× → 1× с LANCZOS ──────────────────────────────────
    final = img.resize((640, 360), Image.LANCZOS)
    final.save(OUT_PATH, "PNG", optimize=True)
    print(f"saved: {OUT_PATH} ({os.path.getsize(OUT_PATH)} bytes)")


if __name__ == "__main__":
    main()
