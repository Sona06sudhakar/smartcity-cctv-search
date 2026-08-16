import sqlite3
import os

VIDEOS_DIR = 'static/videos'

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

# Get all videos
c.execute('SELECT id, filename FROM videos')
videos = c.fetchall()

print('Removing database entries for missing video files...')
removed_count = 0
for video_id, filename in videos:
    filepath = os.path.join(VIDEOS_DIR, filename)
    if not os.path.exists(filepath):
        print(f'Removing video ID {video_id}: {filename} (file missing)')
        c.execute('DELETE FROM videos WHERE id = ?', (video_id,))
        removed_count += 1

conn.commit()
print(f'Removed {removed_count} missing video entries from database.')

# Verify remaining videos
c.execute('SELECT id, filename, camera_id, status FROM videos')
print('\nRemaining videos in DB:')
for row in c.fetchall():
    print(row)

conn.close()
