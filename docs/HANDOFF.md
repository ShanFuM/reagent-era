# 交接手册 · HANDOFF

> 写给下一个接手的人（和你的 AI）。读完这一页你就能改东西。
> 项目宪法在 [`AGENTS.md`](../AGENTS.md)，玩法与数值在 [`GDD.md`](GDD.md)。

---

## 0. 一句话现状

《试剂纪元》是一个**回合制化学对战游戏**，纯前端、无后端。
12 关全部可玩（高三线），96 种物质、96 条手写方程式，外加一套**反应规则引擎**兜底。
构建产物是一个 220 KB 的单文件 HTML，双击即玩。

**你要接手的两件事**：
1. 修 bug
2. 做其他年级线的关卡（初三 / 高一 / 高二）

---

## 1. 五分钟跑起来

```bash
# 1. 装依赖（必须用 pnpm，且不要删 .npmrc）
pnpm install

# 2. 开发服务器
pnpm dev            # → http://localhost:5173

# 3. 出可玩的单文件离线包
pnpm build:single   # → dist-single/index.html，双击即玩
```

**如果你 `pnpm install` 报符号链接错误**：说明 `.npmrc` 没生效或被删了。
它里面的四条都是必须的：

```
node-linker=hoisted            # 不用符号链接
package-import-method=copy     # 复制代替硬链接
dangerously-allow-all-builds=true  # 允许 esbuild 跑安装脚本
```

第三条容易被忽略：pnpm 10 起默认不执行依赖的安装脚本，
装完会返回**非 0 退出码**，看起来像失败（报 `ERR_PNPM_IGNORED_BUILDS`）。

如果 `.npmrc` 没解决，直接在命令里加参数：

```bash
pnpm install --dangerously-allow-all-builds
```

CI 里就是这么写的（`.github/workflows/ci.yml`），因为那两个配置项在 CI 环境下没生效。

> Node 版本没要求，18 以上都行。项目没有原生依赖，不需要 Python 或 C++ 工具链。

---

## 2. 项目地图

```
data/*.json  ──┐
               ├─→ src/engine/data.ts ──→ lookupReaction(a, b)
src/engine/chem.ts ┘         │                    │
   （规则引擎）               │                    ▼
                              │            src/engine/battle.ts
                              │            （状态机、伤害、胜负）
                              │                    │
                              └────────────────────┴─→ src/ui/*.tsx
                                                       （只负责显示）
```

**关键约定**：`battle.ts` 不碰 DOM、不读 localStorage、不 console.log。
它只接收状态、返回新状态。这样以后要做联机 / 回放，直接复用。

判定流程（`lookupReaction`）：

```
1. 查手写反应表  → 命中就用（自带现象、教材出处、陷阱提示）
2. 查不到 → 交给规则引擎推断产物
3. 产物有了 → 通用配平器求系数
4. 配不出 → 判定「不反应」
```

所以**大部分反应你不用手写**，规则引擎会自动覆盖金属+酸、金属+盐、
中和、碳酸盐、复分解沉淀、酸+盐、碱+盐、盐+盐、碱性氧化物+酸。

只有「氧化还原特例」「过氧化物」「工业流程」这类才需要写进 `reactions.json`。

---

## 3. 四种最常见的改动

### 3.1 加一条方程式

编辑 `data/reactions.json`，复制一条改：

```jsonc
"r97": {
  "levels": [5],                                  // 属于哪几关
  "reactants": [["Cl2", 1], ["Na2S", 1]],         // [物质id, 系数]
  "products":  [["S", 1], ["NaCl", 2]],
  "type": "置换",                                  // 见下方类型表
  "condition": "常温",
  "phenomenon": "溶液中出现淡黄色沉淀",
  "precipitate": ["S"],
  "stars": 2,
  "trap": "氯气把硫离子氧化成硫单质"
}
```

然后跑：

```bash
pnpm check:data     # 原子守恒 / 电荷守恒 / 最简整数比 / 反应歧义
```

