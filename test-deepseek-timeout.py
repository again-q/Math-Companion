# -*- coding: utf-8 -*-
"""
DeepSeek 超时问题定位脚本
用法：export DEEPSEEK_API_KEY=sk-你的key && python3 test-deepseek-timeout.py
对比：对话续写 vs 学习总结 两种请求的响应耗时
"""
import json
import os
import time
import urllib.request
import urllib.error

API_KEY = os.environ.get('DEEPSEEK_API_KEY', '').strip()
if not API_KEY:
    print('请先设置环境变量: export DEEPSEEK_API_KEY=sk-你的key')
    raise SystemExit(1)

URL = 'https://api.deepseek.com/chat/completions'


def call(prompt, user_msg, max_tokens=2048, timeout=90):
    body = json.dumps({
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': user_msg},
        ],
        'temperature': 0.7,
        'max_tokens': max_tokens,
    }).encode('utf-8')

    req = urllib.request.Request(
        URL,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + API_KEY,
        },
        method='POST',
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            content = data['choices'][0]['message']['content']
            return time.time() - start, len(content), content
    except urllib.error.HTTPError as e:
        return time.time() - start, 0, 'HTTP %s: %s' % (e.code, e.read().decode('utf-8')[:300])
    except Exception as e:
        return time.time() - start, 0, '错误: %s' % e


def main():
    # 测试1：对话续写（sendMessage 风格）
    print('=== 测试1: 对话续写（sendMessage 风格） ===')
    dur, length, content = call(
        '你是一位幽默的数学老师，用生活例子讲解，先引导再讲解。',
        '一元二次方程怎么解？用篮球例子讲讲，顺便出道题',
    )
    print('耗时 %.1fs | 回复 %d 字符' % (dur, length))
    if length > 0:
        print('内容预览:', content[:80].replace('\n', ' '))
    else:
        print('失败:', content)

    # 测试2：学习总结（getSummary 风格）
    print('\n=== 测试2: 学习总结（getSummary 风格） ===')
    dur, length, content = call(
        '你是一个温暖贴心的学习陪伴者「数学小伴」。根据学生档案和学习数据，生成一段完整的学习总结。'
        '要求：纯文本，不要 JSON，300~500字，自然分段，覆盖学习概况/掌握的知识点/薄弱环节/进步亮点/'
        '下一步建议/鼓励的话，引用学生名字兴趣，语气温暖鼓励。',
        '## 学生档案\n- 昵称：小明\n- 年级：初三\n- 薄弱点：二次函数、圆\n- 兴趣：篮球、动漫\n'
        '- 学习偏好：喜欢例子和故事\n\n'
        '## 学习数据\n学习天数：14天 | 学习次数：8次 | 消息数：76条\n\n'
        '## 知识点\n- 一元二次方程: 掌握（练习6次）\n- 二次函数: 了解（练习5次）\n'
        '- 圆: 初识（练习4次）\n- 反比例函数: 熟练（练习3次）',
    )
    print('耗时 %.1fs | 回复 %d 字符' % (dur, length))
    if length > 0:
        print('内容预览:', content[:80].replace('\n', ' '))
    else:
        print('失败:', content)

    # 测试3（对照）：短输出总结（150字内）
    print('\n=== 测试3: 短总结（150字内） ===')
    dur, length, content = call(
        '根据下面数据，用 100~150 字写一段学习总结，纯文本，直接输出。',
        '学习14天，8次，76条消息。掌握：反比例函数、一元二次方程；薄弱：二次函数、圆。',
        max_tokens=512,
    )
    print('耗时 %.1fs | 回复 %d 字符' % (dur, length))
    if length > 0:
        print('内容预览:', content[:80].replace('\n', ' '))
    else:
        print('失败:', content)


if __name__ == '__main__':
    main()
