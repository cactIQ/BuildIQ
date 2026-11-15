"""Render-inspect harness (WorldClaw-style diagnostic renders).

For each view: load ?shot=1&view=X (frozen time, no UI) at the reference aspect, wait for window.__ready,
screenshot, build a side-by-side compare sheet with the internal reference (_internal/refs/<ref>.png), diff against
the previous round, and collect console errors + window.__report into shots/r<N>/report.json.

Usage:
  python tools/shoot.py                      # next round, default views, headless real GPU (d3d11)
  python tools/shoot.py --views hero,pool    # subset
  python tools/shoot.py --debug ids          # extra diagnostic pass (ids|normals|overdraw)
  python tools/shoot.py --swiftshader        # software GL (structure only; not for colour/perf judgement)
  python tools/shoot.py --perf               # headed Chrome, real GPU, frame-time median/p95 per view
  python tools/shoot.py --round 3 --query "tod=0.65"
Outputs are internal (shots/ is git-ignored and never deployed).
"""
import argparse
import functools
import json
import os
import sys
import threading
import time

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import serve  # noqa: E402

REFS = {'elevation': 'A', 'aerial': 'B', 'aerialN': 'C', 'pool': 'D', 'clubhouse': 'E', 'gym': 'F'}
ASPECT = {'A': 1160 / 794, 'B': 655 / 531, 'C': 619 / 538, 'D': 1160 / 638, 'E': 1160 / 653, 'F': 1160 / 633}
DEFAULT_VIEWS = ['hero', 'elevation', 'aerial', 'aerialN', 'pool', 'clubhouse']
WIDTH = 1600


def start_server():
    handler = functools.partial(serve.Handler, directory=ROOT)
    httpd = serve.Server(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}/'


def next_round(base):
    os.makedirs(base, exist_ok=True)
    nums = [int(d[1:]) for d in os.listdir(base) if d.startswith('r') and d[1:].isdigit()]
    return (max(nums) + 1) if nums else 1


def font(size):
    for f in ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def compare_sheet(ref_path, shot_path, out_path, title):
    shot = Image.open(shot_path).convert('RGB')
    h = 720
    shot_r = shot.resize((round(shot.width * h / shot.height), h))
    tiles = [shot_r]
    if ref_path and os.path.exists(ref_path):
        ref = Image.open(ref_path).convert('RGB')
        tiles.insert(0, ref.resize((round(ref.width * h / ref.height), h)))
    pad, top = 16, 48
    W = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
    sheet = Image.new('RGB', (W, h + top + pad), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 12), title, fill=(230, 230, 230), font=font(22))
    x = pad
    for i, t in enumerate(tiles):
        sheet.paste(t, (x, top))
        label = ('REFERENCE' if (len(tiles) == 2 and i == 0) else 'RENDER')
        d.text((x + 8, top + 8), label, fill=(255, 220, 120), font=font(18))
        x += t.width + pad
    sheet.save(out_path)


def mean_diff(a_path, b_path):
    if not (os.path.exists(a_path) and os.path.exists(b_path)):
        return None
    a, b = Image.open(a_path).convert('RGB'), Image.open(b_path).convert('RGB')
    if a.size != b.size:
        b = b.resize(a.size)
    return round(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3, 2)


def chrome_args(swiftshader, perf):
    if swiftshader:
        return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    args = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
    if perf:
        args += ['--disable-gpu-vsync', '--disable-frame-rate-limit']
    return args


