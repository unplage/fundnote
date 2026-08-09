# fundnote

本地记账 PWA，基于 HTML/JS，数据存于浏览器 IndexedDB，无需服务器。

在线预览：https://unplage.github.io/fundnote/

## 功能

- 记账：收入/支出记录，支持分类管理（系统/自定义分类）
- 金额：输入时支持加减乘除表达式自动计算
- 预算：可设月预算，首页进度条实时显示，超支提醒
- 统计：收支趋势图（折线/柱状）、分类饼图、本月/周/年/自定义周期，显示环比、日均、最大单笔、笔数
- 搜索：按关键词、日期范围、分类筛选记录
- 导出/导入：CSV（含 ID 列，Excel 兼容）、JSON 完整备份
- 离线：Service Worker 缓存资源，断网可用，图表离线降级显示
- 暗色模式：设置页切换，图表/降级图表配色同步适配
- 隐私锁：可设 4-6 位 PIN 码，启动时遮罩需解锁，连续 5 次错误锁定 5 分钟
- 数据兼容：支持旧数字 ID 与新 UUID 记录并存，导入兼容旧格式 CSV/JSON

## 使用

直接浏览器打开 `index.html`，或：

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`

互联网连接时图标和字体可从 CDN 加载；离线后依赖 Service Worker 缓存。

## 技术栈

- 纯 HTML/CSS/JS，单文件，无构建步骤
- IndexedDB（`AccountingDB_v5` v2）：记录、分类、设置、备份
- Font Awesome 6.4.0（CDN）
- ECharts 5.4.0（CDN，异步加载）
- PWA：`manifest.json` + `sw.js`

## 默认日期

默认记账日期为东八区（UTC+8）0 点，导入的 UTC 日期会偏移 +8 小时。
