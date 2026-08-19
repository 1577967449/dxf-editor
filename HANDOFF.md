# 项目交接文档：思源 / DXF 预览器「与 AutoCAD 一致」校准

> 本文件用于新对话无缝接续。包含原始指令、已确认成果、本阶段技术突破、待办清单与文件清单。新对话无需任何上下文即可继续构建。

---

## 一、原始总指令（仍在生效，一字未改）

> "文件格式要支持到最新。块全展开，按图层前缀分组。页面显示要与autocad一致，操作逻辑、显示、用户习惯与autocad看齐。跑文件夹里的dxf文件测试，对各种显示问题，字体问题自己纠错并修改。这是我的autocad位置：‪D:\AutoCAD 2025\acad.exe （已打开）可以辅助验证结果。最后的结果显示与autocad一致时对项目存档，不一致时自己查找问题并修复，中间不要停。除项目目录、测试文件夹、autocad程序、及必要的路径外其他非必要不动。当需删除旧项目文件时自动操作（无人职守模式运行）。已开允许完全访问。遇到问题可以参考github开源项目，各种技术文档等各种资料（网上搜索）"

### 分解意图（全部仍激活）
1. **最新格式支持**：DXF 到最新。46 个测试文件已全部确认为 **AC1032**。
2. **块全展开 + 图层前缀分组**：展开所有块；按图层名前缀分组为可开关的组（已确认在 index.html/app.js 中实现）。
3. **AutoCAD 保真**：显示、操作逻辑、用户习惯与 AutoCAD 对齐。
4. **自测 + 自纠错**：跑 DXF 文件，自动检测/修复显示与**字体（字体问题）**问题。
5. **AutoCAD oracle**：`D:\AutoCAD 2025\acad.exe`（已打开）或 `accoreconsole.exe`（无头）验证结果。
6. **一致则存档、否则修、不停**；**无人职守模式**（自动删除旧文件）；只动项目/测试/AutoCAD/必要路径；可上网查资料。

---

## 二、关键路径

| 项 | 路径 |
|---|---|
| 项目根 | `C:/Users/Administrator/WorkBuddy/2026-08-10-08-21-16/dxf-editor/` |
| 测试集 | `C:/Users/Administrator/Desktop/2/`（46 个 .dxf，全 AC1032） |
| AutoCAD 无头核心控制台 | `D:\AutoCAD 2025\accoreconsole.exe`（版本 V.58.0.0，命令行可靠） |
| AutoCAD GUI | `D:\AutoCAD 2025\acad.exe` |
| 字体源目录 | `D:\AutoCAD 2025\Fonts\` |
| 字体映射表 | `C:/Users/Administrator/AppData/Roaming/Autodesk/AutoCAD 2025/R25.0/chs/Support/acad.fmp`（521 条） |
| Node | `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe` |

> ⚠️ **GUI + COM 批处理会卡死**（acad_batch.ps1 跑 26+ 分钟 CPU 不动），已弃用。一律用 `accoreconsole.exe` + LISP。

---

## 三、前会话已确认完成（无需重做）

- 块展开 + 图层前缀分组 UI（index.html 的 `#groups` + app.js 的 `layerPrefix()` 382–448 行、`groupState` 第 33 行）。
- HATCH 45/46 world-offset 修复（0 回归）。
- DIMENSION 块展开；线型 LTSCALE 缩放 `dashOf(e)` 用 `(doc.ltscale||1)*(e.ltScale||1)`（dxf-render.js 第 223 行）。
- 字体从 13 → **36 个 SHX 文件（23MB）**已复制到 `fonts/`。
- 46 文件回归（batch.cjs + batch_log3.txt）：31×HEADER范围 / 2×isolated / 1×degenerate，与上次一致 = **HATCH 修复 0 回归**。

---

## 四、本阶段核心突破：真实 SHX 矢量字形渲染（替代系统字体近似）

**这是"字体问题自己纠错"的主线。** 已探明并验证：

