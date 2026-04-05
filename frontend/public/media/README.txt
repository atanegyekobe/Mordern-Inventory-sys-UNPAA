Place your hero video files here.

Default filenames used by the Hero component:
- hero-visual.mp4
- hero-visual-2.mp4

Hero playback behavior:
- Plays each video in order
- After the last video, loops back to the first
- If a file fails, skips to the next video
- If all files fail, falls back to the animated scene

Optional explicit playlist (recommended):
NEXT_PUBLIC_HERO_VIDEO_PLAYLIST=/media/hero-visual.mp4,/media/hero-visual-2.mp4,/media/hero-visual-3.mp4

Legacy single-video override is still supported:
NEXT_PUBLIC_HERO_VIDEO_URL=/media/your-file.mp4
