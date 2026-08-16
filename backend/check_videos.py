import sqlite3
conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()
c.execute('SELECT id, filename, camera_id, status FROM videos')
print('Videos in DB:')
for row in c.fetchall():
    print(row)
conn.close()