PERF_JS = """async (frames) => {
  await new Promise(r => setTimeout(r, 2000));
  const t = []; let last = performance.now();
  await new Promise(res => { function f(){ const n = performance.now(); t.push(n - last); last = n; if (t.length < frames) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
  t.sort((a,b)=>a-b);
  const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { median: t[t.length>>1], p95: t[Math.floor(t.length*0.95)], frames: t.length,
           gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', report: window.app ? window.app.report() : null };
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--views', default=','.join(DEFAULT_VIEWS))
    ap.add_argument('--round', type=int, default=0)
    ap.add_argument('--debug', default='')
    ap.add_argument('--query', default='')
    ap.add_argument('--swiftshader', action='store_true')
    ap.add_argument('--perf', action='store_true')
    ap.add_argument('--timeout', type=int, default=180)
    a = ap.parse_args()

    from playwright.sync_api import sync_playwright

    base = os.path.join(ROOT, 'shots')
    rnd = a.round or next_round(base)
    out = os.path.join(base, f'r{rnd}')
    prev = os.path.join(base, f'r{rnd - 1}')
    os.makedirs(out, exist_ok=True)
    httpd, url = start_server()
    views = [v for v in a.views.split(',') if v]
    results = {'round': rnd, 'mode': 'perf' if a.perf else ('swiftshader' if a.swiftshader else 'gpu-headless'),
               'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'views': {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=not a.perf, args=chrome_args(a.swiftshader, a.perf))
        for v in views:
            ref = REFS.get(v)
            w = WIDTH
            h = round(WIDTH / ASPECT[ref]) if ref else round(WIDTH * 9 / 16)
            page = browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
            logs = []
            page.on('console', lambda m, logs=logs: logs.append({'type': m.type, 'text': m.text[:500]}) if m.type in ('error', 'warning') else None)
            page.on('pageerror', lambda e, logs=logs: logs.append({'type': 'pageerror', 'text': str(e)[:500]}))
            q = f'view={v}&q=high' + ('' if a.perf else '&shot=1') + (f'&debug={a.debug}' if a.debug else '') + (f'&{a.query}' if a.query else '')
            t0 = time.time()
            entry = {'url': url + '?' + q}
            try:
                page.goto(url + '?' + q, wait_until='load', timeout=a.timeout * 1000)
                page.wait_for_function('window.__ready === true', timeout=a.timeout * 1000)
                page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
                entry['loadS'] = round(time.time() - t0, 1)
                if a.perf:
                    entry['perf'] = page.evaluate(PERF_JS, 300)
                    if any(s in str(entry['perf'].get('gpu', '')) for s in ('SwiftShader', 'Basic Render')):
                        entry['perfInvalid'] = 'software renderer'
                else:
                    suffix = f'.{a.debug}' if a.debug else ''
                    shot = os.path.join(out, f'{v}{suffix}.png')
                    page.screenshot(path=shot)
                    entry['report'] = page.evaluate('() => window.app ? window.app.report() : window.__report')
                    refp = os.path.join(ROOT, '_internal', 'refs', f'{ref}.png') if ref else None
                    compare_sheet(refp, shot, os.path.join(out, f'{v}{suffix}.compare.png'), f'Round {rnd} - {v}' + (f' (ref {ref})' if ref else '') + suffix)
                    entry['diffPrev'] = mean_diff(shot, os.path.join(prev, f'{v}{suffix}.png'))
            except Exception as e:  # noqa: BLE001
                entry['error'] = str(e)[:800]
                try:
                    page.screenshot(path=os.path.join(out, f'{v}.error.png'))
                except Exception:  # noqa: BLE001
                    pass
            entry['console'] = logs
            entry['consoleErrors'] = sum(1 for l in logs if l['type'] in ('error', 'pageerror'))
            results['views'][v] = entry
            page.close()
            status = 'ERR' if 'error' in entry else 'ok'
            extra = entry.get('perf') or {k: entry.get('report', {}).get(k) for k in ('drawCalls', 'triangles', 'programs', 'ttiMs')} if entry.get('report') or entry.get('perf') else ''
            print(f'[{status}] {v}: load {entry.get("loadS")}s, console errors {entry["consoleErrors"]}, {extra}')
        browser.close()
    httpd.shutdown()
    # merge with earlier invocations of the same round (e.g. a separate night or debug pass)
    rp = os.path.join(out, 'report.json')
    if os.path.exists(rp):
        try:
            with open(rp, encoding='utf-8') as f:
                prev_rep = json.load(f)
            for k, v in results['views'].items():
                prev_rep.setdefault('views', {})[k + (f'.{a.debug}' if a.debug else '') + (f' [{a.query}]' if a.query else '')] = v
            results = prev_rep
        except (OSError, ValueError):
            pass
    else:
        if a.debug or a.query:
            results['views'] = {k + (f'.{a.debug}' if a.debug else '') + (f' [{a.query}]' if a.query else ''): v for k, v in results['views'].items()}
    with open(rp, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print('Saved', out)


if __name__ == '__main__':
    main()
