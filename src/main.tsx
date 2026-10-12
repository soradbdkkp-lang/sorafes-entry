import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Entries from './admin/Entries';
import Login from './admin/Login';
import './styles.css';

const params = new URLSearchParams(location.search);
const appsScriptMode = (globalThis as { __SORAFES_APPS_SCRIPT__?: boolean }).__SORAFES_APPS_SCRIPT__ === true;
const productionMode = import.meta.env.PROD || appsScriptMode;
const root = document.getElementById('root')!;
if (location.pathname === '/admin/login') {
  createRoot(root).render(<StrictMode><Login /></StrictMode>);
} else if (location.pathname === '/admin/entries') {
  createRoot(root).render(<StrictMode><Entries /></StrictMode>);
} else if (location.hostname === '127.0.0.1' && location.pathname === '/code.txt') {
  root.textContent = '転記データを準備しています。';
  void Promise.all(['code', 'index', 'manifest'].map(async name => {
    const response = await fetch(`/?deploy_file=${name}`, { cache: 'no-store' });
    if (!response.ok) throw Error('TRANSFER');
    return [name, await response.text()] as const;
  })).then(files => {
    root.textContent = '';
    for (const [name, value] of files) {
      const area = document.createElement('textarea');
      area.id = `transfer-${name}`;
      area.value = value;
      root.append(area);
    }
  }).catch(() => { root.textContent = '転記データを取得できません。'; });
} else {
  createRoot(root).render(<StrictMode><App
    localMode={productionMode || params.has('phase4') || params.has('phase5') || params.has('production-preview')}
    googleMode={params.get('phase4') === 'google'}
    phase5Mode={params.has('phase5')}
    productionPreview={params.has('production-preview')}
    productionMode={productionMode}
    appsScriptMode={appsScriptMode}
  /></StrictMode>);
}