**校验器会拒绝的**：原子不守恒、系数没化到最简、同一种反应物组合对应两个不同产物。

反应类型只能用这 9 个：
`置换` `中和` `沉淀` `产气` `分解` `化合` `燃烧` `氧化还原` `复分解`

### 3.2 加一种物质

编辑 `data/substances.json`：

```jsonc
"K2Cr2O7": { "name": "重铬酸钾", "formula": "K2Cr2O7", "kind": "盐" }
```

`id` **必须等于化学式本身**（校验器会检查）。`kind` 只能是：
`单质` `氧化物` `过氧化物` `酸` `碱` `盐` `气体` `有机物`

> 规则引擎靠 `kind` 决定套哪条规则，标错会导致判定失效。

### 3.3 改关卡数值

编辑 `data/levels.json`。一次改完一定要重跑平衡模拟：

```bash
pnpm check:sim      # 12 关各跑 60 局，检查胜率和卡死
```

目标区间：普通关 4–7 回合结束、Boss 7–10 回合、模拟胜率 85–95%。
**第 12 关 35% 左右是故意的**（终 Boss 要有点难度）。

### 3.4 改界面

`src/ui/` 下 5 个文件，样式在 `src/styles.css`（画布固定 1600×900 等比缩放）。

**改完必须截图确认**。项目没有浏览器测试，截图是唯一手段：

```bash
pnpm build:single
# 用 Edge 无头模式截图（Windows 自带）
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --headless=new --disable-gpu --hide-scrollbars `
  --window-size=1440,730 --virtual-time-budget=4000 `
  --screenshot="out.png" "file:///D:/.../dist-single/index.html#/battle/7"
```

**深链**：`#/levels` 直接进选关，`#/battle/7` 直接进第 7 关。

---

## 4. 接下来的主要任务：其他年级线

### 4.1 设计（已定，别改）

四条线 × 12 关，共享内容池：

| 年级线 | 编排 |
|---|---|
| 高三线 ✅ 已完成 | 初中 4 关 + 高一 4 关 + 高三 4 关 |
| 高二线 | 初中 4 关 + 高一 4 关 + 选必 4 关 |
| 高一线 | 初中 4 关 + 高一 8 关 |
| 初三线 | 初中 12 关，全部九年级内容 |

前 4 关对所有年级相同——它们同时是新手教程。

### 4.2 现在缺什么

**结构层已完成（2026-11-26）**，`pnpm check` 覆盖了这套规则：

1. `data/levels.json` 每关有 `lines`（属于哪几条线）和 `order`（线内顺序）。
   同一关可以被多条线共用——前 4 关就是四条线共用的新手教程，**不要复制成四份**。
   ```jsonc
   "lines": ["初三", "高一", "高二", "高三"],   // 该关出现在哪几条线
   "order": 1                                  // 该线内的顺序，同线内不重复
   ```
2. `src/ui/LevelSelect.tsx` 有「年级线」页签，按 `lines` 过滤、按 `order` 排序
3. `src/ui/BattleScreen.tsx` 的「下一关」走 `nextLevelInLine(line, level)`，
   是「同一条线内 order + 1」，不是 id + 1
4. `pnpm check:data` 会拒绝：线名拼错、同线 order 重复、某条线少于 4 关
5. `pnpm check:ui` 会逐条线渲染，断言不串线，并走一遍「下一关」链

**剩下的是纯内容**：给初三线补 8 关、高一线补 4 关、高二线补 4 关。

**关卡 id 分配**（保持 number 类型，避免大改）：

| 线 | id 范围 |
|---|---|
| 高三线 | 1–12（已占用，别动） |
| 初三线 | 101–112 |
| 高一线 | 201–212 |
| 高二线 | 301–312 |

> 新关卡的 `lines` 只写自己那条线，`order` 从 5 往后排（前 4 关是共用的）。
> 例如初三线第 5 关：`id: 101, lines: ["初三"], order: 5`。
> 关卡页面上显示的序号是 `order`，不是 `id`。

### 4.3 新关卡怎么做

