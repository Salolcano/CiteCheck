"""Inline shared helpers into the single Intelligent Contract: contracts/citecheck.py (Studio runner 1jb45aa8...)."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
HEADER = '# v0.2.16\n# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\n\n'
(root / 'contracts').mkdir(exist_ok=True)
common = (root / 'contracts-src/common.py').read_text(encoding='utf-8')
body = (root / 'contracts-src/citecheck.py').read_text(encoding='utf-8')
(root / 'contracts/citecheck.py').write_text(HEADER + common + '\n\n' + body, encoding='utf-8')
print('built contracts/citecheck.py')
