# 小智 · AI 个人生活系统

这是一个按参考画面重做的可操作初版：用柔和的粉蓝玻璃拟态界面，把首页、记忆、对话、Box 和个人设置放在同一个移动优先的生活系统里。

## 当前版本包含

- 首页：小智陪伴进度、日报、建议卡片和今日行动
- 记忆：日历提示、记忆时间线和快速记录
- 对话：快捷提问、输入消息和本地演示回复
- Box：搜索、分类筛选、创建新的主题 Box
- 我的：记录统计、记忆与隐私设置、本地备份状态
- 未登录时使用浏览器 localStorage，登录后通过 Supabase 保存到个人云端数据表
- 图片记忆未登录时保存在本机 IndexedDB；登录后的私有云端图片同步需在 Supabase SQL Editor 执行 `supabase-memory-images.sql`
- “智能识别抠图”在浏览器本机运行，不会把原图发给 AI 服务；首次使用会下载模型文件
- 支持邮箱注册、登录、退出和本地数据迁移
- Supabase 使用用户级 Row Level Security，不同账号只能读取自己的记录
- 粉蓝色小智形象为原创素材，位于 `assets/xiaozhi-mascot-pink-blue.png`

## 本地查看

直接打开 `index.html` 即可查看；推荐使用静态文件服务器预览，导航和 localStorage 交互会更稳定。

## 发布到 GitHub Pages

仓库已配置 GitHub Actions。推送到 `main` 后会自动部署到 GitHub Pages。

`sources/` 是项目资料镜像，保持只读。当前版本已经接入 Supabase 云端数据和账号系统；真实 AI 回复仍是下一阶段工作，当前对话回复仍为本地演示逻辑。
