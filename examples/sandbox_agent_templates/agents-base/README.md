# agents-base 沙箱模板

`agents-base` 是 Claude、Codex、Amp 和 opencode 模板共享的基础模板，
在沙箱平台公共 `base` 模板之上预装 Node.js、通用开发、排障、GitHub CLI
和前端脚手架工具。

运行时基础层通过 `qshell.sandbox.toml` 中的 `from_template = "base"`
直接继承平台已存在的 `base` 模板；`Dockerfile` 里的 `FROM scratch`
仅是 qshell 解析器的占位，不会触发任何镜像仓库拉取。这样国内 / 海外
环境都可以直接复用同一份配置，无需配置 Docker 代理或镜像源。

子模板通过 `qshell.sandbox.toml` 中的 `from_template = "agents-base"` 继承该模板，
再用各自的 Dockerfile 叠加专属 AI CLI。

## 镜像内容

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| 基础层 | 平台 `base` 模板 | 通过 `from_template = "base"` 引用，提供运行时根文件系统 |
| Node.js | 24.x | 通过 NodeSource apt 源安装，供 agent CLI 和前端工具使用 |
| `git` / `ripgrep` / `vim` | apt | 代码检索、版本管理与文件编辑工具 |
| `jq` / `less` / `tree` | apt | JSON 处理、长输出查看与目录结构查看 |
| `zip` / `unzip` | apt | 归档文件处理 |
| `procps` / `lsof` / `netcat-openbsd` / `dnsutils` / `iputils-ping` | apt | 进程、端口和网络排障工具 |
| `gh` | apt | GitHub CLI |
| `pnpm` / `yarn` / `tsx` / `vite` | `latest` | 常用前端脚手架 |

## 构建顺序

请先构建并发布 `agents-base`，再构建依赖它的子模板：

```bash
cd examples/sandbox_agent_templates/agents-base
qshell sandbox template build --wait
qshell sandbox template publish -y
```

然后再构建子模板：

```bash
cd ../claude
qshell sandbox template build --wait
```

也可以在 `templates` 目录用 Makefile 一次性构建全部模板：

```bash
cd examples/sandbox_agent_templates
make build
```

模板按 `name` 定位（环境内全局唯一），`qshell.sandbox.toml` 不需要维护
`template_id`。建议使用最新版 qshell 构建和发布模板。
