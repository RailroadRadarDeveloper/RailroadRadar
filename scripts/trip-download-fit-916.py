from pathlib import Path

OLD = '''      const srcAspect = srcW / srcH;
      const destAspect = targetW / targetH;
      let sx = 0, sy = 0, sw = srcW, sh = srcH;
      if (srcAspect > destAspect) {
        sw = srcH * destAspect;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / destAspect;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);'''

NEW = '''      const srcAspect = srcW / Math.max(1, srcH);
      const destAspect = targetW / targetH;
      let dw, dh, dx, dy;
      if (srcAspect > destAspect) {
        dw = targetW;
        dh = targetW / srcAspect;
        dx = 0;
        dy = (targetH - dh) / 2;
      } else {
        dh = targetH;
        dw = targetH * srcAspect;
        dy = 0;
        dx = (targetW - dw) / 2;
      }
      ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);'''

OLD_SHARE = '''        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          await navigator.share({
            files: [file],
            title: 'RailroadRadar trip',
            text: 'My trip on RailroadRadar'
          });
          return 'shared';
        }
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'aborted';
      }
      tripDownloadPngBlob(blob, filename);
      return 'downloaded';'''

NEW_SHARE = '''        tripDownloadPngBlob(blob, filename);
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          try {
            await navigator.share({
              files: [file],
              title: 'RailroadRadar trip',
              text: 'My trip on RailroadRadar'
            });
            return 'shared';
          } catch (e) {
            if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'downloaded';
          }
        }
      } catch (e) {
        tripDownloadPngBlob(blob, filename);
      }
      return 'downloaded';'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    else:
        print('fit block missing', path)
    if OLD_SHARE in t:
        t = t.replace(OLD_SHARE, NEW_SHARE, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