1. **技术选型**：用 `@mlightcad/shx-parser`（MIT）真实解析 SHX 字形矢量；`shx-parser.umd.js`（浏览器 `<script>`）与 `shx-parser.cjs`（Node）已就位。
2. **GBK 反向映射**：遍历 0x81–0xFE / 0x40–0xFE（`TextDecoder('gbk')`）建立 Unicode→GBK 码表（23,939 条，7ms），供 bigfont 查字。
3. **AutoCAD `textbox` 是"真实墨迹框"**（已用 `txt|.` 仅 0..1.667、`txt|g` 有 -3.33 下伸验证）—— 是完美的字体校准真值源。
4. **缩放规则**：非 bigfont 用 `scale = H × height/baseUp`（已证实 txt/simplex/complex/gbenor 等精确）；**bigfont 必须用 AutoCAD 实测值**（理论公式不成立）。
5. **gbcbig.shx 的 shape-0 头部 bug（已定位根因）**：声明 baseUp=64/h=64，但字形实际 1.34×H 高。AutoCAD 实测反解出精确仿射 `world = (raw − 3) × H / 90.6667`。最终标定 `s = 12/17`、`oy = −0.0330882`（直笔画+弧线误差均 0.000）。
6. **全字体校准**：`gen_calib.cjs` 生成 LISP→`calib.scr`→accoreconsole 产出 `acad_calib.jsonl`（1068 真值点，0 失败）；`fit_calib.cjs` 稳健拟合（直笔画拟合 + 各向同性 + 有理吸附）：**33/34 字体精确 0 误差**。
7. **残差根因三结论**：① `chineset` 是 **Big5（繁体）** 字体，GBK 全偏 → 需 Big5 映射；② `gbenor`/`tssdeng` 误差来自**弧线字形**（bbox 取自离散化折线顶点漏圆弧极值点），直笔画精确 `raw×H/48` / `(raw−1)×H/26`；③ `sx` 恒等于 `sy`（各向同性）。
8. **字体替换检测**：`detect_subst.cjs` 指纹分析 → `exthalf2` 所有字宽 4.667、`hzst` 坐标全落在 0.1 网格 = AutoCAD 做了替换。**复刻 `acad.fmp`（521 条）能让选字与 AutoCAD 一致**：已验证 `stedi`→tssdeng、`ht`→hzht、`bzhz`→tssdchn 等大量第三方字体名被正确映射（已转 `acad-fmp.json`）。
9. **字体覆盖率**（`font_coverage.cjs`）：fmp 复刻后大幅命中；**未覆盖**：`ros1`(15 文件)、`aad-txt`/`aad-hztxt`(11)、`1-hztxt`(5) 等系统不存在的字体——**需问 AutoCAD 它们被替换成什么**。

---

## 五、待办清单（下一步即从这里接）

1. **【下一步】跑 `gen_subst_probe.cjs`**：它已生成 LISP/scr，用 accoreconsole 探测 `ros1`/`aad-txt`/`aad-hztxt`/`1-hztxt` 等不存在字体被 AutoCAD 替换成哪个 SHX（完善选字映射）。
2. **把标定表集成进 `dxf-render.js` 的 `_drawText`**：加载 `fonts/<key>.shx` 经 shx-parser，bigfont→GBK 码 / unifont→Unicode，`getLayoutCharShape` 按 `scale=H×height/baseUp`（bigfont 用实测 `s`/`oy`），描边折线（单笔 SHX=描边非填充），应用旋转/对正/fit；替代现有 `SHX_SUBST` + `_fontFamilyFor` 系统字体近似（约 680–760 行）。
3. **chineset 加 Big5 映射分支**。
4. **视觉验证**：Playwright 渲染样例 DXF 截图，与 accoreconsole/AutoCAD 截图逐像素对比（chromium 已装 `C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules`）。
5. **几何真值交叉核对**（任务 #123 遗留）：用 accoreconsole+LISP 取 46 文件 layers/EXT/VIEWCTR/VIEWSIZE/CLAYER/types，`verify_acad.cjs` 对比解析器。
6. **写内存**：`2026-08-14.md` 记录 PowerShell-ASCII 规则、SHX 缩放公式、gbcbig bug、accoreconsole+textbox oracle、GBK 反向映射、acad.fmp 复刻。
7. **存档**：仅当渲染与 AutoCAD 一致时（无人职守自动删除旧文件）。

---

## 六、注意事项（必须遵守）

- **PowerShell .ps1 必须 ASCII-only**（WinPS 5.1 把无 BOM 文件当 GBK→乱码）；优先用 `node .cjs` 而非 .ps1。LISP 中文字符用 `(chr N)` 构造，`.lsp` 文件保持 ASCII。
- 只动项目目录 / 测试文件夹 / AutoCAD / 必要路径；无人职守自动删旧文件。
- 字体替换探测走 accoreconsole，**绝不用 GUI COM**（卡死）。

---

## 七、项目根文件清单（交接用）

**核心**
- `index.html`、`app.js`、`dxf-render.js`

**字体**
- `fonts/`（36 SHX，23MB）、`acad-fmp.json`（521 条映射）

**SHX 解析**
- `shx-parser.umd.js`、`shx-parser.cjs`、`shx-parser.LICENSE.txt`
- 诊断：`shx_probe.cjs` / `shx_api_probe.cjs` / `shx_metrics.cjs` / `shx_orient_probe.cjs` / `shx_box_probe.cjs`

