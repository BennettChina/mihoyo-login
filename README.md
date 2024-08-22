<div align="center">
    <img src="public/images/miyouji.png" alt="avatar/logo" width="200" height="200">
</div>
<div align="center">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/BennettChina/mihoyo-login">
    <a target="_blank" href="https://raw.githubusercontent.com/BennettChina/mihoyo-login/master/LICENSE">
		<img alt="Repo License" src="https://img.shields.io/github/license/BennettChina/mihoyo-login">
	</a>
    <a target="_blank" href='https://github.com/BennettChina/mihoyo-login/stargazers'>
		<img src="https://img.shields.io/github/stars/BennettChina/mihoyo-login.svg?logo=github" alt="github star"/>
	</a>
</div>

<h2 align="center">米哈游登录插件</h2>

## 🧑‍💻简介

**米哈游登录插件** 为 [Adachi-BOT](https://github.com/SilveryStar/Adachi-BOT)
衍生插件，用于获取米游社登录后的 Token 。

## 🛠️ 安装方式

在 `Adachi-BOT/src/plugins` 目录执行下面的命令。

```shell
git clone https://mirror.ghproxy.com/https://github.com/BennettChina/mihoyo-login.git
```

## 🎁 更新方式

### 💻 命令行更新

在插件目录执行下面的命令即可。

```shell
git pull
```

### 📱 指令更新

可使用 `#upgrade_plugins 米游社登录` 指令来更新本插件。

## 🧰 指令列表

| 指令名          | 参数                           | 描述                         |
|--------------|------------------------------|----------------------------|
| `#登录米游社`     | 无                            | 扫码登录米游社获取Cookie(不包含SToken) |
| `#验证码登录` ｜ 无 | 短信验证码登录米游社获取Cookie(包含SToken) |

## 配置参数

```yaml
captcha:
    # 手动处理人机验证码的地址
    viewUrl: ""
    # 获取手动处理验证码结果的API地址
    apiUrl: ""
alias:
    - 米游社登录
```

### 打码服务

项目提供了使用 Vercel 部署的在线地址以及 Render 部署的 API 服务，流量高也可自行部署以下服务。

- [gt-manual](https://github.com/BennettChina/gt-manual)
- [awesome-api](https://github.com/BennettChina/awesome-api)

## 参考案例

- [TimeRainStarSky/TRSS-Plugin](https://github.com/TimeRainStarSky/TRSS-Plugin/blob/main/Apps/miHoYoLogin.js)
  参考了时雨的登录功能。
- [yoimiya-kokomi/Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai/blob/master/plugins/genshin/model/mys/apiTool.js)
  参考喵崽的获取 `device_fp` 参数接口。
- 参考[UIGF-org/mihoyo-api-collect](https://github.com/UIGF-org/mihoyo-api-collect) 整理的 API 文档。