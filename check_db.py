import sqlite3, json, os

for path in ['backend/.data/medora.sqlite3', 'backend/medora.db', 'backend/.preview-practice/medora.sqlite3']:
    if not os.path.exists(path):
        continue
    print('=== DB:', path)
    db = sqlite3.connect(path)
    cur = db.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print('Tables:', tables)
    if 'workspaces' in tables:
        for row in cur.execute('SELECT owner_id, version, data FROM workspaces').fetchall():
            owner, ver, data_str = row
            d = json.loads(data_str)
            print(f'Owner: {owner}, Version: {ver}')
            tasks = d.get('tasks', [])
            print(f'  Tasks count: {len(tasks)}')
            for i, t in enumerate(tasks):
                print(f'    Task {i}: {t}')