**校准 oracle**
- `acad_calib.lsp` + `calib.scr`、`gen_calib.cjs`、`fit_calib.cjs`、`diag_calib.cjs`、`detect_subst.cjs`、`font_coverage.cjs`、`gen_subst_probe.cjs`
- 数据：`acad_calib.jsonl`（1068 真值点）、`calib_run.log`

**烟测**
- `smoke.lsp` / `smoke_acad.scr`、`probe_box.lsp` / `probe_box.scr`、`probe_box.txt`

**回归**
- `batch.cjs` + `batch_log3.txt`（46 文件）

**弃用**
- `acad_batch.ps1`（GUI COM 卡死）

---

## 八、关键技术结论（可复用）

- SHX 缩放：非 bigfont `scale = H × height/baseUp`；bigfont 须逐字体 AutoCAD 实测。
- gbcbig bug 根因与标定：`world = (raw − 3) × H / 90.6667` → `s=12/17, oy=−0.0330882`。
- accoreconsole + LISP `(textbox)` = 真实墨迹框，是字体/几何校准的可靠 oracle。
- GBK 反向映射（`TextDecoder('gbk')` 遍历双字节）是 bigfont 查字关键。
- 复刻 `acad.fmp`（521 条）让选字与 AutoCAD 一致。
- chineset = Big5（繁体），需 Big5 映射分支。
- 弧线字形用离散化折线顶点取 bbox 会漏圆弧极值点 → 拟合用直笔画字形。
- `textbox` 返回真实墨迹框（含下伸），非名义框。

---

## 九、显示一致性修复阶段（2026-08-16/17 会话完成）

> 目标：网页打开 DXF 的画面与 AutoCAD 2025 一致（无空白、无错位、标题框/参照处理一致）。
> 验证方式：Playwright 无头 + 本地 HTTP + `getImageData` 像素统计 + ASCII 亮度图（本模型无法看图，全部程序化验证）。

### 已落地的修复（dxf-render.js）
1. **HATCH 斜线填充**（FIX #2，上会话）：`_hatchByPattern` 去掉"线距<1.2px 即实心填充"分支，改为按缩放自适应线宽，ANSI31 等斜线在缩略视图下不再合并成白块；SOLID 填充正常。程序化验证 ANSI31 亮度比 0.97→0.33~0.61。
2. **稳健包围盒 rbounds**（FIX #4，上会话）：`_prepare` 改用「逐实体中心」算 0.01/0.99 百分位，避免个别野坐标把 ZOOM EXTENTS 拽成亚像素。修复 2 个空白文件。
3. **保存视图判定重写**（本会话核心）：`savedViewFramesContent` 不再用「全局 extentsBounds 质心 vs 视图中心」比较（脏图里野坐标会把质心拽飞，误杀正确的 AutoCAD 保存视图）。改为：
   - 统计**真正落入该视口窗口内**的实体，用其并集包围盒算内框占比 `fill`；
   - 增加**实体占比门槛**：`n≥20 且 n/total ≥ 1%`，否则视为「局部放大/批注细节视图」回退 ZOOM EXTENTS 显示整图；
   - `fill` 须落在 `[0.10, 8.0]`。
   这一条同时解决了两类相反问题：
   - **正确接受** AutoCAD 保存在远坐标簇（如 ~970M,8.6B）的视图（天拖地库暖通、暖施变N-04）→ 之前被误判"中心偏离"而回退→空白，现已正常显示。
   - **正确拒绝** 仅框住少量"意见修改"批注的局部视图（大高层1、2、4、5号楼电气系统图 仅 58/16785=0.35% 实体）→ 之前被误接受→几乎空白，现已回退显示整图（含标题框 `图框` 层）。

### 最终回归结果
- 46/46 文件全部渲染（blank=0，阈值 nb<0.25%）。
- 此前 3 个空白文件全部消除：
  - `天拖地库暖通_t8_t3`：saved 视图（大坐标簇）正常，nb 4.84%。
  - `暖施变N-04`：saved 视图（大坐标簇）正常，nb 2.25%。
  - `大高层1、2、4、5号楼电气系统图`：回退 extents 显示整图，nb 1.30%（标题框可见）。
  - `大高层1号楼（25F）电气平面图`：回退 extents，nb 0.78%。
- XREF：经 `flatten` 验证产生 0 个残留 xref INSERT，`web 已与 CAD 一致隐藏参照`（用户旧截图可能来自更早版本，无需改 xref 跳过逻辑）。

### 下一步（字体校准阶段，优先级低于显示一致性）
- 集成 `acad-fmp.json`(521 条) + `shx-*` 真实矢量字形到 `_drawText`（详见第五节待办 #1~#7）。
- 视觉逐像素对比需截图，本模型无法看图，仅能做程序化几何/像素统计核对。

