# Sandbox Agent 多轮对话

这个示例演示如何在七牛云沙箱中使用 `claude` 模板进行多轮上下文延续的 Agent 对话。

示例会把本地嵌入的 `testdata/access.jsonl` 上传到沙箱内 `/tmp/topn/data.jsonl`，然后引导 Agent 分三轮完成访问日志 top 10 统计：

1. 讨论实现思路。
2. 在沙箱中写入并运行直观版本的 `main.py`。
3. 将实现从一次性读入改成逐行流式处理并再次验证。

## 准备环境

> 注意：示例为了完整演示 Claude Code Agent 的工具调用能力，会在沙箱内使用 `--dangerously-skip-permissions` 运行 `claude`，并通过环境变量向沙箱注入 `ANTHROPIC_API_KEY`。请只在可信示例数据和 prompt 下运行，不要把生产密钥或敏感数据用于该示例。生产场景建议使用七牛沙箱的密钥注入规则（injection-rule）等更安全的密钥管理方式。

复制环境变量模板并填写实际值：

```bash
cp env.example .env
source .env
```

必填变量：

- `QINIU_API_KEY`：七牛沙箱 API Key。
- `ANTHROPIC_API_KEY`：Anthropic API Key，会注入到沙箱环境。

可选变量：

- `QINIU_SANDBOX_API_URL`：沙箱 API 地址，默认使用 SDK 内置 Endpoint。
- `ANTHROPIC_BASE_URL`：第三方 Anthropic 网关地址。

## 运行

在仓库根目录执行：

```bash
cd examples/sandbox_agent
go run .
```
