# 移动前端开发环境快速启动

## 前置条件

1. 已安装EAS CLI并登录：
   ```bash
   cd apps/mobile
   npm install -g eas-cli
   eas login
   ```
   （在 expo.dev 免费注册账号）

2. 已安装Android Development Build到测试手机
3. 手机和电脑在同一WiFi网络

## 日常开发流程

### 1. 启动后端服务

```bash
npm run dev:all
```

### 2. 启动移动开发服务器（LAN模式）

```bash
npm run dev:mobile
```

### 3. 在手机上打开Development Build

- 如果已连接同一WiFi，应用会自动发现Metro服务器
- 如果没有自动连接，在启动器中输入电脑的局域网IP和端口：`http://192.168.1.x:8081`

### 4. Web预览（可选，快速验证UI）

```bash
npm run dev:web
```

浏览器打开 `http://localhost:19006`

## 首次配置步骤（一次性）

### Step 1: 登录EAS

```bash
cd apps/mobile
npx eas login
```

### Step 2: 构建Android Development Build

```bash
npx eas build --profile development --platform android
```

构建完成后：
- 扫描EAS提供的QR码，或复制下载链接到手机浏览器
- 下载APK并安装
- 允许"未知来源"安装

## 何时需要重新构建Development Build？

**需要重建的情况**（原生配置变更）：
- 修改了 `app.json`
- 新增/升级了需要原生代码的依赖（如 expo-secure-store 升级）
- 修改了 `eas.json`

**不需要重建的情况**（纯JS/TS代码变更）：
- 修改组件、页面、样式
- 修改API调用逻辑
- 修改状态管理代码

重建命令：

```bash
npm run build:mobile:android
```

## 常见问题

**Q: 手机上显示"无法连接到Metro服务器"**
A: 检查手机和电脑是否在同一WiFi；在Metro界面按 `?` 确认是LAN模式；尝试手动输入 `http://<电脑IP>:8081`。

**Q: API请求超时**
A: 确认后端服务已启动；确认 `.env.development` 中的地址可访问；手机上用浏览器访问 `http://<电脑IP>:3000/api/docs` 测试连通性。

**Q: EAS Build失败**
A: 将EAS Build网页上的完整错误日志复制给AI分析。常见原因：依赖冲突、app.json配置错误、图标资源缺失。
