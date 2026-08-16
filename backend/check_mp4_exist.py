import os
import sqlite3

VIDEOS_DIR = 'static/videos'

# List all MP4 files in directory
mp4_files = [f for f in os.listdir(VIDEOS_DIR) if f.endswith('.mp4')]
print(f'MP4 files in {VIDEOS_DIR}:')
for f in mp4_files:
    print(f'  {f}')

# Check database
conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()
c.execute('SELECT id, filename FROM videos')
db_videos = c.fetchall()

print('\nVideos in database:')
for video_id, filename in db_videos:
    exists = os.path.exists(os.path.join(VIDEOS_DIR, filename))
    print(f'  ID {video_id}: {filename} - {"EXISTS" if exists else "MISSING"}')

conn.close()
