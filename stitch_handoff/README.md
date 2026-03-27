# Stitch Handoff

这个文件夹是给 Google Stitch 用的前端交接包。

使用顺序：

1. 先看 [00-project-brief.md](/C:/codeX/stitch_handoff/00-project-brief.md)
2. 再看 [import-order.md](/C:/codeX/stitch_handoff/import-order.md)
3. 按顺序把每个页面目录里的：
   - `brief.md`
   - `code/` 下的组件和页面入口
   - 当前页面截图
   一起喂给 Stitch

建议导入顺序：

1. `02-home`
2. `03-rooms-list`
3. `04-chat`
4. `05-models`
5. `06-create-room`
6. `07-edit-room`
7. `08-login`

全局基础文件在：

- [01-global](/C:/codeX/stitch_handoff/01-global)

注意：

- 这个交接包只服务于前端视觉和交互优化
- 不要把 `app/api`、`server`、`prisma`、`generated` 交给 Stitch 主导
- 核心业务语义不能改：
  - 用户发消息后，AI 按顺序依次回答
  - 部分成功语义保留
  - 不新增后端功能
