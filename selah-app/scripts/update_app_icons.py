import os
import base64
from PIL import Image

source_image_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\c7fa2811-dc1d-4752-b3e9-2ea78e864fd9\media__1785289997598.png"
src_img = Image.open(source_image_path).convert("RGBA")

app_dir = r"c:\Users\Admin\Desktop\Selah\Selah\selah-app"
public_dir = os.path.join(app_dir, "public")
res_dir = os.path.join(app_dir, r"android\app\src\main\res")

# 1. Update public web icons
# public/icon.png (512x512)
src_img.save(os.path.join(public_dir, "icon.png"), "PNG")
# public/favicon.png (512x512)
src_img.save(os.path.join(public_dir, "favicon.png"), "PNG")
# public/apple-touch-icon.png (180x180)
apple_icon = src_img.resize((180, 180), Image.Resampling.LANCZOS)
apple_icon.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")

# 2. Update public/favicon.svg with embedded image for exact SVG fidelity
with open(source_image_path, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,{b64_data}" width="512" height="512"/>
</svg>
'''
with open(os.path.join(public_dir, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(svg_content)

# 3. Android mipmap sizes
mipmap_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for mipmap_folder, size in mipmap_sizes.items():
    folder_path = os.path.join(res_dir, mipmap_folder)
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    
    resized = src_img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Save standard launcher icon
    resized.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
    # Save round launcher icon
    resized.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
    # Save foreground adaptive launcher icon
    resized.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")

print("Successfully updated all web and Android app & launcher icons!")