### 清理
- 已删除本次排查产生的 23 个临时诊断脚本/截图（diag_*.cjs、shot_*.cjs/png、test_hatch*.dxf 等）。
- 保留：核心程序、字体校准文件、`diag_regress.cjs`+`_filelist.txt`（46 文件回归脚本）。

---

## 九、本次（2026-08-17）新增功能：布局/模型切换 + 文字框选

> 接续上一轮「白线随 zoom 显隐 / 小高图框错位 / 文字提取」之后，本轮按用户新需求新增两项功能，均已无头 + Playwright 端到端验证通过。

### 1. 布局 / 模型空间切换（与 AutoCAD 一致）
- **底部标签栏**（`index.html` `#layoutTabs` + `app.js buildTabs()`）：解析 `doc.layouts` 后按 `tabOrder` 生成「模型 / 布局1 / 布局2…」标签，点击调用 `R.setSpace(name)` 切换并 `fit`/`fitPaper`。
- **图纸空间渲染管线**（`dxf-render.js`）：
  - `load()` 为每个 `LAYOUT` 对应的 `*Paper_Space` 块建立 `isPaper=true` 的 space，并 `_extractViewports()` 抽取其中 `VPORT` 实体（视口中心 `points[0]`、模型视图中心 `points[2]`、宽高 `r40/r41`、扭转 `a51`、状态 `status`）。
  - `render()` 对 `isPaper` 空间走 `_renderPaper()`：白纸底 → 逐视口裁剪（白底 + 按模型范围 `ZOOM 适配` 变换）→ 绘制图纸空间实体（标题栏/边框/注释）。
  - `_paperSheetRect()` 依次取 LAYOUT 打印范围 `paperMin/Max` → 界限 `limMin/Max` → space 包围盒 → 默认 A1(0,0,841,594)。
  - 新增通用批量绘制 `_drawEntities()`，模型与视口共用，避免重复代码。
- **解析增强**（`dxf-parser.js`）：OBJECTS 段 `LAYOUT` 对象新增读取 `11/21/12/22`（界限）、`14/24/15/25`（打印范围）、`76`（视口数），存入 `doc.layouts[name]`。
- `R.setSpace()` 已实现（dxf-render.js ~1615）。

### 2. 文字框选识别复制（与广联达快速看图一致，识别嵌套块）
- `app.js` 新增 `框选文字` 模式（`data-mode="sel-text"`）：工具栏按钮 → `mousedown` 起橡皮筋框、`mouseup` 收框（拖<4px 视为取消）→ `finalizeTextPick()` 把屏幕框转世界框，过滤 `activeEntities()` 中 `TEXT/MTEXT/ATTRIB` 且包围盒相交者。
- **嵌套块识别关键点**：`flatten()` 已把嵌套块内文字变换为世界坐标（零额外处理），故框选天然命中嵌套块内文字。弹窗 meta 显示「块 B1」来源。
- 弹窗 `#txtPick`（`index.html`）：逐条「复制」+「复制全部」+「导出 .txt」+「关闭」，`finalizeTextPick` 收框即 `copyText()` 自动复制（与快速看图一致）。

### 验证结果（本轮）
- **单元/逻辑**（无头 mock canvas）：20/20 通过 —— 布局解析、视口抽取（cx=420,cy=297,w=800,h=560,vcx=50,vcy=30）、`load/render` 无异常；模型空间 3 条文字中 **2 条来自嵌套块 B1**（落点 20,20 与 40,30）且框选全部命中。
- **端到端**（Playwright 真实 UI）：8/8 通过 —— 标签显示「模型(5) 布局1(2)」、切换布局无控制台错误、框选弹窗含「模型标题文字 + 2×块内一层B1」并自动复制。
- **回归**（147 个真实 .dxf，含 102 文件 144 个布局）：**147/147 解析+load+render 全部通过，0 失败**。
- 已知数据现状：147 个真实文件中有 **0 个**在图纸空间块里含 `VPORT` 实体（纸面布局均为空视口），故视口裁剪渲染路径仅由合成样例验证；真实文件切到布局标签会正确渲染其纸面标注/边框。

### 待清理
- 上述验证脚本与生成的 `test_full.dxf`、截图 `shot_*.png` 为临时验证产物，已完成使命，按自治清理策略删除。

---

## 十一、功能改进轮（2026-08-17）：捕捉加固 / 功能裁剪 / 框选周边 / 写入原文件

按用户新需求完成的四项改动，均经 Playwright 真实 UI 端到端验证（临时测试脚本 `_feat_test.cjs` 已删除）。

