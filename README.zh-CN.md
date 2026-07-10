# ImageViewer

[English](README.md) · **简体中文**

一款轻量、快速的看图软件,支持 **Windows** 与 **macOS**。

ImageViewer 在一个简洁、无边框的窗口里同时提供「单图查看器」和「文件夹浏览库」。
它专为快速翻看大量高分辨率照片而设计 —— 缩放、平移、旋转、全屏、缩略图即时呈现,
没有一堆修图功能的臃肿负担。

- **两种模式合一** —— 专注看单张图片的查看器,以及按文件夹浏览的缩略图库。
- **为大图而生** —— 缩略图和预览用 `sharp` 生成并缓存到磁盘,且在并发上限内产出,
  即使一个装满 4000 万像素相机原图的文件夹也能保持流畅。
- **两端原生观感** —— 自定义无边框窗口,支持明/暗主题,在 Windows 与 macOS 上外观一致。

---

## 功能

### 库(浏览)模式

- 左侧文件夹树 —— 快速访问入口 + 磁盘,按需懒加载展开。
- 面包屑路径,配合 后退 / 前进 / 上一级 / 刷新 导航。
- 虚拟滚动缩略图网格(上千文件依旧流畅);缩略图只生成一次并缓存。
- 可调缩略图大小 —— 拖动滑块只重新排版,不会重新生成缩略图。
- 按 名称 / 日期 / 大小 / 类型 排序,可升序或降序。
- 文件夹内搜索,以及状态栏(名称 · 尺寸 · 大小 · 日期 · 序号)。

### 查看器(单图)模式

- 适应窗口 / 1:1 / 放大 / 缩小 / 全屏。
- 以光标为中心的滚轮缩放;拖拽平移。
- 上一张 / 下一张,向左 / 向右旋转。
- 双击在「适应窗口」与「100%」之间切换。
- 悬浮信息条 + 工具栏,以及缩略图胶片条,会自动隐藏,移动鼠标时重新出现。
- 幻灯片:全屏自动播放,按任意键停止。

### 操作(右键菜单)

- 幻灯片、复制图片、另存为副本(Save As…)。
- 打开所在文件夹、打开方式、设为桌面背景、打印。
- 重命名、删除(移入回收站 / 废纸篓),以及包含 EXIF 的图片信息。

### 支持格式

JPG · PNG · GIF · WebP · BMP · TIFF · AVIF 等。

---

## 键盘快捷键(查看器)

| 按键 | 操作 |
| --- | --- |
| `→` `↓` `PageDown` `空格` | 下一张 |
| `←` `↑` `PageUp` | 上一张 |
| `+` / `=` | 放大 |
| `-` / `_` | 缩小 |
| `0` | 适应窗口 |
| `1` | 实际大小(100%) |
| `Delete` | 删除(移入回收站 / 废纸篓) |
| `F11` | 切换全屏 |
| `Esc` | 退出全屏,或返回库 |
| 双击 | 适应窗口 ⇄ 100% 切换 |
| 鼠标滚轮 | 以光标为中心缩放 |

---

## 安装

从 [Releases 页面](https://github.com/lhyf/ImageViewer/releases) 下载最新安装包。

**Windows** —— 运行 `ImageViewer-Setup-*.exe`(安装版)或 `ImageViewer-Portable-*.exe`(免安装)。

**macOS** —— 打开 `.dmg`,把 **ImageViewer** 拖到「应用程序」。该 app 做了 ad-hoc 临时
签名但未做 Apple 公证(没有付费的 Apple 开发者证书),因此首次打开时 macOS 可能提示
*「ImageViewer 已损坏,无法打开」*。这是 Gatekeeper 拦截未公证应用,并非真的损坏——
在「终端」里清除一次下载隔离标记即可:

```bash
xattr -cr /Applications/ImageViewer.app
```

之后正常双击打开即可(清除一次后长期有效)。

---

## 技术栈

- **Electron** + **electron-vite** —— 跨平台桌面外壳与构建工具链。
- **React 18** + **TypeScript** + **Tailwind CSS** —— 渲染层界面。
- **zustand** —— 应用与 UI 状态管理。
- **react-window** —— 虚拟滚动缩略图网格。
- **sharp** —— 缩略图 / 预览生成与读取图片尺寸(主进程)。
- **exifr** —— 读取 EXIF 元数据。

本地图片通过一个自定义、特权的 `media://` 协议提供给渲染层,而不是直接暴露文件系统。

---

## 快速开始

需要 **Node.js 18+**。

```bash
npm install
npm run dev        # 启动开发环境(热更新)
npm run typecheck  # 对主进程 + 渲染层做类型检查
```

## 打包安装包

```bash
npm run dist:win   # Windows:NSIS 安装包 + 便携版 + zip  → release/
npm run dist:mac   # macOS:  dmg(x64 + arm64),需在 macOS 上执行
```

产物输出到 `release/`:

- `ImageViewer-Setup-<version>-x64.exe` —— NSIS 安装包
- `ImageViewer-Portable-<version>-x64.exe` —— 单文件便携版
- `ImageViewer-<version>-x64.zip` —— 压缩包版

应用图标取自 `build/icon.png`(由 `build/icon.svg` 渲染),electron-builder 会自动生成
平台所需的 `.ico` / `.icns`。

> **注意 —— Windows 打包。** 已关闭签名与 `rcedit`(`win.signAndEditExecutable: false`),
> 这样构建就不会去下载 `winCodeSign` 缓存 —— 该缓存里含有 macOS 的符号链接文件,在未开启
> 「开发者模式」/ 非管理员的 Windows 上会解压失败。代价是打出的 `.exe` 会保留默认的
> Electron 图标。若想嵌入自定义图标:开启 Windows **开发者模式**(设置 → 隐私和安全性 →
> 开发者选项),在 `electron-builder.yml` 中重新启用签名,并提供 `build/icon.ico`。

---

## 项目结构

```
src/
  main/            主进程:窗口、media:// 协议、
                   文件 / 缩略图 / EXIF / 操作 IPC
  preload/         通过 contextBridge 暴露的 window.api
  renderer/        React 界面
    components/    TitleBar · Browser · Viewer · 右键菜单 · 弹窗
    store.ts       应用状态(zustand)
    useUI.ts       菜单 / 弹窗 / Toast / 全屏 状态
  shared/types.ts  主进程 / preload / 渲染层共享的类型
build/             打包资源(图标)
```

## 许可证

MIT
