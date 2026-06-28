from pathlib import Path

root = Path.cwd()
files = [
    root / 'frontend' / 'index.html',
    root / 'frontend' / 'style.css',
    root / 'frontend' / 'script.js',
    root / 'frontend' / 'blackline-config.js',
    root / 'frontend' / 'firebase-data.js',
    root / 'frontend' / 'firebase-config.js',
]

replacements = [
    ('Ã§', 'ç'), ('Ã£', 'ã'), ('Ã¡', 'á'), ('Ã©', 'é'), ('Ã­', 'í'), ('Ã³', 'ó'), ('Ãº', 'ú'),
    ('Ãª', 'ê'), ('Ã´', 'ô'), ('Ã¶', 'ö'), ('Ã¼', 'ü'), ('Ã ', 'à'), ('Ã¨', 'è'), ('Ã¬', 'ì'),
    ('Ã²', 'ò'), ('Ã¹', 'ù'), ('Ã±', 'ñ'), ('Ã‡', 'Ç'), ('Ãƒ', 'Ã'), ('Ã‰', 'É'), ('Ã“', 'Ó'),
    ('Ãš', 'Ú'), ('Ã‘', 'Á'), ('ÃŒ', 'Í'), ('Ã€', 'À'), ('Ãˆ', 'È'), ('ÃŠ', 'Ê'), ('Ã‹', 'Ë'),
    ('ÃŽ', 'Î'), ('Ã', 'Ï'), ('Ã”', 'Ô'), ('Ã•', 'Õ'), ('Ã–', 'Ö'), ('Ã™', 'Ù'), ('Ã›', 'Û'),
    ('Ãœ', 'Ü'), ('ÃŸ', 'ß'), ('Â ', ' '), ('Â', ''), ('â€¢', '•'), ('â€™', '’'), ('â€“', '–'),
    ('â€œ', '“'), ('â€', '”'), ('â€¦', '…'), ('�', ''), ('â€', '“')
]

for path in files:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    for old, new in replacements:
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')
    print(f'fixed {path.relative_to(root)}')