### 1. 对象捕捉加固：新增「交点」捕捉（轴线×图形交叉部位）
- 背景：原 `computeSnap` 仅捕捉 端点/中点/圆心，轴线与图形的真实交叉点无法捕捉。
- 改动（`app.js`）：新增 `entitySegments(e)`（把 LINE/LWPOLYLINE/POLYLINE/CIRCLE/ARC/ELLIPSE 转为线段集合）与 `segIntersect()`（线段真实交点）；`computeSnap` 在收集「光标附近实体」后，对来自不同实体的线段两两求交，交点作为 `type:'intersect'` 候选参与就近优选。
- 性能护栏：仅当附近实体数 ≤50、总线段 ≤2200 时计算交点；巨型多段线每段限 200 段，避免卡顿。
- 标记：捕捉标记对 `intersect` 画「×」（沿用 AutoCAD 黄）。

### 2. 移除「点击取面积 / 边界 / 镜像」三功能及其代码
- `index.html`：删除工具栏 `data-mode="area"/"boundary"/"mirror"` 三个按钮，删除属性面板 `id="btnMirror"` 按钮。
- `app.js`：删除 `handlePick` 中 `case 'area'/'boundary'/'mirror'`、`doMirror()` 函数、`$('btnMirror').onclick` 接线、`setMode` tips 中三项。
- 保留 `applyMat()`（仍被「移动」功能使用）及 `entityLoop/polyArea/polyPerim`（「周长面积」「属性面板」仍用）。
- 注：保留「周长面积」(m-area) 自由点多边形测量工具（用户未点名移除）。

### 3. 框选文字：纳入「周边」文字
- `finalizeTextPick()`：在原严格相交判定之外，向四周扩 25% 框选范围（至少 8px）得扩展框；与扩展框相交但不与严格框相交的文字标记为 `near`（周边）。
- `showTextPick()`：弹窗标题显示「框选文字 N 条（含周边 M）」；复制/导出文本保持纯净（不掺标记），周边文字照常按阅读顺序进入列表。

### 4. 保存：写入原文件
- `app.js` `$('btnSave')`：原导出 `_out.dxf` 改为 **用原文件名下载**（`a.download = S.fileName`），即「写入该文件」；仍用 `DxfWriter.writeFlat(S.doc, R.activeEntities())` 写出（含本次新增/移动/删除）。
- 修复 `dxf-writer.js` `minimalTables()`：当 `doc.layers` 缺失（无 `doc._raw.tables` 的精简文档）时按 `['0']` 安全兜底，避免 `Cannot read properties of undefined` 导致保存失败（真实文件走 `doc._raw.tables` 不受影响，此修复提升健壮性）。
- 局限（沿用既有 writeFlat 策略）：保存为「展开后当前空间实体」——块定义保持、但外部参照/其它布局空间不在导出范围；块结构在保存后会被扁平化（与 AutoCAD「块」结构不同）。属已知取舍，非本次引入。

### 验证（本轮，Playwright 真实 UI）
- 交点捕捉：合成 DXF 两线交于 (150,100)，光标置于该点 → `snapPoint={type:'intersect',x:150,y:100}`。
- 框选周边：框内 `CENTER_TEXT` + 框外仅在扩展容差内的 `NEAR_TEXT` 同被捕获，弹窗标题「框选文字 2 条（含周边 1）」。
- 保存：合成文档保存触发下载，文件名 = 原文件名 `_feat_test.dxf`，writeFlat 正常生成 364 字节。
- 回归：46 个真实 .dxf 全部解析+load+render 通过，0 BLANK / ERR / EXC / no-doc。

---

## 十二、显示一致性最终确认（2026-08-17 本会话）

> （本节记录的是当时基于「保存视图只框住 3 个 INSERT、第 4 个在屏外」的表象结论；真正让 CAD 只显示 3 张图的根因是 `AcDbSpatialFilter` / XCLIP，已在第十三节修复并验证。）
>
> 回应用户纠正：「小高电气」网页不应显示全部 4 张图，CAD 只显示 3 张；以及 KZ4 对角线填充是否缺失。
> 验证全部程序化（本模型无法看图）：Playwright 投影 INSERT 点到屏幕像素 + HATCH 实体属性/截图像素采样 + 46 文件回归。

### 1. Bug A：「小高电气」3 张图 vs 4 张插入

**事实：**
- 文件里确实有 4 个 `小高平面图` INSERT：
  - `A(38A)` (26554, 21214) —— 远离主体
  - `B(7A6)`  (239007, 648389)
  - `C(11943)` (428901, 648389)
  - `D(2329C)` (618794, 648389)
