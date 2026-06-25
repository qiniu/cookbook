# Sandbox Agent 模板构建

这个示例收录一组经过生产验证的 AI Agent 沙箱模板，覆盖共享基础模板和多个常见 Agent CLI：

- `agents-base`：共享基础模板，预装 Node.js、Git、ripgrep、GitHub CLI、前端脚手架和常用排障工具。
- `claude`：基于 `agents-base` 叠加 Claude Code CLI 和常用 MCP servers。
- `codex`：基于 `agents-base` 叠加 OpenAI Codex CLI。
- `amp`：基于 `agents-base` 叠加 Sourcegraph Amp CLI。
- `opencode`：基于 `agents-base` 叠加 opencode CLI。

## 敏感信息说明

模板镜像不内置任何 API key、token 或账号级凭证。各 Agent CLI 需要的认证信息均通过创建沙箱时的环境变量或七牛沙箱 injection-rule 注入。

文档中的 `sk-...`、`sk-ant-...`、`placeholder` 和 `https://api.qnaigc.com` 都是占位示例，请替换为自己的配置。

## 构建顺序

先构建并发布共享基础模板：

```bash
cd examples/sandbox_agent_templates/agents-base
qshell sandbox template build --wait
qshell sandbox template publish -y
```

再构建需要的 Agent 模板：

```bash
cd ../claude
qshell sandbox template build --wait
qshell sandbox template publish -y
```

也可以在本目录一次性按依赖顺序构建或发布全部模板：

```bash
cd examples/sandbox_agent_templates
make build
make publish
```

建议使用最新版 qshell。`Makefile` 会检查本机是否能找到 `qshell` 命令，并按依赖顺序执行构建或发布。

## 配合 Agent 示例使用

构建并发布 `claude` 模板后，可以运行相邻的多轮 Agent 对话示例：

```bash
cd ../sandbox_agent
go run .
```

各模板的具体构建、发布和使用说明请查看对应子目录的 `README.md`。
