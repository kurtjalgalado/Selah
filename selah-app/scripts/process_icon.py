import os
from PIL import Image

input_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\ccdeb508-7063-49d8-bc9a-a510c93c385e\media__1785288409662.png"
if not os.path.exists(input_path):
    print(f"Error: input file {input_path} not found")
    exit(1)

img = Image.open(input_path).convert("RGBA")
width, height = img.size
pixels = img.load()

# Remove white border / outer white pixels
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Pure/near white outer pixels (r, g, b > 240)
        if r > 240 and g > 240 and b > 240:
            pixels[x, y] = (255, 255, 255, 0)

# Bounding box crop of non-transparent region
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Add padding to make square if needed
w, h = img.size
max_dim = max(w, h)
square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
square_img.paste(img, ((max_dim - w) // 2, (max_dim - h) // 2))

# Save processed high-res icon
processed_path = r"c:\Users\Admin\Desktop\Selah\Selah\selah-app\public\icon.png"
os.makedirs(os.path.dirname(processed_path), exist_ok=True)
square_img.save(processed_path, "PNG")
square_img.save(r"c:\Users\Admin\Desktop\Selah\Selah\selah-app\public\favicon.png", "PNG")
square_img.save(r"c:\Users\Admin\Desktop\Selah\Selah\selah-app\public\apple-touch-icon.png", "PNG")

print(f"Processed master icon saved to {processed_path}")

# Android mipmap targets
res_dir = r"c:\Users\Admin\Desktop\Selah\Selah\selah-app\android\app\src\main\res"
mipmap_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, size in mipmap_sizes.items():
    target_folder = os.path.join(res_dir, folder)
    os.makedirs(target_folder, exist_ok=True)
    resized = square_img.resize((size, size), Image.Resampling.LANCZOS)
    
    for filename in ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]:
        target_path = os.path.join(target_folder, filename)
        resized.save(target_path, "PNG")
        print(f"Saved {target_path} ({size}x{size})")

print("All launcher icons updated successfully!")
