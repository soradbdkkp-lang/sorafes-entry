import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const bundle = await build({ entryPoints: ['src/App.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react', 'react/jsx-runtime', 'react-dom'] });
function mount(now = '2026-10-24T14:00:00Z') {
  const slots = [], effects = []; let cursor = 0, tree;
  const calls = [];
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((x,j) => x !== slots[i][j])) effects.push(effect); slots[i] = deps; },
  };
  const module = { exports: {} };
  new Function('require','module','exports','window','Date',bundle.outputFiles[0].text)(name => name === 'react' ? hooks : require(name), module, module.exports, {setInterval() {return 1;}, clearInterval() {}}, class extends Date { static now() { return Date.parse(now); } });
  const nodes = (n=tree) => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(x=>nodes(x)) : [n,...nodes(n.props?.children ?? null)];
  const text = n => Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.props?.children) : String(n??'');
  const render = () => {
    cursor=0; tree=module.exports.default({localMode:true,productionMode:true});
    nodes().find(n=>n.type==='h2' && n.props.ref).props.ref.current={focus: opts=>calls.push(['focus',opts]),scrollIntoView: opts=>calls.push(['scroll',opts])};
    while(effects.length) effects.shift()();
  };
  const click = label => { const b=nodes().find(n=>n.type==='button' && text(n).trim()===label); assert.ok(b,label); b.props.onClick(); render(); };
  render();
  const controller = () => nodes().find(n=>typeof n.type==='function' && 'ready' in n.props);
  return {nodes,text,render,click,calls,controller};
}
test('各STEPの次へ・戻るは新STEP見出しへ移動し既存応募パネルはSTEP外に置く',()=>{
  const ui=mount();
  const draft={kind:'solo',count:1,teamName:'',representative:0,time:'16:00開始でも参加可能',players:[{name:'架空',xId:'fiction',platform:'Steam',otherPlatform:'',gameId:'Fiction#0000',hours:'10',killer:false,duty:'',killers:[],favorite:'',dif:'no',dck:'no',other:'no',difDetails:{},dckDetails:{},histories:[]}]};
  ui.controller().props.load(draft);ui.render();
  ui.click('8入力内容確認'); ui.click('1参加前確認');
  for(let i=0;i<7;i++) {ui.click(i===6?'確認画面へ →':'次へ →'); assert.match(ui.text(ui.nodes().find(n=>n.type==='h2')),new RegExp(['応募形式','応募・チーム情報','プレイヤー情報','担当ロール','大会実績','参加可能時間','入力内容確認'][i]));}
  for(let i=0;i<7;i++)ui.click('戻る');
  const panel=ui.nodes().find(n=>n.type==='section' && n.props.className==='form-panel');
  assert.equal(ui.nodes(panel).includes(ui.controller()),false);
  assert.ok(ui.controller().props.reviewTarget !== undefined);
  for(const [action,opts] of ui.calls)assert.deepEqual(opts,action==='focus'?{preventScroll:true}:{block:'start',behavior:'instant'});
  assert.equal(ui.calls.filter(x=>x[0]==='scroll').length,17);
});
test('STEP 8の各修正リンクの移動先でもSTEP先頭へのスクロールを実行する',()=>{
  const ui=mount();
  // Review's edit callback is shared by all section correction buttons.
  const edit=()=>ui.nodes().find(n=>typeof n.type==='function' && 'edit' in n.props).props.edit;
  ui.controller().props.load({kind:'solo',count:1,teamName:'',representative:0,time:'',players:[]});ui.render();
  for(const target of [1,2,3,4,5,6]) {edit()(target);ui.render();assert.deepEqual(ui.calls.at(-1),['scroll',{block:'start',behavior:'instant'}]);ui.controller().props.load({kind:'solo',count:1,teamName:'',representative:0,time:'',players:[]});ui.render();}
});


test('追加募集では1人・2人だけを選べ、他形式は受付終了と表示する', () => {
  const ui = mount('2026-10-24T15:00:00Z');
  ui.click('2応募形式');
  const choices = ui.nodes().filter(n => n.type === 'input' && n.props.name === 'entry');
  assert.deepEqual(choices.map(n => Boolean(n.props.disabled)), [true, false, false, true, true]);
  assert.match(ui.text(ui.nodes()), /追加募集中/);
  assert.match(ui.text(ui.nodes()), /受付終了/);
});
