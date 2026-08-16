import sys
sys.path.insert(0, '.')
from app.config import DB_PATH
import sqlite3
print('db path', DB_PATH)
conn = sqlite3.connect(str(DB_PATH))
c = conn.cursor()
c.execute('select name from sqlite_master where type="table"')
print('tables:', c.fetchall())
c.execute('select count(*) from videos')
print('videos', c.fetchone()[0])
c.execute('select count(*) from detections')
print('detections', c.fetchone()[0])
c.execute('select id,video_id,camera_id,track_id,frame_number,timestamp,image_path from detections limit 5')
print('sample detections:', c.fetchall())
conn.close()