1. 选好教材章节（人教版 2024 版初中 / 2019 版高中）
2. 在 `levels.json` 加一条：敌人名、血量、攻击、弱点类型、试剂架
3. **试剂架决定了这一关能打出什么**——先想清楚敌人弱什么，再摆物质
4. 跑 `pnpm check:data`，它会检查「至少 3 条可打出的反应」和「至少 1 条能命中弱点」
5. 缺的特例方程式补进 `reactions.json`
6. 跑 `pnpm check:sim` 看数值，跑 `pnpm check:chem` 看判定

---

## 5. 架构约束（违反会埋雷）

| 约束 | 为什么 |
|---|---|
| 引擎函数必须是纯函数，不改入参 | 以后要做联机 / 回放 / 撤销 |
| `BattleState` 必须可 JSON 序列化 | 同上；所以别往里塞 DOM 或函数 |
| UI 不做业务判断 | 判定只能有一份实现，否则两边会分叉 |
| 数据只能放 `data/*.json` | 两个人并行改内容不冲突 |
| 类名不要用裸词（`enemy` / `done` / `active`） | 已经踩过一次：`.bar-fill.enemy` 撞上 `.enemy` 的 `z-index`，把血条数字盖住了 |

---

## 6. 已知的坑（都踩过了）

1. **pnpm 在 Windows 上装不了** → 见第 1 节，别删 `.npmrc`
2. **构建需要完整权限**：Vite 的编译子进程在某些受限终端里会被系统拒绝，
   报 `spawn EPERM`。普通命令行跑没问题
3. **单文件离线包不能有外链**：图片、字体必须内联（用 SVG，别引外部字体）
4. **`localStorage` 在 `file://` 下可能不可用**，存档会退化成内存
5. **配平搜索的最大系数是 8**（`chem.ts` 的 `maxCoeff`），
   生成的反应系数都很小；手写反应表不受此限制
6. **验证器比手写快**：加完数据一定要跑 `pnpm check:data`，
   它抓过好几次守恒错误
7. **`硫酸` 一张卡同时代表稀硫酸和浓硫酸**，
   Cu + H₂SO₄ 走的是浓硫酸加热版，这是已知取舍，写在特例的 `trap` 里

---

## 7. 验证手段（每次改完都要跑）

```bash
pnpm check:data    # 化学数据校验
pnpm check:chem    # 反应判定回归（46 条正反例，包括"必须不反应"的）
pnpm check:ui      # 界面渲染冒烟
pnpm check:types   # TypeScript 类型检查
pnpm check:sim     # 无头对战模拟（数值平衡）
pnpm check         # 前四项一次跑完
```

CI 里跑的是 `check:data`、`check:chem`、`check:ui`、`check:types` 和构建。
**PR 挂了不许合。**

---

## 8. 协作流程

- 一个任务 = 一个 Issue = 一个分支 = 一个 PR
- 分支名：`feat/grade-line-junior`、`fix/tag-label`、`data/level-105`
- 合并前：`pnpm check` 全绿 + 截图贴进 PR
- 每天在 `docs/devlog/YYYY-MM-DD.md` 写三行：**做了什么 / 明天做什么 / 卡在哪**
  —— 这是留给对方 AI 读的上下文，比聊天记录可靠

---

## 9. 当前进度

| 模块 | 状态 |
|---|---|
| 工程骨架、构建、单文件打包 | ✅ |
| 化学式解析、配平判定 | ✅ |
| 反应规则引擎（8 条规则） | ✅ |
| 战斗状态机、伤害模型 | ✅ |
| 高三线 12 关 | ✅ |
| 年级线结构（lines / order / 页签） | ✅ 2026-11-26 |
| 初三 / 高一 / 高二线内容 | ❌ **待做** |
| 第 12 关三阶段 Boss | ❌ |
| 离子方程式模式 | ❌ |
| 音效与打击反馈 | ❌ |
| 存档导出 / 排行榜 | ❌ |
| 教学设计文档（赛道强制项） | ❌ |
