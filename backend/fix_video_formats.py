import sqlite3
import os

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

# Get all videos
c.execute('SELECT id, filename FROM videos')
videos = c.fetchall()

print('Updating video filenames from .avi to .mp4...')
for video_id, filename in videos:
    if filename.endswith('.avi'):
        # Change .avi to .mp4
        new_filename = filename[:-4] + '.mp4'
        print(f'Video ID {video_id}: {filename} -> {new_filename}')
        
        # Update database
        c.execute('UPDATE videos SET filename = ? WHERE id = ?', (new_filename, video_id))

conn.commit()
print('Done! Updated video filenames.')

# Verify
c.execute('SELECT id, filename, camera_id, status FROM videos')
print('\nUpdated videos in DB:')
for row in c.fetchall():
    print(row)

conn.close()
