import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const assets = resolve(root, "assets");
await mkdir(assets, { recursive: true });

const source = resolve(root, "assets", "icon-source.png");

// App icon：1024 透明底，人物图标居中，四周留出 adaptive icon 的安全边距。
const logo = await sharp(source)
  .resize(760, 760, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: logo, left: 132, top: 132 }])
  .png()
  .toFile(resolve(assets, "icon.png"));

// 启动图：黑红背景 + 图标 + 应用名。
const splashSvg = Buffer.from(`
<svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="78%">
      <stop offset="0%" stop-color="#2b0b12"/>
      <stop offset="48%" stop-color="#12060a"/>
      <stop offset="100%" stop-color="#050304"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d21f3c" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#d21f3c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <ellipse cx="1366" cy="1120" rx="820" ry="700" fill="url(#glow)"/>
  <text x="1366" y="1900" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="132" font-weight="700" fill="#ff6b7a" letter-spacing="24">魔女小屋</text>
  <text x="1366" y="2010" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="#c79aa4" letter-spacing="18">MONOSABA</text>
</svg>`);

await sharp(splashSvg)
  .composite([
    {
      input: await sharp(source).resize(620, 620, { fit: "contain" }).png().toBuffer(),
      left: 1056,
      top: 700,
    },
  ])
  .png()
  .toFile(resolve(assets, "splash.png"));

console.log("assets generated");