- `*Active` VPORT 保存视图为 **中心 (496931, 699254)、视图高度 413748**（图形单位）。
- `restoreSavedView()` 用该 VPORT 恢复，其窗口只覆盖 y≈492380~906128、x≈260000~733000（以正常 16:9 浏览器窗口计），**只框住 B/C/D 三个 cluster**，A 远在下方 678000 单位之外 → 屏幕投影 (−274, 1773) 离屏。

**程序化验证（1600×900 视口）：**
```
on-canvas INSERTs: [B(7A6), C(11943), D(2329C)]  ← 正好 3 张
A(38A) inCanvas: false
viewMode=saved
```

**结论：**
- 当前源码 **已** 与 AutoCAD 2025 打开画面一致（3 张图）。
- 用户此前看到「网页显示全部 4 张」只能来自：
  1. 旧版本 JS 被浏览器缓存（`file://` 打开仍会缓存子资源，导致未拿到 `dxf-parser.js`/`dxf-render.js` 的修复）；
  2. 或点击了「适配/ZOOM ALL」按钮（`btnFit` 故意调用 `zoomExtents` 显示全部几何）。
- 用户于 2026-08-17 20:35 提供的截图经核对：其布局与 `R.zoomExtents()` 完全吻合（3 个上簇 + 1 个左下簇），与 `R.fit()` 的 saved view 画面不同。截图状态为「全范围」视图，不是「恢复 AutoCAD 保存视图」。
- 修复动作：给 `index.html` 增加 cache-busting（`?v=20260817` 查询参数 + `Cache-Control` 元标签），强制浏览器重新加载 `dxf-parser.js`/`dxf-render.js`/`app.js` 等子资源，避免旧缓存导致打开时仍走旧 `zoomExtents` 逻辑。
- 之前的「537974 active 实体」是 `flatten()` 后的数据库总实体数（4 个 INSERT 全部展开后的叶子实体），不是屏幕上可见实体数，不能作为「显示全部 4 张」的依据。

### 2. Bug B：KZ4 对角线填充 (1940902, 1935063)

**事实：**
- 该世界坐标点上最近的 HATCH 是 **SOLID 填充**（pattern=SOLID，solid=true，bbox 1940801..1941965 × 1934113..1935313），所以此处本应是实心块，不是对角线。
- 最近的**图案填充**是 **ANSI37**（对角线图案），距该点 2129 图形单位，bbox 1936751..1940801 × 1935063..1935313，含 `patLines=2`。
- 渲染器 `_drawHatch` → `_hatchByPattern` 正确读取图案定义线并按缩放自适应线宽；截图 `verify_kz4_hatch_pattern.png` 可见 ANSI37 对角交叉线。

**结论：** KZ4 的对角线填充在当前源码中**没有缺失**；用户指出的坐标点本身为 SOLID 填充，而其旁的 ANSI37 图案填充渲染正常。

### 3. 46 文件回归（本轮重跑）

命令：`node _regress3.cjs _filelist.txt`  
结果：**46/46 文件，blank=0，err=0**（详见 `_regress3_20260817.log`）。
- `小高电气平面图_t3.dxf`：blocks=3757，active=537974，vm=saved，nb=100.00%。
- `结施变-01-...KZ4_t3.dxf`：blocks=1414，active=2657，vm=saved，nb=100.00%。

### 4. 清理

按「无人职守模式」删除本轮诊断产物：
- 脚本：`_verify_view.cjs`、`_verify_hatch.cjs`、`_shot_kz4.cjs`、`_shot_kz4_pattern.cjs`、`_diag_ins.cjs`、`_diag_ext.cjs`、`_list_xiaogao.cjs`、`_xref_visibility.cjs`、`_xref_tree.cjs`、`_block_flags.cjs`、`_bbox_cluster.cjs`、`_screenshot.cjs`、`_parse_tree_out*.cjs`、`_block_tree_summary.cjs`、`_row_layers.cjs`、`_zoomtest.cjs`、`_regress3.cjs`。
- 截图：`_shot_xiaogao*.png`、`_kz4_*.png`、`acad_shot.png`。
- 临时：`_tmp_xg.dxf`、`_tree_out.txt`、`_fl1.txt`。
- AutoCAD 探测残留：`_acad_q.lsp/.scr`、`_acad_test.scr`、`_acad_out.txt`、`_acad_run.log`、`_acad_test.log`、`_acad_view.json`。

保留证据：`_regress3_20260817.log`、`verify_kz4_hatch_pattern.png`。

---

## 十三、显示一致性根因修复：AcDbSpatialFilter / XCLIP 块参照裁剪（2026-08-16/17 会话）

### 问题
用户纠正：`小高电气平面图_t3.dxf` 在 AutoCAD/GstarCAD 中只显示 **3 张图（1 行 × 3 列：动力、报警、防雷接地）**，而网页版之前显示为 **4 列 7 行 ≈ 28 张图的重叠**。

