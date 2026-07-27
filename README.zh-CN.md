# prompt-golden-baseline

将 prompt 锚定到黄金基线输出 — 检测与精选参考答案的漂移，而非仅与上一版本对比。

## 为什么需要黄金基线？

现有的漂移工具将 prompt 版本 N 与 N-1 进行比较——它们能发现变化，但无法发现退化。黄金基线翻转了这个逻辑：你精心挑选一组代表正确行为的参考输入→输出对，当 prompt 变更导致任何一对结果偏离基线时，工具会告警。

- **锚定质量标准** — 基线代表 prompt 应该输出的内容
- **CI 集成** — `--fail-on-drift` 门禁防止发布已退化的 prompt
- **词汇级相似度** — 使用 Jaccard 重叠度（已过滤停用词）进行有意义的比较
- **锁文件格式** — `.golden.json` 文件可读、可版本控制

## 安装

```bash
npm install -g prompt-golden-baseline
```

## 快速开始

```bash
# 1. 创建 prompt 模板
echo '将"{{word}}"翻译成{{language}}。' > template.txt

# 2. 初始化黄金基线
prompt-golden-baseline init template.txt --name translations

# 3. 锁定黄金条目
echo '{"word":"hello","language":"Spanish"}' > input.json
echo '将"hello"翻译成Spanish：hola' > expected.txt
prompt-golden-baseline lock translations.golden.json input.json expected.txt

# 4. 检查 prompt 是否仍产生正确输出
prompt-golden-baseline check translations.golden.json --fail-on-drift
```

## 许可证

MIT
