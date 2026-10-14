from playwright.sync_api import sync_playwright
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
from pathlib import Path
import json, tempfile, os
root=Path(__file__).resolve().parent.parent
handler=partial(SimpleHTTPRequestHandler, directory=str(root))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
Thread(target=server.serve_forever,daemon=True).start()
try:
 with tempfile.TemporaryDirectory(prefix='canvas-proof-home-') as home, sync_playwright() as p:
  env=dict(os.environ);env['HOME']=home;env['XDG_CONFIG_HOME']=home;env['XDG_CACHE_HOME']=home
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,env=env)
  page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('window.spike !== undefined')
  assert page.evaluate('window.spike.getState().taps')==0
  page.mouse.click(140,300)
  assert page.evaluate('window.spike.getState().taps')==1
  assert page.evaluate('window.spike.getState().point.x')==140
  assert page.evaluate('document.querySelector("canvas").width')==780
  page.reload();page.wait_for_function('window.spike !== undefined')
  assert page.evaluate('window.spike.getState().taps')==1
  page.set_viewport_size({'width':480,'height':720});page.wait_for_timeout(150)
  assert page.evaluate('window.spikePlatform.getSize().width')==480
  page.screenshot(path=str(root/'artifacts/browser-proof.png'))
  assert not errors,errors
  report={'passed':['Chromium actual Canvas2D paint','pointer logical coordinate mapping','DPR=2 backing store','local storage restoration after reload','viewport resize','no uncaught browser errors'],'not_tested':['Douyin compiler/service','real tt host API','real mobile device','audio audibility','WeChat'],'errors':errors}
  (root/'artifacts/browser-tests.json').write_text(json.dumps(report,indent=2))
  print(json.dumps(report))
  browser.close()
finally:
 server.shutdown();server.server_close()