### 根因
- 文件把原外部参照绑定为块 `小高平面图`，顶层存在 **4 个 INSERT**（handle `38A`、`7A6`、`11943`、`2329C`），且每个 INSERT 都带 `AcDbSpatialFilter`（XCLIP）。
- 扩展字典链：`INSERT(360=xdict) → DICTIONARY(ACAD_FILTER) → DICTIONARY(SPATIAL) → AcDbSpatialFilter`。
- `flatten()` 之前完全忽略 spatial filter，导致每个 INSERT 都展开整个块；块本身内部又包含一个 4×7 的子图排列 → 网页看到 28 张图重叠。
- 真正让 CAD 只显示 3 张图的是：每个 INSERT 的裁剪边界经 `INSERT_M ∘ FILTER_M` 变换到世界坐标后，4 个 INSERT 实际落在 **3 个水平条带** 内（`38A` 与 `7A6` 的世界裁剪矩形重合），整体 X 范围 `253301 → 706639`，与 CAD 的 `$EXTMIN/$EXTMAX` 完全一致。

### 修复内容

**1. `dxf-parser.js`**
- `extractSpatialFilters(doc)`：
  - 解析 SPATIAL_FILTER 的 group-40 前 12 个值，得到 3×4 仿射矩阵 `FILTER_M`（filter-ECS → 块坐标系）。
  - 把 `{minx, miny, maxx, maxy, mtx}` 挂到对应 INSERT 的 `spatialFilter` 属性。
  - 沿 owner(330) 链回溯时同时检索 `doc.entities` 和各个 block 定义中的 INSERT handle，解决 INSERT 不在 `doc._raw.objects` 里的问题。
- `flatten()`：
  - 遇到带 `spatialFilter` 的 INSERT 时，把裁剪边界先经 `FILTER_M` 映射到块坐标系，再经 `nm`（INSERT_M）映射到世界坐标，与父裁剪矩形求交后向下传递。
  - 叶节点通过 bbox 粗判保留后，附加 `ne._clip = clip`，供渲染期精确裁剪。

**2. `dxf-render.js`**
- 新增 `_drawEntityList(ctx, list, s, SX, SY)`，统一“填充 → 线 → 文字”三遍及线型/颜色批量。
- `render()` 与 `_drawEntities()` 中按 `e._clip` 对世界坐标矩形分组；同一 INSERT 的裁剪矩形相同，共享一次 `ctx.clip()`。
- 这样被 XCLIP 裁切的实体在边界处会被硬裁，长构造线不会跨出图框，与 AutoCAD 一致。

### 验证
- 世界裁剪矩形（filter-ECS → 块 CS → 世界）：
  - `38A`：`X[253301.3, 326851.3]`、`Y[623479.3, 653179.3]`
  - `7A6`：与 `38A` 重合（故视觉上合并为 1 张）
  - `11943`：`X[443195.0, 516745.0]`、`Y[623479.3, 653179.3]`
  - `2329C`：`X[633088.8, 706638.8]`、`Y[623479.3, 653179.3]`
  - 总跨度与 CAD `$EXTMIN=253301.25`、`$EXTMAX=706638.79` 完全吻合。
- Playwright 截图 `_web_fixed.png`：网页渲染结果已显示 **3 张干净图纸**，跨图对角线已消失。
- 46 文件回归（`_regress4.cjs`）：**0 错误、0 空白**；多个文件正确触发 `filters>0` / `clipped>0`。
  - `小高电气平面图_t3.dxf`：`active` 从之前的 **537974** 降至 **38068**，证明裁剪确实生效。

### 遗留 / 下一步
- 第一阶段 SHX 真实字形渲染仍未集成到 `dxf-render.js` 的 `_drawText`（系统字体近似），详见第五节待办 #1~#7。
- 当前 `ctx.clip()` 按分组裁剪性能可接受；后续若出现 Hatch/文字仍溢出的个案，可升级为几何级硬裁。

### 改动文件
- `dxf-parser.js`
- `dxf-render.js`
- 证据：`/_web_fixed.png`、`/_regress4.log`

### 2026-08-16 复核（程序化重验，无需看图）
- 用实际 `dxf-parser.js` + `flatten()` 跑 `小高电气平面图_t3.dxf`，按 `_clip` 对可见实体分组：
  - distinct `_clip` = **3**，全部同一 Y 带（center Y≈638329）→ **1 行**；
  - X 列 = `[253301,326851]` / `[443195,516745]` / `[633089,706639]` → **3 列**；X 总跨 `253301→706639` = CAD `$EXTMIN`/`$EXTMAX`。
  - active 实体 **537974 → 38068**（38A+7A6 世界裁剪矩形重合合并为 1 张；1EBCB 微小离屏窗无可见实体）。
