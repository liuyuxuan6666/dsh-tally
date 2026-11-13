<div align="center">

<img src="icon.svg" width="72" alt="dsh-tally" />

# dsh-tally

**极简个人待办，住在 DeepSeek Harness 里。**

一个侧栏图标、一个单列面板、十一个工具。数据只有一个 JSON 文件，不联网，不同步，不打扰。

[![License](https://img.shields.io/github/license/liuyuxuan6666/dsh-tally?color=blue)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.x-1c5a40)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.19-339933)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](#)
[![PRs](https://img.shields.io/badge/PRs-welcome-ff69b4)](#)

[为什么](#为什么) · [安装](#安装) · [界面](#界面) · [工具](#工具) · [数据](#数据) · [开发](#开发)

</div>

---

## 为什么

市面上的 DSH 任务类插件解决的是另一件事：**把活派给 agent，然后验收它**。有 status 机、有 claim、有 in_review、有人工 accept。

我需要的只是：**记下来，然后划掉。**

于是这个插件只做三件事——加、勾、改。没有验收，没有草稿确认，没有 AI 执行，没有看板。

| | 任务/议题板 | dsh-tally |
|---|---|---|
| 谁执行 | agent | **你** |
| 核心动作 | claim → submit → accept | 加、勾、改 |
| 状态 | 7 个 | 未完成 / 已完成 / 已归档 |
| 需要的能力 | 审计、版本、验收 | 随手记、提醒、手机能开 |

## 功能

- **原地编辑**：点标题改标题，点日期选日期，点详情写详情。没有弹框。
- **分组**：逾期 / 今天 / 本周 / 以后 / 无日期，自动归位。
- **逾期标红**：只标日期，不喊口号。
- **归档**：完成超过 90 天自动归档，不删数据。
- **两个入口**：侧栏图标，以及输入框下方的一个小胶囊（手机上更顺手的那个）。
- **Agent 可读写**：11 个 `todo_*` 工具，聊天里说一句就能加一条。
- **零依赖**：宿主半与客户端半都不引第三方运行时包。

## 安装

需要 DeepSeek Harness **0.2.x**（使用官方 `sidebar.panellist` + `main` 双槽位）。

### 方式一：从 tarball 安装

```bash
git clone https://github.com/liuyuxuan6666/dsh-tally.git
cd dsh-tally
npm pack
dsh plugin --profile <你的 profile> add file:$PWD/dsh-tally-0.3.0.tgz
```

### 方式二：本地目录（开发用）

让 DSH 能访问到一份 Windows 本地路径的副本，再把该目录作为 bundle 安装：

```bash
DSH_TALLY_DEPLOY='D:/path/to/dsh-tally' ./scripts/sync.sh
```

然后在 DSH 里：`plugin_manager` → `install_bundle` → `target` 填那个目录。

> **为什么要 sync**：DSH 跑在 Windows，`\\wsl.localhost\...` 的 UNC 链接装不成 profile bundle。仓库放哪都行，安装源必须是 Windows 本地路径。

### 装完要重启

| 改动 | 生效方式 |
|---|---|
| `index.js`（Host） | `remove_bundle` → `install_bundle`，不必重启 |
| `client.js`（界面） | **必须重启 DSH**——客户端 bundle 只在 boot 时扫描 |
| 数据 / 配置 | 无需重装 |

## 界面

单列。手机和桌面是同一套布局，没有第二套。

```
┌──────────────────────────────────────────────┐
│  ▣  待办                        [ 已完成 2 ] │
│     3 项待办 · 1 项逾期                      │
│                                              │
│  [ 添加待办，回车确认              ] [ 添加 ] │
│                                              │
│  逾期  1                                     │
│  ☐  交开题报告修改稿                         │
│      10-28   ＋ 详情                         │
│  ─────────────────────────────────────────   │
│  今天  2                                     │
│  ☐  读 MEC 排队模型那节                      │
│      11-18   ＋ 详情                         │
│  ─────────────────────────────────────────   │
│  ☑  跑实验 A 的基线对比                      │
│      11-18   详情    #论文 #实验             │
└──────────────────────────────────────────────┘
```

### 三种原地编辑

| 想改什么 | 怎么操作 | 保存 | 取消 |
|---|---|---|---|
| 标题 | 点标题文字 | `Enter` / 失焦 | `Esc` |
| 日期 | 点日期胶囊（空态是虚线 `＋ 设置日期`） | 选完即存 | 点别处 |
| 日期清除 | 右键点日期胶囊 | 立即 | — |
| 详情 | 点 `＋ 详情` 或那行灰字 | `⌘/Ctrl + Enter` / 失焦 | `Esc` |

新建的任务只有标题，所以日期与详情是**常驻的虚线入口**，不藏在悬停菜单里——手机上没有悬停。

## 工具

| 工具 | 作用 |
|---|---|
| `todo_add` | 添加（`title` 必填，`due` 用 `YYYY-MM-DD`，`tags` ≤ 8 个） |
| `todo_list` | `active` / `today` / `overdue` / `done` / `archived` / `all`，默认最多 200 条 |
| `todo_update` | 只改传入的字段；`due: ""` 表示清除日期 |
| `todo_done` / `todo_undo` | 勾选 / 取消勾选 |
| `todo_archive` / `todo_unarchive` | 归档 / 取消归档 |
| `todo_hide` / `todo_unhide` | 隐藏 / 取消隐藏 |
| `todo_remove` | 删除 |
| `todo_export` | 导出 Markdown 或 JSON 文本 |

Agent 能改状态，但**没有"验收"概念**——这里不需要它。

## 数据

```
$DSH_HOME/todo/todo.json          # 唯一真相，单文件
```

```json
{
  "version": 1,
  "updated": "2026-11-13T12:00:00.000Z",
  "items": [
    {
      "id": "t-20261113-01",
      "title": "读 MEC 排队模型那节",
      "done": false,
      "due": "2026-11-18",
      "tags": ["任务卸载"],
      "note": "",
      "archived": false,
      "hidden": false,
      "created": "2026-11-13T09:00:00.000Z",
      "completed": null
    }
  ]
}
```

- **原子写**：临时文件 → `fsync` → `rename`
- **单写者**：一个 promise 链串行化每次读改写，两个会话同时加不会撞
- **损坏自保**：解析失败把原文件另存为 `todo.json.corrupt-<时间戳>`，然后从空表继续
- **规模**：一年约 1 500 条 ≈ 400 KB，`JSON.parse` 2–3 ms。**不需要索引、分片或数据库**，超过一万条再谈

### 生命周期

| 状态 | 含义 |
|---|---|
| 活跃 | 未完成、未归档 |
| 完成 | `done: true`，面板里折叠显示最近 30 天 |
| 归档 | 完成超过 90 天自动标记，或手动归档；`todo_list(scope="archived")` 可见 |
| 隐藏 | 你主动隐藏的活跃项，不占默认列表 |

### HTTP API（面板用）

| 路径 | 方法 | 说明 |
|---|---|---|
| `/api/todo/state` | GET | 全部条目 + 统计 |
| `/api/todo/op` | POST | `{ op, ...payload }` → `{ ok, value }` 或 `{ ok:false, error }` |
| `/api/todo/clientlog` | GET | 界面渲染失败时的自检上报 |

只接受 loopback `Host`。没有鉴权——它假设 DSH 只在本机回环上监听。

> 两个踩过的坑写在这里省得你也踩：
> **① 路由必须是 `handler`，不能是 `resource`。** resource 只应 `GET/HEAD`，其余方法一律 405——写操作会全部静默失败。
> **② `exports` 里必须有 `"./package.json"`。** 客户端模块扫描器要靠它解析 `dsh.client`，缺了 Host 半能加载、界面永远不出现。

## 设计

跟着宿主已有的视觉走，而不是自带一套：

- **侧栏图标是裸 SVG**，20×20，`stroke: currentColor`。按钮、悬停、选中态都由宿主渲染——自己包一层 `<button>` 就会"凸出来"。
- **只用主题 token**：`--dsw-alias-bg-*`、`label-*`、`border-*`、`brand-primary`。
- **一个强调色**：只用在「添加」和勾选态；红色只用于逾期日期。
- **一套字号**（17 / 14 / 13 / 12）和**一套间距**（4 / 8 / 12 / 16 / 20 / 24）。
- **两个圆角**：8（控件）、10（徽章）。

## 已知限制

- 没有日历视图、没有看板、没有子任务——这是刻意的，不是没做完。
- 没有提醒推送。要定时提醒，把它和 [`dsh-doorbell`](https://github.com/liuyuxuan6666/dsh-doorbell) 这类通知插件接起来。
- 没有多端同步。文件在本机，需要同步就自己同步那个 JSON。
- 界面文案是按浏览器语言在 `ZH` / `EN` 两套字典里选，没有接宿主的 locale 服务（接了会要求注入 `locale`，一旦宿主没提供就整个插件不加载）。
- 客户端渲染出错会被宿主静默摘除，所以每个 slot 组件外面包了一层错误护栏，失败时上报到 `/api/todo/clientlog`。

## 开发

```bash
# 仓库结构
index.js          Host：存储 + 工具 + HTTP API
client.js         Client：侧栏图标 + 面板
cordis.patch.yml  bundle patch
locale/*.json     显示名与文案
scripts/sync.sh   同步到 Windows 侧的安装源
```

改完 `client.js` 要重启 DSH 才看得到；改 `index.js` 只需重装 bundle。

## License

[MIT](LICENSE)
