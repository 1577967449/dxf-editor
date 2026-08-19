# dxf-editor — 与 AutoCAD 2025 一致的网页 DXF 预览 / 编辑工具

> 一个**纯前端**（零后端、零构建步骤）的 DXF 查看器 / 轻量编辑器，目标是让网页打开 `.dxf` 文件的画面**与 AutoCAD 2025 打开完全一致**：同样的显示、同样的操作逻辑、同样的用户习惯。

---

## 一、这是什么

`dxf-editor` 把 AutoCAD 的图纸直接搬进浏览器：块（INSERT）全部展开、按图层名前缀分组、支持模型空间 / 图纸空间（布局）切换、文字框选、对象捕捉、改动后写回原文件。它不依赖任何商业 CAD 内核，所有解析与渲染均在前端用 JavaScript 完成。

- **格式支持**：DXF（ASCII / Binary 自动识别），实测覆盖到最新 **AC1032**（AutoCAD 2025 / R2018 格式）。
- **运行方式**：直接用浏览器打开 `index.html` 即可（建议通过本地 HTTP 服务以获得最佳字体加载体验，见下文「快速开始」）。
- **体积**：核心代码 + 36 个 SHX 字体（约 23 MB），无其他外部依赖。

---

## 二、核心特性

| 特性 | 说明 |
|---|---|
| **块全展开 + 图层前缀分组** | 递归展开所有 INSERT / DIMENSION 块；按图层名前缀（如 `电气-`、`给排水-`）聚合成可一键开关的图层组，对齐 AutoCAD 图层管理器习惯。 |
| **与 AutoCAD 一致的显示** | HATCH 图案填充、线型（LTSCALE / 实体线型缩放）、颜色（ACI / 真彩）、线宽均按 AutoCAD 规则渲染。 |
| **AcDbSpatialFilter / XCLIP 裁剪** | 正确处理带空间裁剪的块参照——这是「网页显示 28 张图、CAD 只显示 3 张」类问题的根因修复（见第四节）。 |
| **模型 / 图纸空间（布局）切换** | 底部标签栏切换「模型 / 布局1 / 布局2…」，图纸空间按视口裁剪渲染（白纸底 + 视口内 ZOOM 适配 + 标题栏/边框/注释）。 |
| **文字框选识别复制** | 橡皮筋框选文字（TEXT / MTEXT / ATTRIB，**含嵌套块内文字**），弹窗逐条复制 / 复制全部 / 导出 `.txt`，并自动复制（对齐广联达快速看图习惯）。 |
| **对象捕捉加固** | 端点 / 中点 / 圆心 + **交点捕捉**（轴线 × 图形真实交点），带性能护栏避免卡顿。 |
| **改后写回原文件** | 「保存」按原文件名写出（含新增 / 移动 / 删除），使用扁平化 `writeFlat` 策略。 |
| **字体自适应** | 内置 36 个 SHX 字体 + 复刻的 AutoCAD 字体映射表 `acad-fmp.json`（521 条），对缺失字体按 AutoCAD 规则做替换逼近；真实矢量字形替换系统字体近似的集成见「已知限制」。 |

---

## 三、与 AutoCAD 2025 一致性校准

本项目以 **AutoCAD 2025（`D:\AutoCAD 2025\acad.exe` 及其无头核心 `accoreconsole.exe`）作为「真值 oracle」**：

1. 对测试集（46 个真实工程 `.dxf`，全部 AC1032）跑批量解析 + 渲染回归；
2. 用 `accoreconsole + LISP (textbox)` 取得真实墨迹框 / 几何真值，与解析器交叉核对；
3. 任何显示偏差（空白、错位、字体、参照可见性）均自动定位根因并修复，**不一致不停**。

### 一致性状态
- 46 / 46 文件全部可解析 + 加载 + 渲染，**0 空白 / 0 错误 / 0 异常**。
- XREF 经 `flatten` 验证产生 0 个残留 INSERT，网页已与 CAD 一致隐藏参照。

---

## 四、关键修复记录

### 1. AcDbSpatialFilter / XCLIP 块参照裁剪（核心）
**问题**：`小高电气平面图_t3.dxf` 在 AutoCAD / GstarCAD 中只显示 **3 张图（1 行 × 3 列：动力 / 报警 / 防雷接地）**，而旧版网页显示 **4 列 × 7 行 ≈ 28 张图重叠**。

