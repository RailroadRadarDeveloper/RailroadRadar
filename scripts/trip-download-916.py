from pathlib import Path

OLD_CSS = '''    #trip-detail-overlay.trip-detail-capturing .trip-detail-share-logo {
      display: block;
    }'''
NEW_CSS = '''    #trip-detail-overlay.trip-detail-capturing .trip-detail-share-logo {
      display: none !important;
    }'''

OLD_CANVAS = '''      const img = await tripLoadImage(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        const logoSrc = tripShareLogoSrc();
        // Keep DOM logo in sync for capture pass
        try {
          const domLogo = document.getElementById('trip-detail-share-logo');
          if (domLogo && logoSrc) domLogo.src = logoSrc;
        } catch (_) {}
        const logo = await tripLoadImage(logoSrc);
        const natW = logo.naturalWidth || logo.width || 1;
        const natH = logo.naturalHeight || logo.height || 1;
        const aspect = natW / natH;
        /* Trip share logo bigger */
        // Wordmark ~10–12% of min canvas side (~2x prior); still no plate
        const minSide = Math.min(canvas.width, canvas.height);
        let logoH = Math.round(minSide * 0.11);
        logoH = Math.max(40, Math.min(96, logoH));
        let logoW = Math.round(logoH * aspect);
        const maxW = Math.round(canvas.width * 0.52);
        if (logoW > maxW) {
          logoW = maxW;
          logoH = Math.round(logoW / aspect);
        }
        const padX = Math.max(14, Math.round(canvas.width * 0.022));
        const padY = Math.max(12, Math.round(canvas.height * 0.018));
        const x = canvas.width - logoW - padX;
        const y = canvas.height - logoH - padY;
        // No background plate — just the logo pixels (transparent around wordmark)
        ctx.drawImage(logo, x, y, logoW, logoH);
      } catch (logoErr) {
        console.warn('[trip-share] logo overlay skipped', logoErr);
      }'''

NEW_CANVAS = '''      const img = await tripLoadImage(dataUrl);
      const srcW = img.naturalWidth || img.width || 1;
      const srcH = img.naturalHeight || img.height || 1;
      const targetW = 1080;
      const targetH = 1920; // 9:16
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#07093e';
      ctx.fillRect(0, 0, targetW, targetH);
      const srcAspect = srcW / srcH;
      const destAspect = targetW / targetH;
      let sx = 0, sy = 0, sw = srcW, sh = srcH;
      if (srcAspect > destAspect) {
        sw = srcH * destAspect;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / destAspect;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      try {
        const logoSrc = tripShareLogoSrc();
        const logo = await tripLoadImage(logoSrc);
        const natW = logo.naturalWidth || logo.width || 1;
        const natH = logo.naturalHeight || logo.height || 1;
        const aspect = natW / Math.max(1, natH);
        let logoW = Math.round(targetW * 0.42);
        let logoH = Math.round(logoW / aspect);
        const maxH = Math.round(targetH * 0.08);
        if (logoH > maxH) {
          logoH = maxH;
          logoW = Math.round(logoH * aspect);
        }
        const padX = Math.round(targetW * 0.045);
        const padY = Math.round(targetH * 0.03);
        ctx.drawImage(logo, targetW - logoW - padX, targetH - logoH - padY, logoW, logoH);
      } catch (logoErr) {
        console.warn('[trip-share] logo overlay skipped', logoErr);
      }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_CSS in t:
        t = t.replace(OLD_CSS, NEW_CSS, 1)
    if OLD_CANVAS in t:
        t = t.replace(OLD_CANVAS, NEW_CANVAS, 1)
    else:
        print('canvas block not exact in', path)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
