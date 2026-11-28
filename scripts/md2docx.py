#!/usr/bin/env python3
"""把 docs 下的 Markdown 转成排版好的 docx（只支持本文档用到的那部分语法）。

用法：
    python scripts/md2docx.py docs/teach-design.md docs/试剂纪元-教学设计.docx
"""

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

CN_FONT = "微软雅黑"
BODY_PT = 11
ACCENT = RGBColor(0x1F, 0x4E, 0x79)


def style_run(run, size=BODY_PT, bold=False, color=None):
    run.font.name = CN_FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.append(fonts)
    fonts.set(qn("w:eastAsia"), CN_FONT)
    fonts.set(qn("w:ascii"), CN_FONT)
    fonts.set(qn("w:hAnsi"), CN_FONT)


def add_rich_text(paragraph, text, size=BODY_PT, bold=False, color=None):
    """处理 **加粗** 和 <br> 换行。"""
    segments = text.split("<br>")
    for seg_index, segment in enumerate(segments):
        if seg_index > 0:
            br = paragraph.add_run()
            style_run(br, size=size)
            br.add_break()
        for chunk in re.split(r"(\*\*.+?\*\*)", segment):
            if not chunk:
                continue
            is_bold = chunk.startswith("**") and chunk.endswith("**")
            run = paragraph.add_run(chunk[2:-2] if is_bold else chunk)
            style_run(run, size=size, bold=bold or is_bold, color=color)


def flush_table(doc, rows):
    if not rows:
        return
    header, *body = rows
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, cell_text in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.text = ""
        add_rich_text(cell.paragraphs[0], cell_text, size=9.5, bold=True)
    for row in body:
        cells = table.add_row().cells
        for i, cell_text in enumerate(row[: len(header)]):
            cells[i].text = ""
            add_rich_text(cells[i].paragraphs[0], cell_text, size=9.5)
    doc.add_paragraph()


def parse_row(line):
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    return parts


def convert(src: Path, dst: Path):
    lines = src.read_text(encoding="utf-8").splitlines()

    doc = Document()
    section = doc.sections[0]
    section.page_height = Cm(29.7)
    section.page_width = Cm(21.0)
    section.top_margin = Cm(2.4)
    section.bottom_margin = Cm(2.4)
    section.left_margin = Cm(2.6)
    section.right_margin = Cm(2.6)

    normal = doc.styles["Normal"]
    normal.font.name = CN_FONT
    normal.font.size = Pt(BODY_PT)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), CN_FONT)

    table_rows = []
    list_mode = None

    def end_list():
        nonlocal list_mode
        list_mode = None

    for raw in lines:
        line = raw.rstrip()

        # 表格
        if line.startswith("|"):
            cells = parse_row(line)
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                continue
            table_rows.append(cells)
            continue
        if table_rows:
            flush_table(doc, table_rows)
            table_rows = []

        if not line.strip():
            end_list()
            continue

        # 分隔线
        if re.fullmatch(r"-{3,}", line.strip()):
            doc.add_paragraph()
            continue

        # 标题
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            end_list()
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                add_rich_text(p, text, size=20, bold=True, color=ACCENT)
                p.paragraph_format.space_after = Pt(6)
            elif level == 2:
                p = doc.add_paragraph()
                add_rich_text(p, text, size=14, bold=True, color=ACCENT)
                p.paragraph_format.space_before = Pt(14)
                p.paragraph_format.space_after = Pt(6)
            else:
                p = doc.add_paragraph()
                add_rich_text(p, text, size=12, bold=True)
                p.paragraph_format.space_before = Pt(10)
                p.paragraph_format.space_after = Pt(4)
            continue

        # 引用
        if line.startswith("> "):
            end_list()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.6)
            add_rich_text(p, line[2:], size=BODY_PT - 0.5)
            continue

        # 无序列表（用字面符号，避免依赖模板样式）
        m = re.match(r"^[-*]\s+(.*)$", line)
        if m:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.75)
            p.paragraph_format.first_line_indent = Cm(-0.45)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.4
            add_rich_text(p, "• " + m.group(1))
            list_mode = "ul"
            continue

        # 有序列表（保留原编号，避免 Word 跨列表续号）
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.75)
            p.paragraph_format.first_line_indent = Cm(-0.45)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.4
            add_rich_text(p, f"{m.group(1)}. {m.group(2)}")
            list_mode = "ol"
            continue

        # 普通段落（连续行合并）
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
        add_rich_text(p, line.strip())
        end_list()

    if table_rows:
        flush_table(doc, table_rows)

    dst.parent.mkdir(parents=True, exist_ok=True)
    doc.save(dst)
    print(f"已生成 {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(1)
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
