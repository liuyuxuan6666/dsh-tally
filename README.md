# dsh-tally

极简个人待办插件：一个侧栏入口、一个单列面板、九条 agent 工具。数据只在本机，一个 JSON 文件。

## 为什么不是工作台

`dsh-personal-workbench` 的目标是「AI 工作台」——日历、任务树、子任务拆解、角色库、知识库、日报周报、验收闭环。对一个存放待办的地方来说，这套流程太重，而且按桌面浮层设计，手机端不可用。

这个插件只做三件事：**加、勾、改**。没有验收，没有草稿确认，没有 AI 执行。

## 结构

```
dsh-tally/
├── index.js            Host：存储 + 工具 + HTTP API
├── client.js           Client：侧栏入口 + 面板
├── cordis.patch.yml    bundle patch
├── locale/{en,zh}.json 显示名与文案
└── icon.svg
```

## 数据

```
$DSH_HOME/todo/todo.json
```

单文件、原子写（临时文件 + rename）、进程内单写者串行化。读写路径都做长度约束：标题 ≤200 字、备注 ≤2000 字、标签 ≤8 个。

一年约 1 500 条 ≈ 400 KB，`JSON.parse` 2–3 ms，不需要分片或索引。

## 生命周期

| 状态 | 含义 |
|---|---|
| 活跃 | 未完成、未归档 |
| 完成 | `done: true`，主视图折叠显示最近 30 天 |
| 归档 | 完成超过 90 天后自动标记，或手动归档；`todo_list(scope="archived")` 可见 |
| 隐藏 | 你主动隐藏的活跃项，不参与默认列表 |

## 工具

| 工具 | 作用 |
|---|---|
| `todo_add` | 添加（title 必填，due 用 `YYYY-MM-DD`，tags ≤8） |
| `todo_list` | 列出：`active` / `today` / `overdue` / `done` / `archived` / `all` |
| `todo_update` | 只改传入的字段 |
| `todo_done` / `todo_undo` | 勾选 / 取消勾选 |
| `todo_archive` / `todo_unarchive` | 归档 / 取消归档 |
| `todo_hide` / `todo_unhide` | 隐藏 / 取消隐藏 |
| `todo_remove` | 删除（直接从存储移除；需要可恢复请先归档） |
| `todo_export` | 导出 Markdown / JSON 文本 |

Agent 只能改状态，**不能代替你做"验收"**——这里没有验收概念。

## HTTP API（面板用）

| 路径 | 说明 |
|---|---|
| `GET /api/todo/state` | 全部条目 + 统计 |
| `POST /api/todo/op` | `{ op, ...payload }`，返回 `{ ok, value }` 或 `{ ok:false, error }` |

只接受 loopback Host。没有鉴权：它假设 DSH 只在本机回环上监听。

## 界面

侧栏「待办」入口 → 主面板。

- 顶部输入框，回车即添加
- 按「逾期 / 今天 / 本周 / 以后 / 无日期」分组
- 行高 ≥48px，单列，最大宽度 720，手机与桌面同一套布局
- 已完成折叠在底部
- 逾期日期标红

## 已知不做

- 不做日历、看板、甘特
- 不做子任务/父任务
- 不做 AI 自动执行
- 不做飞书推送（`dsh-doorbell` 已经承担通知，接它是下一步）

## 验证记录

- 工具写入 → JSON 文件 → HTTP API 三端一致
- 状态流转：add / update / done / undo / archive / unarchive / remove / export
- 归档后不再出现在默认列表，`scope="archived"` 可查