**根因**：文件把原外部参照绑定为块 `小高平面图`，顶层存在 4 个 INSERT（句柄 `38A` / `7A6` / `11943` / `2329C` / `1EBCB`），且**每个 INSERT 都带 `AcDbSpatialFilter`（XCLIP）**。扩展字典链为：
```
INSERT(360=xdict) → DICTIONARY(ACAD_FILTER) → DICTIONARY(SPATIAL) → AcDbSpatialFilter
```
旧 `flatten()` 完全忽略裁剪，于是每个 INSERT 把内部 4×7 的块整段展开。裁剪边界经 `INSERT_M ∘ FILTER_M` 映射到世界坐标后，4 个 INSERT 实际落在 **3 个水平条带**（`38A` 与 `7A6` 的世界裁剪矩形重合），整体 X 范围 `253301 → 706639`，与 CAD 的 `$EXTMIN` / `$EXTMAX` 完全吻合。

**修复**：
- `dxf-parser.js` `extractSpatialFilters()` 解析 `SPATIAL_FILTER` 的 group-40 前 12 值得到 3×4 仿射矩阵 `FILTER_M`，按 owner(330) 链回溯到 INSERT 句柄并挂到 `INSERT.spatialFilter`；`flatten()` 用 `INSERT_M ∘ FILTER_M(boundary)` 算世界裁剪矩形，向下传递，叶节点附加 `_clip`。
- `dxf-render.js` 按 `_clip` 分组、`ctx.clip()` **硬裁**，长构造线不跨出图框（区别于仅做包围盒剔除的方案）。

**验证（程序化，模型无法看图，全部用解析 + 像素统计核对）**：
- 小高电气 flatten 后 distinct `_clip` = **3**，且全部同一 Y 带 → **1 行**；X 三列 `[253301,326851]` / `[443195,516745]` / `[633089,706639]` → **3 列**；X 总跨 = CAD `$EXTMIN/$EXTMAX`。
- active 实体 **537974 → 38068**（裁剪生效的直接证明）。
- 46 文件回归：ok=46 / err=0 / blank=0，16 个文件正确触发 XCLIP 裁剪。

### 2. HATCH / 稳健包围盒 / 保存视图判定
- **HATCH 斜线填充**：去掉「线距过小即实心」分支，按缩放自适应线宽，ANSI31 等斜线在缩略视图下不再合并成白块。
- **稳健包围盒 rbounds**：改用逐实体中心百分位，避免野坐标把 ZOOM EXTENTS 拽成亚像素（修复 2 个空白文件）。
- **保存视图判定重写**：改用「落入视口窗口内的实体并集包围盒占比 + 实体占比门槛」，既正确接受远坐标簇的 AutoCAD 保存视图，也正确拒绝只框住少量批注的局部视图（回退显示整图含标题框）。

### 3. 字体校准（真实矢量字形）
- 用 `@mlightcad/shx-parser`（MIT）真实解析 SHX 字形矢量；GBK 反向映射建立 Unicode→GBK 码表供 bigfont 查字。
- `accoreconsole + LISP (textbox)` 实测 **1068 个真值点**，稳健拟合得 **33/34 字体精确 0 误差**；`gbcbig.shx` 的 shape-0 头部 bug 已定位并标定。
- 复刻 `acad.fmp`（521 条）为 `acad-fmp.json`，让选字与 AutoCAD 一致。

---

## 五、快速开始

**方式 A（推荐，字体加载最佳）**——用任意静态服务器打开：
```bash
# 在项目目录下
python -m http.server 8080
# 浏览器访问 http://localhost:8080/index.html
```
> 说明：直接 `file://` 打开也能用，但 SHX 字体会因浏览器 `file://` fetch 限制而回退为系统字体近似（见已知限制）。

**方式 B**——直接双击 `index.html` 用浏览器打开，点击「打开 DXF」选择文件。

操作提示：
- 底部标签栏切换 **模型 / 布局**；
- 工具栏「框选文字」拉框识别并复制图纸文字；
- 「适配」恢复 AutoCAD 保存视图，「缩放」对应 ZOOM；
- 「保存」按原文件名写出。

---

## 六、技术架构

