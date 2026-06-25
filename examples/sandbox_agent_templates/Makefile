# 可通过 QSHELL 覆盖 qshell 二进制；建议使用最新版 qshell。
QSHELL ?= qshell

# agents-base 必须先构建，因为所有 agent 模板都会通过各自的
# qshell.sandbox.toml 中的 from_template = "agents-base" 继承它。
BASE_TEMPLATE := agents-base
AGENT_TEMPLATES := claude codex amp opencode
TEMPLATES := $(BASE_TEMPLATE) $(AGENT_TEMPLATES)

.PHONY: all build publish $(addprefix build-,$(TEMPLATES)) $(addprefix publish-,$(TEMPLATES))

all: build

# 按依赖顺序构建全部模板。显式依赖保证 make -j 时也会先构建 agents-base。
build: _check-qshell $(addprefix build-,$(TEMPLATES))

# 按相同顺序发布全部模板。显式依赖保证 make -j 时也会先发布 agents-base。
publish: _check-qshell $(addprefix publish-,$(TEMPLATES))

# 单模板辅助目标，例如：
#   make build-claude
#   make publish-agents-base
$(addprefix build-,$(AGENT_TEMPLATES)): build-$(BASE_TEMPLATE)
$(addprefix publish-,$(AGENT_TEMPLATES)): publish-$(BASE_TEMPLATE)

$(addprefix build-,$(TEMPLATES)): _check-qshell
	$(MAKE) _build TEMPLATE=$(@:build-%=%)

$(addprefix publish-,$(TEMPLATES)): _check-qshell
	$(MAKE) _publish TEMPLATE=$(@:publish-%=%)

.PHONY: _build _publish _check-qshell

_check-qshell:
	@command -v $(QSHELL) >/dev/null 2>&1 || { \
		echo "ERROR: qshell binary '$(QSHELL)' not found in PATH" >&2; \
		exit 1; \
	}

# 进入模板目录执行，让 qshell 读取该目录下的 qshell.sandbox.toml；
# 模板按 name 定位，配置里不需要维护 template_id。
_build:
	cd $(TEMPLATE) && $(QSHELL) sandbox template build --wait

# 发布同样依赖模板目录中的 qshell.sandbox.toml 按 name 定位模板。
_publish:
	cd $(TEMPLATE) && $(QSHELL) sandbox template publish -y
