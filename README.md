# Qiniu Cookbook

七牛服务示例代码与解决方案集合。

每个示例都是独立项目，可以使用不同语言、运行方式和依赖管理文件。请进入具体示例目录查看说明并运行。

## Examples

### Sandbox

- [Sandbox Agent 多轮对话](./examples/sandbox_agent)：在七牛云沙箱中使用 `claude` 模板完成多轮 Agent 对话，演示文件上传、上下文续接、工具调用、流式事件解析与结果验证。
- [Sandbox Agent 模板构建](./examples/sandbox_agent_templates)：构建 `agents-base`、`claude`、`codex`、`amp`、`opencode` 等 AI Agent 沙箱模板，用于运行不同 Agent CLI。
- [Sandbox Python SDK 延迟示例](./examples/sandbox_python_sdk_latency)：使用 Qiniu Python SDK 创建公开模板沙箱、执行一段简单代码、打印时间报告并自动清理。