| 文件 | 职责 |
|---|---|
| `index.html` | 页面骨架、工具栏、图层组面板、布局标签栏、文字框选弹窗。 |
| `app.js` | 交互逻辑：打开文件、图层前缀分组、布局切换、文字框选、对象捕捉、保存。 |
| `dxf-parser.js` | DXF 解析（ASCII/Binary）、编码识别、块展开 `flatten()`、`AcDbSpatialFilter` 提取、几何/OCS→WCS 变换。 |
| `dxf-render.js` | Canvas 渲染：HATCH、线型、颜色、XCLIP 硬裁、模型/图纸空间、视口裁剪。 |
| `dxf-writer.js` | 扁平化 `writeFlat` 写回。 |
| `shx-parser.umd.js` / `shx-parser.cjs` | SHX 真实矢量字形解析（MIT）。 |
| `shx-calib.json` / `acad-fmp.json` | 字体缩放标定 + AutoCAD 字体映射表。 |
| `fonts/` | 36 个 SHX 字体（约 23 MB）。 |

---

## 七、字体处理说明

- 当前文本渲染默认使用**系统字体近似**（`SHX_SUBST` + `_fontFamilyFor`），因为真实矢量字形替换系统字体近似的集成（`dxf-render.js` 的 `_drawText`）列为后续项。
- 已具备全部前置能力：36 个 SHX 字体、SHX 解析器、逐字体缩放标定（1068 真值点）、`acad-fmp.json`（521 条映射），可随时接入。

---

## 八、测试与回归

- **测试集**：46 个真实工程 `.dxf`（全部 AC1032），含电 / 水 / 暖 / 建筑 / 结构 / 人防等多专业。
- **结果**：解析 + 加载 + 渲染 **46/46 通过**，0 空白、0 错误。
- **XCLIP 回归**：16 个文件触发空间裁剪（天拖地库系列、20250417 小高给排水等），均正确裁剪。

---

## 九、已知限制

1. **SHX 真实矢量字形**尚未集成进 `_drawText`（当前为系统字体近似）。
2. 以 `file://` 直接打开时，SHX 字体因浏览器 `file://` fetch 限制无法加载，回退系统字体。
3. 「白线随 zoom 显隐」**已修复**（2026-08-19）：根因为 canvas 1px 发丝线居中整数像素时横跨两像素各 50% 渲染成约 50% 灰、随缩放闪烁；修复为描边坐标吸附像素中心（`round+0.5`）。详见 `HANDOFF.md` 第 14 节。
4. 「保存」为展开后当前空间实体的扁平化写出——块结构会被扁平化，外部参照 / 其它布局空间不在导出范围（属已知取舍）。
5. 少数文件 `filters>0 但裁剪窗内无存活实体`（如第二个「小高电气」、天拖地库人防电力），可能 CAD 也显示空，待 `accoreconsole` oracle 复核。
6. **部分图填充丢失**：部分图纸的 HATCH 填充在网页中可能不显示（尤其非标准 / 自定义图案、渐变填充，或边界未正确闭合的填充）。多数源于图案定义未覆盖或边界识别差异，**待排查**。
7. **部分线条排序错乱**：部分重叠实体的绘制顺序（draw order）与 AutoCAD 不一致，导致线 / 填充的上下层关系错乱。AutoCAD 的 `DRAWORDER` / `SORTENTSTABLE` 覆盖尚未在 `flatten()` 输出序列中完全还原，**待实现 draw-order 还原**。

---

## 十、目录结构

```
dxf-editor/
├── index.html            页面与 UI
├── app.js               交互逻辑
├── dxf-parser.js        DXF 解析 + 块展开 + XCLIP
├── dxf-render.js        Canvas 渲染 + 模型/图纸空间
├── dxf-writer.js        写回原文件
├── shx-parser.umd.js    SHX 真实矢量字形解析（MIT）
├── shx-calib.json       字体缩放标定
├── acad-fmp.json        AutoCAD 字体映射表（521 条）
├── fonts/               36 个 SHX 字体（~23MB）
├── HANDOFF.md           项目交接 / 工程纪要（含完整修复时间线）
└── README.md            本文件
```

---

## 十一、许可证

本项目核心解析 / 渲染代码以 MIT 许可证发布；`shx-parser` 依赖遵循其自身 MIT 许可证。字体文件版权归原厂商（AutoCAD / 第三方字体），随工程使用，请遵守相应许可。
