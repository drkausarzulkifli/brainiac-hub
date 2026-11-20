from pathlib import Path
import zipfile, hashlib, json, re

root = Path(__file__).resolve().parent
out = root.parent / 'brainiac-hub-hostinger-LOGIN-DATABASE.zip'
private_files = ['bootstrap.php', 'schema.sql', 'config.example.php', '.htaccess']
public = root / 'public'
html = (public / 'index.html').read_text(encoding='utf-8')
for asset in re.findall(r'(?:src|href)="(/[^"#]+)"', html):
    if asset == '/':
        continue
    assert (public / asset.split('?')[0].lstrip('/')).is_file(), asset
app = (public / 'app.js').read_text(encoding='utf-8')
initial = json.loads(re.search(r'const initial=(.*?);', app).group(1))
assert len(initial) == 11 and all(v == [] for v in initial.values())
assert 'localStorage' not in app
assert 'id="demo-role"' not in html
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(public.rglob('*')):
        if path.is_file():
            assert path.suffix.lower() not in ['.sqlite', '.sql', '.zip', '.log', '.bak']
            z.write(path, 'public_html/' + path.relative_to(public).as_posix())
    for name in private_files:
        z.write(root / 'brainiac-private' / name, 'brainiac-private/' + name)
with zipfile.ZipFile(out) as z:
    assert 'brainiac-private/config.php' not in z.namelist()
    assert not any('tests/' in p for p in z.namelist())
print(json.dumps({'archive': str(out), 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'empty_collections': len(initial), 'credentials_included': False}, indent=2))
