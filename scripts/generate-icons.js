const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 微信官方推荐 tabBar 图标尺寸：81x81px（高DPI屏幕清晰显示）
const ICON_SIZE = 81;
const OUTPUT_DIR = path.join(__dirname, '../miniprogram/images/icons');

// 品牌颜色 - 粉色系主题
const COLORS = {
  default: '#9B9B9B',       // 默认态：中性灰色
  active: '#FF7EB3',        // 选中态：品牌粉色
  fill: '#FFE4EC',          // 填充色：浅粉色
  stroke: '#FF7EB3'         // 描边色：品牌粉色
};

// 图标 SVG 定义 - 现代扁平化设计风格
const icons = {
  chat: {
    name: 'chat',
    svg: (isActive) => {
      const color = isActive ? COLORS.active : COLORS.default;
      const bgColor = isActive ? COLORS.fill : 'transparent';
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="18" rx="4" fill="${bgColor}" stroke="${color}" stroke-width="2"/>
          <path d="M6 10h12M6 14h8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <circle cx="9" cy="7" r="1.5" fill="${color}"/>
          <circle cx="15" cy="7" r="1.5" fill="${color}"/>
        </svg>
      `.trim();
    }
  },
  summary: {
    name: 'summary',
    svg: (isActive) => {
      const color = isActive ? COLORS.active : COLORS.default;
      const bgColor = isActive ? COLORS.fill : 'transparent';
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="${bgColor}" stroke="${color}" stroke-width="2"/>
          <line x1="7" y1="9" x2="17" y2="9" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="7" y1="12" x2="14" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="7" y1="15" x2="12" y2="15" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <rect x="15" y="13" width="4" height="4" rx="1" fill="${color}"/>
        </svg>
      `.trim();
    }
  },
  memory: {
    name: 'memory',
    svg: (isActive) => {
      const color = isActive ? COLORS.active : COLORS.default;
      const bgColor = isActive ? COLORS.fill : 'transparent';
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-6-5z" fill="${bgColor}" stroke="${color}" stroke-width="2"/>
          <path d="M14 2v6h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="8" y1="13" x2="16" y2="13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="8" y1="17" x2="16" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <circle cx="10" cy="9" r="1" fill="${color}"/>
        </svg>
      `.trim();
    }
  },
  settings: {
    name: 'settings',
    svg: (isActive) => {
      const color = isActive ? COLORS.active : COLORS.default;
      const bgColor = isActive ? COLORS.fill : 'transparent';
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" fill="${color}"/>
          <circle cx="12" cy="12" r="7" fill="${bgColor}" stroke="${color}" stroke-width="2"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `.trim();
    }
  }
};

async function generateIcon(name, svgContent, isActive) {
  const suffix = isActive ? '-active' : '';
  const outputPath = path.join(OUTPUT_DIR, `${name}${suffix}.png`);
  
  try {
    await sharp(Buffer.from(svgContent))
      .resize(ICON_SIZE, ICON_SIZE)
      .png({
        quality: 100,
        compressionLevel: 0
      })
      .toFile(outputPath);
    
    console.log(`✓ ${name}${suffix}.png (${ICON_SIZE}x${ICON_SIZE})`);
  } catch (error) {
    console.error(`✗ 生成图标失败 ${name}${suffix}.png:`, error);
    throw error;
  }
}

async function main() {
  console.log('开始生成导航栏图标...');
  console.log(`输出目录: ${OUTPUT_DIR}`);
  console.log(`图标尺寸: ${ICON_SIZE}x${ICON_SIZE}（微信官方推荐）`);
  console.log('');

  for (const [key, icon] of Object.entries(icons)) {
    // 生成默认态图标（灰色）
    await generateIcon(icon.name, icon.svg(false), false);
    
    // 生成选中态图标（粉色填充+描边）
    await generateIcon(icon.name, icon.svg(true), true);
  }

  console.log('');
  console.log('✅ 所有图标生成完成！');
}

main().catch(err => {
  console.error('❌ 图标生成失败:', err);
  process.exit(1);
});