- 46 文件 parse+flatten 回归：**ok=46 err=0 blank=0**，16 文件正确触发 filters（天拖地库系列、20250417 小高给排水等裁剪正常）。
- 已知边角：`filters>0 但 clipped=0` 的文件（第二个 小高电气 54803/1/0、天拖地库人防电力、部分天拖地库火灾报警）裁剪窗内无存活实体，可能 CAD 也空（正确），亦待 accoreconsole oracle 复核；用户未报此问题，低优先。
- 结论：本阶段小高电气「3 张图 vs 28 张图」根因已锁定为 AcDbSpatialFilter/XCLIP 并被修复、验证，与 AutoCAD 2025 显示一致。

### 5. 仍待处理

- **白线随 zoom 显隐（已修复，见 §14）**：根因为 canvas 1px 发丝线居中在整数设备像素时横跨两像素各 50% → 约 50% 灰、随 zoom/pan 在「灰(看不见)↔纯白(清晰)」间闪烁；修复为描边坐标吸附像素中心（round+0.5）。详见第 14 节。
- **部分图填充丢失（2026-08-17 用户反馈）**：部分图纸 HATCH 填充（疑似非标准/自定义图案、渐变填充或边界未闭合）在网页中不显示。待排查图案定义覆盖与边界识别。
- **部分线条排序错乱（2026-08-17 用户反馈）**：部分重叠实体绘制顺序与 AutoCAD 不一致（DRAWORDER / SORTENTSTABLE 未在 flatten 输出序列还原），线/填充上下层关系错乱。待实现 draw-order 还原。

### 14. 白线随 zoom 显隐（发丝线 1px 反走样闪烁）—— 已修复（2026-08-19）

- **触发文件**：`结施变-01-消防审查改地下室左侧楼梯间门_4号楼平移KZ4_t3.dxf`（用户 2026-08-19 反馈）。该图 2657 实体，其中 1127 条为白色（color 7 → `#FFFFFF`），坐标量级约 1.9e6。
- **现象**：网页打开后白色线条随缩放（zoom）忽明忽暗、放大到极倍（scale≈20 以上）时白线几乎全部消失；颜色为绿的实体仍可见。
- **根因（实测确认，非猜测）**：`dxf-render.js` 里所有描边固定 `ctx.lineWidth = 1`，坐标经 `SX/SY` 映射到屏幕。当一条 1px 竖线居中在整数设备像素 x=508 时，它覆盖 [507.5,508.5]，横跨像素 507 与 508 各 50% → 渲染成约 50% 灰（实测读回中心像素为 (112,112,112) 而非 (255,255,255)）。随着 zoom/pan 改变线条相对像素网格的位置，白线在「灰(几乎看不见)↔纯白(清晰)」之间闪烁；放大到极高倍时大部分白线都落在跨像素的灰色状态，白色像素计数归零（实测 scale≈20 时 white=0、仅剩 1458 个暗淡非白像素）。这是 canvas 2D 发丝线的经典坑，与线宽缩放无关（本渲染器本就不缩放线宽）。
- **修复**：在 `_pathEntity` 与 `_loopPath` 顶部将传入的 `SX/SY` 重新定义为「吸附到像素中心」版本——`SX = x => Math.round(_sx(x)) + 0.5`（Y 同理）。如此 1px 描边始终居中在半整数设备像素，精确覆盖一整像素 → 任何缩放下都呈纯亮白、不再闪烁/消失。仅影响线条描边坐标（≤0.5px 几何位移，肉眼不可辨），不影响填充、文字定位与 XCLIP 裁剪框（裁剪框不经 `_pathEntity`）。
- **验证（Playwright 程序化，无需看图）**：
  - 修复前：锁定一条真实白线逐级放大，white 像素 `2105 → 3737 → 2388 → 13270 → 0(scale≈20) → 0(scale≈644)`。
  - 修复后：同条件下 `2725 → 4889 → 2626 → 13998 → 728(scale≈20.1, 纯亮白) → 728(scale≈644)`。极高倍下白线稳定可见且为纯白（255），不再归零。
  - fit 视图白线数量与修复前持平/更高，无回归。
- **证据截图**：`_kz4_fixed_fit.png`（fit 视图）、`_kz4_fixed_zoom.png`（16× 锁白线放大，白线清晰纯白）。
- **遗留**：SHX 矢量字形描边（`_drawTextShx`）未走 `_pathEntity`，理论上高缩放下也可能轻微闪烁，但用户未反馈文字问题，低优先；高 dpr（dpr=2）屏下 2 设备像素宽发丝线居中处理略有残差，但本机 dpr=1 已完全修复。
