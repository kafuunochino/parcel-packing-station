// Exact native bundle + native Canvas; not phone/emulator screenshots.
import {harness} from '../test/native-viewport.test.js';
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';
const {createCanvas,GlobalFonts}=createRequire(import.meta.url)('@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','Noto Sans CJK SC');
const dir=new URL('../artifacts/native-viewport/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const [w,h]of [[390,844],[540,1200],[768,1024]]){
 const canvas=createCanvas(1,1),x=harness({screenWidth:w,screenHeight:h,windowWidth:320,windowHeight:568,pixelRatio:2,safeArea:{top:44,bottom:h-34,right:w,left:0}},canvas);
 x.tap('play');x.tap('briefStart');writeFileSync(new URL(`${w}-native-not-phone.png`,dir),canvas.toBuffer('image/png'));
}
