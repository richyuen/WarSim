# Crop and enlarge: python critic/scripts/c5_crop.py in.png out.png x y w h [scale]
import sys
from PIL import Image
a = sys.argv
im = Image.open(a[1]); x, y, w, h = map(int, a[3:7]); s = int(a[7]) if len(a) > 7 else 3
im.crop((x, y, x + w, y + h)).resize((w * s, h * s), Image.NEAREST).save(a[2])
