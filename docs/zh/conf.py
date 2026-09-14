# -----------------------------------------------------------------------------------------------------------
# Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# -----------------------------------------------------------------------------------------------------------
import os
import sys

# 将项目根目录加入 Python 路径
sys.path.insert(0, os.path.abspath('.'))

# -- General configuration ------------------------------------------------
# 避免构建失败的虚拟导入
autodoc_mock_imports = ["torch"]

# 项目基本信息
project = "PyPTO Toolkit"
html_title = "PyPTO Toolkit文档"
copyright = "2025-2026 Huawei Technologies Co., Ltd. All Rights Reserved."

# 指定主文档
master_doc = 'index'

# 扩展列表
extensions = [
    "sphinx_tabs.tabs",          # 标签页
    "sphinx_toolbox.collapse",   # 折叠块
    "sphinxcontrib.httpdomain",  # HTTP 接口文档
    "sphinx.ext.napoleon",       # Docstring 解析
    "sphinx.ext.intersphinx",    # 跨文档链接
    "sphinx_reredirects",        # 页面重定向
    "sphinx.ext.mathjax",        # 数学公式
    "myst_parser",               # Markdown 解析
    "sphinx.ext.viewcode",       # 显示代码源文件链接
]

#source_suffix 配置
source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

# Myst 扩展配置
myst_enable_extensions = [
    "colon_fence",  # 支持 ``` 代码块
    "deflist",      # 支持定义列表
]

# 语言改为中文
language = "zh_CN"

# 排除目录
exclude_patterns = ["_build", "README.md"]

# 代码高亮风格
pygments_style = "sphinx"

# -- Options for HTML output ----------------------------------------------
# Furo 主题配置
html_theme = "furo"

html_theme_options = {
}

# 模板路径
templates_path = []


# 1. 告诉 Sphinx 去哪里找静态文件（通常是 '_static'）
html_static_path = ['../_static']

# 指定自定义 CSS 文件
html_css_files = [
    'custom.css',
]
