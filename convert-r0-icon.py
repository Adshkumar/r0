from PIL import Image
import sys

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
im.seek(0)
im.convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS).save(dst)
print("Converted icon:", dst, Image.open(dst).size)
