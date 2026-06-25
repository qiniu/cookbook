# Shared base template for AI agent sandboxes
# 在沙箱平台公共模板 `base` 之上预装所有 agent 模板共用的开发、排障和前端工具。
#
# 这里 FROM scratch 仅是 qshell Dockerfile 解析器的占位；真正的基础层由
# qshell.sandbox.toml 中的 `from_template = "base"` 指定。这样不依赖任何
# Docker 镜像仓库，国内 / 海外环境都能直接使用平台已有的 `base` 模板，
# 无需配置代理或镜像源。
FROM scratch

# Node.js 24 + 基础工具：便于 agent 检索代码、管理版本、编辑文件和排查运行问题
# gh 便于在沙箱里直接操作 GitHub Issue / PR
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        ripgrep \
        vim \
        jq \
        less \
        tree \
        unzip \
        zip \
        procps \
        lsof \
        netcat-openbsd \
        dnsutils \
        iputils-ping \
        ca-certificates \
        curl \
        gnupg \
    && mkdir -p -m 755 /etc/apt/keyrings \
    # e2bdev/base 在 /usr/local 预装了一份 Node.js 20 + 配套 npm/pnpm/yarn，
    # PATH 上 /usr/local/bin 优先于 /usr/bin，会把后面 apt 装的 Node.js 24
    # 完全影子覆盖。这里在装新 Node 之前先把旧 Node 及其全局模块清理干净，
    # 避免出现「apt 显示 Node 24，但 `node --version` 仍是 20」的情况。
    # 注意：只删 Node 相关条目，保留 /usr/local 下的 Python / pip 等。
    && rm -f /usr/local/bin/node \
             /usr/local/bin/nodejs \
             /usr/local/bin/npm \
             /usr/local/bin/npx \
             /usr/local/bin/corepack \
             /usr/local/bin/pnpm \
             /usr/local/bin/pnpx \
             /usr/local/bin/yarn \
             /usr/local/bin/yarnpkg \
    && rm -rf /usr/local/lib/node_modules \
              /usr/local/include/node \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        gh \
    && rm -rf /var/lib/apt/lists/*

# 常用前端脚手架
# 说明：统一使用 @latest，保证每次 rebuild 拿到最新能力
RUN npm install -g \
        pnpm@latest \
        yarn@latest \
        tsx@latest \
        vite@latest \
    && npm cache clean --force

# 默认工作目录：与 E2B 基础镜像保持一致
WORKDIR /home/user

# 构建期验证：核心工具缺失时直接失败，避免发布不可用模板。
RUN git --version \
    && rg --version \
    && vim --version | head -n 1 \
    && jq --version \
    && gh --version \
    && pnpm --version \
    && yarn --version \
    && tsx --version \
    && vite --version \
    && node --version \
    && python3 --version
